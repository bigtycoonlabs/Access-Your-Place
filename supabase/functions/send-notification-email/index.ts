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

    if (!RESEND_API_KEY) {
      return json({ success: false, email_sent: false, error: 'Email service not configured' });
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const body = await req.json();
    const { action, investor_id, investor_name, investor_email, staff_name, subject, portal_url } = body;

    console.log('[send-notification-email v3] Action:', action, 'Investor:', investor_name, 'Email:', investor_email);

    if (!investor_email || !investor_email.includes('@')) {
      return json({ success: false, email_sent: false, error: 'Invalid or missing investor email' });
    }

    // Check if investor has unsubscribed
    if (investor_id) {
      try {
        const invRes = await fetch(
          `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=messaging_email_unsubscribed,email_opt_in`,
          { headers }
        );
        const inv = (await invRes.json())?.[0];
        if (inv?.messaging_email_unsubscribed || inv?.email_opt_in === false) {
          console.log('[send-notification-email v3] Investor has unsubscribed from emails');
          return json({ success: true, email_sent: false, reason: 'unsubscribed' });
        }
      } catch (e) {
        console.warn('Could not check unsubscribe status:', e);
      }
    }

    const loginUrl = portal_url || `${PLATFORM_URL}/investor-login`;
    const firstName = (investor_name || 'Investor').split(' ')[0];

    let emailSubject = subject || 'Notification from Access Your Place';
    let emailHtml = '';

    // ==================== AGREEMENT SENT ====================
    if (action === 'agreement_sent') {
      const { document_name, document_type, expires_in_days } = body;
      emailSubject = subject || `Action Required: ${document_name} - Ready for Your Signature`;

      emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Agreement Ready for Signature</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        A new agreement has been prepared and is ready for your review and signature.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d4a574;border-radius:8px;padding:20px;margin:0 0 28px;">
        <p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:16px;">${document_name}</p>
        <p style="color:#64748b;margin:0 0 4px;font-size:14px;">Type: ${(document_type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
        <p style="color:#64748b;margin:0 0 4px;font-size:14px;">Sent by: ${staff_name || 'AYP Team'}</p>
        ${expires_in_days ? `<p style="color:#dc2626;margin:8px 0 0;font-size:13px;font-weight:600;">Expires in ${expires_in_days} days - please sign promptly</p>` : ''}
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          Review & Sign Now
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        Log in to your investor portal to review the full agreement and sign electronically.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Real Estate Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>`;
    }

    // ==================== DOCUMENT UPLOADED ====================
    else if (action === 'document_uploaded') {
      const { document_name, document_type } = body;
      emailSubject = subject || `New Document Available: ${document_name}`;

      emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">New Document Available</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        A new document has been uploaded to your investor portal for your review.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #22c55e;border-radius:8px;padding:20px;margin:0 0 28px;">
        <p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:16px;">${document_name}</p>
        <p style="color:#64748b;margin:0 0 4px;font-size:14px;">Type: ${(document_type || 'Document').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
        <p style="color:#64748b;margin:0;font-size:14px;">Uploaded by: ${staff_name || 'AYP Team'}</p>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          View Document
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        Log in to your investor portal to view and download this document.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Real Estate Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>`;
    }

    // ==================== NEW MESSAGE ====================
    else if (action === 'new_message') {
      const { message_subject, message_preview } = body;
      emailSubject = subject || `New Message from ${staff_name || 'Your AYP Team'}`;

      emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">New Message</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong>${staff_name || 'Your AYP Team'}</strong> sent you a new message on the platform.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d4a574;border-radius:8px;padding:20px;margin:0 0 28px;">
        ${message_subject ? `<p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:14px;">${message_subject}</p>` : ''}
        <p style="color:#334155;margin:0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message_preview || ''}</p>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          Reply on Platform
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        Reply directly on the platform for a secure, tracked conversation.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Real Estate Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>`;
    }

    // ==================== PROPERTY ASSIGNED (v3 - dual-purpose: investor + AM) ====================
    else if (action === 'property_assigned') {
      const { property_address, property_city, property_state, property_bedrooms, property_bathrooms, property_rent, community_name, recipient_type } = body;
      const isInvestorEmail = recipient_type === 'investor';
      const propLabel = community_name || property_address || 'New Property';
      const propLoc = property_city && property_state ? `${property_city}, ${property_state}` : '';

      if (isInvestorEmail) {
        // â”€â”€ INVESTOR-FACING EMAIL â”€â”€
        emailSubject = subject || `New Property Added to Your Portfolio: ${propLabel}`;

        emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">New Property Added to Your Portfolio</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Great news! A new property has been added to your portfolio by <strong>${staff_name || 'your AYP team'}</strong>. Here are the details:
      </p>
      <div style="background:linear-gradient(135deg,#f0f4f8 0%,#e8f0fe 100%);border:1px solid #d4e4f7;border-left:4px solid #d4a574;border-radius:8px;padding:24px;margin:0 0 28px;">
        ${community_name ? `<p style="font-weight:700;color:#d4a574;margin:0 0 4px;font-size:18px;">${community_name}</p>` : ''}
        <p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:${community_name ? '15' : '18'}px;">${property_address || 'Property Address'}</p>
        ${propLoc ? `<p style="color:#64748b;margin:0 0 12px;font-size:14px;">${propLoc}</p>` : ''}
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${property_bedrooms ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>${property_bedrooms}</strong> Bed</span>` : ''}
          ${property_bathrooms ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>${property_bathrooms}</strong> Bath</span>` : ''}
          ${property_rent ? `<span style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:13px;color:#475569;"><strong>$${Number(property_rent).toLocaleString()}</strong>/mo</span>` : ''}
        </div>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
        You can view all property details, track the acquisition progress, upload documents, and manage your portfolio from your investor portal.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          View in My Portfolio
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0;text-align:center;">
        Log in to your investor portal to see the full property details and track your acquisition progress.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Real Estate Arbitrage Platform</p>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">Questions? Contact your Acquisition Manager or reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
      } else {
        // â”€â”€ AM / STAFF-FACING EMAIL â”€â”€
        emailSubject = subject || `Property Assigned: ${property_address || 'New Property'}`;

        emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Property Assignment Notification</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        A property has been assigned to investor <strong>${investor_name}</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d4a574;border-radius:8px;padding:20px;margin:0 0 28px;">
        <p style="font-weight:600;color:#1a365d;margin:0 0 8px;font-size:16px;">${property_address || 'Property'}</p>
        <p style="color:#64748b;margin:0;font-size:14px;">${propLoc}</p>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${PLATFORM_URL}/staff" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
          View in Dashboard
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place - Real Estate Arbitrage Platform</p>
    </div>
  </div>
</body>
</html>`;
      }
    }

    else {
      return json({ success: false, email_sent: false, error: `Unknown action: ${action}` }, 400);
    }

    // Send the email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Access Your Place <notifications@accessyourplace.com>',
        to: [investor_email],
        subject: emailSubject,
        html: emailHtml
      })
    });

    const emailResult = await emailRes.json();
    const emailSent = emailRes.ok;
    const resendId = emailResult?.id || null;

    console.log(`[send-notification-email v3] Email ${emailSent ? 'sent' : 'failed'} to ${investor_email}${resendId ? ` (${resendId})` : ''}`);

    // Log the email delivery
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/email_delivery_logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email_type: `notification_${action}`,
          recipient_email: investor_email,
          recipient_name: investor_name || 'Investor',
          recipient_type: body.recipient_type || 'investor',
          sender_name: staff_name || 'AYP System',
          sender_type: 'staff',
          subject: emailSubject,
          resend_id: resendId,
          status: emailSent ? 'sent' : 'failed',
          error_message: emailSent ? null : (emailResult?.message || 'Send failed'),
          metadata: { action, investor_id }
        })
      });
    } catch (e) {
      console.warn('Email log insert failed:', e);
    }

    // Also create an investor notification record
    if (investor_id && body.recipient_type !== 'staff') {
      try {
        const notifType = action === 'agreement_sent' ? 'new_agreement' :
                          action === 'document_uploaded' ? 'new_document' :
                          action === 'property_assigned' ? 'property_assigned' : 'new_message';
        const notifTitle = action === 'agreement_sent' ? 'Agreement Ready for Signature' :
                           action === 'document_uploaded' ? 'New Document Available' :
                           action === 'property_assigned' ? 'New Property Added to Your Portfolio' : 'New Message';
        const notifMessage = action === 'agreement_sent' ? `${body.document_name} is ready for your signature` :
                             action === 'document_uploaded' ? `${body.document_name} has been uploaded to your portal` :
                             action === 'property_assigned' ? `${body.property_address || 'A new property'} has been added to your portfolio. Check your Portfolio tab to view details.` :
                             `New message from ${staff_name || 'your team'}`;

        await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            read: false,
            data: { action, staff_name, email_sent: emailSent },
            created_at: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn('Notification insert failed:', e);
      }
    }

    return json({ success: true, email_sent: emailSent, resend_id: resendId });
  } catch (error: any) {
    console.error('[send-notification-email v3] Error:', error.message);
    return json({ success: false, email_sent: false, error: error.message }, 500);
  }
});

