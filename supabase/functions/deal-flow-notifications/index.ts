// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};
// deal-flow-notifications v2.0 - Added deal_status_notifications table support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUCCESS_EMAIL = 'success@accessyourplace.com';
    const PLATFORM_URL = 'https://accessyourplace.com';
    const FROM_EMAIL = 'Access Your Place <notifications@accessyourplace.com>';

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

    const body = await req.json();
    const { action } = body;

    console.log('[deal-flow-notifications v2.0] Action:', action);

    // ==================== HELPER: Send email via Resend ====================
    async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
      if (!RESEND_API_KEY) { console.log('[deal-flow-notifications] No RESEND_API_KEY'); return false; }
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
        });
        if (!res.ok) { console.error('[deal-flow-notifications] Resend error:', res.status, await res.text()); return false; }
        const resData = await res.json();
        console.log('[deal-flow-notifications] Email sent to', to, 'id:', resData?.id);
        return true;
      } catch (e: any) { console.error('[deal-flow-notifications] Email error:', e.message); return false; }
    }

    // ==================== HELPER: Get staff info ====================
    async function getStaffInfo(staffId: string): Promise<any> {
      const url = `${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staffId}&select=id,email,name,first_name,last_name,department,role`;
      const res = await fetch(url, { headers: getH });
      const data = await res.json();
      return Array.isArray(data) ? data[0] : null;
    }

    function getStaffName(staff: any): string {
      if (!staff) return 'Team Member';
      if (staff.first_name) return `${staff.first_name} ${staff.last_name || ''}`.trim();
      if (staff.name) return staff.name;
      return 'Team Member';
    }

    // ==================== INSERT DEAL STATUS NOTIFICATION ====================
    // Called by update-property and am-submit-deal edge functions, or directly
    if (action === 'insert_deal_status_notification') {
      const {
        property_id, property_title, property_address, property_city, property_state,
        recipient_staff_id, recipient_staff_name, recipient_email,
        reviewer_staff_id, reviewer_staff_name,
        old_status, new_status, notification_type, message, metadata,
        send_email
      } = body;

      if (!property_id || !recipient_staff_id || !notification_type || !new_status) {
        return json({ success: false, error: 'property_id, recipient_staff_id, notification_type, and new_status are required' }, 400);
      }

      // Insert notification record
      const notifPayload = {
        property_id,
        property_title: property_title || null,
        property_address: property_address || null,
        property_city: property_city || null,
        property_state: property_state || null,
        recipient_staff_id,
        recipient_staff_name: recipient_staff_name || null,
        recipient_email: recipient_email || null,
        reviewer_staff_id: reviewer_staff_id || null,
        reviewer_staff_name: reviewer_staff_name || null,
        old_status: old_status || null,
        new_status,
        notification_type,
        message: message || `Deal status changed to ${new_status}`,
        is_read: false,
        email_sent: false,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications`, {
        method: 'POST', headers, body: JSON.stringify(notifPayload)
      });

      let notifId = null;
      if (insertRes.ok) {
        const insertData = await insertRes.json();
        notifId = insertData?.[0]?.id;
        console.log('[deal-flow-notifications] Notification inserted:', notifId);
      } else {
        const errText = await insertRes.text();
        console.error('[deal-flow-notifications] Insert error:', errText);
        return json({ success: false, error: 'Failed to insert notification: ' + errText.substring(0, 200) });
      }

      // Send email for critical statuses
      let emailSent = false;
      const criticalStatuses = ['deal_approved', 'deal_rejected', 'deal_published', 'deal_verified'];
      if (send_email !== false && criticalStatuses.includes(notification_type)) {
        // Resolve recipient email if not provided
        let toEmail = recipient_email;
        if (!toEmail && recipient_staff_id) {
          const staff = await getStaffInfo(recipient_staff_id);
          toEmail = staff?.email;
        }

        if (toEmail) {
          const recipientName = recipient_staff_name || 'Team Member';
          const dealLabel = property_title || property_address || 'Your Deal';
          const location = [property_city, property_state].filter(Boolean).join(', ');

          let statusColor = '#3b82f6';
          let statusLabel = new_status;
          let statusEmoji = '';
          let bodyText = '';

          switch (notification_type) {
            case 'deal_approved':
              statusColor = '#22c55e';
              statusLabel = 'Approved';
              statusEmoji = '';
              bodyText = `Great news! Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been <strong style="color:${statusColor};">approved</strong> by ${reviewer_staff_name || 'the Success Team'}. It has been verified and is ready for the next steps.`;
              break;
            case 'deal_rejected':
              statusColor = '#ef4444';
              statusLabel = 'Not Approved';
              statusEmoji = '';
              bodyText = `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} was <strong style="color:${statusColor};">not approved</strong> by ${reviewer_staff_name || 'the Success Team'}.${metadata?.denial_reason ? `<br/><br/><strong>Feedback:</strong> ${metadata.denial_reason}` : ''}`;
              break;
            case 'deal_published':
              statusColor = '#8b5cf6';
              statusLabel = 'Published';
              statusEmoji = '';
              bodyText = `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been <strong style="color:${statusColor};">published</strong> to the marketplace by ${reviewer_staff_name || 'the Success Team'}! It is now visible to investors.`;
              break;
            case 'deal_verified':
              statusColor = '#0ea5e9';
              statusLabel = 'Verified';
              statusEmoji = '';
              bodyText = `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been <strong style="color:${statusColor};">verified</strong> by ${reviewer_staff_name || 'the Success Team'}.`;
              break;
          }

          const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:${statusColor};margin:0;font-size:24px;font-weight:700;">${statusEmoji} Deal ${statusLabel}</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Deal Status Update</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${recipientName.split(' ')[0]},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">${bodyText}</p>
      <div style="background:linear-gradient(135deg,#f0f4f8 0%,#e8f0fe 100%);border:1px solid #d4e4f7;border-left:4px solid ${statusColor};border-radius:8px;padding:20px;margin:0 0 24px;">
        <p style="font-weight:700;color:#1a365d;margin:0 0 6px;font-size:17px;">${dealLabel}</p>
        ${location ? `<p style="color:#64748b;margin:0 0 8px;font-size:14px;">${location}</p>` : ''}
        <span style="display:inline-block;background:${statusColor};color:white;border-radius:20px;padding:4px 16px;font-size:13px;font-weight:600;">${statusLabel}</span>
        ${reviewer_staff_name ? `<p style="color:#94a3b8;margin:8px 0 0;font-size:12px;">Reviewed by: ${reviewer_staff_name}</p>` : ''}
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${PLATFORM_URL}/staff" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">View in Dashboard</a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Deal Flow Notifications</p>
    </div>
  </div>
</body></html>`;

          emailSent = await sendResendEmail(toEmail, `Deal ${statusLabel}: ${dealLabel}${location ? ` - ${location}` : ''}`, emailHtml);

          // Update notification with email status
          if (notifId) {
            await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?id=eq.${notifId}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null })
            });
          }
        }
      }

      return json({ success: true, notification_id: notifId, email_sent: emailSent });
    }

    // ==================== GET AM NOTIFICATIONS ====================
    if (action === 'get_am_notifications') {
      const { staff_id, limit: reqLimit, offset, unread_only } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id required' }, 400);

      const lim = Math.min(reqLimit || 30, 100);
      const off = offset || 0;

      let url = `${SUPABASE_URL}/rest/v1/deal_status_notifications?recipient_staff_id=eq.${staff_id}&order=created_at.desc&limit=${lim}&offset=${off}`;
      if (unread_only) url += '&is_read=eq.false';

      const res = await fetch(url, { headers: getH });
      const data = await res.json();
      const notifications = Array.isArray(data) ? data : [];

      // Also get total unread count
      const countUrl = `${SUPABASE_URL}/rest/v1/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false&select=id`;
      const countRes = await fetch(countUrl, { headers: getH });
      const countData = await countRes.json();
      const unreadCount = Array.isArray(countData) ? countData.length : 0;

      return json({ success: true, notifications, count: notifications.length, unread_count: unreadCount });
    }

    // ==================== GET AM UNREAD COUNT ====================
    if (action === 'get_am_unread_count') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id required' }, 400);

      const url = `${SUPABASE_URL}/rest/v1/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false&select=id`;
      const res = await fetch(url, { headers: getH });
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;

      return json({ success: true, unread_count: count });
    }

    // ==================== MARK AM NOTIFICATION(S) READ ====================
    if (action === 'mark_am_notification_read') {
      const { staff_id, notification_id, notification_ids, mark_all } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id required' }, 400);

      const now = new Date().toISOString();

      if (mark_all) {
        // Mark all unread notifications for this staff member as read
        await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ is_read: true, read_at: now, updated_at: now })
        });
        return json({ success: true, message: 'All notifications marked as read' });
      }

      if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
        // Mark specific notifications as read (with ownership check)
        for (const nid of notification_ids) {
          await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?id=eq.${nid}&recipient_staff_id=eq.${staff_id}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ is_read: true, read_at: now, updated_at: now })
          });
        }
        return json({ success: true, message: `${notification_ids.length} notification(s) marked as read` });
      }

      if (notification_id) {
        // Mark single notification as read (with ownership check)
        await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?id=eq.${notification_id}&recipient_staff_id=eq.${staff_id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ is_read: true, read_at: now, updated_at: now })
        });
        return json({ success: true, message: 'Notification marked as read' });
      }

      return json({ success: false, error: 'Provide notification_id, notification_ids, or mark_all=true' }, 400);
    }

    // ==================== DELETE OLD NOTIFICATIONS ====================
    if (action === 'cleanup_old_notifications') {
      const { days_old } = body;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days_old || 90));

      const delRes = await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?created_at=lt.${cutoff.toISOString()}&is_read=eq.true`, {
        method: 'DELETE', headers
      });

      return json({ success: true, message: `Cleaned up read notifications older than ${days_old || 90} days` });
    }

    // ==================== LEGACY: NEW DEAL SUBMITTED ====================
    if (action === 'new_deal_submitted') {
      const { property_id, property_title, property_address, property_city, property_state,
              submitted_by_staff_id, submitted_by_staff_name, bedrooms, bathrooms, monthly_rent,
              operation_type } = body;

      const propLabel = property_title || property_address || 'New Property';
      const propLocation = [property_city, property_state].filter(Boolean).join(', ');

      // 1. Create notification record in legacy table
      const notifPayload = {
        type: 'new_deal_submitted',
        property_id,
        property_title: propLabel,
        property_address,
        property_city,
        property_state,
        submitted_by_staff_id,
        submitted_by_staff_name: submitted_by_staff_name || 'Unknown AM',
        recipient_type: 'success_team',
        recipient_email: SUCCESS_EMAIL,
        message: `New deal submitted by ${submitted_by_staff_name || 'AM'}: ${propLabel} in ${propLocation}`,
        read: false,
        email_sent: false
      };

      const notifRes = await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications`, {
        method: 'POST', headers, body: JSON.stringify(notifPayload)
      });

      let notifId = null;
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        notifId = notifData?.[0]?.id;
      }

      // 2. Also insert into deal_status_notifications for the submitting AM
      if (submitted_by_staff_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications`, {
          method: 'POST', headers,
          body: JSON.stringify({
            property_id,
            property_title: propLabel,
            property_address,
            property_city,
            property_state,
            recipient_staff_id: submitted_by_staff_id,
            recipient_staff_name: submitted_by_staff_name,
            notification_type: 'deal_submitted',
            new_status: 'am_submitted',
            message: `Your deal "${propLabel}" in ${propLocation} has been submitted and is under review.`,
            is_read: false,
            email_sent: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      }

      // 3. Send email to success team
      let emailSent = false;
      if (RESEND_API_KEY) {
        try {
          const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">New Deal Submitted</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Requires Verification & Approval</p>
    </div>
    <div style="padding:32px 24px;">
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:0 0 24px;text-align:center;">
        <p style="color:#92400e;font-weight:700;margin:0;font-size:15px;">Action Required: New Deal Needs Review</p>
      </div>
      <div style="background:linear-gradient(135deg,#f0f4f8 0%,#e8f0fe 100%);border:1px solid #d4e4f7;border-left:4px solid #d4a574;border-radius:8px;padding:24px;margin:0 0 24px;">
        <p style="font-weight:700;color:#1a365d;margin:0 0 8px;font-size:18px;">${propLabel}</p>
        ${propLocation ? `<p style="color:#64748b;margin:0 0 12px;font-size:14px;">${propLocation}</p>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
          ${bedrooms ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>${bedrooms}</strong> Bed</span>` : ''}
          ${bathrooms ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>${bathrooms}</strong> Bath</span>` : ''}
          ${monthly_rent ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>$${Number(monthly_rent).toLocaleString()}</strong>/mo</span>` : ''}
          ${operation_type ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;">${operation_type === 'coliving' ? 'Co-Living' : operation_type === 'both' ? 'STR + Co-Living' : 'STR'}</span>` : ''}
        </div>
      </div>
      <p style="color:#475569;font-size:14px;margin:0 0 8px;"><strong>Submitted by:</strong> ${submitted_by_staff_name || 'Acquisition Manager'}</p>
      <p style="color:#475569;font-size:14px;margin:0 0 24px;"><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET</p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${PLATFORM_URL}/staff" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">Review Deal in Dashboard</a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Deal Flow Notifications</p>
    </div>
  </div>
</body></html>`;

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM_EMAIL, to: [SUCCESS_EMAIL],
              subject: `New Deal: ${propLabel} in ${propLocation} - Submitted by ${submitted_by_staff_name || 'AM'}`,
              html: emailHtml
            })
          });
          emailSent = emailRes.ok;
          if (notifId) {
            await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications?id=eq.${notifId}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null })
            });
          }
        } catch (e) { console.error('[deal-flow-notifications] Email error:', e); }
      }

      return json({ success: true, notification_id: notifId, email_sent: emailSent });
    }

    // ==================== LEGACY: DEAL APPROVED / PUBLISHED ====================
    if (action === 'deal_approved' || action === 'deal_published') {
      const { property_id, property_title, property_address, property_city, property_state,
              approved_by_staff_name, approved_by_staff_id, submitted_by_staff_id, submitted_by_staff_name,
              submitted_by_staff_email } = body;

      const propLabel = property_title || property_address || 'Property';
      const propLocation = [property_city, property_state].filter(Boolean).join(', ');
      const isPublished = action === 'deal_published';
      const statusLabel = isPublished ? 'Published' : 'Approved';

      // 1. Legacy notification
      const notifPayload = {
        type: action,
        property_id,
        property_title: propLabel,
        property_address,
        property_city,
        property_state,
        submitted_by_staff_id,
        submitted_by_staff_name,
        approved_by_staff_name: approved_by_staff_name || 'Success Team',
        recipient_type: 'acquisition_manager',
        recipient_staff_id: submitted_by_staff_id,
        recipient_email: submitted_by_staff_email,
        message: `Your deal "${propLabel}" in ${propLocation} has been ${statusLabel.toLowerCase()} by ${approved_by_staff_name || 'Success Team'}`,
        read: false,
        email_sent: false
      };

      const notifRes = await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications`, {
        method: 'POST', headers, body: JSON.stringify(notifPayload)
      });
      let notifId = null;
      if (notifRes.ok) { const d = await notifRes.json(); notifId = d?.[0]?.id; }

      // 2. Also insert into deal_status_notifications for the AM
      if (submitted_by_staff_id) {
        const notifType = isPublished ? 'deal_published' : 'deal_approved';
        await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications`, {
          method: 'POST', headers,
          body: JSON.stringify({
            property_id,
            property_title: propLabel,
            property_address,
            property_city,
            property_state,
            recipient_staff_id: submitted_by_staff_id,
            recipient_staff_name: submitted_by_staff_name,
            recipient_email: submitted_by_staff_email,
            reviewer_staff_id: approved_by_staff_id || null,
            reviewer_staff_name: approved_by_staff_name || 'Success Team',
            old_status: isPublished ? 'am_approved' : 'am_submitted',
            new_status: isPublished ? 'published' : 'am_approved',
            notification_type: notifType,
            message: `Your deal "${propLabel}" in ${propLocation} has been ${statusLabel.toLowerCase()} by ${approved_by_staff_name || 'the Success Team'}.`,
            is_read: false,
            email_sent: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      }

      // 3. Success team notification
      await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...notifPayload,
          recipient_type: 'success_team',
          recipient_staff_id: null,
          recipient_email: SUCCESS_EMAIL,
          message: `Deal "${propLabel}" in ${propLocation} has been ${statusLabel.toLowerCase()} by ${approved_by_staff_name || 'Staff'}`,
        })
      });

      // 4. Send email to submitting AM
      let amEmailSent = false;
      if (RESEND_API_KEY && submitted_by_staff_email) {
        try {
          const statusColor = isPublished ? '#8b5cf6' : '#22c55e';
          const amFirstName = (submitted_by_staff_name || 'Team Member').split(' ')[0];
          const amEmailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:${statusColor};margin:0;font-size:24px;font-weight:700;">Deal ${statusLabel}!</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;margin:0 0 8px;">Hi ${amFirstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Your deal has been <strong style="color:${statusColor};">${statusLabel.toLowerCase()}</strong> by <strong>${approved_by_staff_name || 'the Success Team'}</strong>.
        ${isPublished ? 'It is now live on the marketplace!' : 'It has been verified and is ready for publishing.'}
      </p>
      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:1px solid #bbf7d0;border-left:4px solid ${statusColor};border-radius:8px;padding:24px;margin:0 0 24px;">
        <p style="font-weight:700;color:#1a365d;margin:0 0 8px;font-size:18px;">${propLabel}</p>
        ${propLocation ? `<p style="color:#64748b;margin:0 0 8px;font-size:14px;">${propLocation}</p>` : ''}
        <span style="display:inline-block;background:${statusColor};color:white;border-radius:20px;padding:4px 16px;font-size:13px;font-weight:600;">${statusLabel}</span>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${PLATFORM_URL}/staff" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">View in Dashboard</a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Deal Flow Notifications</p>
    </div>
  </div>
</body></html>`;

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM_EMAIL, to: [submitted_by_staff_email],
              subject: `Your Deal "${propLabel}" Has Been ${statusLabel}!`,
              html: amEmailHtml
            })
          });
          amEmailSent = emailRes.ok;
        } catch (e) { console.error('[deal-flow-notifications] AM email error:', e); }
      }

      if (notifId) {
        await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications?id=eq.${notifId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ email_sent: amEmailSent, email_sent_at: amEmailSent ? new Date().toISOString() : null })
        });
      }

      return json({ success: true, notification_id: notifId, am_email_sent: amEmailSent });
    }

    // ==================== LEGACY: GET DEAL TIMELINE ====================
    if (action === 'get_deal_timeline') {
      const { property_ids } = body;
      if (!property_ids || !Array.isArray(property_ids) || property_ids.length === 0) {
        return json({ success: true, timelines: {} });
      }
      const idsFilter = property_ids.map((id: string) => `"${id}"`).join(',');
      const url = `${SUPABASE_URL}/rest/v1/deal_flow_notifications?property_id=in.(${idsFilter})&order=created_at.asc&limit=500`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      const timelines: Record<string, any[]> = {};
      for (const notif of (data || [])) {
        const pid = notif.property_id;
        if (!timelines[pid]) timelines[pid] = [];
        timelines[pid].push({
          id: notif.id, type: notif.type, message: notif.message,
          approved_by_staff_name: notif.approved_by_staff_name,
          submitted_by_staff_name: notif.submitted_by_staff_name,
          recipient_type: notif.recipient_type, email_sent: notif.email_sent,
          created_at: notif.created_at,
        });
      }
      return json({ success: true, timelines });
    }

    // ==================== LEGACY: GET AM DEAL STATUSES ====================
    if (action === 'get_am_deal_statuses') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id required' }, 400);

      const propsUrl = `${SUPABASE_URL}/rest/v1/properties?or=(added_by_staff_id.eq.${staff_id},found_by_am_id.eq.${staff_id})&order=created_at.desc&limit=100&select=id,listing_title,address,city,state,zip_code,status,deal_status,is_verified,is_published,acquisition_fee,monthly_rent,monthly_revenue,bedrooms,bathrooms,operation_type,photos,created_at,updated_at,approved_by_staff_name,approved_at,denial_reason,found_by_am_name,added_by_staff_name`;
      const propsRes = await fetch(propsUrl, { headers });
      const properties = await propsRes.json();

      if (!Array.isArray(properties) || properties.length === 0) {
        return json({ success: true, deals: [], timelines: {}, counts: { total: 0, pending: 0, approved: 0, published: 0, rejected: 0 } });
      }

      const propIds = properties.map((p: any) => p.id);
      const idsFilter = propIds.map((id: string) => `"${id}"`).join(',');
      const notifsUrl = `${SUPABASE_URL}/rest/v1/deal_flow_notifications?property_id=in.(${idsFilter})&order=created_at.asc&limit=1000`;
      const notifsRes = await fetch(notifsUrl, { headers });
      const notifications = await notifsRes.json();

      const timelines: Record<string, any[]> = {};
      for (const notif of (notifications || [])) {
        const pid = notif.property_id;
        if (!timelines[pid]) timelines[pid] = [];
        timelines[pid].push({
          id: notif.id, type: notif.type, message: notif.message,
          approved_by_staff_name: notif.approved_by_staff_name,
          submitted_by_staff_name: notif.submitted_by_staff_name,
          recipient_type: notif.recipient_type, email_sent: notif.email_sent,
          created_at: notif.created_at,
        });
      }

      const deals = properties.map((p: any) => {
        let computedStatus = 'pending_review';
        if (p.deal_status === 'am_denied' || p.denial_reason) computedStatus = 'rejected';
        else if (p.is_published) computedStatus = 'published';
        else if (p.is_verified || p.deal_status === 'am_approved') computedStatus = 'approved';
        return {
          id: p.id, title: p.listing_title || p.address || 'Untitled',
          address: p.address, city: p.city, state: p.state, zip_code: p.zip_code,
          status: p.status, deal_status: p.deal_status, computed_status: computedStatus,
          is_verified: p.is_verified, is_published: p.is_published,
          acquisition_fee: p.acquisition_fee, monthly_rent: p.monthly_rent || p.monthly_revenue,
          bedrooms: p.bedrooms, bathrooms: p.bathrooms, operation_type: p.operation_type,
          photos: p.photos, created_at: p.created_at, updated_at: p.updated_at,
          approved_by_staff_name: p.approved_by_staff_name, approved_at: p.approved_at,
          denial_reason: p.denial_reason, found_by_am_name: p.found_by_am_name,
          added_by_staff_name: p.added_by_staff_name, timeline: timelines[p.id] || [],
        };
      });

      const counts = {
        total: deals.length,
        pending: deals.filter((d: any) => d.computed_status === 'pending_review').length,
        approved: deals.filter((d: any) => d.computed_status === 'approved').length,
        published: deals.filter((d: any) => d.computed_status === 'published').length,
        rejected: deals.filter((d: any) => d.computed_status === 'rejected').length,
      };

      return json({ success: true, deals, timelines, counts });
    }

    // ==================== LEGACY: GET NOTIFICATIONS ====================
    if (action === 'get_notifications') {
      const { staff_id, recipient_type, unread_only, limit: reqLimit } = body;
      const lim = reqLimit || 50;
      let url = `${SUPABASE_URL}/rest/v1/deal_flow_notifications?order=created_at.desc&limit=${lim}`;
      if (recipient_type) url += `&recipient_type=eq.${recipient_type}`;
      if (staff_id) url += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team,recipient_type.eq.all_staff)`;
      if (unread_only) url += `&read=eq.false`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      return json({ success: true, notifications: data || [], count: data?.length || 0 });
    }

    // ==================== LEGACY: GET UNREAD COUNT ====================
    if (action === 'get_unread_count') {
      const { staff_id, recipient_type } = body;
      let url = `${SUPABASE_URL}/rest/v1/deal_flow_notifications?read=eq.false&select=id`;
      if (recipient_type === 'success_team') url += `&recipient_type=eq.success_team`;
      else if (staff_id) url += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team,recipient_type.eq.all_staff)`;
      const res = await fetch(url, { headers: { ...headers, 'Prefer': 'count=exact' } });
      const countHeader = res.headers.get('content-range');
      const count = countHeader ? parseInt(countHeader.split('/')[1] || '0') : 0;
      return json({ success: true, unread_count: count });
    }

    // ==================== LEGACY: MARK READ ====================
    if (action === 'mark_read') {
      const { notification_id, notification_ids, mark_all, staff_id, recipient_type } = body;
      if (mark_all) {
        let url = `${SUPABASE_URL}/rest/v1/deal_flow_notifications?read=eq.false`;
        if (recipient_type) url += `&recipient_type=eq.${recipient_type}`;
        if (staff_id) url += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team)`;
        await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ read: true }) });
      } else if (notification_ids?.length) {
        for (const nid of notification_ids) {
          await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications?id=eq.${nid}`, {
            method: 'PATCH', headers, body: JSON.stringify({ read: true })
          });
        }
      } else if (notification_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/deal_flow_notifications?id=eq.${notification_id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ read: true })
        });
      }
      return json({ success: true });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    console.error('[deal-flow-notifications v2.0] Error:', error.message);
    return json({ success: false, error: error.message }, 500);
  }
});
