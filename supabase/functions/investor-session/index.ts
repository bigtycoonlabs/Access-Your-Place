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
// Investor session v12.0.0 - 2026-03-04
// FIXED: refresh_session now checks remember_me flag and extends to 30 days for Remember Me users
// FIXED: validate_session updates last_activity timestamp
// OPTIMIZED: Faster session validation with caching headers

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store, max-age=0'
};

function genToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Simple in-memory cache for session validation (5 minute TTL)
const sessionCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedSession(token: string): any | null {
  const cached = sessionCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  sessionCache.delete(token);
  return null;
}

function setCachedSession(token: string, data: any): void {
  if (sessionCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of sessionCache.entries()) {
      if (value.expires < now) sessionCache.delete(key);
    }
  }
  sessionCache.set(token, { data, expires: Date.now() + CACHE_TTL });
}

function invalidateCache(token: string): void {
  sessionCache.delete(token);
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  console.log('[v12] investor-session request received');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, session_token, token, email, base_url, skip_cache } = body;

    console.log('[v12] Action:', action);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[v12] Missing env vars');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error. Please contact support.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // ==================== VALIDATE SESSION ====================
    if (action === 'validate_session') {
      console.log('[v12] Validating session');
      
      if (!session_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'No session token provided' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check cache first (unless skip_cache is true)
      if (!skip_cache) {
        const cached = getCachedSession(session_token);
        if (cached) {
          console.log('[v12] Returning cached session (took', Date.now() - startTime, 'ms)');
          return new Response(
            JSON.stringify(cached),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Get session with remember_me flag
      const sessionUrl = `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=id,investor_id,expires_at,remember_me`;
      const sessionRes = await fetch(sessionUrl, { method: 'GET', headers });
      const sessions = await sessionRes.json();

      if (!Array.isArray(sessions) || sessions.length === 0) {
        console.log('[v12] No active session found');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid session' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessions[0];
      
      if (new Date(session.expires_at) < new Date()) {
        console.log('[v12] Session expired');
        invalidateCache(session_token);
        // Mark as inactive
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ is_active: false })
        });
        return new Response(
          JSON.stringify({ success: false, error: 'Session expired' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get investor data
      const investorUrl = `${supabaseUrl}/rest/v1/investors?id=eq.${session.investor_id}&select=id,email,full_name,referral_code,onboarding_completed,email_verified,preferred_markets,investment_budget_min,investment_budget_max,preferred_operation_types,account_funded,assigned_acquisition_manager_id,deals_closed`;
      const investorRes = await fetch(investorUrl, { method: 'GET', headers });
      const investors = await investorRes.json();

      if (!Array.isArray(investors) || investors.length === 0) {
        console.log('[v12] Investor not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Investor not found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const investor = investors[0];

      // Update last_activity (non-blocking)
      fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ last_activity: new Date().toISOString() })
      }).catch(() => {});

      console.log('[v12] Session valid for:', investor.email, '| remember_me:', session.remember_me, '(took', Date.now() - startTime, 'ms)');

      const responseData = {
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          referral_code: investor.referral_code,
          onboarding_completed: investor.onboarding_completed,
          preferred_markets: investor.preferred_markets,
          investment_budget_min: investor.investment_budget_min,
          investment_budget_max: investor.investment_budget_max,
          preferred_operation_types: investor.preferred_operation_types,
          account_funded: investor.account_funded,
          assigned_acquisition_manager_id: investor.assigned_acquisition_manager_id,
          deals_closed: investor.deals_closed
        },
        session: {
          token: session_token,
          expires_at: session.expires_at,
          remember_me: session.remember_me || false
        },
        email_verified: investor.email_verified || false
      };

      setCachedSession(session_token, responseData);

      return new Response(
        JSON.stringify(responseData),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== VERIFY EMAIL ====================
    if (action === 'verify_email') {
      console.log('[v12] Verifying email token');
      
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Verification token is required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const findUrl = `${supabaseUrl}/rest/v1/investors?email_verification_token=eq.${encodeURIComponent(token)}&select=id,email,full_name,email_verification_expires,email_verified`;
      const findRes = await fetch(findUrl, { method: 'GET', headers });
      const investors = await findRes.json();

      if (!Array.isArray(investors) || investors.length === 0) {
        console.log('[v12] Invalid verification token');
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or expired verification token. Please request a new verification email from your account settings.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const investor = investors[0];

      if (investor.email_verified) {
        return new Response(
          JSON.stringify({ success: true, message: 'Email already verified', already_verified: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (investor.email_verification_expires && new Date(investor.email_verification_expires) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Verification token has expired. Please request a new verification email from your account settings.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
          updated_at: new Date().toISOString()
        })
      });

      console.log('[v12] Email verified for:', investor.email);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email verified successfully!',
          investor: { id: investor.id, email: investor.email, full_name: investor.full_name }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== RESEND VERIFICATION ====================
    if (action === 'resend_verification') {
      console.log('[v12] Resending verification email');
      
      let investor = null;
      
      if (session_token) {
        const sessionUrl = `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`;
        const sessionRes = await fetch(sessionUrl, { method: 'GET', headers });
        const sessions = await sessionRes.json();
        if (Array.isArray(sessions) && sessions.length > 0) {
          const investorUrl = `${supabaseUrl}/rest/v1/investors?id=eq.${sessions[0].investor_id}&select=id,email,full_name,email_verified`;
          const investorRes = await fetch(investorUrl, { method: 'GET', headers });
          const investors = await investorRes.json();
          if (Array.isArray(investors) && investors.length > 0) investor = investors[0];
        }
      }
      
      if (!investor && email) {
        const investorUrl = `${supabaseUrl}/rest/v1/investors?email=ilike.${encodeURIComponent(email.toLowerCase())}&select=id,email,full_name,email_verified`;
        const investorRes = await fetch(investorUrl, { method: 'GET', headers });
        const investors = await investorRes.json();
        if (Array.isArray(investors) && investors.length > 0) investor = investors[0];
      }

      if (!investor) {
        return new Response(
          JSON.stringify({ success: false, error: 'Please provide a valid session token or email address' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (investor.email_verified) {
        return new Response(
          JSON.stringify({ success: true, message: 'Email is already verified' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newToken = genToken();
      const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ email_verification_token: newToken, email_verification_expires: newExpires })
      });

      if (resendKey) {
        const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${newToken}`;
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [investor.email],
              subject: 'Verify Your Email - Access Your Place',
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Investor Portal</p>
                  </div>
                  <div style="padding: 40px 30px;">
                    <h2 style="color: #1a365d; margin: 0 0 20px 0;">Verify Your Email</h2>
                    <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                      Hi ${investor.full_name || 'there'}, please click the button below to verify your email address.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Verify Email Address
                      </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">This verification link will expire in 24 hours.</p>
                  </div>
                  <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Access Your Place. All rights reserved.</p>
                  </div>
                </div>
              `
            })
          });
          if (emailRes.ok) {
            console.log('[v12] Verification email resent to:', investor.email);
          } else {
            const emailError = await emailRes.text();
            console.error('[v12] Email send failed:', emailError);
          }
        } catch (emailErr: any) {
          console.error('[v12] Email error:', emailErr.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Verification email sent! Please check your inbox.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== REFRESH SESSION (extend expiry) ====================
    if (action === 'refresh_session') {
      console.log('[v12] Refreshing session');
      
      if (!session_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'No session token provided' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current session WITH remember_me flag
      const sessionUrl = `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=id,investor_id,expires_at,remember_me`;
      const sessionRes = await fetch(sessionUrl, { method: 'GET', headers });
      const sessions = await sessionRes.json();

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid session' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = sessions[0];
      
      // CRITICAL FIX: Extend based on remember_me flag
      // Remember Me = 30 days, otherwise = 24 hours
      const extensionMs = session.remember_me 
        ? 30 * 24 * 60 * 60 * 1000   // 30 days
        : 24 * 60 * 60 * 1000;        // 24 hours
      
      const newExpiry = new Date(Date.now() + extensionMs).toISOString();
      
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          expires_at: newExpiry,
          last_activity: new Date().toISOString()
        })
      });

      invalidateCache(session_token);

      console.log('[v12] Session refreshed | remember_me:', session.remember_me, '| new expiry:', newExpiry, '| extension:', session.remember_me ? '30 days' : '24 hours');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Session refreshed',
          expires_at: newExpiry,
          remember_me: session.remember_me || false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[v12] Unknown action:', action);
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Supported: validate_session, verify_email, resend_verification, refresh_session' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[v12] Error:', error.name, error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again or contact support.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

