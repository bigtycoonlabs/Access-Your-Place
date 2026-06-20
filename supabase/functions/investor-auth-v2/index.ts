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

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===== SHA-256 helper =====
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Original auth-v2 hash (SHA-256 with fixed salt) =====
async function authV2Hash(password: string): Promise<string> {
  return await sha256Hex(password + 'yp_salt_2024');
}

// ===== v2$ hash (new standard: SHA-256 with random salt) =====
function generateSalt(): string {
  let salt = '';
  for (let i = 0; i < 32; i++) salt += Math.floor(Math.random() * 16).toString(16);
  return salt;
}

async function v2HashPassword(password: string, salt: string): Promise<string> {
  return await sha256Hex(salt + password);
}

async function createV2Hash(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await v2HashPassword(password, salt);
  return `v2$${salt}$${hash}`;
}

// ===== v1$ hash (legacy simpleHash) =====
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

// ===== Universal password verification =====
async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; format: string }> {
  if (!storedHash) return { valid: false, format: 'empty' };

  // Format 1: v2$salt$hash (new standard SHA-256)
  if (storedHash.startsWith('v2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v2_malformed' };
    const computed = await v2HashPassword(password, parts[1]);
    return { valid: computed === parts[2], format: 'v2' };
  }

  // Format 2: v1$salt$hash (legacy simpleHash)
  if (storedHash.startsWith('v1$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v1_malformed' };
    return { valid: v1HashPassword(password, parts[1]) === parts[2], format: 'v1' };
  }

  // Format 3: auth-v2 SHA-256 (64-char hex, no prefix)
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    const authV2Computed = await authV2Hash(password);
    if (authV2Computed === storedHash) {
      return { valid: true, format: 'auth_v2_sha256' };
    }
  }

  // Format 4: Plain text
  if (password === storedHash) {
    return { valid: true, format: 'plain_text' };
  }

  return { valid: false, format: 'unknown' };
}

const parseUserAgent = (ua: string) => {
  let deviceType = 'Desktop', browser = 'Unknown', os = 'Unknown';
  if (!ua) return { deviceType, browser, os };
  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  return { deviceType, browser, os };
};

const getHeader = (headers: any, name: string): string | null => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lowerName = name.toLowerCase();
  for (const key in headers) {
    if (key.toLowerCase() === lowerName) return headers[key];
  }
  return null;
};

const sendSMS = async (to: string, message: string) => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!accountSid || !authToken || !fromNumber) return { success: false, error: 'SMS service not configured' };
  let normalizedPhone = to.replace(/\D/g, '');
  if (normalizedPhone.length === 10) normalizedPhone = '1' + normalizedPhone;
  if (!normalizedPhone.startsWith('+')) normalizedPhone = '+' + normalizedPhone;
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: normalizedPhone, From: fromNumber, Body: message })
    });
    const result = await response.json();
    return response.ok ? { success: true, sid: result.sid } : { success: false, error: result.message || 'Failed to send SMS' };
  } catch (error: any) {
    return { success: false, error: error.message || 'SMS service error' };
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const clientIP = (getHeader(req.headers, 'x-forwarded-for') || 'unknown').split(',')[0]?.trim() || 'unknown';
  const userAgent = getHeader(req.headers, 'user-agent') || '';

  const dbFetch = async (table: string, method: string, data?: any, query?: string) => {
    const url = `${supabaseUrl}/rest/v1/${table}${query || ''}`;
    const response = await fetch(url, {
      method,
      headers: { 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: data && (method === 'POST' || method === 'PATCH') ? JSON.stringify(data) : undefined
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { result = text; }
    return { ok: response.ok, status: response.status, data: result };
  };

  const sendEmail = async (to: string, subject: string, html: string) => {
    if (!resendApiKey) {
      console.error('[auth-v2] RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Access Your Place <noreply@accessyourplace.com>', to: [to], subject, html })
      });
      const result = await res.json();
      if (res.ok) {
        console.log('[auth-v2] Email sent successfully to:', to, 'ID:', result?.id);
        return { success: true, id: result?.id };
      } else {
        console.error('[auth-v2] Resend error:', result);
        return { success: false, error: result?.message || 'Email delivery failed' };
      }
    } catch (e: any) {
      console.error('[auth-v2] Email exception:', e.message);
      return { success: false, error: e.message };
    }
  };

  const createSession = async (investorId: string, rememberMe = false) => {
    const sessionToken = `sess_${generateToken()}`;
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
    await dbFetch('investor_sessions', 'POST', {
      investor_id: investorId, session_token: sessionToken, device_info: parseUserAgent(userAgent),
      ip_address: clientIP, user_agent: userAgent, remember_me: rememberMe,
      expires_at: expiresAt.toISOString(), is_active: true, last_activity: new Date().toISOString()
    });
    return { token: sessionToken, expires: expiresAt.getTime(), rememberMe };
  };

  try {
    const body = await req.json();
    const { action } = body;
    console.log('[auth-v2] Action:', action);

    if (action === 'register') {
      const { email, password, full_name, phone, referral_code, base_url } = body;
      if (!email || !password) return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (password.length < 8) return new Response(JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const cleanEmail = email.toLowerCase().trim();
      const existing = await dbFetch('investors', 'GET', null, `?email=ilike.${encodeURIComponent(cleanEmail)}&select=id`);
      if (existing.data?.length > 0) return new Response(JSON.stringify({ success: false, error: 'Email already registered' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      // Use v2$ hash format (new standard)
      const hashedPassword = await createV2Hash(password);
      const newReferralCode = 'YP-' + Date.now().toString(36).toUpperCase();
      const emailVerificationToken = generateToken();
      const deviceInfo = parseUserAgent(userAgent);
      const fingerprint = `${deviceInfo.deviceType}-${deviceInfo.browser}-${deviceInfo.os}`.toLowerCase();
      const insertData: any = {
        email: cleanEmail, password_hash: hashedPassword, full_name: full_name || 'Investor',
        phone: phone || null, referral_code: newReferralCode, is_verified: false, email_verified: false,
        email_verification_token: emailVerificationToken,
        email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        security_alerts_enabled: true, known_devices: [fingerprint],
        known_ips: clientIP !== 'unknown' ? [clientIP] : []
      };
      if (referral_code) insertData.referred_by = referral_code;
      const insertResult = await dbFetch('investors', 'POST', insertData, '?select=id,email,full_name,referral_code');
      if (!insertResult.ok) return new Response(JSON.stringify({ success: false, error: 'Registration failed', details: insertResult.data }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const newInvestor = Array.isArray(insertResult.data) ? insertResult.data[0] : insertResult.data;
      const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${emailVerificationToken}`;
      sendEmail(cleanEmail, 'Verify Your Email - Access Your Place', `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#2d5a87);padding:40px 20px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">Welcome to Access Your Place!</h1></div><div style="padding:30px;"><p>Hi ${full_name || 'there'},</p><p>Please verify your email:</p><div style="text-align:center;margin:30px 0;"><a href="${verifyUrl}" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#1a365d;padding:16px 40px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Verify Email</a></div><p style="color:#666;font-size:14px;">This link expires in 24 hours.</p></div></div>`);
      const session = await createSession(newInvestor.id, false);
      console.log('[auth-v2] Registration successful for:', cleanEmail, '(v2$ hash)');
      return new Response(JSON.stringify({ success: true, investor: { ...newInvestor, email_verified: false }, session, message: 'Registration successful!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'login') {
      const { email, password, remember_me } = body;
      if (!email || !password) return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const cleanEmail = email.toLowerCase().trim();
      const result = await dbFetch('investors', 'GET', null, `?email=ilike.${encodeURIComponent(cleanEmail)}&select=*`);
      if (!result.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const investor = result.data[0];
      const storedHash = investor.password_hash || investor.password;
      
      // Universal password verification
      const verification = await verifyPassword(password, storedHash);
      console.log('[auth-v2] Login verification:', { email: cleanEmail, format: verification.format, valid: verification.valid });
      
      if (!verification.valid) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Auto-upgrade to v2$ format
      if (verification.format !== 'v2') {
        try {
          const newHash = await createV2Hash(password);
          await dbFetch('investors', 'PATCH', { password_hash: newHash }, `?id=eq.${investor.id}`);
          console.log(`[auth-v2] Auto-upgraded password from ${verification.format} to v2$ for:`, cleanEmail);
        } catch (e) {
          console.error('[auth-v2] Password upgrade failed:', e);
        }
      }
      
      const session = await createSession(investor.id, remember_me || false);
      dbFetch('investors', 'PATCH', { last_login: new Date().toISOString() }, `?id=eq.${investor.id}`);
      const { password_hash, reset_token, reset_token_expires, email_verification_token, ...safeInvestor } = investor;
      console.log('[auth-v2] Login successful for:', cleanEmail, '| format:', verification.format);
      return new Response(JSON.stringify({ success: true, investor: safeInvestor, session, email_verified: investor.email_verified || false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'validate_session') {
      const { session_token } = body;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'No session token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=*`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const session = sessionResult.data[0];
      if (new Date(session.expires_at) < new Date()) {
        await dbFetch('investor_sessions', 'PATCH', { is_active: false }, `?id=eq.${session.id}`);
        return new Response(JSON.stringify({ success: false, error: 'Session expired' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const investorResult = await dbFetch('investors', 'GET', null, `?id=eq.${session.investor_id}&select=*`);
      if (!investorResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investor = investorResult.data[0];
      const { password_hash, reset_token, email_verification_token, ...safeInvestor } = investor;
      dbFetch('investor_sessions', 'PATCH', { last_activity: new Date().toISOString() }, `?id=eq.${session.id}`);
      return new Response(JSON.stringify({ success: true, investor: safeInvestor, session: { token: session_token, expires: new Date(session.expires_at).getTime(), rememberMe: session.remember_me } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify_email') {
      const { verification_token } = body;
      if (!verification_token) return new Response(JSON.stringify({ success: false, error: 'Token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const result = await dbFetch('investors', 'GET', null, `?email_verification_token=eq.${encodeURIComponent(verification_token)}&select=id,email,full_name,email_verified,email_verification_expires`);
      if (!result.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investor = result.data[0];
      if (investor.email_verified) return new Response(JSON.stringify({ success: true, already_verified: true, message: 'Email already verified' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (investor.email_verification_expires && new Date(investor.email_verification_expires) < new Date()) return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await dbFetch('investors', 'PATCH', { email_verified: true, email_verification_token: null, email_verification_expires: null }, `?id=eq.${investor.id}`);
      return new Response(JSON.stringify({ success: true, message: 'Email verified!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'logout') {
      const { session_token } = body;
      if (session_token) await dbFetch('investor_sessions', 'PATCH', { is_active: false }, `?session_token=eq.${encodeURIComponent(session_token)}`);
      return new Response(JSON.stringify({ success: true, message: 'Logged out' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'forgot_password') {
      const { email, base_url } = body;
      if (!email) return new Response(JSON.stringify({ success: false, error: 'Email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const cleanEmail = email.toLowerCase().trim();
      console.log('[auth-v2] Forgot password for:', cleanEmail);
      
      const result = await dbFetch('investors', 'GET', null, `?email=ilike.${encodeURIComponent(cleanEmail)}&select=id,email,full_name`);
      if (result.data?.length) {
        const investor = result.data[0];
        const resetToken = generateToken();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        
        await dbFetch('investors', 'PATCH', { reset_token: resetToken, reset_token_expires: resetExpires }, `?id=eq.${investor.id}`);
        
        // Also store in password_reset_tokens table
        try {
          await dbFetch('password_reset_tokens', 'POST', {
            investor_id: investor.id, token: resetToken, expires_at: resetExpires, used: false
          });
        } catch (e) { console.warn('[auth-v2] password_reset_tokens table may not exist:', e); }
        
        const resetUrl = `${base_url || 'https://accessyourplace.com'}/investor/reset-password?token=${resetToken}`;
        
        const emailResult = await sendEmail(investor.email, 'Reset Your Password - Access Your Place', `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">
            <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 100%);padding:40px 20px;text-align:center;">
              <h1 style="color:#f59e0b;margin:0;font-size:28px;">Access Your Place</h1>
              <p style="color:#fff;margin:10px 0 0 0;opacity:0.9;">Investor Portal</p>
            </div>
            <div style="padding:40px 30px;">
              <h2 style="color:#1a365d;margin:0 0 20px 0;">Password Reset Request</h2>
              <p style="color:#475569;line-height:1.6;font-size:16px;">Hi ${investor.full_name || 'there'},</p>
              <p style="color:#475569;line-height:1.6;font-size:16px;">Click the button below to reset your password:</p>
              <div style="text-align:center;margin:35px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#1a365d;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Reset Password</a>
              </div>
              <p style="color:#64748b;font-size:14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
              <p style="color:#64748b;font-size:14px;">Direct link: <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a></p>
            </div>
            <div style="background:#1e293b;padding:20px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Access Your Place. All rights reserved.</p>
            </div>
          </div>
        `);
        
        if (!emailResult.success) {
          console.error('[auth-v2] Failed to send reset email:', emailResult.error);
          // Log the failure for admin monitoring
          try {
            await dbFetch('auth_errors', 'POST', {
              error_type: 'password_reset_failed',
              email: cleanEmail,
              investor_id: investor.id,
              error_message: `Email delivery failed: ${emailResult.error}`,
              metadata: { reason: 'email_delivery_failed' }
            });
          } catch (e) { /* auth_errors table may not exist */ }
        }
      } else {
        console.log('[auth-v2] No account found for:', cleanEmail);
      }
      
      return new Response(JSON.stringify({ success: true, message: 'If account exists, reset email sent.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset_password') {
      const { reset_token, new_password } = body;
      if (!reset_token || !new_password || new_password.length < 8) return new Response(JSON.stringify({ success: false, error: 'Valid token and password (8+ chars) required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      let investorData = null;
      
      // Check investor record
      const result = await dbFetch('investors', 'GET', null, `?reset_token=eq.${encodeURIComponent(reset_token)}&select=id,email,full_name,reset_token_expires`);
      if (result.data?.length) {
        investorData = result.data[0];
      } else {
        // Fallback: check password_reset_tokens table
        try {
          const tokenResult = await dbFetch('password_reset_tokens', 'GET', null, `?token=eq.${encodeURIComponent(reset_token)}&used=eq.false&select=investor_id,expires_at`);
          if (tokenResult.data?.length) {
            const tokenRecord = tokenResult.data[0];
            if (new Date(tokenRecord.expires_at) >= new Date()) {
              const invResult = await dbFetch('investors', 'GET', null, `?id=eq.${tokenRecord.investor_id}&select=id,email,full_name`);
              if (invResult.data?.length) investorData = invResult.data[0];
              await dbFetch('password_reset_tokens', 'PATCH', { used: true, used_at: new Date().toISOString() }, `?token=eq.${encodeURIComponent(reset_token)}`);
            }
          }
        } catch (e) { console.warn('[auth-v2] password_reset_tokens fallback failed:', e); }
      }
      
      if (!investorData) return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (investorData.reset_token_expires && new Date(investorData.reset_token_expires) < new Date()) return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      // Use v2$ hash format
      const hashedPassword = await createV2Hash(new_password);
      await dbFetch('investors', 'PATCH', { password_hash: hashedPassword, reset_token: null, reset_token_expires: null }, `?id=eq.${investorData.id}`);
      await dbFetch('investor_sessions', 'PATCH', { is_active: false }, `?investor_id=eq.${investorData.id}`);
      
      console.log('[auth-v2] Password reset with v2$ hash for:', investorData.email);
      
      // Send confirmation email
      sendEmail(investorData.email, 'Password Reset Successful', `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a365d;padding:30px;text-align:center;"><h1 style="color:#22c55e;margin:0;">Password Reset Successful</h1></div>
          <div style="padding:30px;">
            <p>Hi ${investorData.full_name || 'there'},</p>
            <p>Your password has been successfully reset.</p>
            <div style="text-align:center;margin:30px 0;"><a href="https://accessyourplace.com/investor/login" style="background:#f59e0b;color:#1a365d;padding:16px 40px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Log In Now</a></div>
          </div>
        </div>
      `);
      
      return new Response(JSON.stringify({ success: true, message: 'Password reset successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_active_sessions') {
      const { session_token } = body;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'Session token required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionsResult = await dbFetch('investor_sessions', 'GET', null, `?investor_id=eq.${sessionResult.data[0].investor_id}&is_active=eq.true&order=last_activity.desc&select=id,device_info,ip_address,created_at,last_activity,remember_me,session_token`);
      const sessions = (sessionsResult.data || []).map((s: any) => ({
        id: s.id, device_info: s.device_info, ip_address: s.ip_address, created_at: s.created_at,
        last_activity: s.last_activity, remember_me: s.remember_me, is_current: s.session_token === session_token
      }));
      return new Response(JSON.stringify({ success: true, sessions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'revoke_session') {
      const { session_id } = body;
      if (!session_id) return new Response(JSON.stringify({ success: false, error: 'Session ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await dbFetch('investor_sessions', 'PATCH', { is_active: false }, `?id=eq.${session_id}`);
      return new Response(JSON.stringify({ success: true, message: 'Session revoked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'logout_all') {
      const { session_token } = body;
      if (session_token) {
        const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
        if (sessionResult.data?.length) await dbFetch('investor_sessions', 'PATCH', { is_active: false }, `?investor_id=eq.${sessionResult.data[0].investor_id}`);
      }
      return new Response(JSON.stringify({ success: true, message: 'All sessions logged out' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_profile') {
      const { session_token, ...updates } = body;
      delete updates.action;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'Session required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      delete updates.password_hash; delete updates.email; delete updates.id;
      updates.updated_at = new Date().toISOString();
      await dbFetch('investors', 'PATCH', updates, `?id=eq.${sessionResult.data[0].investor_id}`);
      const investorResult = await dbFetch('investors', 'GET', null, `?id=eq.${sessionResult.data[0].investor_id}&select=*`);
      const { password_hash, reset_token, email_verification_token, ...safeInvestor } = investorResult.data[0];
      return new Response(JSON.stringify({ success: true, investor: safeInvestor }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'change_password') {
      const { session_token, current_password, new_password } = body;
      if (!session_token || !current_password || !new_password || new_password.length < 8) return new Response(JSON.stringify({ success: false, error: 'Valid session and passwords required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investorResult = await dbFetch('investors', 'GET', null, `?id=eq.${sessionResult.data[0].investor_id}&select=password_hash`);
      
      const currentVerification = await verifyPassword(current_password, investorResult.data[0].password_hash);
      if (!currentVerification.valid) return new Response(JSON.stringify({ success: false, error: 'Current password incorrect' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const hashedNew = await createV2Hash(new_password);
      await dbFetch('investors', 'PATCH', { password_hash: hashedNew, updated_at: new Date().toISOString() }, `?id=eq.${sessionResult.data[0].investor_id}`);
      console.log('[auth-v2] Password changed with v2$ hash for investor:', sessionResult.data[0].investor_id);
      return new Response(JSON.stringify({ success: true, message: 'Password changed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'resend_verification') {
      const { email, investor_id, base_url } = body;
      const query = investor_id ? `?id=eq.${investor_id}&select=id,email,full_name,email_verified` : `?email=ilike.${encodeURIComponent(email.toLowerCase())}&select=id,email,full_name,email_verified`;
      const result = await dbFetch('investors', 'GET', null, query);
      if (!result.data?.length) return new Response(JSON.stringify({ success: false, error: 'Account not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investor = result.data[0];
      if (investor.email_verified) return new Response(JSON.stringify({ success: true, message: 'Already verified' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const newToken = generateToken();
      await dbFetch('investors', 'PATCH', { email_verification_token: newToken, email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, `?id=eq.${investor.id}`);
      const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${newToken}`;
      sendEmail(investor.email, 'Verify Your Email', `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#2d5a87);padding:30px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">Verify Your Email</h1></div><div style="padding:30px;"><p>Hi ${investor.full_name || 'there'},</p><p>Click to verify:</p><div style="text-align:center;margin:30px 0;"><a href="${verifyUrl}" style="background:#f59e0b;color:#1a365d;padding:16px 40px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">Verify Email</a></div></div></div>`);
      return new Response(JSON.stringify({ success: true, message: 'Verification email sent' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Phone OTP actions
    if (action === 'send_phone_otp') {
      const { session_token, phone } = body;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'Session required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!phone) return new Response(JSON.stringify({ success: false, error: 'Phone number required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const otp = generateOTP();
      await dbFetch('investors', 'PATCH', { phone_otp: otp, phone_otp_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), phone_pending: phone, updated_at: new Date().toISOString() }, `?id=eq.${sessionResult.data[0].investor_id}`);
      const smsResult = await sendSMS(phone, `Your Access Your Place verification code is: ${otp}. This code expires in 10 minutes.`);
      if (!smsResult.success) return new Response(JSON.stringify({ success: false, error: smsResult.error || 'Failed to send SMS' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, message: 'Verification code sent', expires_in: 600 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify_phone_otp') {
      const { session_token, otp } = body;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'Session required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!otp) return new Response(JSON.stringify({ success: false, error: 'OTP code required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investorResult = await dbFetch('investors', 'GET', null, `?id=eq.${sessionResult.data[0].investor_id}&select=phone_otp,phone_otp_expires,phone_pending`);
      if (!investorResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investor = investorResult.data[0];
      if (!investor.phone_otp) return new Response(JSON.stringify({ success: false, error: 'No pending verification' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (investor.phone_otp_expires && new Date(investor.phone_otp_expires) < new Date()) {
        await dbFetch('investors', 'PATCH', { phone_otp: null, phone_otp_expires: null, phone_pending: null }, `?id=eq.${sessionResult.data[0].investor_id}`);
        return new Response(JSON.stringify({ success: false, error: 'Code expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (investor.phone_otp !== otp.trim()) return new Response(JSON.stringify({ success: false, error: 'Invalid code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await dbFetch('investors', 'PATCH', { phone: investor.phone_pending, phone_verified: true, phone_otp: null, phone_otp_expires: null, phone_pending: null, updated_at: new Date().toISOString() }, `?id=eq.${sessionResult.data[0].investor_id}`);
      const updatedResult = await dbFetch('investors', 'GET', null, `?id=eq.${sessionResult.data[0].investor_id}&select=*`);
      const { password_hash: ph, reset_token: rt, email_verification_token: evt, phone_otp: po, phone_otp_expires: poe, phone_pending: pp, ...safe } = updatedResult.data[0];
      return new Response(JSON.stringify({ success: true, message: 'Phone verified', investor: safe }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'resend_phone_otp') {
      const { session_token } = body;
      if (!session_token) return new Response(JSON.stringify({ success: false, error: 'Session required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const sessionResult = await dbFetch('investor_sessions', 'GET', null, `?session_token=eq.${encodeURIComponent(session_token)}&is_active=eq.true&select=investor_id`);
      if (!sessionResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const investorResult = await dbFetch('investors', 'GET', null, `?id=eq.${sessionResult.data[0].investor_id}&select=phone_pending,phone`);
      if (!investorResult.data?.length) return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const phone = investorResult.data[0].phone_pending || investorResult.data[0].phone;
      if (!phone) return new Response(JSON.stringify({ success: false, error: 'No phone number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const otp = generateOTP();
      await dbFetch('investors', 'PATCH', { phone_otp: otp, phone_otp_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), phone_pending: phone, updated_at: new Date().toISOString() }, `?id=eq.${sessionResult.data[0].investor_id}`);
      const smsResult = await sendSMS(phone, `Your Access Your Place verification code is: ${otp}. This code expires in 10 minutes.`);
      if (!smsResult.success) return new Response(JSON.stringify({ success: false, error: smsResult.error || 'Failed to send SMS' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, message: 'New code sent', expires_in: 600 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[auth-v2] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

