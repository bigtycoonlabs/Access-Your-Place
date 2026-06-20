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
// staff-login v9.0 - Security hardened: constant-time comparison, session tokens, failed attempt tracking
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ayp_staff_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal, false otherwise.
 * Always compares the full length regardless of where differences occur.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Pad shorter string to same length to avoid length-based timing leaks
  const maxLen = Math.max(a.length, b.length);
  const aPadded = a.padEnd(maxLen, '\0');
  const bPadded = b.padEnd(maxLen, '\0');
  let result = 0;
  // XOR every character â€” if any differ, result will be non-zero
  for (let i = 0; i < maxLen; i++) {
    result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
  }
  // Also check original lengths match (constant time via XOR)
  result |= a.length ^ b.length;
  return result === 0;
}

/**
 * Generate a cryptographically random session token.
 * Format: "sess_" + 48 random hex characters (192 bits of entropy)
 */
function generateSessionToken(): string {
  const bytes = new Uint8Array(24); // 24 bytes = 192 bits
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sess_${hex}`;
}

/** Retry a fetch up to `maxAttempts` times with exponential backoff */
async function fetchWithRetry(url: string, options: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res; // Only retry on 5xx
      lastError = new Error(`HTTP ${res.status}: ${await res.text()}`);
    } catch (err: any) {
      lastError = err;
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, attempt * 200)); // 200ms, 400ms
    }
  }
  throw lastError || new Error('fetchWithRetry exhausted');
}

// Rate limiting constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: any) => new Response(JSON.stringify(data), {
    status: 200,
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

    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[staff-login v9.0] Failed to parse request body:', parseErr);
      return json({ success: false, error: 'Invalid request body' });
    }

    const { action, email, password, staff_id, investor_email, current_password, new_password, reset_token, invitation_token, phone, whatsapp_number, base_url } = body;

    console.log('[staff-login v9.0] Action:', action || 'login', 'Email:', email, 'StaffID:', staff_id);

    async function sendEmail(to: string, subject: string, html: string) {
      if (!RESEND_API_KEY) return { success: false, error: 'Email not configured' };
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            from: 'Access Your Place <noreply@accessyourplace.com>', 
            to: [to], 
            subject, 
            html 
          })
        });
        const result = await res.json();
        return res.ok ? { success: true, id: result.id } : { success: false, error: result };
      } catch (e: any) { 
        return { success: false, error: e.message }; 
      }
    }

    async function checkAgreementSigned(staffId: string): Promise<{ agreement_signed: boolean; agreement_id: string | null }> {
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/am_agreements?staff_id=eq.${staffId}&select=id,status&order=created_at.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) {
          console.log('[staff-login v9.0] am_agreements query failed (table may not exist):', res.status);
          return { agreement_signed: true, agreement_id: null };
        }
        const agreements = await res.json();
        if (!Array.isArray(agreements) || agreements.length === 0) {
          return { agreement_signed: true, agreement_id: null };
        }
        const latest = agreements[0];
        return { 
          agreement_signed: latest.status === 'signed', 
          agreement_id: latest.id 
        };
      } catch (err: any) {
        console.error('[staff-login v9.0] checkAgreementSigned error:', err.message);
        return { agreement_signed: true, agreement_id: null };
      }
    }

    function buildSessionData(user: any, agreementInfo: { agreement_signed: boolean; agreement_id: string | null }, sessionToken?: string) {
      return {
        id: user.id,
        email: user.email,
        name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        whatsapp_number: user.whatsapp_number,
        team: user.team,
        role: user.role,
        department: user.department,
        permissions: user.permissions || [],
        linked_investor_id: user.linked_investor_id,
        roles: user.roles || [],
        yp_certified: user.yp_certified,
        trainee_status: user.trainee_status,
        commission_split: user.commission_split,
        notification_preferences: user.notification_preferences,
        account_completed: true,
        agreement_signed: agreementInfo.agreement_signed,
        agreement_id: agreementInfo.agreement_id,
        ...(sessionToken ? { session_token: sessionToken } : {})
      };
    }

    /**
     * Check and enforce server-side rate limiting for login attempts.
     * Returns { allowed: boolean, remaining_seconds?: number }
     */
    async function checkRateLimit(userEmail: string): Promise<{ allowed: boolean; remaining_seconds?: number }> {
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(userEmail)}&select=failed_login_attempts,locked_until`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) return { allowed: true }; // If we can't check, allow (fail open)
        const users = await res.json();
        if (!users?.length) return { allowed: true }; // User not found â€” will fail at password check
        
        const user = users[0];
        const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
        
        if (lockedUntil && lockedUntil > new Date()) {
          const remainingMs = lockedUntil.getTime() - Date.now();
          return { allowed: false, remaining_seconds: Math.ceil(remainingMs / 1000) };
        }
        
        return { allowed: true };
      } catch {
        return { allowed: true }; // Fail open
      }
    }

    /**
     * Record a failed login attempt. After MAX_FAILED_ATTEMPTS, lock the account.
     */
    async function recordFailedAttempt(userId: string, currentAttempts: number): Promise<void> {
      try {
        const newCount = (currentAttempts || 0) + 1;
        const updatePayload: any = { 
          failed_login_attempts: newCount,
          last_failed_login: new Date().toISOString()
        };
        
        if (newCount >= MAX_FAILED_ATTEMPTS) {
          updatePayload.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
          console.log(`[staff-login v9.0] Account locked for user ${userId} after ${newCount} failed attempts`);
        }
        
        await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${userId}`, {
          method: 'PATCH', headers, body: JSON.stringify(updatePayload)
        });
      } catch (err: any) {
        console.error('[staff-login v9.0] Failed to record failed attempt:', err.message);
      }
    }

    /**
     * Reset failed login attempts on successful login.
     */
    async function resetFailedAttempts(userId: string): Promise<void> {
      try {
        await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${userId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ 
            failed_login_attempts: 0, 
            locked_until: null,
            last_failed_login: null
          })
        });
      } catch (err: any) {
        console.error('[staff-login v9.0] Failed to reset failed attempts:', err.message);
      }
    }

    // ==================== REFRESH SESSION ====================
    if (action === 'refresh_session') {
      if (!staff_id) return json({ success: false, error: 'staff_id required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=id,email,first_name,last_name,name,phone,whatsapp_number,team,role,department,permissions,linked_investor_id,roles,is_active,account_completed,yp_certified,trainee_status,commission_split,notification_preferences`, 
          { headers }
        );
        
        if (!res.ok) {
          return json({ success: false, error: 'Database query failed' });
        }
        
        const users = await res.json();
        if (!users?.length) return json({ success: false, error: 'Staff member not found' });
        
        const user = users[0];
        if (user.is_active === false) return json({ success: false, error: 'Account is deactivated' });

        const isAM = user.department === 'acquisition_managers' || (Array.isArray(user.roles) && user.roles.includes('acquisition_managers'));
        let agreementInfo = { agreement_signed: true, agreement_id: null as string | null };
        if (isAM) agreementInfo = await checkAgreementSigned(user.id);
        
        return json({ success: true, message: 'Session refreshed successfully', ...buildSessionData(user, agreementInfo) });
      } catch (err: any) {
        return json({ success: false, error: 'Failed to refresh session: ' + err.message });
      }
    }

    // ==================== VALIDATE SESSION TOKEN ====================
    if (action === 'validate_session') {
      const { session_token } = body;
      if (!session_token || !staff_id) return json({ valid: false, error: 'session_token and staff_id required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=id,session_token,session_expires,is_active`,
          { headers }
        );
        if (!res.ok) return json({ valid: false, error: 'Database query failed' });
        const users = await res.json();
        if (!users?.length) return json({ valid: false, error: 'User not found' });
        
        const user = users[0];
        if (user.is_active === false) return json({ valid: false, error: 'Account deactivated' });
        if (!user.session_token) return json({ valid: false, error: 'No active session' });
        
        // Constant-time comparison of session tokens
        if (!constantTimeEqual(user.session_token, session_token)) {
          return json({ valid: false, error: 'Invalid session token' });
        }
        
        // Check expiration
        if (user.session_expires && new Date(user.session_expires) < new Date()) {
          return json({ valid: false, error: 'Session expired' });
        }
        
        return json({ valid: true });
      } catch (err: any) {
        return json({ valid: false, error: 'Session validation failed' });
      }
    }

    // ==================== CHANGE PASSWORD ====================
    if (action === 'change_password') {
      if (!staff_id || !current_password || !new_password) return json({ success: false, error: 'Missing fields' });
      
      try {
        const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=password_hash`, { headers });
        const staff = await res.json();
        
        const storedPassword = staff?.[0]?.password_hash;
        if (!storedPassword || !staff?.length) {
          return json({ success: false, error: 'Invalid current password' });
        }

        // Hash the provided current password and compare using constant-time comparison
        const currentHashed = await hashPassword(current_password);
        const matchesHash = constantTimeEqual(storedPassword, currentHashed);
        // Also check if stored password is still in plaintext (legacy) using constant-time
        const matchesPlain = constantTimeEqual(storedPassword, current_password);
        
        if (!matchesHash && !matchesPlain) {
          return json({ success: false, error: 'Invalid current password' });
        }
        
        const newHashed = await hashPassword(new_password);
        await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { 
          method: 'PATCH', headers, body: JSON.stringify({ password_hash: newHashed, account_completed: true, is_active: true }) 
        });
        
        return json({ success: true });
      } catch (err: any) {
        return json({ success: false, error: 'Failed to change password: ' + err.message });
      }
    }

    // ==================== FORGOT PASSWORD ====================
    if (action === 'forgot_password') {
      const emailLower = email?.toLowerCase().trim();
      if (!emailLower) return json({ success: true, message: 'Reset link sent if account exists' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=*`, { headers }
        );
        const staff = await res.json();
        
        if (staff?.length && RESEND_API_KEY) {
          // Generate a cryptographically secure reset token
          const tokenBytes = new Uint8Array(32);
          crypto.getRandomValues(tokenBytes);
          const token = 'rst_' + Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          const expires = new Date(Date.now() + 3600000).toISOString();
          
          await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff[0].id}`, {
            method: 'PATCH', headers, body: JSON.stringify({ reset_token: token, reset_token_expires: expires })
          });
          
          const resetUrl = `${base_url || 'https://accessyourplace.com'}/staff/reset-password?token=${token}`;
          const userName = staff[0].first_name || staff[0].name || 'Staff Member';
          
          await sendEmail(
            staff[0].email,
            'Reset Your Staff Password - Access Your Place',
            `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;">
              <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:28px;">Access Your Place</h1>
                <p style="color:#f59e0b;margin:10px 0 0;font-size:14px;">Staff Portal</p>
              </div>
              <div style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
                <h2 style="color:#1e3a5f;margin-top:0;">Password Reset Request</h2>
                <p style="color:#374151;">Hi ${userName},</p>
                <p style="color:#374151;">Click the button below to create a new password:</p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${resetUrl}" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Reset Password</a>
                </div>
                <p style="color:#6b7280;font-size:14px;">This link will expire in 1 hour.</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
                <p style="color:#9ca3af;font-size:11px;">Or copy this link: ${resetUrl}</p>
              </div>
            </body></html>`
          );
        }
      } catch (err: any) {
        console.error('[staff-login v9.0] forgot_password error:', err.message);
      }
      
      // Always return success to avoid email enumeration
      return json({ success: true, message: 'If an account exists with that email, you will receive a password reset link.' });
    }

    // ==================== VALIDATE TOKEN ====================
    if (action === 'validate_token') {
      if (!reset_token) return json({ valid: false, error: 'Token required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?reset_token=eq.${reset_token}&select=id,email,name,first_name,last_name,reset_token_expires`, { headers }
        );
        const staff = await res.json();
        
        if (!staff?.length) return json({ valid: false, error: 'Invalid or expired token' });
        
        const user = staff[0];
        if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
          return json({ valid: false, error: 'Token has expired' });
        }
        
        return json({ valid: true, email: user.email, name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(), is_new_account: false });
      } catch (err: any) {
        return json({ valid: false, error: 'Failed to validate token' });
      }
    }

    // ==================== VALIDATE INVITATION ====================
    if (action === 'validate_invitation') {
      if (!invitation_token) return json({ valid: false, error: 'Invitation token required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?invitation_token=eq.${invitation_token}&select=id,email,first_name,last_name,department,invitation_expires,account_completed`, { headers }
        );
        const staff = await res.json();
        
        if (!staff?.length) return json({ valid: false, error: 'Invalid invitation token' });
        const user = staff[0];
        if (user.account_completed) return json({ valid: false, error: 'Account already set up. Please log in.' });
        if (user.invitation_expires && new Date(user.invitation_expires) < new Date()) {
          return json({ valid: false, error: 'Invitation has expired. Please contact your administrator.' });
        }
        
        return json({ valid: true, email: user.email, first_name: user.first_name, last_name: user.last_name, department: user.department });
      } catch (err: any) {
        return json({ valid: false, error: 'Failed to validate invitation' });
      }
    }

    // ==================== COMPLETE INVITATION ====================
    if (action === 'complete_invitation') {
      if (!invitation_token || !new_password) return json({ success: false, error: 'Invitation token and password required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?invitation_token=eq.${invitation_token}&select=id,email,first_name,last_name,department,roles,invitation_expires,account_completed`, { headers }
        );
        const staff = await res.json();
        if (!staff?.length) return json({ success: false, error: 'Invalid invitation token' });
        
        const user = staff[0];
        if (user.account_completed) return json({ success: false, error: 'Account already set up' });
        if (user.invitation_expires && new Date(user.invitation_expires) < new Date()) return json({ success: false, error: 'Invitation has expired' });
        
        const hashedPassword = await hashPassword(new_password);
        const sessionToken = generateSessionToken();
        const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
        
        const updateRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${user.id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({
            password_hash: hashedPassword, phone: phone || null, whatsapp_number: whatsapp_number || null,
            invitation_token: null, invitation_expires: null, account_completed: true, is_active: true,
            last_login: new Date().toISOString(), updated_at: new Date().toISOString(),
            session_token: sessionToken, session_expires: sessionExpires,
            failed_login_attempts: 0, locked_until: null
          })
        });
        
        if (!updateRes.ok) return json({ success: false, error: 'Failed to complete account setup' });

        const fullUserRes = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?id=eq.${user.id}&select=id,email,first_name,last_name,name,phone,whatsapp_number,team,role,department,permissions,linked_investor_id,roles,is_active,account_completed,yp_certified,trainee_status,commission_split,notification_preferences`, { headers }
        );
        
        let fullUser = user;
        if (fullUserRes.ok) { const fu = await fullUserRes.json(); if (fu?.length) fullUser = fu[0]; }

        const isAM = fullUser.department === 'acquisition_managers' || (Array.isArray(fullUser.roles) && fullUser.roles.includes('acquisition_managers'));
        let agreementInfo = { agreement_signed: true, agreement_id: null as string | null };
        if (isAM) agreementInfo = await checkAgreementSigned(fullUser.id);
        
        // Notify success team if AM has no mentor (non-blocking)
        if (fullUser.department === 'acquisition_managers') {
          (async () => {
            try {
              const staffCheck = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${fullUser.id}&select=assigned_mentor_id`, { headers });
              const staffData = await staffCheck.json();
              if (!staffData?.[0]?.assigned_mentor_id) {
                const smRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?department=eq.success_managers&is_active=eq.true&select=email,first_name`, { headers });
                const sms = await smRes.json();
                const amName = `${fullUser.first_name || ''} ${fullUser.last_name || ''}`.trim();
                if (Array.isArray(sms)) for (const sm of sms) {
                  if (sm.email) sendEmail(sm.email, `Action Required: New AM ${amName} Needs Mentor Assignment`,
                    `<p>New AM <strong>${amName}</strong> (${fullUser.email}) completed account setup but has no mentor assigned.</p><p><a href="https://accessyourplace.com/staff">Go to Staff Dashboard</a></p>`
                  ).catch(() => {});
                }
              }
            } catch {}
          })();
        }
        
        return json({ success: true, message: 'Account setup complete', ...buildSessionData(fullUser, agreementInfo, sessionToken) });
      } catch (err: any) {
        return json({ success: false, error: 'Failed to complete account setup: ' + err.message });
      }
    }

    // ==================== RESET PASSWORD ====================
    if (action === 'reset_password') {
      if (!reset_token || !new_password) return json({ success: false, error: 'Token and new password required' });
      
      try {
        const res = await fetchWithRetry(
          `${SUPABASE_URL}/rest/v1/staff_users?reset_token=eq.${reset_token}&select=id,email,reset_token_expires`, { headers }
        );
        const staff = await res.json();
        if (!staff?.length) return json({ success: false, error: 'Invalid or expired token' });
        
        const user = staff[0];
        if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
          return json({ success: false, error: 'Token has expired. Please request a new reset link.' });
        }
        
        const hashedPassword = await hashPassword(new_password);
        const updateRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${user.id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ 
            password_hash: hashedPassword, reset_token: null, reset_token_expires: null, 
            account_completed: true, is_active: true, updated_at: new Date().toISOString(),
            // Reset failed attempts on password reset
            failed_login_attempts: 0, locked_until: null
          })
        });
        
        if (!updateRes.ok) return json({ success: false, error: 'Failed to reset password' });
        return json({ success: true, message: 'Password reset successfully' });
      } catch (err: any) {
        return json({ success: false, error: 'Failed to reset password: ' + err.message });
      }
    }

    // ==================== LINK / UNLINK / GET INVESTOR ====================
    if (action === 'link_investor_account') {
      if (!staff_id || !investor_email) return json({ success: false, error: 'Missing fields' });
      try {
        const invRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(investor_email.toLowerCase())}&select=*`, { headers });
        const investors = await invRes.json();
        if (!investors?.length) return json({ success: false, error: 'Investor not found' });
        await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: investors[0].id }) });
        return json({ success: true, investor: investors[0] });
      } catch (err: any) { return json({ success: false, error: err.message }); }
    }

    if (action === 'unlink_investor_account') {
      if (!staff_id) return json({ success: false, error: 'Missing staff_id' });
      await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: null }) });
      return json({ success: true });
    }

    if (action === 'get_linked_investor') {
      if (!staff_id) return json({ success: false, error: 'Missing staff_id' });
      try {
        const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=linked_investor_id`, { headers });
        const staff = await res.json();
        if (!staff?.[0]?.linked_investor_id) return json({ investor: null });
        const invRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/investors?id=eq.${staff[0].linked_investor_id}&select=*`, { headers });
        return json({ investor: (await invRes.json())?.[0] || null });
      } catch (err: any) { return json({ success: false, error: err.message }); }
    }

    // ==================== LOGOUT (invalidate session) ====================
    if (action === 'logout') {
      if (!staff_id) return json({ success: true }); // Nothing to do
      try {
        await fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ session_token: null, session_expires: null })
        });
      } catch {
        // Non-critical â€” localStorage will be cleared client-side anyway
      }
      return json({ success: true, message: 'Logged out' });
    }

    // ==================== LOGIN (DEFAULT ACTION) ====================
    if (!email || !password) return json({ success: false, error: 'Email and password required' });

    const emailLower = email.toLowerCase().trim();
    console.log('[staff-login v9.0] Looking up user:', emailLower);

    // --- Server-side rate limiting check ---
    const rateLimitResult = await checkRateLimit(emailLower);
    if (!rateLimitResult.allowed) {
      console.log(`[staff-login v9.0] Rate limited: ${emailLower}, ${rateLimitResult.remaining_seconds}s remaining`);
      return json({ 
        success: false, 
        error: `Too many failed login attempts. Please wait ${rateLimitResult.remaining_seconds} seconds before trying again.`,
        rate_limited: true,
        retry_after_seconds: rateLimitResult.remaining_seconds
      });
    }

    let checkData: any[];
    try {
      const checkRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=id,email,is_active,password_hash,account_completed,first_name,last_name,name,phone,whatsapp_number,team,role,department,permissions,linked_investor_id,roles,yp_certified,trainee_status,commission_split,notification_preferences,failed_login_attempts,locked_until`, 
        { headers }
      );
      
      if (!checkRes.ok) {
        const errText = await checkRes.text();
        console.error('[staff-login v9.0] DB query failed after retries:', checkRes.status, errText);
        return json({ success: false, error: 'The server is experiencing a temporary issue. Please try again in a moment.' });
      }
      
      checkData = await checkRes.json();
    } catch (fetchErr: any) {
      console.error('[staff-login v9.0] DB fetch exception after retries:', fetchErr.message);
      return json({ success: false, error: 'Unable to reach the database. Please try again in a moment.' });
    }

    if (!checkData?.length) {
      // Don't reveal whether the email exists â€” use generic message
      // Add a small delay to match the timing of a real password check
      await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
      return json({ success: false, error: 'Invalid email or password' });
    }

    const user = checkData[0];
    
    // Check server-side lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMs = new Date(user.locked_until).getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      return json({ 
        success: false, 
        error: `Account temporarily locked. Please wait ${remainingSec} seconds before trying again.`,
        rate_limited: true,
        retry_after_seconds: remainingSec
      });
    }

    if (user.is_active === false) return json({ success: false, error: 'Account is deactivated. Please contact your administrator.' });

    const storedPassword = user.password_hash || '';
    let passwordValid = false;
    
    try {
      const providedHashed = await hashPassword(password);
      // Use constant-time comparison for both hash and legacy plaintext checks
      const matchesHash = constantTimeEqual(storedPassword, providedHashed);
      const matchesPlain = constantTimeEqual(storedPassword, password);
      const matchesTrimmed = constantTimeEqual(storedPassword.trim(), password.trim());
      passwordValid = matchesHash || matchesPlain || matchesTrimmed;
    } catch (hashErr: any) {
      // If hashing fails, only try constant-time plaintext comparison
      passwordValid = constantTimeEqual(storedPassword, password) || constantTimeEqual(storedPassword.trim(), password.trim());
    }

    if (!passwordValid) {
      // Record the failed attempt
      await recordFailedAttempt(user.id, user.failed_login_attempts || 0);
      
      const newCount = (user.failed_login_attempts || 0) + 1;
      const remainingAttempts = MAX_FAILED_ATTEMPTS - newCount;
      
      let errorMsg = 'Invalid email or password';
      if (remainingAttempts > 0 && remainingAttempts <= 2) {
        errorMsg += `. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.`;
      } else if (remainingAttempts <= 0) {
        errorMsg = `Too many failed login attempts. Your account has been temporarily locked for ${LOCKOUT_DURATION_MS / 1000} seconds.`;
      }
      
      return json({ 
        success: false, 
        error: errorMsg,
        ...(remainingAttempts <= 0 ? { rate_limited: true, retry_after_seconds: LOCKOUT_DURATION_MS / 1000 } : {})
      });
    }

    // --- Successful login ---
    
    // Generate session token
    const sessionToken = generateSessionToken();
    const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Update last_login, store session token, and reset failed attempts
    const loginUpdateData: any = { 
      last_login: new Date().toISOString(), 
      is_active: true,
      session_token: sessionToken,
      session_expires: sessionExpires,
      failed_login_attempts: 0,
      locked_until: null,
      last_failed_login: null
    };
    if (!user.account_completed) loginUpdateData.account_completed = true;
    
    // If the stored password was plaintext, silently upgrade to hashed
    if (constantTimeEqual(storedPassword, password) || constantTimeEqual(storedPassword.trim(), password.trim())) {
      try {
        const upgradedHash = await hashPassword(password);
        loginUpdateData.password_hash = upgradedHash;
        console.log(`[staff-login v9.0] Silently upgraded plaintext password to hash for user: ${emailLower}`);
      } catch {
        // Non-critical â€” password will be upgraded on next login
      }
    }
    
    // Non-blocking update
    fetchWithRetry(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${user.id}`, { 
      method: 'PATCH', headers, body: JSON.stringify(loginUpdateData) 
    }).catch(() => {});

    const isAM = user.department === 'acquisition_managers' || (Array.isArray(user.roles) && user.roles.includes('acquisition_managers'));
    let agreementInfo = { agreement_signed: true, agreement_id: null as string | null };
    if (isAM) agreementInfo = await checkAgreementSigned(user.id);

    console.log('[staff-login v9.0] Login successful for:', emailLower, 'Department:', user.department);

    return json({ success: true, ...buildSessionData(user, agreementInfo, sessionToken) });
  } catch (error: any) {
    console.error('[staff-login v9.0] Server error:', error.message);
    return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

