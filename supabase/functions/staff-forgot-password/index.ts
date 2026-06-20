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
// staff-forgot-password v2.1 - Updated to use verified domain, no bcrypt
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Simple SHA-256 hash function
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ayp_staff_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: 'Config error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const emailLower = body.email?.toLowerCase().trim();
    const { action, reset_token, new_password } = body;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Helper function to log emails
    async function logEmail(templateType: string, recipientEmail: string, subject: string, status: string, errorMessage?: string, resendId?: string) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            template_type: templateType,
            recipient_email: recipientEmail,
            subject,
            status,
            error_message: errorMessage || null,
            resend_id: resendId || null,
            sent_at: new Date().toISOString()
          })
        });
      } catch (e) {
        console.error('Failed to log email:', e);
      }
    }

    // Handle password reset action
    if (action === 'reset_password' && reset_token && new_password) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/staff_users?reset_token=eq.${reset_token}&select=*`,
        { headers }
      );
      const staff = await res.json();

      if (!staff?.length) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const user = staff[0];
      if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ error: 'Token has expired' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Hash the new password with SHA-256
      const hashedPassword = await hashPassword(new_password);

      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${user.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ password_hash: hashedPassword, reset_token: null, reset_token_expires: null })
      });

      return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle forgot password request
    if (!emailLower) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&is_active=eq.true&select=*`,
      { headers }
    );
    const staff = await res.json();

    let emailSent = false;
    let emailError = null;
    let emailId = null;

    if (staff?.length && RESEND_KEY) {
      const token = 'rst' + Date.now() + 'x' + Math.floor(Math.random() * 1000000000);
      const expires = new Date(Date.now() + 3600000).toISOString();

      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff[0].id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ reset_token: token, reset_token_expires: expires })
      });

      const resetUrl = `${body.base_url || 'https://accessyourplace.com'}/staff/reset-password?token=${token}`;
      const subject = 'Reset Your Staff Password - Access Your Place';
      
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Access Your Place <noreply@accessyourplace.com>',
          to: staff[0].email,
          subject,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:28px;">Access Your Place</h1>
              <p style="color:#f59e0b;margin:10px 0 0;font-size:14px;">Staff Portal</p>
            </div>
            <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
              <h2 style="color:#1e3a5f;margin-top:0;">Password Reset Request</h2>
              <p style="color:#374151;">Hi ${staff[0].first_name || staff[0].name || 'there'},</p>
              <p style="color:#374151;">We received a request to reset your staff portal password. Click the button below to create a new password:</p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetUrl}" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;box-shadow:0 4px 6px rgba(245,158,11,0.3);">Reset Password</a>
              </div>
              <p style="color:#6b7280;font-size:14px;">This link will expire in 1 hour for security reasons.</p>
              <p style="color:#9ca3af;font-size:12px;margin-top:20px;">If you didn't request this reset, please contact your administrator immediately.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
              <p style="color:#9ca3af;font-size:11px;">Or copy this link: ${resetUrl}</p>
            </div>
            <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">
              <p>Â© 2026 Access Your Place. All rights reserved.</p>
            </div>
          </body></html>`
        })
      });

      const result = await emailRes.json();
      emailSent = emailRes.ok;
      emailId = result.id;
      if (!emailRes.ok) emailError = result;

      // Log the email
      await logEmail(
        'staff_password_reset',
        staff[0].email,
        subject,
        emailRes.ok ? 'sent' : 'failed',
        emailRes.ok ? null : JSON.stringify(result),
        result.id
      );
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'If email exists, reset link sent.',
      debug: { emailSent, emailError, emailId }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

