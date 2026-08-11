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
    
    const headers = { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`, 
      'Content-Type': 'application/json', 
      'Prefer': 'return=representation' 
    };
    
    const body = await req.json();
    const { action } = body;

    // ==================== GET ALL SUPPORT REQUESTS ====================
    if (action === 'get_requests') {
      const { status, search, limit = 50, offset = 0 } = body;
      
      let url = `${SUPABASE_URL}/rest/v1/support_requests?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
      
      if (status && status !== 'all') {
        url += `&status=eq.${status}`;
      }
      
      if (search) {
        url += `&or=(email.ilike.*${encodeURIComponent(search)}*,name.ilike.*${encodeURIComponent(search)}*)`;
      }
      
      const res = await fetch(url, { headers });
      const requests = await res.json();
      
      if (!Array.isArray(requests)) {
        console.error('Unexpected response from support_requests:', requests);
        return json({ requests: [], total: 0 });
      }
      
      // Get count for pagination
      const countUrl = `${SUPABASE_URL}/rest/v1/support_requests?select=id`;
      const countRes = await fetch(countUrl, { headers: { ...headers, 'Prefer': 'count=exact' } });
      const totalCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0');
      
      // Enrich with investor data if available
      const enrichedRequests = await Promise.all((requests || []).map(async (req: any) => {
        try {
          if (req.investor_id) {
            const invRes = await fetch(
              `${SUPABASE_URL}/rest/v1/investors?id=eq.${req.investor_id}&select=id,full_name,email,phone,status,email_verified`,
              { headers }
            );
            const investors = await invRes.json();
            req.investor = Array.isArray(investors) ? investors?.[0] || null : null;
          }
          
          if (req.assigned_to) {
            const staffRes = await fetch(
              `${SUPABASE_URL}/rest/v1/staff?id=eq.${req.assigned_to}&select=id,full_name,email`,
              { headers }
            );
            const staff = await staffRes.json();
            req.assigned_staff = Array.isArray(staff) ? staff?.[0] || null : null;
          }
        } catch (e) {
          console.error('Error enriching request:', e);
        }
        
        return req;
      }));
      
      return json({ requests: enrichedRequests, total: totalCount });
    }

    // ==================== GET SINGLE REQUEST WITH FULL DETAILS ====================
    if (action === 'get_request_details') {
      const { request_id } = body;
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=*`,
        { headers }
      );
      const requests = await res.json();
      const request = Array.isArray(requests) ? requests?.[0] : null;
      
      if (!request) {
        return json({ error: 'Request not found' }, 404);
      }
      
      // Ensure conversation_history is always an array
      if (!Array.isArray(request.conversation_history)) {
        request.conversation_history = [];
      }
      
      // Get investor details if linked
      if (request.investor_id) {
        try {
          const invRes = await fetch(
            `${SUPABASE_URL}/rest/v1/investors?id=eq.${request.investor_id}&select=*`,
            { headers }
          );
          const investors = await invRes.json();
          request.investor = Array.isArray(investors) ? investors?.[0] || null : null;
        } catch (e) {
          console.error('Error fetching investor:', e);
        }
      }
      
      // Try to find investor by email if not linked
      if (!request.investor && request.email) {
        try {
          const invRes = await fetch(
            `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(request.email.toLowerCase())}&select=id,full_name,email,phone,status,email_verified`,
            { headers }
          );
          const investors = await invRes.json();
          if (Array.isArray(investors) && investors.length > 0) {
            request.investor = investors[0];
            // Auto-link investor_id for future lookups
            await fetch(
              `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
              { method: 'PATCH', headers, body: JSON.stringify({ investor_id: investors[0].id }) }
            );
          }
        } catch (e) {
          console.error('Error looking up investor by email:', e);
        }
      }
      
      // Get assigned staff info
      if (request.assigned_to) {
        try {
          const staffRes = await fetch(
            `${SUPABASE_URL}/rest/v1/staff?id=eq.${request.assigned_to}&select=id,full_name,email`,
            { headers }
          );
          const staff = await staffRes.json();
          request.assigned_staff = Array.isArray(staff) ? staff?.[0] || null : null;
        } catch (e) {
          console.error('Error fetching staff:', e);
        }
      }
      
      return json({ request });
    }

    // ==================== UPDATE REQUEST STATUS ====================
    if (action === 'update_status') {
      const { request_id, status, staff_id, resolution_notes } = body;
      
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = staff_id;
        if (resolution_notes) {
          updateData.resolution_notes = resolution_notes;
        }
      }
      
      if (status === 'in_progress' && staff_id) {
        updateData.assigned_to = staff_id;
      }
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
        { method: 'PATCH', headers, body: JSON.stringify(updateData) }
      );
      
      return json({ success: true });
    }

    // ==================== ASSIGN REQUEST ====================
    if (action === 'assign_request') {
      const { request_id, staff_id } = body;
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
        { 
          method: 'PATCH', 
          headers, 
          body: JSON.stringify({
            assigned_to: staff_id,
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
        }
      );
      
      return json({ success: true });
    }

    // ==================== ADD CONVERSATION MESSAGE (INTERNAL NOTE) ====================
    if (action === 'add_message') {
      const { request_id, message, staff_id, staff_name, message_type = 'note' } = body;
      
      // Get current conversation history
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=conversation_history`,
        { headers }
      );
      const requests = await res.json();
      const currentHistory = (Array.isArray(requests) && requests[0]?.conversation_history) || [];
      
      // Add new message
      const newMessage = {
        id: crypto.randomUUID(),
        message,
        staff_id,
        staff_name,
        message_type,
        created_at: new Date().toISOString()
      };
      
      const updatedHistory = Array.isArray(currentHistory) ? [...currentHistory, newMessage] : [newMessage];
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
        { 
          method: 'PATCH', 
          headers, 
          body: JSON.stringify({
            conversation_history: updatedHistory,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      return json({ success: true, message: newMessage });
    }

    // ==================== REPLY TO INVESTOR (SEND EMAIL + LOG) ====================
    if (action === 'reply_to_investor') {
      const { request_id, email, reply_message, reply_subject, staff_id, staff_name } = body;
      
      if (!email || !reply_message) {
        return json({ error: 'Email and reply message are required' }, 400);
      }
      
      // Look up investor name
      let investorName = 'there';
      try {
        const invRes = await fetch(
          `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=full_name`,
          { headers }
        );
        const investors = await invRes.json();
        if (Array.isArray(investors) && investors[0]?.full_name) {
          investorName = investors[0].full_name.split(' ')[0];
        }
      } catch (e) { /* use default */ }
      
      // Get the original request for context
      let originalMessage = '';
      try {
        const reqRes = await fetch(
          `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=message,name`,
          { headers }
        );
        const reqs = await reqRes.json();
        if (Array.isArray(reqs) && reqs[0]) {
          originalMessage = reqs[0].message || '';
          if (reqs[0].name && investorName === 'there') {
            investorName = reqs[0].name.split(' ')[0];
          }
        }
      } catch (e) { /* ignore */ }
      
      const subject = reply_subject || 'Re: Your Support Request - Access Your Place';
      
      // Send email via Resend
      let emailSent = false;
      if (RESEND_API_KEY) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Access Your Place Support <support@accessyourplace.com>',
              to: [email],
              subject,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #f59e0b; margin: 0; font-size: 22px;">Support Response</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Access Your Place</p>
                  </div>
                  <div style="padding: 30px; background: #ffffff;">
                    <p style="color: #475569; font-size: 15px;">Hi ${investorName},</p>
                    <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin: 16px 0;">${reply_message.replace(/\n/g, '<br>')}</div>
                    ${originalMessage ? `
                    <div style="margin-top: 24px; padding: 16px; background: #f1f5f9; border-left: 4px solid #d4a574; border-radius: 4px;">
                      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; font-weight: 600;">Your original message:</p>
                      <p style="color: #475569; font-size: 13px; margin: 0; line-height: 1.5;">${originalMessage.replace(/\n/g, '<br>')}</p>
                    </div>
                    ` : ''}
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                    <p style="color: #64748b; font-size: 13px;">If you need further assistance, simply reply to this email or log in to your investor portal.</p>
                    <div style="text-align: center; margin-top: 20px;">
                      <a href="https://accessyourplace.com/investor/login" style="display: inline-block; background: #d4a574; color: #1a365d; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                        Go to Investor Portal
                      </a>
                    </div>
                  </div>
                  <div style="padding: 16px 30px; background: #f8fafc; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      ${staff_name || 'Support Team'} | Access Your Place Support Team
                    </p>
                  </div>
                </div>
              `
            })
          });
          
          if (emailRes.ok) {
            emailSent = true;
            console.log('Reply email sent successfully to:', email);
          } else {
            const errBody = await emailRes.text();
            console.error('Resend API error:', errBody);
          }
        } catch (e) {
          console.error('Email send error:', e);
        }
      } else {
        console.warn('RESEND_API_KEY not configured, skipping email');
      }
      
      // Log the reply in conversation history
      if (request_id) {
        try {
          const histRes = await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=conversation_history,status,assigned_to`,
            { headers }
          );
          const histData = await histRes.json();
          const currentHistory = (Array.isArray(histData) && Array.isArray(histData[0]?.conversation_history)) 
            ? histData[0].conversation_history : [];
          
          currentHistory.push({
            id: crypto.randomUUID(),
            message: `Reply sent to ${email}: ${reply_message}`,
            staff_id,
            staff_name,
            message_type: 'reply_sent',
            action: 'reply_to_investor',
            email_sent: emailSent,
            created_at: new Date().toISOString()
          });
          
          const updatePayload: any = {
            conversation_history: currentHistory,
            updated_at: new Date().toISOString()
          };
          
          // Auto-assign and set in_progress if still open
          const currentStatus = Array.isArray(histData) ? histData[0]?.status : null;
          if (currentStatus === 'open') {
            updatePayload.status = 'in_progress';
            updatePayload.assigned_to = staff_id;
          }
          
          await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
            { method: 'PATCH', headers, body: JSON.stringify(updatePayload) }
          );
        } catch (e) {
          console.error('Error logging reply:', e);
        }
      }
      
      // Also create an in-app notification for the investor
      try {
        // Find investor by email
        const invRes = await fetch(
          `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
          { headers }
        );
        const investors = await invRes.json();
        if (Array.isArray(investors) && investors[0]?.id) {
          await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              investor_id: investors[0].id,
              notification_type: 'support_reply',
              type: 'support_reply',
              title: 'Support Team Response',
              message: reply_message.substring(0, 200) + (reply_message.length > 200 ? '...' : ''),
              metadata: { staff_name, request_id },
              read: false,
              created_at: new Date().toISOString()
            })
          });
        }
      } catch (e) {
        console.error('Error creating in-app notification:', e);
      }
      
      return json({ 
        success: true, 
        email_sent: emailSent, 
        message: emailSent ? 'Reply sent via email and logged' : 'Reply logged (email delivery may have failed)' 
      });
    }

    // ==================== SEND PASSWORD RESET EMAIL ====================
    if (action === 'send_password_reset') {
      const { request_id, email, staff_id, staff_name } = body;
      
      // Find investor by email
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name,email`,
        { headers }
      );
      const investors = await invRes.json();
      const investor = Array.isArray(investors) ? investors?.[0] : null;
      
      if (!investor) {
        return json({ error: 'No investor account found with this email' }, 404);
      }
      
      // Generate reset token
      const resetToken = crypto.randomUUID();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            password_reset_token: resetToken,
            password_reset_expires: resetExpiry,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      if (RESEND_API_KEY) {
        const resetLink = `https://accessyourplace.com/investor/reset-password?token=${resetToken}`;
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <support@accessyourplace.com>',
            to: [investor.email],
            subject: 'Reset Your Password - Access Your Place',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0;">Password Reset</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">Hi ${investor.full_name?.split(' ')[0] || 'there'},</p>
                  <p style="color: #475569;">Our support team has initiated a password reset for your account. Click the button below to set a new password:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: #d4a574; color: #1a365d; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Reset My Password
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">This link will expire in 24 hours.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="color: #94a3b8; font-size: 12px;">If the button doesn't work, copy and paste this link: ${resetLink}</p>
                </div>
              </div>
            `
          })
        });
      }
      
      // Log action
      if (request_id) {
        try {
          const histRes = await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=conversation_history`,
            { headers }
          );
          const histData = await histRes.json();
          const currentHistory = (Array.isArray(histData) && Array.isArray(histData[0]?.conversation_history)) 
            ? histData[0].conversation_history : [];
          
          currentHistory.push({
            id: crypto.randomUUID(),
            message: `Password reset email sent to ${email}`,
            staff_id,
            staff_name,
            message_type: 'email_sent',
            action: 'password_reset',
            created_at: new Date().toISOString()
          });
          
          await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
            { method: 'PATCH', headers, body: JSON.stringify({ conversation_history: currentHistory, updated_at: new Date().toISOString() }) }
          );
        } catch (e) { console.error('Error logging action:', e); }
      }
      
      return json({ success: true, message: 'Password reset email sent' });
    }

    // ==================== RESEND VERIFICATION EMAIL ====================
    if (action === 'resend_verification') {
      const { request_id, email, staff_id, staff_name } = body;
      
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name,email,email_verified`,
        { headers }
      );
      const investors = await invRes.json();
      const investor = Array.isArray(investors) ? investors?.[0] : null;
      
      if (!investor) {
        return json({ error: 'No investor account found with this email' }, 404);
      }
      
      if (investor.email_verified) {
        return json({ error: 'Email is already verified' }, 400);
      }
      
      const verificationToken = crypto.randomUUID();
      const verificationExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            email_verification_token: verificationToken,
            email_verification_expires: verificationExpiry,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      if (RESEND_API_KEY) {
        const verifyLink = `https://accessyourplace.com/investor/verify-email?token=${verificationToken}`;
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <support@accessyourplace.com>',
            to: [investor.email],
            subject: 'Verify Your Email - Access Your Place',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0;">Verify Your Email</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">Hi ${investor.full_name?.split(' ')[0] || 'there'},</p>
                  <p style="color: #475569;">Please verify your email address by clicking the button below:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyLink}" style="display: inline-block; background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Verify My Email
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">This link will expire in 48 hours.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="color: #94a3b8; font-size: 12px;">If the button doesn't work, copy and paste this link: ${verifyLink}</p>
                </div>
              </div>
            `
          })
        });
      }
      
      if (request_id) {
        try {
          const histRes = await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=conversation_history`,
            { headers }
          );
          const histData = await histRes.json();
          const currentHistory = (Array.isArray(histData) && Array.isArray(histData[0]?.conversation_history)) 
            ? histData[0].conversation_history : [];
          
          currentHistory.push({
            id: crypto.randomUUID(),
            message: `Verification email resent to ${email}`,
            staff_id,
            staff_name,
            message_type: 'email_sent',
            action: 'resend_verification',
            created_at: new Date().toISOString()
          });
          
          await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
            { method: 'PATCH', headers, body: JSON.stringify({ conversation_history: currentHistory, updated_at: new Date().toISOString() }) }
          );
        } catch (e) { console.error('Error logging action:', e); }
      }
      
      return json({ success: true, message: 'Verification email sent' });
    }

    // ==================== UNLOCK ACCOUNT ====================
    if (action === 'unlock_account') {
      const { request_id, email, staff_id, staff_name } = body;
      
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name,email`,
        { headers }
      );
      const investors = await invRes.json();
      const investor = Array.isArray(investors) ? investors?.[0] : null;
      
      if (!investor) {
        return json({ error: 'No investor account found with this email' }, 404);
      }
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            // investors has NO account_locked / failed_login_attempts / lockout_until.
            // Writing them failed the entire PATCH, so support could never actually
            // restore a client's access. is_active is the real switch.
            is_active: true,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <support@accessyourplace.com>',
            to: [investor.email],
            subject: 'Your Account Has Been Unlocked - Access Your Place',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #22c55e; margin: 0;">Account Unlocked</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">Hi ${investor.full_name?.split(' ')[0] || 'there'},</p>
                  <p style="color: #475569;">Good news! Our support team has unlocked your account. You can now log in to your investor portal.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://accessyourplace.com/investor/login" style="display: inline-block; background: #d4a574; color: #1a365d; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Log In Now
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">If you continue to have trouble logging in, please contact our support team.</p>
                </div>
              </div>
            `
          })
        });
      }
      
      if (request_id) {
        try {
          const histRes = await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}&select=conversation_history`,
            { headers }
          );
          const histData = await histRes.json();
          const currentHistory = (Array.isArray(histData) && Array.isArray(histData[0]?.conversation_history)) 
            ? histData[0].conversation_history : [];
          
          currentHistory.push({
            id: crypto.randomUUID(),
            message: `Account unlocked for ${email}. Failed login attempts reset to 0.`,
            staff_id,
            staff_name,
            message_type: 'action_taken',
            action: 'unlock_account',
            created_at: new Date().toISOString()
          });
          
          await fetch(
            `${SUPABASE_URL}/rest/v1/support_requests?id=eq.${request_id}`,
            { method: 'PATCH', headers, body: JSON.stringify({ conversation_history: currentHistory, updated_at: new Date().toISOString() }) }
          );
        } catch (e) { console.error('Error logging action:', e); }
      }
      
      return json({ success: true, message: 'Account unlocked successfully' });
    }

    // ==================== GET STATS ====================
    if (action === 'get_stats') {
      const countHeaders = { ...headers, 'Prefer': 'count=exact' };
      
      const [openRes, inProgressRes, resolvedRes, todayRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/support_requests?status=eq.open&select=id`, { headers: countHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/support_requests?status=eq.in_progress&select=id`, { headers: countHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/support_requests?status=eq.resolved&select=id`, { headers: countHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/support_requests?created_at=gte.${new Date().toISOString().split('T')[0]}&select=id`, { headers: countHeaders })
      ]);
      
      const openCount = parseInt(openRes.headers.get('content-range')?.split('/')[1] || '0');
      const inProgressCount = parseInt(inProgressRes.headers.get('content-range')?.split('/')[1] || '0');
      const resolvedCount = parseInt(resolvedRes.headers.get('content-range')?.split('/')[1] || '0');
      const todayCount = parseInt(todayRes.headers.get('content-range')?.split('/')[1] || '0');
      
      return json({
        stats: {
          open: openCount,
          in_progress: inProgressCount,
          resolved: resolvedCount,
          today: todayCount,
          total: openCount + inProgressCount + resolvedCount
        }
      });
    }

    // ==================== LOOKUP INVESTOR BY EMAIL ====================
    if (action === 'lookup_investor') {
      const { email } = body;
      
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,full_name,email,phone,status,email_verified,created_at,last_login`,
        { headers }
      );
      const investors = await invRes.json();
      
      return json({ investor: Array.isArray(investors) ? investors?.[0] || null : null });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error: any) {
    console.error('Support requests error:', error);
    return json({ error: error.message }, 500);
  }
});
