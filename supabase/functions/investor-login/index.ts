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
// Investor login v11.0.0 - 2026-03-04
// CRITICAL FIX: Now handles ALL password hash formats:
// 1. v2$salt$hash - Client-side SHA-256 (new standard)
// 2. v1$salt$hash - Legacy simpleHash with 100 iterations
// 3. SHA-256(password + 'yp_salt_2024') - investor-auth-v2 format (no prefix)
// 4. Plain text - auto-upgraded on login
// All successful logins auto-upgrade to v2$ format

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function makeUUID(): string {
  const h = '0123456789abcdef';
  let u = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) u += '-';
    else if (i === 14) u += '4';
    else if (i === 19) u += h[(Math.random() * 4) | 8];
    else u += h[(Math.random() * 16) | 0];
  }
  return u;
}

function genToken(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 64; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
}

function generateSalt(): string {
  let salt = '';
  for (let i = 0; i < 32; i++) salt += Math.floor(Math.random() * 16).toString(16);
  return salt;
}

// ===== v1$ hash functions (legacy) =====
function simpleHash(str: string): string {
  let hash1 = 5381, hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  let combined = (hash1 >>> 0).toString(16).padStart(8, '0') + (hash2 >>> 0).toString(16).padStart(8, '0');
  for (let pass = 0; pass < 100; pass++) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < combined.length; i++) {
      const c = combined.charCodeAt(i);
      h1 = ((h1 << 5) + h1) ^ c;
      h2 = ((h2 << 5) + h2) ^ c;
    }
    combined = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + combined.substring(0, 48);
  }
  return combined.substring(0, 64);
}

function v1HashPassword(password: string, salt: string): string {
  return simpleHash(salt + password + salt);
}

// ===== v2$ hash functions (SHA-256, new standard) =====
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function v2HashPassword(password: string, salt: string): Promise<string> {
  return await sha256Hex(salt + password);
}

async function createV2Hash(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await v2HashPassword(password, salt);
  return `v2$${salt}$${hash}`;
}

// ===== investor-auth-v2 format (SHA-256 with fixed salt) =====
async function authV2Hash(password: string): Promise<string> {
  return await sha256Hex(password + 'yp_salt_2024');
}

// ===== Universal password verification =====
async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; format: string }> {
  if (!storedHash) return { valid: false, format: 'empty' };

  // Format 1: v2$salt$hash (client-side SHA-256)
  if (storedHash.startsWith('v2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v2_malformed' };
    const salt = parts[1];
    const hash = parts[2];
    const computed = await v2HashPassword(password, salt);
    return { valid: computed === hash, format: 'v2' };
  }

  // Format 2: v1$salt$hash (legacy simpleHash)
  if (storedHash.startsWith('v1$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v1_malformed' };
    const salt = parts[1];
    const hash = parts[2];
    return { valid: v1HashPassword(password, salt) === hash, format: 'v1' };
  }

  // Format 3: investor-auth-v2 SHA-256 (64-char hex string, no prefix)
  // This is SHA-256(password + 'yp_salt_2024')
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    const authV2Computed = await authV2Hash(password);
    if (authV2Computed === storedHash) {
      return { valid: true, format: 'auth_v2_sha256' };
    }
    // Could also be some other 64-char hex - fall through to plain text check
  }

  // Format 4: Plain text comparison
  if (password === storedHash) {
    return { valid: true, format: 'plain_text' };
  }

  return { valid: false, format: 'unknown' };
}

// Log authentication errors for admin monitoring
async function logAuthError(supabaseUrl: string, headers: Record<string, string>, errorType: string, email: string | null, investorId: string | null, errorMessage: string, metadata: Record<string, any> = {}) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/auth_errors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        error_type: errorType,
        email: email,
        investor_id: investorId,
        error_message: errorMessage,
        metadata: metadata
      })
    });
    console.log(`[v11] Logged auth error: ${errorType} for ${email || 'unknown'}`);
  } catch (e) {
    console.error('[v11] Failed to log auth error:', e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, email, password, remember_me, session_token, reset_method, phone, base_url, otp_code, reset_token, new_password } = body;
    console.log('[v11] investor-login action:', action);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

    // ==================== GET AUTH ERRORS (for admin dashboard) ====================
    if (action === 'get_auth_errors') {
      const { limit = 50, offset = 0, error_type, resolved, email_filter } = body;
      
      let query = `${supabaseUrl}/rest/v1/auth_errors?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (error_type) query += `&error_type=eq.${encodeURIComponent(error_type)}`;
      if (resolved !== undefined) query += `&resolved=eq.${resolved}`;
      if (email_filter) query += `&email=ilike.*${encodeURIComponent(email_filter)}*`;
      
      const res = await fetch(query, { method: 'GET', headers });
      const errors = await res.json();
      
      const allErrorsRes = await fetch(`${supabaseUrl}/rest/v1/auth_errors?select=error_type,resolved&created_at=gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`, { method: 'GET', headers });
      const allErrors = await allErrorsRes.json();
      let counts: any = {};
      if (Array.isArray(allErrors)) {
        counts = {
          total_24h: allErrors.length,
          login_failed: allErrors.filter((e: any) => e.error_type === 'login_failed').length,
          verification_failed: allErrors.filter((e: any) => e.error_type === 'verification_failed').length,
          password_reset_failed: allErrors.filter((e: any) => e.error_type === 'password_reset_failed').length,
          unresolved: allErrors.filter((e: any) => !e.resolved).length
        };
      }
      
      return new Response(JSON.stringify({ success: true, errors, counts }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== RESOLVE AUTH ERROR ====================
    if (action === 'resolve_auth_error') {
      const { error_id, staff_id, notes } = body;
      if (!error_id) {
        return new Response(JSON.stringify({ success: false, error: 'error_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      await fetch(`${supabaseUrl}/rest/v1/auth_errors?id=eq.${error_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: staff_id,
          metadata: notes ? { resolution_notes: notes } : undefined
        })
      });
      
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== UPDATE PROFILE (for onboarding) ====================
    if (action === 'update_profile') {
      const { investor_id, company_name, portfolio_count, investment_budget_min, investment_budget_max, preferred_markets, preferred_operation_types, onboarding_completed, show_guided_tour, full_name, phone: profilePhone } = body;
      
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (company_name !== undefined) updateData.company_name = company_name;
      if (portfolio_count !== undefined) updateData.portfolio_count = portfolio_count;
      if (investment_budget_min !== undefined) updateData.investment_budget_min = investment_budget_min;
      if (investment_budget_max !== undefined) updateData.investment_budget_max = investment_budget_max;
      if (preferred_markets !== undefined) updateData.preferred_markets = preferred_markets;
      if (preferred_operation_types !== undefined) updateData.preferred_operation_types = preferred_operation_types;
      if (onboarding_completed !== undefined) updateData.onboarding_completed = onboarding_completed;
      if (show_guided_tour !== undefined) updateData.show_guided_tour = show_guided_tour;
      if (full_name !== undefined) updateData.full_name = full_name;
      if (profilePhone !== undefined) updateData.phone = profilePhone;

      console.log('[v11] Updating profile for investor:', investor_id);
      
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('[v11] Update failed:', errorText);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update profile' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const updatedInvestors = await updateRes.json();
      if (!Array.isArray(updatedInvestors) || updatedInvestors.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const investor = updatedInvestors[0];
      console.log('[v11] Profile updated successfully for:', investor.email);

      if (onboarding_completed) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/staff_notifications`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              notification_type: 'onboarding_completed',
              title: 'Investor Completed Onboarding',
              message: `${investor.full_name || 'An investor'} (${investor.email}) has completed their onboarding profile.`,
              priority: 'low',
              target_department: 'success_managers',
              metadata: { investor_id, investor_email: investor.email, preferred_markets, preferred_operation_types }
            })
          });
        } catch (e) {
          console.error('[v11] Notification error:', e);
        }
      }

      return new Response(JSON.stringify({ success: true, investor }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== LOGIN ====================
    if (action === 'login') {
      if (!email || !password) return new Response(JSON.stringify({ success: false, error: 'Email and password are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const normalizedEmail = email.toLowerCase().trim();
      console.log('[v11] Login attempt for:', normalizedEmail);

      // Case-insensitive email lookup
      const findRes = await fetch(`${supabaseUrl}/rest/v1/investors?email=ilike.${encodeURIComponent(normalizedEmail)}&select=*`, { method: 'GET', headers });
      const investors = await findRes.json();
      
      if (!Array.isArray(investors) || investors.length === 0) {
        await logAuthError(supabaseUrl, headers, 'login_failed', normalizedEmail, null, 'Account not found', { reason: 'email_not_found' });
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const investor = investors[0];
      const storedPassword = investor.password_hash || investor.password;
      
      // Universal password verification - handles v2$, v1$, auth_v2_sha256, and plain text
      const verification = await verifyPassword(password, storedPassword);
      console.log('[v11] Password verification result:', { format: verification.format, valid: verification.valid, email: normalizedEmail });
      
      if (!verification.valid) {
        await logAuthError(supabaseUrl, headers, 'login_failed', normalizedEmail, investor.id, 'Invalid password', { 
          reason: 'wrong_password', 
          investor_name: investor.full_name,
          stored_format: verification.format
        });
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Auto-upgrade password to v2$ format if not already
      if (verification.format !== 'v2') {
        try {
          const newV2Hash = await createV2Hash(password);
          await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, { 
            method: 'PATCH', 
            headers, 
            body: JSON.stringify({ password_hash: newV2Hash }) 
          });
          console.log(`[v11] Auto-upgraded password from ${verification.format} to v2$ for:`, normalizedEmail);
        } catch (upgradeErr) {
          console.error('[v11] Password upgrade failed (non-critical):', upgradeErr);
        }
      }

      // Create session with proper remember_me duration
      const newSessionToken = makeUUID() + '-' + makeUUID();
      const sessionDays = remember_me ? 30 : 1;
      const sessionExpires = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
      
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({ 
          investor_id: investor.id, 
          session_token: newSessionToken, 
          is_active: true, 
          remember_me: remember_me || false, 
          expires_at: sessionExpires, 
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        }) 
      });
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ last_login: new Date().toISOString() }) 
      });

      console.log('[v11] Login successful for:', normalizedEmail, '| format:', verification.format, '| remember_me:', !!remember_me);
      
      return new Response(JSON.stringify({ 
        success: true, 
        investor: { 
          id: investor.id, email: investor.email, full_name: investor.full_name, 
          phone: investor.phone, referral_code: investor.referral_code, 
          onboarding_completed: investor.onboarding_completed, 
          preferred_markets: investor.preferred_markets, 
          preferred_operation_types: investor.preferred_operation_types, 
          investment_budget_min: investor.investment_budget_min, 
          investment_budget_max: investor.investment_budget_max 
        }, 
        session: { token: newSessionToken, expires_at: sessionExpires }, 
        email_verified: investor.email_verified || false 
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== LOGOUT ====================
    if (action === 'logout') {
      if (session_token) await fetch(`${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(session_token)}`, { method: 'PATCH', headers, body: JSON.stringify({ is_active: false }) });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== FORGOT PASSWORD ====================
    if (action === 'forgot_password') {
      if (!email) return new Response(JSON.stringify({ success: false, error: 'Email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const normalizedEmail = email.toLowerCase().trim();
      console.log('[v11] Forgot password request for:', normalizedEmail);

      // Case-insensitive email lookup
      const findRes = await fetch(`${supabaseUrl}/rest/v1/investors?email=ilike.${encodeURIComponent(normalizedEmail)}&select=id,email,full_name`, { method: 'GET', headers });
      const investors = await findRes.json();
      
      if (!Array.isArray(investors) || investors.length === 0) {
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', normalizedEmail, null, 'Account not found for password reset', { reason: 'email_not_found' });
        // Still return success to prevent email enumeration
        return new Response(JSON.stringify({ success: true, message: 'If an account exists, you will receive a reset link.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const investor = investors[0];
      const resetTokenValue = genToken();
      const resetExpires = new Date(Date.now() + 3600000).toISOString();
      
      // Store reset token on investor record
      const storeRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ 
          reset_token: resetTokenValue, 
          reset_token_expires: resetExpires 
        }) 
      });
      console.log('[v11] Reset token stored, status:', storeRes.status);

      // Also store in password_reset_tokens table for redundancy
      try {
        await fetch(`${supabaseUrl}/rest/v1/password_reset_tokens`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: investor.id,
            token: resetTokenValue,
            expires_at: resetExpires,
            used: false
          })
        });
        console.log('[v11] Reset token also stored in password_reset_tokens table');
      } catch (tokenTableErr) {
        console.warn('[v11] Could not store in password_reset_tokens table (may not exist):', tokenTableErr);
      }

      // Send reset email via Resend
      const resetUrl = `${base_url || 'https://accessyourplace.com'}/investor/reset-password?token=${resetTokenValue}`;
      
      if (resendKey) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              from: 'Access Your Place <noreply@accessyourplace.com>', 
              to: [investor.email], 
              subject: 'Reset Your Password - Access Your Place', 
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Investor Portal</p>
                  </div>
                  <div style="padding: 40px 30px;">
                    <h2 style="color: #1a365d; margin: 0 0 20px 0;">Password Reset Request</h2>
                    <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                      Hi ${investor.full_name || 'there'},
                    </p>
                    <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                      We received a request to reset your password. Click the button below to create a new password:
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Reset Password
                      </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
                    </p>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                      If the button doesn't work, copy and paste this link into your browser:<br/>
                      <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                    </p>
                  </div>
                  <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      &copy; ${new Date().getFullYear()} Access Your Place. All rights reserved.
                    </p>
                  </div>
                </div>
              `
            }) 
          });
          
          const emailResult = await emailRes.json();
          console.log('[v11] Resend API response:', emailRes.status, JSON.stringify(emailResult));
          
          if (!emailRes.ok) {
            console.error('[v11] Resend API error:', emailResult);
            await logAuthError(supabaseUrl, headers, 'password_reset_failed', normalizedEmail, investor.id, 
              `Email delivery failed: ${emailResult?.message || emailResult?.error || 'Unknown Resend error'}`, 
              { reason: 'email_delivery_failed', resend_status: emailRes.status, resend_response: emailResult }
            );
          } else {
            console.log('[v11] Password reset email sent successfully to:', investor.email, 'Resend ID:', emailResult?.id);
          }
        } catch (emailErr: any) {
          console.error('[v11] Email send exception:', emailErr.message);
          await logAuthError(supabaseUrl, headers, 'password_reset_failed', normalizedEmail, investor.id, 
            `Email send exception: ${emailErr.message}`, 
            { reason: 'email_exception', error: emailErr.message }
          );
        }
      } else {
        console.error('[v11] RESEND_API_KEY not configured! Cannot send password reset email.');
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', normalizedEmail, investor.id, 
          'RESEND_API_KEY not configured', 
          { reason: 'no_resend_key' }
        );
      }

      return new Response(JSON.stringify({ success: true, message: 'If an account exists, you will receive a reset link.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== VALIDATE TOKEN ====================
    if (action === 'validate_token') {
      if (!reset_token) return new Response(JSON.stringify({ valid: false, error: 'Reset token is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const findRes = await fetch(`${supabaseUrl}/rest/v1/investors?reset_token=eq.${encodeURIComponent(reset_token)}&select=id,email,reset_token_expires`, { method: 'GET', headers });
      const investors = await findRes.json();
      
      if (!Array.isArray(investors) || investors.length === 0) {
        // Also check password_reset_tokens table
        try {
          const tokenRes = await fetch(`${supabaseUrl}/rest/v1/password_reset_tokens?token=eq.${encodeURIComponent(reset_token)}&used=eq.false&select=investor_id,expires_at`, { method: 'GET', headers });
          const tokens = await tokenRes.json();
          if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenRecord = tokens[0];
            if (new Date(tokenRecord.expires_at) < new Date()) {
              return new Response(JSON.stringify({ valid: false, error: 'Reset token has expired' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            // Get investor email for display
            const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${tokenRecord.investor_id}&select=email`, { method: 'GET', headers });
            const invData = await invRes.json();
            if (Array.isArray(invData) && invData.length > 0) {
              const emailParts = invData[0].email.split('@');
              const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
              return new Response(JSON.stringify({ valid: true, email: maskedEmail }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
        } catch (e) {
          console.warn('[v11] password_reset_tokens lookup failed:', e);
        }
        
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', null, null, 'Invalid reset token used', { reason: 'invalid_token' });
        return new Response(JSON.stringify({ valid: false, error: 'Invalid reset token' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const investor = investors[0];
      if (investor.reset_token_expires && new Date(investor.reset_token_expires) < new Date()) {
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', investor.email, investor.id, 'Expired reset token used', { reason: 'expired_token' });
        return new Response(JSON.stringify({ valid: false, error: 'Reset token has expired' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const emailParts = investor.email.split('@');
      const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
      return new Response(JSON.stringify({ valid: true, email: maskedEmail }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== RESET PASSWORD ====================
    if (action === 'reset_password') {
      if (!reset_token || !new_password || new_password.length < 8) return new Response(JSON.stringify({ success: false, error: 'Valid reset token and password (8+ chars) required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      // Try investor record first
      const findRes = await fetch(`${supabaseUrl}/rest/v1/investors?reset_token=eq.${encodeURIComponent(reset_token)}&select=id,email,full_name,reset_token_expires`, { method: 'GET', headers });
      let investors = await findRes.json();
      
      // Fallback: check password_reset_tokens table
      if (!Array.isArray(investors) || investors.length === 0) {
        try {
          const tokenRes = await fetch(`${supabaseUrl}/rest/v1/password_reset_tokens?token=eq.${encodeURIComponent(reset_token)}&used=eq.false&select=investor_id,expires_at`, { method: 'GET', headers });
          const tokens = await tokenRes.json();
          if (Array.isArray(tokens) && tokens.length > 0) {
            const tokenRecord = tokens[0];
            if (new Date(tokenRecord.expires_at) < new Date()) {
              return new Response(JSON.stringify({ success: false, error: 'Reset token has expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${tokenRecord.investor_id}&select=id,email,full_name`, { method: 'GET', headers });
            investors = await invRes.json();
            // Mark token as used
            await fetch(`${supabaseUrl}/rest/v1/password_reset_tokens?token=eq.${encodeURIComponent(reset_token)}`, {
              method: 'PATCH', headers, body: JSON.stringify({ used: true, used_at: new Date().toISOString() })
            });
          }
        } catch (e) {
          console.warn('[v11] password_reset_tokens fallback failed:', e);
        }
      }
      
      if (!Array.isArray(investors) || investors.length === 0) {
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', null, null, 'Invalid reset token during password reset', { reason: 'invalid_token' });
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired reset token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const investor = investors[0];
      if (investor.reset_token_expires && new Date(investor.reset_token_expires) < new Date()) {
        await logAuthError(supabaseUrl, headers, 'password_reset_failed', investor.email, investor.id, 'Expired reset token during password reset', { reason: 'expired_token' });
        return new Response(JSON.stringify({ success: false, error: 'Reset token has expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Hash new password with v2$ format (new standard)
      const newHash = await createV2Hash(new_password);
      console.log('[v11] Resetting password with v2$ hash for:', investor.email);
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ password_hash: newHash, reset_token: null, reset_token_expires: null }) 
      });
      
      // Invalidate all existing sessions
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?investor_id=eq.${investor.id}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ is_active: false }) 
      });
      
      // Send confirmation email
      if (resendKey) {
        try {
          await fetch('https://api.resend.com/emails', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              from: 'Access Your Place <noreply@accessyourplace.com>', 
              to: [investor.email], 
              subject: 'Your Password Has Been Reset', 
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #22c55e; margin: 0;">Password Reset Successful</h1>
                  </div>
                  <div style="padding: 30px;">
                    <p>Hi ${investor.full_name || 'there'},</p>
                    <p>Your password has been successfully reset. You can now log in with your new password.</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${base_url || 'https://accessyourplace.com'}/investor/login" style="display: inline-block; background: #f59e0b; color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In Now</a>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">If you didn't make this change, please contact support immediately.</p>
                  </div>
                </div>
              `
            }) 
          });
          console.log('[v11] Password reset confirmation email sent to:', investor.email);
        } catch (e) { 
          console.error('[v11] Confirmation email error:', e); 
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Password reset successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== CHANGE PASSWORD (authenticated) ====================
    if (action === 'change_password') {
      const { session_token: sessToken, current_password, new_password: newPwd } = body;
      if (!sessToken || !current_password || !newPwd || newPwd.length < 8) {
        return new Response(JSON.stringify({ success: false, error: 'Valid session and passwords (8+ chars) required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Validate session
      const sessRes = await fetch(`${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(sessToken)}&is_active=eq.true&select=investor_id`, { method: 'GET', headers });
      const sessions = await sessRes.json();
      if (!Array.isArray(sessions) || sessions.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const investorId = sessions[0].investor_id;
      const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=password_hash`, { method: 'GET', headers });
      const invData = await invRes.json();
      if (!Array.isArray(invData) || invData.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const currentVerification = await verifyPassword(current_password, invData[0].password_hash);
      if (!currentVerification.valid) {
        return new Response(JSON.stringify({ success: false, error: 'Current password is incorrect' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const newHash = await createV2Hash(newPwd);
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, { 
        method: 'PATCH', 
        headers, 
        body: JSON.stringify({ password_hash: newHash, updated_at: new Date().toISOString() }) 
      });
      
      console.log('[v11] Password changed successfully for investor:', investorId);
      return new Response(JSON.stringify({ success: true, message: 'Password changed successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[v11] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

