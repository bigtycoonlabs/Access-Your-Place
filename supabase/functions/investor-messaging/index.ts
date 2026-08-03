const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
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
    const PLATFORM_URL = 'https://accessyourplace.com';
    
    const headers = { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`, 
      'Content-Type': 'application/json', 
      'Prefer': 'return=representation' 
    };
    
    const body = await req.json();
    const { action, investor_id } = body;

    // ==================== EMAIL HELPER ====================
    async function sendEmailNotification(params: {
      to: string[];
      recipientName: string;
      recipientType: 'investor' | 'staff' | 'success_team';
      senderName: string;
      senderType: 'investor' | 'staff' | 'system';
      subject: string;
      messageContent: string;
      messageSubject?: string;
      messageId?: string;
      emailType: string;
      replyUrl: string;
      unsubscribeId?: string;
      unsubscribeType?: 'investor' | 'staff';
    }) {
      if (!RESEND_API_KEY || !params.to.length) {
        console.log('[email] Skipping email - no API key or no recipients');
        return null;
      }

      const validEmails = params.to.filter(e => e && e.includes('@'));
      if (validEmails.length === 0) return null;

      const unsubscribeUrl = params.unsubscribeId 
        ? `${PLATFORM_URL}/investor/unsubscribe?id=${params.unsubscribeId}&type=${params.unsubscribeType || 'investor'}&category=messaging`
        : `${PLATFORM_URL}/investor/unsubscribe?email=${encodeURIComponent(validEmails[0])}&category=messaging`;

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">New Message Notification</p>
    </div>
    
    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">
        Hi ${params.recipientName.split(' ')[0] || 'there'},
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong>${params.senderName}</strong> sent you a new message on the platform${params.messageSubject && params.messageSubject !== 'Message' && params.messageSubject !== 'Reply' ? ` regarding <em>"${params.messageSubject}"</em>` : ''}:
      </p>
      
      <!-- Message Card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d4a574;border-radius:8px;padding:20px;margin:0 0 28px;">
        ${params.messageSubject && params.messageSubject !== 'Message' && params.messageSubject !== 'Reply' ? `<p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:14px;">${params.messageSubject}</p>` : ''}
        <p style="color:#334155;margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${params.messageContent}</p>
        <p style="color:#94a3b8;margin:12px 0 0;font-size:12px;">
          ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${params.replyUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          Reply on Platform
        </a>
      </div>
      
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        You can reply directly on the platform for a secure, tracked conversation.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">
        Access Your Place - Real Estate Arbitrage Platform
      </p>
      <p style="color:#94a3b8;font-size:11px;margin:0 0 12px;">
        This email was sent because you have an active account on our platform.
      </p>
      <a href="${unsubscribeUrl}" style="color:#94a3b8;font-size:11px;text-decoration:underline;">
        Unsubscribe from message notifications
      </a>
    </div>
  </div>
</body>
</html>`;

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <notifications@accessyourplace.com>',
            to: validEmails,
            subject: params.subject,
            html: emailHtml,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          })
        });

        const emailResult = await emailRes.json();
        const resendId = emailResult?.id || null;
        const emailStatus = emailRes.ok ? 'sent' : 'failed';
        const errorMsg = !emailRes.ok ? (emailResult?.message || `HTTP ${emailRes.status}`) : null;

        console.log(`[email] ${params.emailType} to ${validEmails.join(',')} - status: ${emailStatus}${resendId ? ` resend_id: ${resendId}` : ''}`);

        // Log each recipient separately
        const deliveryLogIds: string[] = [];
        for (const email of validEmails) {
          const logRes = await fetch(
            `${SUPABASE_URL}/rest/v1/email_delivery_logs`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                email_type: params.emailType,
                recipient_email: email,
                recipient_name: params.recipientName,
                recipient_type: params.recipientType,
                sender_name: params.senderName,
                sender_type: params.senderType,
                subject: params.subject,
                message_id: params.messageId || null,
                resend_id: resendId,
                status: emailStatus,
                error_message: errorMsg,
                metadata: {
                  reply_url: params.replyUrl,
                  unsubscribe_url: unsubscribeUrl,
                  all_recipients: validEmails
                }
              })
            }
          );
          const logData = await logRes.json();
          if (logData?.[0]?.id) deliveryLogIds.push(logData[0].id);
        }

        return { resendId, status: emailStatus, deliveryLogIds, error: errorMsg };
      } catch (emailErr: any) {
        console.error('[email] Send failed:', emailErr.message);
        
        // Log the failure
        await fetch(
          `${SUPABASE_URL}/rest/v1/email_delivery_logs`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              email_type: params.emailType,
              recipient_email: validEmails[0],
              recipient_name: params.recipientName,
              recipient_type: params.recipientType,
              sender_name: params.senderName,
              sender_type: params.senderType,
              subject: params.subject,
              message_id: params.messageId || null,
              status: 'failed',
              error_message: emailErr.message
            })
          }
        );
        return { resendId: null, status: 'failed', deliveryLogIds: [], error: emailErr.message };
      }
    }

    // ==================== UNSUBSCRIBE ====================
    if (action === 'unsubscribe_messaging_emails') {
      const { email, user_id, user_type } = body;
      
      if (user_type === 'investor' && user_id) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/investors?id=eq.${user_id}`,
          { method: 'PATCH', headers, body: JSON.stringify({ messaging_email_unsubscribed: true }) }
        );
      } else if (user_type === 'staff' && user_id) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/staff?id=eq.${user_id}`,
          { method: 'PATCH', headers, body: JSON.stringify({ messaging_email_unsubscribed: true }) }
        );
      } else if (email) {
        // Try both tables
        await fetch(
          `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email)}`,
          { method: 'PATCH', headers, body: JSON.stringify({ messaging_email_unsubscribed: true }) }
        );
        await fetch(
          `${SUPABASE_URL}/rest/v1/staff?email=eq.${encodeURIComponent(email)}`,
          { method: 'PATCH', headers, body: JSON.stringify({ messaging_email_unsubscribed: true }) }
        );
      }

      return json({ success: true, message: 'Unsubscribed from messaging email notifications' });
    }

    // Resubscribe
    if (action === 'resubscribe_messaging_emails') {
      const { user_id, user_type } = body;
      const table = user_type === 'investor' ? 'investors' : 'staff';
      await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${user_id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ messaging_email_unsubscribed: false }) }
      );
      return json({ success: true });
    }

    // Get email delivery status for a message
    if (action === 'get_email_delivery_status') {
      const { message_id } = body;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/email_delivery_logs?message_id=eq.${message_id}&select=*&order=created_at.desc`,
        { headers }
      );
      const logs = await res.json();
      return json({ delivery_logs: logs || [] });
    }

    // Get all email delivery logs (for admin)
    if (action === 'get_email_delivery_logs') {
      const { limit = 50, offset = 0, status: filterStatus, email_type } = body;
      let url = `${SUPABASE_URL}/rest/v1/email_delivery_logs?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (filterStatus) url += `&status=eq.${filterStatus}`;
      if (email_type) url += `&email_type=eq.${email_type}`;
      
      const res = await fetch(url, { headers });
      const logs = await res.json();
      
      // Get total count
      const countRes = await fetch(
        `${SUPABASE_URL}/rest/v1/email_delivery_logs?select=id${filterStatus ? `&status=eq.${filterStatus}` : ''}${email_type ? `&email_type=eq.${email_type}` : ''}`,
        { headers: { ...headers, 'Prefer': 'count=exact' } }
      );
      const countHeader = countRes.headers.get('content-range');
      const total = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : (logs || []).length;
      
      return json({ logs: logs || [], total });
    }

    // ==================== STAFF TO STAFF MESSAGING ====================
    if (action === 'send_staff_message') {
      const { from_staff_id, to_staff_id, message, subject } = body;
      console.log('[messaging] send_staff_message from:', from_staff_id, 'to:', to_staff_id);

      if (!from_staff_id || !to_staff_id || !message) {
        return json({ error: 'from_staff_id, to_staff_id, and message are required' }, 400);
      }

      // Get sender info
      const senderRes = await fetch(
        `${SUPABASE_URL}/rest/v1/staff?id=eq.${from_staff_id}&select=id,full_name,email`,
        { headers }
      );
      const sender = (await senderRes.json())?.[0];

      // Get recipient info
      const recipientRes = await fetch(
        `${SUPABASE_URL}/rest/v1/staff?id=eq.${to_staff_id}&select=id,full_name,email,notification_preferences,messaging_email_unsubscribed`,
        { headers }
      );
      const recipient = (await recipientRes.json())?.[0];

      if (!sender || !recipient) {
        return json({ error: 'Sender or recipient not found' }, 404);
      }

      // Create staff message record
      const msgData = {
        from_staff_id,
        to_staff_id,
        subject: subject || 'Message',
        message,
        is_read: false,
        email_notification_sent: false,
        created_at: new Date().toISOString()
      };

      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_messages`,
        { method: 'POST', headers, body: JSON.stringify(msgData) }
      );
      const newMessage = await msgRes.json();
      const messageId = newMessage?.[0]?.id;

      // Create staff notification
      await fetch(
        `${SUPABASE_URL}/rest/v1/staff_notifications`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            staff_id: to_staff_id,
            notification_type: 'staff_message',
            title: `Message from ${sender.full_name}`,
            message: `${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
            priority: 'medium',
            metadata: { from_staff_id, message_id: messageId },
            created_at: new Date().toISOString()
          })
        }
      );

      // Send email notification if recipient hasn't unsubscribed
      let emailResult = null;
      if (!recipient.messaging_email_unsubscribed && recipient.email) {
        emailResult = await sendEmailNotification({
          to: [recipient.email],
          recipientName: recipient.full_name || 'Team Member',
          recipientType: 'staff',
          senderName: sender.full_name || 'Team Member',
          senderType: 'staff',
          subject: subject ? `[AYP Team] ${subject}` : `New message from ${sender.full_name}`,
          messageContent: message,
          messageSubject: subject,
          messageId,
          emailType: 'staff_to_staff_message',
          replyUrl: `${PLATFORM_URL}/staff`,
          unsubscribeId: to_staff_id,
          unsubscribeType: 'staff'
        });

        // Update message with email delivery info
        if (messageId && emailResult) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/staff_messages?id=eq.${messageId}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                email_notification_sent: emailResult.status === 'sent',
                email_delivery_id: emailResult.deliveryLogIds?.[0] || null
              })
            }
          );
        }
      }

      return json({ 
        success: true, 
        message: newMessage?.[0] || newMessage,
        email_sent: emailResult?.status === 'sent',
        email_delivery: emailResult
      });
    }

    // Get staff-to-staff messages
    if (action === 'get_staff_messages') {
      const { staff_id } = body;
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_messages?or=(from_staff_id.eq.${staff_id},to_staff_id.eq.${staff_id})&select=*&order=created_at.desc`,
        { headers }
      );
      const messages = await res.json();

      const staffIds = new Set<string>();
      (messages || []).forEach((m: any) => {
        staffIds.add(m.from_staff_id);
        staffIds.add(m.to_staff_id);
      });

      const staffNames: Record<string, string> = {};
      if (staffIds.size > 0) {
        const namesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/staff?id=in.(${Array.from(staffIds).join(',')})&select=id,full_name`,
          { headers }
        );
        const staffList = await namesRes.json();
        (staffList || []).forEach((s: any) => {
          staffNames[s.id] = s.full_name;
        });
      }

      const conversations: Record<string, any> = {};
      (messages || []).forEach((msg: any) => {
        const partnerId = msg.from_staff_id === staff_id ? msg.to_staff_id : msg.from_staff_id;
        if (!conversations[partnerId]) {
          conversations[partnerId] = {
            partner_id: partnerId,
            partner_name: staffNames[partnerId] || 'Unknown',
            messages: [],
            unread_count: 0,
            last_message: null
          };
        }
        conversations[partnerId].messages.push({
          ...msg,
          sender_name: staffNames[msg.from_staff_id] || 'Unknown',
          is_from_me: msg.from_staff_id === staff_id
        });
        if (!msg.is_read && msg.to_staff_id === staff_id) {
          conversations[partnerId].unread_count++;
        }
        if (!conversations[partnerId].last_message || 
            new Date(msg.created_at) > new Date(conversations[partnerId].last_message.created_at)) {
          conversations[partnerId].last_message = msg;
        }
      });

      return json({ 
        messages: messages || [], 
        conversations: Object.values(conversations),
        staff_names: staffNames
      });
    }

    // Mark staff message as read
    if (action === 'mark_staff_message_read') {
      const { message_id, staff_id } = body;
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/staff_messages?id=eq.${message_id}&to_staff_id=eq.${staff_id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() })
        }
      );
      return json({ success: true });
    }

    // Mark all staff messages from a partner as read
    if (action === 'mark_staff_conversation_read') {
      const { staff_id, partner_id } = body;
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/staff_messages?to_staff_id=eq.${staff_id}&from_staff_id=eq.${partner_id}&is_read=eq.false`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_read: true, read_at: new Date().toISOString() })
        }
      );
      return json({ success: true });
    }

    // Get all staff for messaging dropdown
    if (action === 'get_staff_for_messaging') {
      const { exclude_staff_id } = body;
      
      let url = `${SUPABASE_URL}/rest/v1/staff?select=id,full_name,email,role&order=full_name.asc`;
      if (exclude_staff_id) {
        url += `&id=neq.${exclude_staff_id}`;
      }
      
      const res = await fetch(url, { headers });
      const staff = await res.json();
      return json({ staff: staff || [] });
    }

    // ==================== SUBMIT SUPPORT REQUEST (unauthenticated) ====================
    if (action === 'submit_support_request') {
      const { email, name, phone, message, context } = body;
      
      if (!email || !message) {
        return json({ error: 'Email and message are required' }, 400);
      }

      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name`,
        { headers }
      );
      const investors = await invRes.json();
      const existingInvestor = investors?.[0];

      const notificationData = {
        notification_type: 'login_support_request',
        title: 'Login Support Request',
        message: `${name || 'User'} (${email}) needs help logging in: "${message.substring(0, 200)}${message.length > 200 ? '...' : ''}"`,
        priority: context?.failed_login_attempts >= 3 ? 'high' : 'medium',
        target_department: 'success_managers',
        metadata: {
          email, name, phone,
          full_message: message,
          context,
          existing_investor_id: existingInvestor?.id || null,
          existing_investor_name: existingInvestor?.full_name || null
        },
        created_at: new Date().toISOString()
      };

      await fetch(
        `${SUPABASE_URL}/rest/v1/staff_notifications`, 
        { method: 'POST', headers, body: JSON.stringify(notificationData) }
      );

      await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email, name, phone, message,
            request_type: 'login_help',
            context,
            investor_id: existingInvestor?.id || null,
            status: 'open',
            created_at: new Date().toISOString()
          })
        }
      );

      // Send email to success team
      await sendEmailNotification({
        to: ['success@accessyourplace.com'],
        recipientName: 'Success Team',
        recipientType: 'success_team',
        senderName: name || email,
        senderType: 'system',
        subject: `Login Support Request from ${name || email}`,
        messageContent: `<strong>Name:</strong> ${name || 'Not provided'}<br><strong>Email:</strong> ${email}<br><strong>Phone:</strong> ${phone || 'Not provided'}<br><br><strong>Issue:</strong><br>${message}${existingInvestor ? `<br><br><strong>Existing Investor:</strong> ${existingInvestor.full_name}` : '<br><br><em>No matching investor account found</em>'}`,
        emailType: 'support_request',
        replyUrl: `${PLATFORM_URL}/staff`
      });

      return json({ success: true, message: 'Support request submitted' });
    }

    // ==================== INVESTOR MESSAGING ====================

    // Get all messages for an investor
    if (action === 'get_messages') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?investor_id=eq.${investor_id}&select=*&order=created_at.desc`, 
        { headers }
      );
      const messages = await res.json();
      return json({ messages: messages || [] });
    }

    // Get unread message count for an investor
    if (action === 'get_unread_count') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?investor_id=eq.${investor_id}&read=eq.false&sender_type=eq.staff&select=id`, 
        { headers }
      );
      const messages = await res.json();
      return json({ count: messages?.length || 0 });
    }

    // Mark a message as read
    if (action === 'mark_read') {
      const { message_id } = body;
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?id=eq.${message_id}`, 
        { 
          method: 'PATCH', 
          headers, 
          body: JSON.stringify({ read: true, read_at: new Date().toISOString() }) 
        }
      );
      return json({ success: true });
    }

    // Mark all messages as read
    if (action === 'mark_all_read') {
      await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?investor_id=eq.${investor_id}&read=eq.false&sender_type=eq.staff`, 
        { 
          method: 'PATCH', 
          headers, 
          body: JSON.stringify({ read: true, read_at: new Date().toISOString() }) 
        }
      );
      return json({ success: true });
    }

    // ==================== INVESTOR SENDS MESSAGE (to AM / Success Team) ====================
    if (action === 'send_reply') {
      const { message, subject, parent_message_id, investor_name } = body;
      
      // Get investor details
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=*`,
        { headers }
      );
      const investors = await invRes.json();
      const investor = investors?.[0];
      
      const senderDisplayName = investor_name || investor?.full_name || 'Investor';
      
      const msgData = { 
        investor_id, 
        subject: subject || 'Reply', 
        message, 
        sender_type: 'investor', 
        sender_name: senderDisplayName,
        parent_message_id: parent_message_id || null,
        read: false,
        email_notification_sent: false,
        created_at: new Date().toISOString() 
      };
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages`, 
        { method: 'POST', headers, body: JSON.stringify(msgData) }
      );
      const newMessage = await res.json();
      const messageId = newMessage?.[0]?.id;

      // Create staff notification for AM
      const notificationData: any = {
        notification_type: 'investor_message',
        title: `New Message from ${senderDisplayName}`,
        message: `${senderDisplayName} sent a message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        priority: 'medium',
        metadata: { investor_id, message_id: messageId },
        created_at: new Date().toISOString()
      };

      if (investor?.assigned_acquisition_manager_id) {
        notificationData.staff_id = investor.assigned_acquisition_manager_id;
      } else {
        notificationData.target_department = 'success_managers';
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/staff_notifications`, 
        { method: 'POST', headers, body: JSON.stringify(notificationData) }
      );

      // EMAIL 1: Notify assigned AM
      let amEmailResult = null;
      if (investor?.assigned_acquisition_manager_id) {
        const amRes = await fetch(
          `${SUPABASE_URL}/rest/v1/staff?id=eq.${investor.assigned_acquisition_manager_id}&select=id,email,full_name,messaging_email_unsubscribed`,
          { headers }
        );
        const ams = await amRes.json();
        const am = ams?.[0];

        if (am?.email && !am.messaging_email_unsubscribed) {
          amEmailResult = await sendEmailNotification({
            to: [am.email],
            recipientName: am.full_name || 'Acquisition Manager',
            recipientType: 'staff',
            senderName: senderDisplayName,
            senderType: 'investor',
            subject: `New message from ${senderDisplayName}${subject && subject !== 'Reply' ? ` - ${subject}` : ''}`,
            messageContent: message,
            messageSubject: subject,
            messageId,
            emailType: 'investor_to_am_message',
            replyUrl: `${PLATFORM_URL}/staff`,
            unsubscribeId: am.id,
            unsubscribeType: 'staff'
          });
        }
      }

      // EMAIL 2: Always notify the success team
      const successEmailResult = await sendEmailNotification({
        to: ['success@accessyourplace.com'],
        recipientName: 'Success Team',
        recipientType: 'success_team',
        senderName: senderDisplayName,
        senderType: 'investor',
        subject: `[Investor Message] ${senderDisplayName}${subject && subject !== 'Reply' ? ` - ${subject}` : ''}`,
        messageContent: message,
        messageSubject: subject,
        messageId,
        emailType: 'investor_to_success_team_message',
        replyUrl: `${PLATFORM_URL}/staff`
      });

      // Update message with email delivery info
      if (messageId) {
        const emailSent = (amEmailResult?.status === 'sent') || (successEmailResult?.status === 'sent');
        await fetch(
          `${SUPABASE_URL}/rest/v1/investor_messages?id=eq.${messageId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              email_notification_sent: emailSent,
              email_delivery_id: amEmailResult?.deliveryLogIds?.[0] || successEmailResult?.deliveryLogIds?.[0] || null
            })
          }
        );
      }

      return json({ 
        success: true, 
        message: newMessage?.[0] || newMessage,
        email_notifications: {
          am_notified: amEmailResult?.status === 'sent',
          success_team_notified: successEmailResult?.status === 'sent'
        }
      });
    }

    // ==================== STAFF SENDS MESSAGE TO INVESTOR ====================
    if (action === 'send_to_investor') {
      const { message, subject, staff_id, staff_name, template_id } = body;

      // Get investor details
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=*`,
        { headers }
      );
      const investors = await invRes.json();
      const investor = investors?.[0];

      if (!investor) {
        return json({ error: 'Investor not found' }, 404);
      }

      const msgData = {
        investor_id,
        subject: subject || 'Message from Your Team',
        message,
        sender_type: 'staff',
        sender_id: staff_id,
        sender_name: staff_name || 'Access Your Place Team',
        template_id: template_id || null,
        read: false,
        email_notification_sent: false,
        created_at: new Date().toISOString()
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages`,
        { method: 'POST', headers, body: JSON.stringify(msgData) }
      );
      const newMessage = await res.json();
      const messageId = newMessage?.[0]?.id;

      // Create investor notification
      await fetch(
        `${SUPABASE_URL}/rest/v1/investor_notifications`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id,
            type: 'new_message',
            title: 'New Message',
            message: `You have a new message from ${staff_name || 'your team'}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
            read: false,
            created_at: new Date().toISOString()
          })
        }
      );

      // Send email notification to investor
      let emailResult = null;
      if (!investor.messaging_email_unsubscribed && investor.email_opt_in !== false && investor.email) {
        emailResult = await sendEmailNotification({
          to: [investor.email],
          recipientName: investor.full_name || 'Investor',
          recipientType: 'investor',
          senderName: staff_name || 'Your Access Your Place Team',
          senderType: 'staff',
          subject: subject || `New message from ${staff_name || 'Your Team'}`,
          messageContent: message,
          messageSubject: subject,
          messageId,
          emailType: 'staff_to_investor_message',
          replyUrl: `${PLATFORM_URL}/investor`,
          unsubscribeId: investor_id,
          unsubscribeType: 'investor'
        });

        // Update message with email delivery info
        if (messageId && emailResult) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/investor_messages?id=eq.${messageId}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                email_notification_sent: emailResult.status === 'sent',
                email_delivery_id: emailResult.deliveryLogIds?.[0] || null
              })
            }
          );
        }
      }

      return json({ 
        success: true, 
        message: newMessage?.[0] || newMessage,
        email_sent: emailResult?.status === 'sent',
        email_delivery: emailResult
      });
    }

    // Get conversation thread
    if (action === 'get_conversation') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?investor_id=eq.${investor_id}&select=*&order=created_at.asc`, 
        { headers }
      );
      const messages = await res.json();
      
      const threads: Record<string, any[]> = {};
      (messages || []).forEach((msg: any) => {
        const threadKey = msg.subject || 'General';
        if (!threads[threadKey]) threads[threadKey] = [];
        threads[threadKey].push(msg);
      });
      
      return json({ messages: messages || [], threads });
    }

    // Get message templates
    if (action === 'get_templates') {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/message_templates?select=*&order=name.asc`,
        { headers }
      );
      const templates = await res.json();
      return json({ templates: templates || [] });
    }

    // Create/update message template
    if (action === 'save_template') {
      const { template_id, name, subject, body: templateBody, category, created_by } = body;

      if (template_id) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/message_templates?id=eq.${template_id}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name, subject, body: templateBody, category, updated_at: new Date().toISOString() })
          }
        );
      } else {
        await fetch(
          `${SUPABASE_URL}/rest/v1/message_templates`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ name, subject, body: templateBody, category, created_by, created_at: new Date().toISOString() })
          }
        );
      }

      return json({ success: true });
    }

    // Delete template
    if (action === 'delete_template') {
      const { template_id } = body;
      await fetch(
        `${SUPABASE_URL}/rest/v1/message_templates?id=eq.${template_id}`,
        { method: 'DELETE', headers }
      );
      return json({ success: true });
    }

    // Get messages for staff (AM view) - all investor conversations
    if (action === 'get_am_messages') {
      const { staff_id } = body;

      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?assigned_acquisition_manager_id=eq.${staff_id}&select=id`,
        { headers }
      );
      const investors = await invRes.json();
      const investorIds = (investors || []).map((i: any) => i.id);

      if (investorIds.length === 0) {
        return json({ messages: [], conversations: [] });
      }

      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?investor_id=in.(${investorIds.join(',')})&select=*&order=created_at.desc`,
        { headers }
      );
      const messages = await msgRes.json();

      const conversations: Record<string, any> = {};
      (messages || []).forEach((msg: any) => {
        if (!conversations[msg.investor_id]) {
          conversations[msg.investor_id] = {
            investor_id: msg.investor_id,
            messages: [],
            unread_count: 0,
            last_message: null
          };
        }
        conversations[msg.investor_id].messages.push(msg);
        if (!msg.read && msg.sender_type === 'investor') {
          conversations[msg.investor_id].unread_count++;
        }
        if (!conversations[msg.investor_id].last_message || 
            new Date(msg.created_at) > new Date(conversations[msg.investor_id].last_message.created_at)) {
          conversations[msg.investor_id].last_message = msg;
        }
      });

      return json({ 
        messages: messages || [], 
        conversations: Object.values(conversations) 
      });
    }

    // Get ALL investor messages (for success team - not just assigned)
    if (action === 'get_all_investor_messages') {
      const { limit = 100 } = body;

      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?select=*&order=created_at.desc&limit=${limit}`,
        { headers }
      );
      const messages = await msgRes.json();

      const conversations: Record<string, any> = {};
      (messages || []).forEach((msg: any) => {
        if (!conversations[msg.investor_id]) {
          conversations[msg.investor_id] = {
            investor_id: msg.investor_id,
            messages: [],
            unread_count: 0,
            last_message: null
          };
        }
        conversations[msg.investor_id].messages.push(msg);
        if (!msg.read && msg.sender_type === 'investor') {
          conversations[msg.investor_id].unread_count++;
        }
        if (!conversations[msg.investor_id].last_message || 
            new Date(msg.created_at) > new Date(conversations[msg.investor_id].last_message.created_at)) {
          conversations[msg.investor_id].last_message = msg;
        }
      });

      return json({ 
        messages: messages || [], 
        conversations: Object.values(conversations) 
      });
    }

    // Update notification preferences
    if (action === 'update_notification_preferences') {
      const { email_notifications, sms_notifications, push_notifications } = body;

      await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            email_opt_in: email_notifications,
            sms_opt_in: sms_notifications,
            push_notifications_enabled: push_notifications,
            updated_at: new Date().toISOString()
          })
        }
      );

      return json({ success: true });
    }

    // Delete a message (only investor's own messages)
    if (action === 'delete_message') {
      const { message_id } = body;
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?id=eq.${message_id}&investor_id=eq.${investor_id}&sender_type=eq.investor&select=id`, 
        { headers }
      );
      const checkMsg = await checkRes.json();
      
      if (!checkMsg || checkMsg.length === 0) {
        return json({ error: 'Cannot delete this message' }, 403);
      }
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/investor_messages?id=eq.${message_id}`, 
        { method: 'DELETE', headers }
      );
      
      return json({ success: true });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error: any) {
    console.error('Investor messaging error:', error);
    return json({ error: error.message }, 500);
  }
});
