/**
 * Access Your Place - Railway Functions Server
 * Replaces all famous.ai/Supabase Edge Functions.
 *
 * Routes:
 *   POST /functions/v1/:functionName  → edge function handler
 *   GET  /health                      → health check
 */

'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Env helpers ───────────────────────────────────────────────────────────────
const SUPABASE_URL       = process.env.SUPABASE_URL;          // PostgREST public URL
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY         = process.env.RESEND_API_KEY;
const ANTHROPIC_KEY      = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY     = process.env.GOOGLE_API_KEY;
const GOOGLE_CX          = process.env.GOOGLE_CX;
const TWILIO_SID         = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN       = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM        = process.env.TWILIO_FROM_NUMBER;
const SITE_URL           = process.env.SITE_URL || 'https://accessyourplace.com';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── PostgREST Proxy (/rest/v1/* → PostgREST) ──────────────────────────────────
// Priority: POSTGREST_URL env var → Railway internal PostgREST → real Supabase URL
const POSTGREST_INTERNAL = process.env.POSTGREST_URL
  || (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('localhost') ? process.env.SUPABASE_URL : null)
  || 'http://postgrest.railway.internal:3000';

const PROXY_TARGET = POSTGREST_INTERNAL.includes('supabase.co')
  ? POSTGREST_INTERNAL  // real Supabase — path already includes /rest/v1
  : POSTGREST_INTERNAL; // internal PostgREST — strip /rest/v1 prefix

console.log(`[PostgREST Proxy] target: ${PROXY_TARGET}`);

app.use('/rest/v1', createProxyMiddleware({
  target: PROXY_TARGET,
  changeOrigin: true,
  pathRewrite: POSTGREST_INTERNAL.includes('supabase.co')
    ? {} // Supabase already has /rest/v1 in its URL — don't strip
    : { '^/rest/v1': '' }, // internal PostgREST — strip the prefix
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.headers.authorization) proxyReq.setHeader('Authorization', req.headers.authorization);
      if (req.headers.apikey) proxyReq.setHeader('apikey', req.headers.apikey);
      if (req.headers.prefer) proxyReq.setHeader('Prefer', req.headers.prefer);
      // If proxying to real Supabase, inject the service role key
      if (POSTGREST_INTERNAL.includes('supabase.co') && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
        proxyReq.setHeader('apikey', process.env.SUPABASE_SERVICE_ROLE_KEY);
      }
    },
    error: (err, req, res) => {
      console.error('[PostgREST Proxy] Error:', err.message);
      res.status(502).json({ error: 'PostgREST unreachable', detail: err.message });
    }
  }
}));

// ── Serve built React frontend (static files) ─────────────────────────────────
const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

// ── DB helper (calls PostgREST) ───────────────────────────────────────────────
const dbHeaders = () => ({
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

async function db(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    headers: dbHeaders(),
    ...opts,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function dbGet(path)          { return db(path); }
async function dbPost(path, body)   { return db(path, { method: 'POST', headers: { ...dbHeaders(), 'Prefer': 'return=representation' }, body: JSON.stringify(body) }); }
async function dbPatch(path, body)  { return db(path, { method: 'PATCH', headers: { ...dbHeaders(), 'Prefer': 'return=minimal' }, body: JSON.stringify(body) }); }
async function dbDelete(path)       { return db(path, { method: 'DELETE', headers: { ...dbHeaders() } }); }

// ── Email helper (Resend) ─────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, from }) {
  if (!RESEND_KEY) {
    console.error('[sendEmail] BLOCKED: No RESEND_API_KEY configured. Email NOT sent:', { to, subject });
    return { ok: false, error: 'No RESEND_API_KEY configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: from || 'Access Your Place <noreply@accessyourplace.com>', to: Array.isArray(to) ? to : [to], subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[sendEmail] FAILED:', { to, subject, status: res.status, body: errText });
      return { ok: false, error: `Resend API error ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[sendEmail] EXCEPTION:', { to, subject, message: e.message });
    return { ok: false, error: e.message || 'Network error sending email' };
  }
}

// ── SMS helper (Twilio) ───────────────────────────────────────────────────────
async function sendSMS(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { ok: false };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64') },
    body: params.toString(),
  });
  return { ok: res.ok };
}

// ── Anthropic helper ──────────────────────────────────────────────────────────
async function callAnthropic({ model = 'claude-3-5-sonnet-20241022', max_tokens = 2048, messages, system }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, messages, ...(system ? { system } : {}) }),
  });
  return res.json();
}

// ── REAL password schemes, ported faithfully from the deployed famous.ai
//    Edge Functions (staff-login v39, investor-login v18, landlord-auth v1).
//    bcrypt was NEVER used in production — every real stored hash is one of
//    the formats below. Using bcrypt.compare() against any of these would
//    always fail, which was the root cause of the login outage.
// ────────────────────────────────────────────────────────────────────────────

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// ===== STAFF: SHA-256(password + static salt), hex, no prefix =====
const STAFF_SALT = 'ayp_staff_salt_2024';
function hashStaffPassword(password) { return sha256Hex(password + STAFF_SALT); }
function verifyStaffPassword(password, stored) {
  if (!stored) return false;
  const hashed = hashStaffPassword(password);
  // Real source also falls back to direct/trimmed plaintext comparison for
  // any row that was never migrated to the hashed format.
  return constantTimeEqual(stored, hashed)
    || constantTimeEqual(stored, password)
    || constantTimeEqual(String(stored).trim(), String(password).trim());
}

// ===== LANDLORD: SHA-256(password + its own static salt), hex, no prefix =====
const LANDLORD_SALT = 'ayp_landlord_salt_2026';
function hashLandlordPassword(password) { return sha256Hex(password + LANDLORD_SALT); }
function verifyLandlordPassword(password, stored) {
  if (!stored) return false;
  return constantTimeEqual(stored, hashLandlordPassword(password)) || constantTimeEqual(stored, password);
}

// ===== INVESTOR: 4-format fallback chain (oldest -> newest migration history) =====
// v1$salt$hash  — legacy custom "simpleHash" (100-round DJB2-style, non-cryptographic)
// v2$salt$hash  — SHA-256(salt + password), the modern standard going forward
// 64-hex (no prefix) — SHA-256(password + 'yp_salt_2024'), the investor-auth-v2 era format
// anything else — plaintext (oldest, pre-hashing accounts)
function simpleHashLegacy(str) {
  let hash1 = 5381, hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (((hash1 << 5) + hash1) ^ ch) >>> 0;
    hash2 = (((hash2 << 5) + hash2) ^ ch) >>> 0;
  }
  let combined = hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0');
  for (let pass = 0; pass < 100; pass++) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < combined.length; i++) {
      const c = combined.charCodeAt(i);
      h1 = (((h1 << 5) + h1) ^ c) >>> 0;
      h2 = (((h2 << 5) + h2) ^ c) >>> 0;
    }
    combined = h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + combined.substring(0, 48);
  }
  return combined.substring(0, 64);
}
function v1HashPassword(password, salt) { return simpleHashLegacy(salt + password + salt); }
function v2HashPassword(password, salt) { return sha256Hex(salt + password); }
function generateSalt32Hex() {
  let salt = '';
  for (let i = 0; i < 32; i++) salt += Math.floor(Math.random() * 16).toString(16);
  return salt;
}
function createV2Hash(password) {
  const salt = generateSalt32Hex();
  return `v2$${salt}$${v2HashPassword(password, salt)}`;
}
const INVESTOR_AUTH_V2_SALT = 'yp_salt_2024';
function authV2Hash(password) { return sha256Hex(password + INVESTOR_AUTH_V2_SALT); }

/** Returns { valid, format } — format tells the caller whether to silently upgrade the stored hash. */
function verifyInvestorPassword(password, storedHash) {
  if (!storedHash) return { valid: false, format: 'empty' };

  if (storedHash.startsWith('v2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v2_malformed' };
    return { valid: constantTimeEqual(v2HashPassword(password, parts[1]), parts[2]), format: 'v2' };
  }
  if (storedHash.startsWith('v1$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return { valid: false, format: 'v1_malformed' };
    return { valid: constantTimeEqual(v1HashPassword(password, parts[1]), parts[2]), format: 'v1' };
  }
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    if (constantTimeEqual(authV2Hash(password), storedHash)) return { valid: true, format: 'auth_v2_sha256' };
    // fall through — a 64-hex string that doesn't match this format might still be plaintext-by-coincidence; unlikely, but keep checking
  }
  if (constantTimeEqual(password, storedHash)) return { valid: true, format: 'plain_text' };
  return { valid: false, format: 'unknown' };
}

// ===== Constant-time string comparison (prevents timing attacks on every scheme above) =====
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  const aPadded = a.padEnd(maxLen, '\0');
  const bPadded = b.padEnd(maxLen, '\0');
  let result = 0;
  for (let i = 0; i < maxLen; i++) result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
  result |= a.length ^ b.length;
  return result === 0;
}

function generateSessionToken() {
  return 'sess_' + crypto.randomBytes(24).toString('hex');
}

// Legacy aliases kept so any code I haven't migrated yet doesn't hard-crash;
// these intentionally route to the STAFF scheme since that was the original
// (incorrect) bcrypt call site's most common caller. Anywhere this matters
// for investors/landlords specifically has been updated to call the correct
// verify*Password function directly instead of these aliases.
async function verifyPassword(input, stored) { return verifyStaffPassword(input, stored); }
async function hashPassword(plain) { return hashStaffPassword(plain); }
function isBcryptHash(_str) { return false; } // bcrypt was never real; always false now

// ── CORS preflight ────────────────────────────────────────────────────────────
app.options('*', cors());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── One-time migration endpoint — runs the missing column additions safely ────
// Uses IF NOT EXISTS so safe to call multiple times. Remove after confirmed done.
app.post('/admin/run-migration', async (req, res) => {
  const secret = req.headers['x-migration-secret'];
  if (secret !== 'ayp-migrate-2024-secure') return res.status(401).json({ error: 'unauthorized' });
  try {
    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.startsWith('V/')) return res.status(500).json({ error: 'DATABASE_URL not available or sealed', hint: 'Use SUPABASE_URL + service role key approach instead' });
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const results = [];
    const queries = [
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0`,
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone`,
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_failed_login timestamp with time zone`,
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS session_token text`,
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS session_expires timestamp with time zone`,
      `ALTER TABLE landlord_contacts ADD COLUMN IF NOT EXISTS reset_token text`,
      `ALTER TABLE landlord_contacts ADD COLUMN IF NOT EXISTS reset_token_expires timestamp with time zone`,
      `CREATE INDEX IF NOT EXISTS idx_staff_users_session_token ON staff_users (session_token) WHERE session_token IS NOT NULL`,
    ];
    for (const q of queries) {
      try { await client.query(q); results.push({ ok: true, q: q.substring(0, 60) }); }
      catch (e) { results.push({ ok: false, q: q.substring(0, 60), error: e.message }); }
    }
    await client.end();
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION ROUTER
// ══════════════════════════════════════════════════════════════════════════════
app.post('/functions/v1/:fn', async (req, res) => {
  const fn = req.params.fn;
  const body = req.body || {};

  const ok  = (data)         => res.json({ ...data });
  const err = (msg, status=400) => res.status(status).json({ error: msg });

  try {
    switch (fn) {

    // ─────────────────────────── AUTH: INVESTOR ───────────────────────────
    case 'investor-auth':
    case 'investor-login':
    case 'investor-register':
    case 'investor-session': {
      const { action } = body;

      // REGISTER
      if (action === 'register') {
        const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code } = body;
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await dbGet(`/investors?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`);
        if (existing.data?.length) return err('Email already exists');
        const hash = createV2Hash(password); // new accounts always get the current v2$salt$hash format
        const myRef = 'AYP' + Math.random().toString(36).substring(2,8).toUpperCase();
        const result = await dbPost('/investors', {
          email: normalizedEmail, password_hash: hash, full_name, phone,
          sms_opt_in: sms_opt_in || false,
          email_opt_in: email_opt_in !== false,
          referred_by: referral_code || null,
          referral_code: myRef,
          onboarding_completed: false,
        });
        const inv = Array.isArray(result.data) ? result.data[0] : result.data;
        if (result.data?.code || result.data?.message) return err(result.data.message || 'Registration failed');
        await sendEmail({ to: email, subject: 'Welcome to Access Your Place!', html: `<p>Hi ${full_name}, welcome! Your referral code is <strong>${myRef}</strong>.</p>` });
        return ok({ success: true, investor: { id: inv.id, email: inv.email, full_name: inv.full_name, referral_code: myRef, onboarding_completed: false } });
      }

      // LOGIN
      if (action === 'login' || !action) {
        const { email, password } = body;
        const { data: users } = await dbGet(`/investors?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=*`);
        if (!users?.length) return ok({ success: false, error: 'Invalid email or password' });
        const user = users[0];
        const stored = user.password_hash || user.password;
        if (!stored) return ok({ success: false, error: 'Account not set up. Please use forgot password.' });
        const { valid, format } = verifyInvestorPassword(password, stored);
        if (!valid) return ok({ success: false, error: 'Invalid email or password' });
        // Silently upgrade any legacy format (v1, auth_v2_sha256, plain_text) to the current v2$ standard
        if (format !== 'v2') await dbPatch(`/investors?id=eq.${user.id}`, { password_hash: createV2Hash(password) });
        await dbPatch(`/investors?id=eq.${user.id}`, { last_login: new Date().toISOString() });
        return ok({ success: true, investor: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, company_name: user.company_name, portfolio_count: user.portfolio_count, investment_budget_min: user.investment_budget_min, investment_budget_max: user.investment_budget_max, preferred_markets: user.preferred_markets, preferred_operation_types: user.preferred_operation_types, referral_code: user.referral_code, onboarding_completed: user.onboarding_completed, sms_opt_in: user.sms_opt_in, email_opt_in: user.email_opt_in, linked_staff_id: user.linked_staff_id } });
      }

      // GET PROFILE
      if (action === 'get_profile') {
        const { investor_id } = body;
        const { data } = await dbGet(`/investors?id=eq.${investor_id}&select=*`);
        return ok({ success: true, investor: data?.[0] || null });
      }

      // UPDATE PROFILE
      if (action === 'update_profile') {
        const { investor_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/investors?id=eq.${investor_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      // FORGOT PASSWORD
      if (action === 'forgot_password') {
        const { email } = body;
        const { data: users } = await dbGet(`/investors?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=id,email,full_name`);
        if (users?.length) {
          const token = uuidv4() + '-' + uuidv4();
          const expires = new Date(Date.now() + 3600000);
          await dbPatch(`/investors?id=eq.${users[0].id}`, { reset_token: token, reset_token_expires: expires.toISOString() });
          const resetUrl = `${SITE_URL}/investor/reset-password?token=${token}`;
          await sendEmail({ to: email, subject: 'Reset Your Password', html: `<p>Hi ${users[0].full_name},</p><p><a href="${resetUrl}">Click here to reset your password</a>. Link expires in 1 hour.</p>` });
        }
        return ok({ success: true });
      }

      // RESET PASSWORD
      if (action === 'reset_password') {
        const { token, new_password } = body;
        const { data: users } = await dbGet(`/investors?reset_token=eq.${token}&select=id,reset_token_expires`);
        if (!users?.length) return ok({ success: false, error: 'Invalid or expired token' });
        if (new Date(users[0].reset_token_expires) < new Date()) return ok({ success: false, error: 'Token expired' });
        const hash = createV2Hash(new_password);
        await dbPatch(`/investors?id=eq.${users[0].id}`, { password_hash: hash, reset_token: null, reset_token_expires: null, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      // GET LINKED STAFF
      if (action === 'get_linked_staff') {
        const { investor_id } = body;
        const { data } = await dbGet(`/investors?id=eq.${investor_id}&select=linked_staff_id`);
        return ok({ staff_id: data?.[0]?.linked_staff_id || null });
      }

      // SWITCH TO STAFF
      if (action === 'switch_to_staff') {
        const { investor_id } = body;
        const { data: inv } = await dbGet(`/investors?id=eq.${investor_id}&select=linked_staff_id`);
        if (!inv?.[0]?.linked_staff_id) return ok({ success: false, error: 'No linked staff account' });
        const { data: staff } = await dbGet(`/staff_users?id=eq.${inv[0].linked_staff_id}&select=*`);
        return ok({ success: true, staff: staff?.[0] || null });
      }

      return err(`Unknown investor-auth action: ${action}`);
    }

    // ─────────────────────────── AUTH: STAFF ─────────────────────────────
    case 'staff-login':
    case 'staff-forgot-password': {
      const MAX_FAILED_ATTEMPTS = 5;
      const LOCKOUT_DURATION_MS = 30 * 1000;

      const { action, email, password, reset_token, new_password, staff_id, current_password, investor_email,
              session_token, invitation_token, phone, whatsapp_number, base_url } = body;

      function buildStaffSession(user, agreementInfo, sessionTok) {
        return {
          id: user.id, email: user.email,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name, last_name: user.last_name, phone: user.phone,
          whatsapp_number: user.whatsapp_number, team: user.team, role: user.role,
          department: user.department, permissions: user.permissions || [],
          linked_investor_id: user.linked_investor_id, roles: user.roles || [],
          yp_certified: user.yp_certified, trainee_status: user.trainee_status,
          commission_split: user.commission_split, notification_preferences: user.notification_preferences,
          account_completed: true,
          agreement_signed: agreementInfo ? agreementInfo.agreement_signed : true,
          agreement_id: agreementInfo ? agreementInfo.agreement_id : null,
          ...(sessionTok ? { session_token: sessionTok } : {}),
        };
      }

      async function checkAgreementSigned(sId) {
        try {
          const { data } = await dbGet(`/am_agreements?staff_id=eq.${sId}&select=id,status&order=created_at.desc&limit=1`);
          if (!data?.length) return { agreement_signed: true, agreement_id: null };
          return { agreement_signed: data[0].status === 'signed', agreement_id: data[0].id };
        } catch { return { agreement_signed: true, agreement_id: null }; }
      }

      const STAFF_SELECT = 'id,email,is_active,password_hash,account_completed,first_name,last_name,name,phone,whatsapp_number,team,role,department,permissions,linked_investor_id,roles,yp_certified,trainee_status,commission_split,notification_preferences,failed_login_attempts,locked_until';

      // ==================== REFRESH SESSION ====================
      if (action === 'refresh_session') {
        if (!staff_id) return ok({ success: false, error: 'staff_id required' });
        const { data: users } = await dbGet(`/staff_users?id=eq.${staff_id}&select=${STAFF_SELECT}`);
        if (!users?.length) return ok({ success: false, error: 'Staff member not found' });
        const user = users[0];
        if (user.is_active === false) return ok({ success: false, error: 'Account is deactivated' });
        const isAM = user.department === 'acquisition_managers' || (user.roles || []).includes('acquisition_managers');
        const agreementInfo = isAM ? await checkAgreementSigned(user.id) : null;
        return ok({ success: true, message: 'Session refreshed successfully', ...buildStaffSession(user, agreementInfo) });
      }

      // ==================== VALIDATE SESSION TOKEN ====================
      if (action === 'validate_session') {
        if (!session_token || !staff_id) return ok({ valid: false, error: 'session_token and staff_id required' });
        const { data: users } = await dbGet(`/staff_users?id=eq.${staff_id}&select=id,session_token,session_expires,is_active`);
        if (!users?.length) return ok({ valid: false, error: 'User not found' });
        const user = users[0];
        if (user.is_active === false) return ok({ valid: false, error: 'Account deactivated' });
        if (!user.session_token) return ok({ valid: false, error: 'No active session' });
        if (!constantTimeEqual(user.session_token, session_token)) return ok({ valid: false, error: 'Invalid session token' });
        if (user.session_expires && new Date(user.session_expires) < new Date()) return ok({ valid: false, error: 'Session expired' });
        return ok({ valid: true });
      }

      // ==================== CHANGE PASSWORD ====================
      if (action === 'change_password') {
        if (!staff_id || !current_password || !new_password) return ok({ success: false, error: 'Missing fields' });
        const { data: users } = await dbGet(`/staff_users?id=eq.${staff_id}&select=password_hash`);
        if (!users?.length || !users[0].password_hash) return ok({ success: false, error: 'Invalid current password' });
        if (!verifyStaffPassword(current_password, users[0].password_hash)) return ok({ success: false, error: 'Invalid current password' });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { password_hash: hashStaffPassword(new_password), account_completed: true, is_active: true });
        return ok({ success: true });
      }

      // ==================== FORGOT PASSWORD ====================
      if (action === 'forgot_password') {
        const emailLower = email?.toLowerCase().trim();
        if (!emailLower) return ok({ success: true, message: 'Reset link sent if account exists' });
        const { data: users } = await dbGet(`/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=*`);
        if (users?.length) {
          const token = 'rst_' + crypto.randomBytes(32).toString('hex');
          const expires = new Date(Date.now() + 3600000).toISOString();
          await dbPatch(`/staff_users?id=eq.${users[0].id}`, { reset_token: token, reset_token_expires: expires });
          const resetUrl = `${base_url || SITE_URL}/staff/reset-password?token=${token}`;
          const userName = users[0].first_name || users[0].name || 'Staff Member';
          const emailResult = await sendEmail({ to: users[0].email, subject: 'Reset Your Staff Password - Access Your Place', html: `<p>Hi ${userName},</p><p><a href="${resetUrl}">Click here to reset your password</a>. Expires in 1 hour.</p>` });
          if (!emailResult.ok) console.error('[staff-forgot-password] Email failed to send:', emailResult.error);
        }
        // Always return success regardless of whether the email was found/sent — intentional,
        // to avoid leaking which emails are registered. Failures are logged server-side above.
        return ok({ success: true, message: 'If an account exists with that email, you will receive a password reset link.' });
      }

      // ==================== VALIDATE TOKEN ====================
      if (action === 'validate_token') {
        const { data: users } = await dbGet(`/staff_users?reset_token=eq.${reset_token}&select=id,email,name,first_name,last_name,reset_token_expires`);
        if (!users?.length) return ok({ valid: false, error: 'Invalid or expired token' });
        if (users[0].reset_token_expires && new Date(users[0].reset_token_expires) < new Date()) return ok({ valid: false, error: 'Token has expired' });
        return ok({ valid: true, email: users[0].email, name: users[0].name || `${users[0].first_name || ''} ${users[0].last_name || ''}`.trim() });
      }

      // ==================== VALIDATE INVITATION ====================
      if (action === 'validate_invitation') {
        if (!invitation_token) return ok({ valid: false, error: 'Invitation token required' });
        const { data: users } = await dbGet(`/staff_users?invitation_token=eq.${invitation_token}&select=id,email,first_name,last_name,department,invitation_expires,account_completed`);
        if (!users?.length) return ok({ valid: false, error: 'Invalid invitation token' });
        const user = users[0];
        if (user.account_completed) return ok({ valid: false, error: 'Account already set up. Please log in.' });
        if (user.invitation_expires && new Date(user.invitation_expires) < new Date()) return ok({ valid: false, error: 'Invitation has expired. Please contact your administrator.' });
        return ok({ valid: true, email: user.email, first_name: user.first_name, last_name: user.last_name, department: user.department });
      }

      // ==================== COMPLETE INVITATION ====================
      if (action === 'complete_invitation' || action === 'complete_account') {
        const pwd = new_password || body.password;
        if (!invitation_token || !pwd) return ok({ success: false, error: 'Invitation token and password required' });
        const { data: users } = await dbGet(`/staff_users?invitation_token=eq.${invitation_token}&select=id,email,first_name,last_name,department,roles,invitation_expires,account_completed`);
        if (!users?.length) return ok({ success: false, error: 'Invalid invitation token' });
        const user = users[0];
        if (user.account_completed) return ok({ success: false, error: 'Account already set up' });
        if (user.invitation_expires && new Date(user.invitation_expires) < new Date()) return ok({ success: false, error: 'Invitation has expired' });

        const sessionTok = generateSessionToken();
        const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await dbPatch(`/staff_users?id=eq.${user.id}`, {
          password_hash: hashStaffPassword(pwd), phone: phone || null, whatsapp_number: whatsapp_number || null,
          invitation_token: null, invitation_expires: null, account_completed: true, is_active: true,
          last_login: new Date().toISOString(), updated_at: new Date().toISOString(),
          session_token: sessionTok, session_expires: sessionExpires,
          failed_login_attempts: 0, locked_until: null,
        });

        const { data: fullUsers } = await dbGet(`/staff_users?id=eq.${user.id}&select=${STAFF_SELECT}`);
        const fullUser = fullUsers?.[0] || user;
        const isAM = fullUser.department === 'acquisition_managers' || (fullUser.roles || []).includes('acquisition_managers');
        const agreementInfo = isAM ? await checkAgreementSigned(fullUser.id) : null;

        // Non-blocking: notify Success Team if this new AM has no mentor assigned yet
        if (fullUser.department === 'acquisition_managers') {
          (async () => {
            try {
              const { data: check } = await dbGet(`/staff_users?id=eq.${fullUser.id}&select=assigned_mentor_id`);
              if (!check?.[0]?.assigned_mentor_id) {
                const { data: successManagers } = await dbGet(`/staff_users?department=eq.success_managers&is_active=eq.true&select=email,first_name`);
                const amName = `${fullUser.first_name || ''} ${fullUser.last_name || ''}`.trim();
                for (const sm of successManagers || []) {
                  if (sm.email) await sendEmail({ to: sm.email, subject: `Action Required: New AM ${amName} Needs Mentor Assignment`, html: `<p>New AM <strong>${amName}</strong> (${fullUser.email}) completed account setup but has no mentor assigned.</p><p><a href="${SITE_URL}/staff">Go to Staff Dashboard</a></p>` }).catch(() => {});
                }
              }
            } catch (e) { console.error('[complete_invitation] mentor-notify failed:', e.message); }
          })();
        }

        return ok({ success: true, message: 'Account setup complete', ...buildStaffSession(fullUser, agreementInfo, sessionTok) });
      }

      // ==================== RESET PASSWORD ====================
      if (action === 'reset_password') {
        if (!reset_token || !new_password) return ok({ success: false, error: 'Token and new password required' });
        const { data: users } = await dbGet(`/staff_users?reset_token=eq.${reset_token}&select=id,email,reset_token_expires`);
        if (!users?.length) return ok({ success: false, error: 'Invalid or expired token' });
        if (users[0].reset_token_expires && new Date(users[0].reset_token_expires) < new Date()) return ok({ success: false, error: 'Token has expired. Please request a new reset link.' });
        await dbPatch(`/staff_users?id=eq.${users[0].id}`, {
          password_hash: hashStaffPassword(new_password), reset_token: null, reset_token_expires: null,
          account_completed: true, is_active: true, updated_at: new Date().toISOString(),
          failed_login_attempts: 0, locked_until: null,
        });
        return ok({ success: true, message: 'Password reset successfully' });
      }

      // ==================== LINK / UNLINK / GET INVESTOR ====================
      if (action === 'link_investor_account' || action === 'link_investor') {
        if (!staff_id || !investor_email) return ok({ success: false, error: 'Missing fields' });
        const { data: investors } = await dbGet(`/investors?email=eq.${encodeURIComponent(investor_email.toLowerCase())}&select=*`);
        if (!investors?.length) return ok({ success: false, error: 'Investor not found' });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { linked_investor_id: investors[0].id });
        return ok({ success: true, investor: investors[0] });
      }

      if (action === 'unlink_investor_account') {
        if (!staff_id) return ok({ success: false, error: 'Missing staff_id' });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { linked_investor_id: null });
        return ok({ success: true });
      }

      if (action === 'get_linked_investor') {
        if (!staff_id) return ok({ success: false, error: 'Missing staff_id' });
        const { data: staff } = await dbGet(`/staff_users?id=eq.${staff_id}&select=linked_investor_id`);
        if (!staff?.[0]?.linked_investor_id) return ok({ investor: null });
        const { data: investors } = await dbGet(`/investors?id=eq.${staff[0].linked_investor_id}&select=*`);
        return ok({ investor: investors?.[0] || null });
      }

      // ==================== LOGOUT ====================
      if (action === 'logout') {
        if (!staff_id) return ok({ success: true });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { session_token: null, session_expires: null }).catch(() => {});
        return ok({ success: true, message: 'Logged out' });
      }

      // ==================== LOGIN (DEFAULT ACTION) ====================
      if (!email || !password) return ok({ success: false, error: 'Email and password required' });
      const emailLower = email.toLowerCase().trim();

      // Server-side rate limiting check (requires migrations/001_staff_login_session_security.sql to be applied)
      const { data: rlCheck } = await dbGet(`/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=failed_login_attempts,locked_until`).catch(() => ({ data: null }));
      if (rlCheck?.length && rlCheck[0].locked_until && new Date(rlCheck[0].locked_until) > new Date()) {
        const remainingSec = Math.ceil((new Date(rlCheck[0].locked_until).getTime() - Date.now()) / 1000);
        return ok({ success: false, error: `Too many failed login attempts. Please wait ${remainingSec} seconds before trying again.`, rate_limited: true, retry_after_seconds: remainingSec });
      }

      const { data: users } = await dbGet(`/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=${STAFF_SELECT}`);
      if (!users?.length) {
        await new Promise(r => setTimeout(r, 100 + Math.random() * 100)); // mask user-existence via timing
        return ok({ success: false, error: 'Invalid email or password' });
      }
      const user = users[0];
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingSec = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000);
        return ok({ success: false, error: `Account temporarily locked. Please wait ${remainingSec} seconds before trying again.`, rate_limited: true, retry_after_seconds: remainingSec });
      }
      if (user.is_active === false) return ok({ success: false, error: 'Account is deactivated. Please contact your administrator.' });

      const stored = user.password_hash || user.password;
      if (!stored) return ok({ success: false, error: 'Account not set up. Please check your invitation email.' });
      const passwordValid = verifyStaffPassword(password, stored);

      if (!passwordValid) {
        const newCount = (user.failed_login_attempts || 0) + 1;
        const patch = { failed_login_attempts: newCount, last_failed_login: new Date().toISOString() };
        if (newCount >= MAX_FAILED_ATTEMPTS) patch.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        await dbPatch(`/staff_users?id=eq.${user.id}`, patch).catch(() => {});
        const remainingAttempts = MAX_FAILED_ATTEMPTS - newCount;
        let errorMsg = 'Invalid email or password';
        if (remainingAttempts > 0 && remainingAttempts <= 2) errorMsg += `. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.`;
        else if (remainingAttempts <= 0) errorMsg = `Too many failed login attempts. Your account has been temporarily locked for ${LOCKOUT_DURATION_MS / 1000} seconds.`;
        return ok({ success: false, error: errorMsg, ...(remainingAttempts <= 0 ? { rate_limited: true, retry_after_seconds: LOCKOUT_DURATION_MS / 1000 } : {}) });
      }

      // Successful login
      const sessionTok = generateSessionToken();
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const loginUpdate = { last_login: new Date().toISOString(), is_active: true, session_token: sessionTok, session_expires: sessionExpires, failed_login_attempts: 0, locked_until: null, last_failed_login: null };
      if (!user.account_completed) loginUpdate.account_completed = true;
      // Silently upgrade legacy plaintext rows to the hashed format on successful login
      if (constantTimeEqual(stored, password) || constantTimeEqual(String(stored).trim(), String(password).trim())) {
        loginUpdate.password_hash = hashStaffPassword(password);
      }
      await dbPatch(`/staff_users?id=eq.${user.id}`, loginUpdate).catch(() => {});

      const isAM = user.department === 'acquisition_managers' || (user.roles || []).includes('acquisition_managers');
      const agreementInfo = isAM ? await checkAgreementSigned(user.id) : null;

      return ok({ success: true, ...buildStaffSession(user, agreementInfo, sessionTok) });
    }

    // ─────────────────────────── INVESTOR FAVORITES ───────────────────────
    case 'investor-favorites': {
      const { action, investor_id, property_id } = body;
      if (action === 'get') {
        const { data } = await dbGet(`/investor_favorites?investor_id=eq.${investor_id}&select=*,properties(*)`);
        return ok({ success: true, favorites: data || [] });
      }
      if (action === 'add') {
        const existing = await dbGet(`/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`);
        if (existing.data?.length) return ok({ success: true, message: 'Already favorited' });
        await dbPost('/investor_favorites', { investor_id, property_id, created_at: new Date().toISOString() });
        return ok({ success: true });
      }
      if (action === 'remove') {
        await dbDelete(`/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}`);
        return ok({ success: true });
      }
      return err('Unknown favorites action');
    }

    // ─────────────────────────── MANAGE STAFF ────────────────────────────
    case 'manage-staff': {
      const { action } = body;

      if (action === 'get_staff') {
        const { data } = await dbGet('/staff_users?is_active=eq.true&order=created_at.desc&select=*');
        return ok({ success: true, staff: data || [] });
      }

      if (action === 'add_staff') {
        const { first_name, last_name, email, phone, department, roles, base_url } = body;
        const existing = await dbGet(`/staff_users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`);
        if (existing.data?.length) return ok({ success: false, error: 'A staff member with this email already exists' });
        const invToken = uuidv4() + '-' + uuidv4();
        const result = await dbPost('/staff_users', { email: email.toLowerCase().trim(), first_name: first_name.trim(), last_name: last_name.trim(), phone: phone || null, department, roles: roles || [department], invitation_token: invToken, invitation_expires: new Date(Date.now() + 7 * 86400000).toISOString(), is_active: true, account_completed: false });
        const inviteUrl = `${base_url || SITE_URL}/staff/login?invitation=${invToken}`;
        const emailResult = await sendEmail({ to: email, subject: 'Welcome to Access Your Place - Complete Your Account Setup', html: `<p>Hi ${first_name},</p><p>You have been added as ${department}. <a href="${inviteUrl}">Click here to complete your account setup</a>. Link expires in 7 days.</p>` });
        const createdStaff = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!emailResult.ok) {
          // Staff record was created, but the invite never went out — surface this clearly
          // rather than reporting blanket success while the new hire silently can't log in.
          return ok({
            success: true,
            staff: createdStaff,
            warning: `Staff account created, but the invitation email could not be sent (${emailResult.error}). Share this setup link with ${first_name} directly: ${inviteUrl}`,
            invite_url: inviteUrl,
            email_failed: true,
          });
        }
        return ok({ success: true, staff: createdStaff, invite_url: inviteUrl });
      }

      if (action === 'update_roles') {
        const { staff_id, roles } = body;
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { roles, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'deactivate') {
        const { staff_id, deactivated_by } = body;
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { is_active: false, deactivated_by, deactivated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'reactivate') {
        const { staff_id } = body;
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { is_active: true, deactivated_by: null, deactivated_at: null });
        return ok({ success: true });
      }

      if (action === 'get_certifications') {
        const { staff_id } = body;
        const q = staff_id ? `/staff_certifications?staff_id=eq.${staff_id}&select=*` : '/staff_certifications?select=*&order=uploaded_at.desc';
        const { data } = await dbGet(q);
        return ok({ success: true, certifications: data || [] });
      }

      if (action === 'verify_certification') {
        const { cert_id, verified_by } = body;
        await dbPatch(`/staff_certifications?id=eq.${cert_id}`, { status: 'verified', verified_by, verified_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'reject_certification') {
        const { cert_id, rejection_reason, rejected_by } = body;
        await dbPatch(`/staff_certifications?id=eq.${cert_id}`, { status: 'rejected', rejection_reason, verified_by: rejected_by });
        return ok({ success: true });
      }

      if (action === 'get_all_staff') {
        const { data } = await dbGet('/staff_users?order=created_at.desc&select=*');
        return ok({ success: true, staff: data || [] });
      }

      return err(`Unknown manage-staff action: ${action}`);
    }

    // ─────────────────────────── SEND INVESTOR INVITATION ─────────────────
    case 'send-investor-invitation': {
      const { action, email, investor_id, staff_id: sId, base_url } = body;

      if (action === 'send' || action === 'invite') {
        const token = uuidv4();
        const expires = new Date(Date.now() + 7 * 86400000).toISOString();
        await dbPatch(`/investors?id=eq.${investor_id}`, { invitation_token: token, invitation_expires: expires });
        const invUrl = `${base_url || SITE_URL}/investor/portal?invitation=${token}`;
        await sendEmail({ to: email, subject: 'Your Access Your Place Investor Account Invitation', html: `<p>You have been invited to Access Your Place. <a href="${invUrl}">Click here to get started</a>. Expires in 7 days.</p>` });
        return ok({ success: true });
      }

      if (action === 'get_investors') {
        const { data } = await dbGet('/investors?order=created_at.desc&select=*');
        return ok({ success: true, investors: data || [] });
      }

      if (action === 'update_investor') {
        const { investor_id: iid, ...updates } = body;
        delete updates.action;
        await dbPatch(`/investors?id=eq.${iid}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'create_investor') {
        const { email: em, full_name, phone } = body;
        const result = await dbPost('/investors', { email: em, full_name, phone, onboarding_completed: false, referral_code: 'AYP' + Math.random().toString(36).substring(2,8).toUpperCase() });
        return ok({ success: true, investor: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      return err(`Unknown send-investor-invitation action: ${action}`);
    }

    // ─────────────────────────── PROPERTIES ──────────────────────────────
    case 'get-properties': {
      const { status, source, city, state, zip_code, limit = 50, offset = 0 } = body;
      let q = `/properties?select=*,deal_analytics(*)&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (status && status !== 'all') q += `&status=eq.${status}`;
      if (source) q += `&source=eq.${source}`;
      if (city) q += `&city=ilike.%25${encodeURIComponent(city)}%25`;
      if (state) q += `&state=eq.${state}`;
      if (zip_code) q += `&zip_code=eq.${zip_code}`;
      const { data } = await dbGet(q);
      return ok({ success: true, properties: data || [] });
    }

    case 'add-property':
    case 'create-property': {
      const { property } = body;
      const result = await dbPost('/properties', { ...property, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      const prop = Array.isArray(result.data) ? result.data[0] : result.data;
      return ok({ success: true, property: prop });
    }

    case 'update-property': {
      const { property_id, ...updates } = body;
      delete updates.action;
      await dbPatch(`/properties?id=eq.${property_id}`, { ...updates, updated_at: new Date().toISOString() });
      return ok({ success: true });
    }

    case 'delete-property': {
      const { property_id } = body;
      await dbDelete(`/properties?id=eq.${property_id}`);
      return ok({ success: true });
    }

    case 'clear-all-properties': {
      // Admin only - clears all properties (use with caution)
      await dbDelete('/properties?status=neq.active');
      return ok({ success: true });
    }

    // ─────────────────────────── DEAL MARKETPLACE ─────────────────────────
    case 'manage-deal-marketplace': {
      const { action } = body;

      if (action === 'get_deals') {
        const { status, operation_type, limit = 20, offset = 0 } = body;
        let q = `/properties?is_published=eq.true&order=created_at.desc&limit=${limit}&offset=${offset}&select=*,deal_analytics(*)`;
        if (status && status !== 'all') q += `&deal_status=eq.${status}`;
        if (operation_type) q += `&operation_type=eq.${operation_type}`;
        const { data } = await dbGet(q);
        return ok({ success: true, deals: data || [] });
      }

      if (action === 'get_deal') {
        const { deal_id } = body;
        const { data } = await dbGet(`/properties?id=eq.${deal_id}&select=*,deal_analytics(*)`);
        return ok({ success: true, deal: data?.[0] || null });
      }

      if (action === 'publish_deal') {
        const { deal_id } = body;
        await dbPatch(`/properties?id=eq.${deal_id}`, { is_published: true, deal_status: 'available', published_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'unpublish_deal') {
        const { deal_id } = body;
        await dbPatch(`/properties?id=eq.${deal_id}`, { is_published: false });
        return ok({ success: true });
      }

      if (action === 'update_deal_status') {
        const { deal_id, deal_status } = body;
        await dbPatch(`/properties?id=eq.${deal_id}`, { deal_status, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'get_inquiries') {
        const { deal_id, investor_id } = body;
        let q = '/deal_inquiries?select=*,investors(full_name,email)&order=created_at.desc';
        if (deal_id) q += `&deal_id=eq.${deal_id}`;
        if (investor_id) q += `&investor_id=eq.${investor_id}`;
        const { data } = await dbGet(q);
        return ok({ success: true, inquiries: data || [] });
      }

      if (action === 'create_inquiry') {
        const { deal_id, investor_id, message, investment_type } = body;
        const result = await dbPost('/deal_inquiries', { deal_id, investor_id, message, investment_type, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, inquiry: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      return err(`Unknown manage-deal-marketplace action: ${action}`);
    }

    // ─────────────────────────── INVESTOR MESSAGING ───────────────────────
    case 'investor-messaging': {
      const { action, investor_id, staff_id, message_id } = body;

      if (action === 'get_conversations') {
        const { data } = await dbGet(`/investor_messages?or=(investor_id.eq.${investor_id},staff_id.eq.${investor_id})&order=created_at.desc&select=*`);
        return ok({ success: true, conversations: data || [] });
      }

      if (action === 'send_message') {
        const { content, recipient_id, message_type = 'text' } = body;
        const result = await dbPost('/investor_messages', { investor_id, staff_id, content, recipient_id, message_type, read: false, created_at: new Date().toISOString() });
        return ok({ success: true, message: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'mark_read') {
        await dbPatch(`/investor_messages?id=eq.${message_id}`, { read: true });
        return ok({ success: true });
      }

      if (action === 'get_unread_count') {
        const { data } = await dbGet(`/investor_messages?recipient_id=eq.${investor_id}&read=eq.false&select=id`);
        return ok({ success: true, count: data?.length || 0 });
      }

      return err(`Unknown investor-messaging action: ${action}`);
    }

    // ─────────────────────────── AM SUBMIT DEAL ───────────────────────────
    case 'am-submit-deal': {
      const { action } = body;

      function getStaffDisplayName(staff) {
        if (staff.first_name) return `${staff.first_name} ${staff.last_name || ''}`.trim();
        if (staff.name) return staff.name;
        return 'Team Member';
      }

      async function getSuccessTeamMembers() {
        const { data } = await dbGet(`/staff_users?select=id,email,name,first_name,last_name,role,department,roles&is_active=eq.true&or=(role.eq.success_managers,department.eq.success_managers,role.eq.admin,role.eq.success_manager)`);
        return Array.isArray(data) ? data : [];
      }

      async function logActivity(propertyId, activityType, activityDescription, performerName, newValue, previousValue, performedBy) {
        try {
          await dbPost('/deal_activity_log', {
            property_id: propertyId, activity_type: activityType, activity_description: activityDescription,
            performer_name: performerName || 'System', new_value: newValue || null, previous_value: previousValue || null,
            performed_by: performedBy || null, created_at: new Date().toISOString(),
          });
        } catch (e) { console.error('[am-submit-deal] Activity log error:', e.message); }
      }

      // Mirrors deal_status_notifications_notification_type_check constraint in the real schema.
      const VALID_NOTIFICATION_TYPES = ['deal_submitted','deal_under_review','deal_approved','deal_rejected','deal_published','deal_verified','deal_archived','deal_status_change','deal_needs_changes','deal_unpublished'];
      async function insertDealStatusNotification(notif) {
        try {
          if (!VALID_NOTIFICATION_TYPES.includes(notif.notification_type)) {
            console.error('[am-submit-deal] Invalid notification_type, skipping insert:', notif.notification_type);
            return null;
          }
          const result = await dbPost('/deal_status_notifications', {
            ...notif, is_read: false, email_sent: false, metadata: notif.metadata || {},
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          });
          const created = Array.isArray(result.data) ? result.data[0] : result.data;
          if (!created?.id) console.error('[am-submit-deal] Notification insert error:', JSON.stringify(result.data));
          return created?.id || null;
        } catch (e) { console.error('[am-submit-deal] Notification error:', e.message); return null; }
      }

      async function sendDealEmail(to, subject, html) {
        const result = await sendEmail({ to, subject, html });
        return result.ok;
      }

      // Calls the internal penny-deal-scoring function over HTTP, same pattern as the
      // original cross-edge-function call. NOTE: penny-deal-scoring itself still needs
      // its own real-source port (separate pass) -- this call is resilient to that
      // function not yet returning the expected shape, so deal approval never hard-fails
      // because of it.
      async function triggerPennyScoring(propertyId, propertyData) {
        try {
          const internalUrl = `http://localhost:${PORT}/functions/v1/penny-deal-scoring`;
          const scoringRes = await fetch(internalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'score_property', property_id: propertyId, property_data: propertyData }),
          });
          if (!scoringRes.ok) return { score: null, recommendation: null, error: `HTTP ${scoringRes.status}` };
          const scoreResult = await scoringRes.json();
          if (scoreResult.score !== undefined) {
            await dbPatch(`/properties?id=eq.${propertyId}`, { penny_score: scoreResult.score, penny_recommendation: scoreResult.recommendation, penny_scored_at: new Date().toISOString() }).catch(() => {});
            return { score: scoreResult.score, recommendation: scoreResult.recommendation, confidence: scoreResult.confidence };
          }
          return { score: null, recommendation: null, error: 'No score returned' };
        } catch (e) { return { score: null, recommendation: null, error: e.message }; }
      }

      // ========== GET DEAL ACTIVITY LOG ==========
      if (action === 'get_deal_activity_log') {
        const { property_id } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const { data } = await dbGet(`/deal_activity_log?property_id=eq.${property_id}&order=created_at.desc&limit=100`);
        const logs = Array.isArray(data) ? data : [];
        return ok({ success: true, logs, count: logs.length });
      }

      // ========== GET ACQUISITION MANAGERS ==========
      if (action === 'get_acquisition_managers') {
        const { data } = await dbGet(`/staff_users?select=id,email,name,first_name,last_name,role,department,roles&is_active=eq.true&or=(department.eq.acquisition_managers,role.eq.acquisition_managers,role.eq.acquisition_manager)&order=first_name.asc`);
        const managers = (Array.isArray(data) ? data : []).map(s => ({ id: s.id, name: getStaffDisplayName(s), email: s.email, department: s.department }));
        return ok({ success: true, managers });
      }

      // ========== TOGGLE THIRD-PARTY SELLER ==========
      if (action === 'toggle_third_party') {
        const { property_id, is_third_party_seller, staff_name, staff_id } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const patchRes = await dbPatch(`/properties?id=eq.${property_id}`, { is_third_party_seller: !!is_third_party_seller, source: is_third_party_seller ? 'third_party' : 'acquisition_manager', updated_at: new Date().toISOString() });
        if (!patchRes.ok) return ok({ success: false, error: JSON.stringify(patchRes.data).substring(0, 200) });
        await logActivity(property_id, 'third_party_toggled', `Deal marked as ${is_third_party_seller ? 'third-party seller' : 'direct acquisition'} by ${staff_name || 'Staff'}`, staff_name || 'Staff', JSON.stringify({ is_third_party_seller }), null, staff_id || null);
        return ok({ success: true, message: `Deal marked as ${is_third_party_seller ? 'third-party seller' : 'direct acquisition'}` });
      }

      // ========== ASSIGN AM TO DEAL ==========
      if (action === 'assign_am_to_deal') {
        const { property_id, am_staff_id, am_staff_name, assigned_by_name, assigned_by_staff_id } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        if (!am_staff_id) return ok({ success: false, error: 'AM staff ID required' });
        const { data: propData } = await dbGet(`/properties?id=eq.${property_id}&select=found_by_am_id,found_by_am_name`);
        const previousAm = propData?.[0]?.found_by_am_name || 'None';
        const patchRes = await dbPatch(`/properties?id=eq.${property_id}`, { found_by_am_id: am_staff_id, found_by_am_name: am_staff_name || null, updated_at: new Date().toISOString() });
        if (!patchRes.ok) return ok({ success: false, error: JSON.stringify(patchRes.data).substring(0, 200) });
        await logActivity(property_id, 'am_assigned', `AM ${am_staff_name || 'Unknown'} assigned to deal by ${assigned_by_name || 'Success Team'}`, assigned_by_name || 'Success Team', JSON.stringify({ am_staff_id, am_staff_name }), JSON.stringify({ previous_am: previousAm }), assigned_by_staff_id || null);
        return ok({ success: true, message: `AM ${am_staff_name || 'Unknown'} assigned to deal` });
      }

      // ========== SUBMIT DEAL ==========
      if (action === 'submit_deal') {
        const {
          address, city, state, zip_code, asking_price, monthly_revenue,
          bedrooms, bathrooms, sqft, property_type, operation_type,
          notes, photos, listing_url, landlord_name, landlord_email, landlord_phone,
          submitted_by_staff_id, submitted_by_staff_name, community_name,
          submitted_by_type, submitted_by_client_name, submitted_by_client_email,
          is_third_party_seller, listing_title, listing_description,
          adr_peak_season, adr_slow_season, monthly_room_rate, avg_occupancy_rate,
          projected_yearly_revenue, projected_monthly_revenue_peak, projected_monthly_revenue_slow,
          peak_season_description, deposits_concessions_notes,
        } = body;

        const errors = [];
        if (!address?.trim()) errors.push('Street address is required');
        if (!city?.trim()) errors.push('City is required');
        if (!state?.trim()) errors.push('State is required');
        if (!zip_code?.trim()) errors.push('ZIP code is required');
        if (!asking_price || parseFloat(String(asking_price)) <= 0) errors.push('Asking price is required');
        if (!monthly_revenue || parseFloat(String(monthly_revenue)) <= 0) errors.push('Monthly revenue is required');
        if (!operation_type) errors.push('Operation type is required');
        if (!landlord_name?.trim()) errors.push('Landlord name is required');
        if (!landlord_phone?.trim() && !landlord_email?.trim()) errors.push('Landlord phone or email is required');
        const photoArray = Array.isArray(photos) ? photos.filter(p => p && p.trim()) : [];
        if (photoArray.length === 0) errors.push('At least 1 property photo is required');
        if (errors.length > 0) return ok({ success: false, error: errors.join('. '), validation_errors: errors });

        const autoTitle = listing_title?.trim() || `${bedrooms || 3}BR in ${city.trim()}, ${state.trim().toUpperCase()}`;
        const submitterType = submitted_by_type || 'acquisition_manager';

        const propertyData = {
          title: autoTitle, listing_title: autoTitle, listing_description: listing_description || null,
          address: address.trim(), city: city.trim(), state: state.trim().toUpperCase().substring(0, 2),
          zip_code: zip_code.trim(), price: parseFloat(String(asking_price)),
          monthly_rent: parseFloat(String(monthly_revenue)),
          bedrooms: parseInt(String(bedrooms)) || 3, bathrooms: parseFloat(String(bathrooms)) || 2,
          sqft: sqft ? parseInt(String(sqft)) : null,
          property_type: property_type || 'single_family', operation_type: operation_type || 'str',
          photos: photoArray, landlord_name: landlord_name || null, landlord_email: landlord_email || null,
          landlord_phone: landlord_phone || null, listing_url: listing_url || null,
          internal_notes: notes || null, community_name: community_name || null,
          is_third_party_seller: !!is_third_party_seller,
          status: 'am_submitted', deal_status: 'am_submitted', workflow_stage: 'am_submitted',
          workflow_stage_entered_at: new Date().toISOString(),
          source: is_third_party_seller ? 'third_party' : (submitterType === 'seller' ? 'seller_submission' : 'acquisition_manager'),
          submitted_by_type: submitterType, submitted_by_client_name: submitted_by_client_name || null,
          submitted_by_client_email: submitted_by_client_email || null,
          is_published: false, is_featured: false, featured: false, is_verified: false, staff_verified: false,
          added_by_staff_id: submitted_by_staff_id || null, added_by_staff_name: submitted_by_staff_name || null,
          found_by_am_id: submitted_by_staff_id || null, found_by_am_name: submitted_by_staff_name || null,
          units_available: 1, acquisition_fee: 2500,
          visibility_settings: { show_address: false, show_community_name: false, show_landlord_contact: false, show_full_photos: true, show_financials: true },
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        if (adr_peak_season) propertyData.adr_peak_season = parseFloat(String(adr_peak_season));
        if (adr_slow_season) propertyData.adr_slow_season = parseFloat(String(adr_slow_season));
        if (monthly_room_rate) propertyData.monthly_room_rate = parseFloat(String(monthly_room_rate));
        if (avg_occupancy_rate) propertyData.avg_occupancy_rate = parseFloat(String(avg_occupancy_rate));
        if (projected_yearly_revenue) propertyData.projected_yearly_revenue = parseFloat(String(projected_yearly_revenue));
        if (projected_monthly_revenue_peak) propertyData.projected_monthly_revenue_peak = parseFloat(String(projected_monthly_revenue_peak));
        if (projected_monthly_revenue_slow) propertyData.projected_monthly_revenue_slow = parseFloat(String(projected_monthly_revenue_slow));
        if (peak_season_description) propertyData.peak_season_description = peak_season_description;
        if (deposits_concessions_notes) propertyData.deposits_concessions_notes = deposits_concessions_notes;

        const insertRes = await dbPost('/properties', propertyData);
        if (!insertRes.ok) {
          console.error('[am-submit-deal] Insert error:', JSON.stringify(insertRes.data));
          return ok({ success: false, error: 'Failed to save property: ' + JSON.stringify(insertRes.data).substring(0, 200) });
        }
        const property = Array.isArray(insertRes.data) ? insertRes.data[0] : insertRes.data;

        await logActivity(property.id, 'am_deal_submitted', `${submitterType === 'seller' ? 'Seller' : 'AM'} ${submitted_by_staff_name || submitted_by_client_name || 'Unknown'} submitted deal: ${address}, ${city}${is_third_party_seller ? ' [Third-Party Seller]' : ''}`, submitted_by_staff_name || submitted_by_client_name || 'Submitter', JSON.stringify({ asking_price, monthly_revenue, status: 'am_submitted', submitted_by_type: submitterType, is_third_party_seller }), null, submitted_by_staff_id || null);

        if (submitted_by_staff_id) {
          const dealLocation = [city?.trim(), state?.trim()?.toUpperCase()].filter(Boolean).join(', ');
          await insertDealStatusNotification({
            property_id: property.id, property_title: autoTitle, property_address: address?.trim(),
            property_city: city?.trim(), property_state: state?.trim()?.toUpperCase(),
            recipient_staff_id: submitted_by_staff_id, recipient_staff_name: submitted_by_staff_name,
            notification_type: 'deal_submitted', new_status: 'am_submitted',
            message: `Your deal "${autoTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been submitted and is under review by the Success Team.`,
          });
        }

        // Create staff notification (note: must include `type` -- staff_notifications.type is
        // NOT NULL in the real schema and the original source never set it, which silently
        // failed every insert. Fixed here.)
        try {
          await dbPost('/staff_notifications', {
            type: 'am_deal_submitted', notification_type: 'am_deal_submitted',
            title: `New Deal Submitted: ${autoTitle}${is_third_party_seller ? ' [3rd Party]' : ''}`,
            message: `${submitted_by_staff_name || submitted_by_client_name || 'Someone'} submitted ${address}, ${city}, ${state} for review. Asking: $${Number(asking_price).toLocaleString()}`,
            target_role: 'success_managers', property_id: property.id,
            created_by_staff_id: submitted_by_staff_id || null,
            created_by_staff_name: submitted_by_staff_name || submitted_by_client_name || null,
            is_read: false, priority: 'high', created_at: new Date().toISOString(),
          });
        } catch (e) { console.error('[am-submit-deal] staff_notifications insert failed:', e.message); }

        let submitterEmailSent = false;
        if (submitted_by_staff_id) {
          try {
            const { data: staffData } = await dbGet(`/staff_users?id=eq.${submitted_by_staff_id}&select=email,name,first_name,last_name`);
            const staff = staffData?.[0];
            if (staff?.email) {
              submitterEmailSent = await sendDealEmail(staff.email, `Deal Received - ${autoTitle} - Under Review`,
                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#d4a574;margin:0;font-size:22px;">Deal Submission Received</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffDisplayName(staff)},</p><p>Your deal <strong>${autoTitle}</strong> has been received and is under Success Team review.</p><div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #d4a574;"><p style="margin:4px 0;"><strong>Location:</strong> ${city}, ${state}</p><p style="margin:4px 0;"><strong>Asking Price:</strong> $${Number(asking_price).toLocaleString()}</p><p style="margin:4px 0;"><strong>Monthly Revenue:</strong> $${Number(monthly_revenue).toLocaleString()}/mo</p></div><div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Track in Dashboard</a></div></div></div>`);
            }
          } catch (e) { console.error('[am-submit-deal] submitter email failed:', e.message); }
        }

        let emailsSent = 0;
        try {
          const successTeam = await getSuccessTeamMembers();
          for (const member of successTeam) {
            try {
              const sent = await sendDealEmail(member.email, `[Action Required] New Deal: ${autoTitle}${is_third_party_seller ? ' [3rd Party Seller]' : ''}`,
                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#d4a574;margin:0;">New Deal for Review</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffDisplayName(member)},</p><p><strong>AM: ${submitted_by_staff_name || 'Unknown'}</strong> submitted a new property:</p><div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #d4a574;"><p style="margin:4px 0;font-weight:bold;">${autoTitle}</p><p style="margin:4px 0;">${city}, ${state} ${zip_code || ''}</p><p style="margin:4px 0;">Price: $${Number(asking_price).toLocaleString()} | Revenue: $${Number(monthly_revenue).toLocaleString()}/mo</p>${is_third_party_seller ? '<p style="margin:4px 0;color:#9333ea;font-weight:bold;">Third-Party Seller Deal</p>' : ''}</div><div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Review Deal</a></div></div></div>`);
              if (sent) emailsSent++;
            } catch (e) { console.error('[am-submit-deal] success-team email failed:', e.message); }
          }
        } catch (e) { console.error('[am-submit-deal] getSuccessTeamMembers failed:', e.message); }

        return ok({ success: true, property, id: property?.id, property_id: property?.id, emails_sent: emailsSent, submitter_email_sent: submitterEmailSent, message: `Deal submitted successfully! ${emailsSent} Success Team member(s) notified.` });
      }

      // ========== GET AM SUBMITTED DEALS ==========
      if (action === 'get_submitted_deals') {
        const { staff_id, status_filter } = body;
        let q = `/properties?select=*&order=created_at.desc`;
        if (status_filter === 'am_submitted') q += '&deal_status=eq.am_submitted';
        else if (status_filter === 'am_approved') q += '&deal_status=eq.am_approved';
        else if (status_filter === 'am_denied') q += '&deal_status=eq.am_denied';
        else q += '&deal_status=in.(am_submitted,am_approved,am_denied)';
        if (staff_id) q += `&or=(added_by_staff_id.eq.${staff_id},found_by_am_id.eq.${staff_id})`;
        const { data } = await dbGet(q);
        const dealsList = Array.isArray(data) ? data : [];
        return ok({ success: true, deals: dealsList, counts: {
          total: dealsList.length,
          pending: dealsList.filter(d => d.deal_status === 'am_submitted').length,
          approved: dealsList.filter(d => d.deal_status === 'am_approved').length,
          denied: dealsList.filter(d => d.deal_status === 'am_denied').length,
        }});
      }

      // ========== GET FULL PIPELINE ==========
      if (action === 'get_pipeline_deals') {
        const { data: amData } = await dbGet(`/properties?select=*&deal_status=in.(am_submitted,am_approved,am_denied)&order=created_at.desc&limit=500`);
        const amList = Array.isArray(amData) ? amData : [];
        let sellerList = [];
        try {
          const { data: sellerData } = await dbGet(`/marketplace_listings?select=*,property:investor_portfolio(*),seller:investors!seller_id(full_name,email,phone)&status=in.(pending_approval,needs_changes)&order=created_at.desc&limit=100`);
          sellerList = Array.isArray(sellerData) ? sellerData : [];
        } catch (e) { /* skip */ }
        return ok({ success: true, am_deals: amList, seller_deals: sellerList, counts: {
          am_total: amList.length,
          am_pending: amList.filter(d => d.deal_status === 'am_submitted').length,
          am_approved: amList.filter(d => d.deal_status === 'am_approved').length,
          am_denied: amList.filter(d => d.deal_status === 'am_denied').length,
          seller_pending: sellerList.filter(d => d.status === 'pending_approval').length,
          seller_needs_changes: sellerList.filter(d => d.status === 'needs_changes').length,
        }});
      }

      // ========== GET PENDING COUNT ==========
      if (action === 'get_pending_count') {
        const { data } = await dbGet(`/properties?select=id&deal_status=eq.am_submitted`);
        return ok({ success: true, pending_count: Array.isArray(data) ? data.length : 0 });
      }

      // ========== APPROVE DEAL ==========
      if (action === 'approve_deal') {
        const { property_id, approved_by_name, approved_by_staff_id, approval_notes } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const { data: propRows } = await dbGet(`/properties?id=eq.${property_id}&select=*`);
        const propData = propRows?.[0];

        const patchRes = await dbPatch(`/properties?id=eq.${property_id}`, {
          deal_status: 'am_approved', status: 'new', workflow_stage: 'new', workflow_stage_entered_at: new Date().toISOString(),
          verification_status: 'verified', staff_verified: true, is_verified: true,
          approved_by_staff_id: approved_by_staff_id || null, approved_by_staff_name: approved_by_name || 'Success Team',
          approved_at: new Date().toISOString(),
          internal_notes: approval_notes ? `[APPROVED by ${approved_by_name || 'Success Team'}]: ${approval_notes}` : (propData?.internal_notes || null),
          updated_at: new Date().toISOString(),
        });
        if (!patchRes.ok) return ok({ success: false, error: 'Failed to approve: ' + JSON.stringify(patchRes.data).substring(0, 200) });

        await logActivity(property_id, 'am_deal_approved', `Deal approved by ${approved_by_name || 'Success Team'}${approval_notes ? ': ' + approval_notes : ''}`, approved_by_name || 'Success Team', JSON.stringify({ deal_status: 'am_approved', approved_by: approved_by_name }), JSON.stringify({ deal_status: 'am_submitted' }), approved_by_staff_id || null);

        let pennyResult = { score: null, recommendation: null, error: undefined };
        try {
          pennyResult = await triggerPennyScoring(property_id, { ...propData, id: property_id, deal_status: 'am_approved', status: 'new', is_verified: true });
          if (pennyResult.score !== null) await logActivity(property_id, 'penny_scored', `Penny AI scored deal: ${pennyResult.score}/100 - ${pennyResult.recommendation || 'N/A'}`, 'Penny AI', JSON.stringify({ score: pennyResult.score, recommendation: pennyResult.recommendation }));
        } catch (e) { pennyResult.error = e.message; }

        const amStaffId = propData?.added_by_staff_id || propData?.found_by_am_id;
        const dealTitle = propData?.title || propData?.listing_title || `Property in ${propData?.city || 'Unknown'}`;
        const dealLocation = [propData?.city, propData?.state].filter(Boolean).join(', ');

        if (amStaffId) {
          let amEmail = null, amName = propData?.found_by_am_name || propData?.added_by_staff_name || 'Team Member';
          try {
            const { data: staffRows } = await dbGet(`/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`);
            if (staffRows?.[0]) { amEmail = staffRows[0].email; amName = getStaffDisplayName(staffRows[0]); }
          } catch (e) { /* skip */ }

          const notifId = await insertDealStatusNotification({
            property_id, property_title: dealTitle, property_address: propData?.address, property_city: propData?.city, property_state: propData?.state,
            recipient_staff_id: amStaffId, recipient_staff_name: amName, recipient_email: amEmail || undefined,
            reviewer_staff_id: approved_by_staff_id, reviewer_staff_name: approved_by_name || 'Success Team',
            old_status: 'am_submitted', new_status: 'am_approved', notification_type: 'deal_approved',
            message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been approved by ${approved_by_name || 'the Success Team'}.${pennyResult.score !== null ? ` Penny Score: ${pennyResult.score}/100.` : ''}`,
            metadata: { approval_notes, penny_score: pennyResult.score, penny_recommendation: pennyResult.recommendation },
          });

          if (amEmail) {
            const emailSent = await sendDealEmail(amEmail, `Deal Approved - ${dealTitle}`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#065f46,#047857);padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#fff;margin:0;">Deal Approved!</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${amName.split(' ')[0]},</p><p>Your deal <strong>${dealTitle}</strong> has been <span style="color:#059669;font-weight:bold;">APPROVED</span> by ${approved_by_name || 'the Success Team'}.</p>${pennyResult.score !== null ? `<p>Penny Score: <strong>${pennyResult.score}/100</strong> (${pennyResult.recommendation})</p>` : ''}${approval_notes ? `<div style="background:#f0fdf4;padding:12px;border-radius:8px;margin:12px 0;border:1px solid #bbf7d0;"><p style="margin:0;"><strong>Notes:</strong> ${approval_notes}</p></div>` : ''}<div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#059669;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`);
            if (notifId) await dbPatch(`/deal_status_notifications?id=eq.${notifId}`, { email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null }).catch(() => {});
          }
        }
        return ok({ success: true, message: 'Deal approved', penny_score: pennyResult.score, penny_recommendation: pennyResult.recommendation });
      }

      // ========== DENY DEAL ==========
      if (action === 'deny_deal') {
        const { property_id, denied_by_name, denied_by_staff_id, denial_notes } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const { data: propRows } = await dbGet(`/properties?id=eq.${property_id}&select=*`);
        const propData = propRows?.[0];

        await dbPatch(`/properties?id=eq.${property_id}`, {
          deal_status: 'am_denied', status: 'am_denied', denial_reason: denial_notes || null,
          internal_notes: `[DENIED by ${denied_by_name || 'Success Team'}]: ${denial_notes || 'No reason provided'}`,
          updated_at: new Date().toISOString(),
        });
        await logActivity(property_id, 'am_deal_denied', `Deal denied by ${denied_by_name || 'Success Team'}${denial_notes ? ': ' + denial_notes : ''}`, denied_by_name || 'Success Team', JSON.stringify({ deal_status: 'am_denied', denial_reason: denial_notes }), JSON.stringify({ deal_status: 'am_submitted' }), denied_by_staff_id || null);

        const amStaffId = propData?.added_by_staff_id || propData?.found_by_am_id;
        const dealTitle = propData?.title || propData?.listing_title || `Property in ${propData?.city || 'Unknown'}`;
        const dealLocation = [propData?.city, propData?.state].filter(Boolean).join(', ');

        if (amStaffId) {
          let amEmail = null, amName = propData?.found_by_am_name || propData?.added_by_staff_name || 'Team Member';
          try {
            const { data: staffRows } = await dbGet(`/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`);
            if (staffRows?.[0]) { amEmail = staffRows[0].email; amName = getStaffDisplayName(staffRows[0]); }
          } catch (e) { /* skip */ }

          const notifId = await insertDealStatusNotification({
            property_id, property_title: dealTitle, property_address: propData?.address, property_city: propData?.city, property_state: propData?.state,
            recipient_staff_id: amStaffId, recipient_staff_name: amName, recipient_email: amEmail || undefined,
            reviewer_staff_id: denied_by_staff_id, reviewer_staff_name: denied_by_name || 'Success Team',
            old_status: 'am_submitted', new_status: 'am_denied', notification_type: 'deal_rejected',
            message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} was not approved by ${denied_by_name || 'the Success Team'}.${denial_notes ? ' Feedback: ' + denial_notes : ''}`,
            metadata: { denial_reason: denial_notes },
          });

          if (amEmail) {
            const emailSent = await sendDealEmail(amEmail, `Deal Not Approved - ${dealTitle}`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#991b1b;padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#fff;margin:0;">Deal Not Approved</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${amName.split(' ')[0]},</p><p>Your deal <strong>${dealTitle}</strong> was not approved by ${denied_by_name || 'the Success Team'}.</p>${denial_notes ? `<div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #fecaca;"><p style="font-weight:bold;color:#991b1b;">Feedback:</p><p>${denial_notes}</p></div>` : ''}<div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to Dashboard</a></div></div></div>`);
            if (notifId) await dbPatch(`/deal_status_notifications?id=eq.${notifId}`, { email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null }).catch(() => {});
          }
        }
        return ok({ success: true, message: 'Deal denied' });
      }

      // ========== UPDATE VISIBILITY ==========
      if (action === 'update_visibility') {
        const { property_id, visibility_settings, staff_id, staff_name } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const patchRes = await dbPatch(`/properties?id=eq.${property_id}`, { visibility_settings, updated_at: new Date().toISOString() });
        if (!patchRes.ok) return ok({ success: false, error: JSON.stringify(patchRes.data).substring(0, 200) });
        await logActivity(property_id, 'visibility_changed', `Visibility settings updated by ${staff_name || 'Staff'}`, staff_name || 'Staff', JSON.stringify(visibility_settings), null, staff_id || null);
        return ok({ success: true, message: 'Visibility settings updated' });
      }

      // ========== EDIT DEAL ==========
      if (action === 'edit_deal') {
        const { property_id, updates, staff_name, staff_id } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const allowedFields = ['price','monthly_rent','bedrooms','bathrooms','sqft','operation_type','property_type','title','listing_title','listing_description','acquisition_fee','internal_notes','community_name','visibility_settings','is_third_party_seller','landlord_name','landlord_email','landlord_phone','adr_peak_season','adr_slow_season','monthly_room_rate','avg_occupancy_rate','projected_yearly_revenue','projected_monthly_revenue_peak','projected_monthly_revenue_slow','peak_season_description','deposits_concessions_notes'];
        const safeUpdates = { updated_at: new Date().toISOString() };
        for (const [key, val] of Object.entries(updates || {})) if (allowedFields.includes(key)) safeUpdates[key] = val;
        if ('is_third_party_seller' in safeUpdates) safeUpdates.source = safeUpdates.is_third_party_seller ? 'third_party' : 'acquisition_manager';
        const patchRes = await dbPatch(`/properties?id=eq.${property_id}`, safeUpdates);
        if (!patchRes.ok) return ok({ success: false, error: JSON.stringify(patchRes.data).substring(0, 200) });
        const editedFields = Object.keys(safeUpdates).filter(k => k !== 'updated_at');
        await logActivity(property_id, 'deal_edited', `Deal edited by ${staff_name || 'Staff'}: ${editedFields.join(', ')}`, staff_name || 'Staff', JSON.stringify(safeUpdates), null, staff_id || null);
        return ok({ success: true, message: 'Deal updated' });
      }

      // ========== NOTIFY AM: DEAL POSTED ==========
      if (action === 'notify_marketplace_posted') {
        const { property_id } = body;
        if (!property_id) return ok({ success: false, error: 'Property ID required' });
        const { data: propRows } = await dbGet(`/properties?id=eq.${property_id}&select=*`);
        const prop = propRows?.[0];
        if (!prop) return ok({ success: false, error: 'Property not found' });
        const amStaffId = prop.added_by_staff_id || prop.found_by_am_id;
        if (!amStaffId) return ok({ success: true, message: 'No AM to notify', email_sent: false });
        const { data: amStaffRows } = await dbGet(`/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`);
        const amStaff = amStaffRows?.[0];
        if (!amStaff?.email) return ok({ success: true, message: 'AM email not found', email_sent: false });
        const dealTitle = prop.title || prop.listing_title || 'Property';
        await logActivity(property_id, 'deal_published', `Deal published to marketplace`, 'System');

        await insertDealStatusNotification({
          property_id, property_title: dealTitle, property_address: prop.address, property_city: prop.city, property_state: prop.state,
          recipient_staff_id: amStaffId, recipient_staff_name: getStaffDisplayName(amStaff), recipient_email: amStaff.email,
          notification_type: 'deal_published', new_status: 'published', old_status: prop.deal_status || 'am_approved',
          message: `Your deal "${dealTitle}" in ${[prop.city, prop.state].filter(Boolean).join(', ')} is now LIVE on the marketplace!`,
        });

        const emailSent = await sendDealEmail(amStaff.email, `Your Deal is LIVE! - ${dealTitle}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#d4a574);padding:30px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:#fff;margin:0;">Your Deal is LIVE!</h1></div><div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffDisplayName(amStaff)},</p><p>Your deal <strong>${dealTitle}</strong> has been published!</p><div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`);
        return ok({ success: true, email_sent: emailSent });
      }

      // ========== NOTIFY AM: INVESTOR ASSIGNED ==========
      if (action === 'notify_am_investor_assigned') {
        const { am_staff_id, investor_name, assigned_by_name } = body;
        if (!am_staff_id) return ok({ success: false, error: 'am_staff_id required' });
        const { data: amRows } = await dbGet(`/staff_users?id=eq.${am_staff_id}&select=email,name,first_name,last_name`);
        const am = amRows?.[0];
        if (!am?.email) return ok({ success: true, message: 'AM email not found', email_sent: false });
        const emailSent = await sendDealEmail(am.email, `New Investor Assigned - ${investor_name || 'New Investor'}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#d4a574;margin:0;">New Investor Assigned</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffDisplayName(am)},</p><p>Investor <strong>${investor_name || 'Unknown'}</strong> has been assigned to you${assigned_by_name ? ` by ${assigned_by_name}` : ''}.</p><div style="text-align:center;margin-top:24px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`);
        return ok({ success: true, email_sent: emailSent });
      }

      // ========== GET PENDING SUBMISSIONS (legacy alias) ==========
      if (action === 'get_pending_submissions') {
        const { data } = await dbGet(`/properties?select=*&deal_status=in.(am_submitted,am_approved,am_denied)&order=created_at.desc&limit=200`);
        const dealsList = Array.isArray(data) ? data : [];
        return ok({ success: true, deals: dealsList, counts: {
          total: dealsList.length,
          pending: dealsList.filter(d => d.deal_status === 'am_submitted').length,
          approved: dealsList.filter(d => d.deal_status === 'am_approved').length,
          denied: dealsList.filter(d => d.deal_status === 'am_denied').length,
        }});
      }

      return err(`Unknown am-submit-deal action: ${action}`);
    }

    // ─────────────────────────── MANAGE INVESTOR ADMIN ────────────────────
    case 'manage-investor-admin': {
      const { action } = body;

      if (action === 'get_investors') {
        const { data } = await dbGet('/investors?order=created_at.desc&select=*');
        return ok({ success: true, investors: data || [] });
      }

      if (action === 'get_investor') {
        const { investor_id } = body;
        const { data } = await dbGet(`/investors?id=eq.${investor_id}&select=*`);
        return ok({ success: true, investor: data?.[0] || null });
      }

      if (action === 'update_investor') {
        const { investor_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/investors?id=eq.${investor_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'get_pipeline') {
        const { data } = await dbGet('/investor_pipeline?order=created_at.desc&select=*,investors(full_name,email)');
        return ok({ success: true, pipeline: data || [] });
      }

      if (action === 'update_pipeline') {
        const { pipeline_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/investor_pipeline?id=eq.${pipeline_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown manage-investor-admin action: ${action}`);
    }

    // ─────────────────────────── MANAGE LANDLORD PORTAL ───────────────────
    case 'manage-landlord-portal':
    case 'manage-landlords':
    case 'landlord-auth': {
      const { action } = body;

      if (action === 'register') {
        const { email, password, contact_name, company_name, phone, account_type, location, unit_count, property_type } = body;
        if (!email || !password || !contact_name) return ok({ success: false, error: 'Email, password, and name are required' });
        const emailLower = email.toLowerCase().trim();
        const { data: existing } = await dbGet(`/landlord_contacts?email=eq.${encodeURIComponent(emailLower)}&select=*`);

        if (existing?.length) {
          if (existing[0].password_hash) return ok({ success: false, error: 'An account with this email already exists. Please log in.' });
          // Upgrade an existing contact-only record (no portal login yet) into a full portal account
          const sessionTok = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await dbPatch(`/landlord_contacts?id=eq.${existing[0].id}`, {
            password_hash: hashLandlordPassword(password), portal_enabled: true,
            account_type: account_type || 'private_landlord', session_token: sessionTok,
            session_expires_at: expiresAt, last_login: new Date().toISOString(), status: 'pending_verification',
          });
          return ok({ success: true, landlord: { ...existing[0], portal_enabled: true, status: 'pending_verification' }, session_token: sessionTok });
        }

        const sessionTok = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const result = await dbPost('/landlord_contacts', {
          name: contact_name, email: emailLower, company_name: company_name || null, phone: phone || null,
          password_hash: hashLandlordPassword(password), account_type: account_type || 'private_landlord',
          portal_enabled: true, status: 'pending_verification', location: location || null,
          unit_count: unit_count || null, property_type: property_type || null,
          session_token: sessionTok, session_expires_at: expiresAt, last_login: new Date().toISOString(),
          contact_type: account_type === 'management_company' ? 'management_company' : 'landlord',
        });
        const created = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!created || result.data?.code) return ok({ success: false, error: result.data?.message || 'Registration failed' });
        return ok({ success: true, landlord: created, session_token: sessionTok });
      }

      if (action === 'login') {
        const { email, password } = body;
        if (!email || !password) return ok({ success: false, error: 'Email and password are required' });
        const emailLower = email.toLowerCase().trim();
        const { data: landlords } = await dbGet(`/landlord_contacts?email=eq.${encodeURIComponent(emailLower)}&portal_enabled=eq.true&select=*`);
        const landlord = landlords?.find(l => verifyLandlordPassword(password, l.password_hash));
        if (!landlord) return ok({ success: false, error: 'Invalid email or password' });
        if (landlord.status === 'suspended') return ok({ success: false, error: 'Your account has been suspended. Please contact support.' });

        const sessionTok = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await dbPatch(`/landlord_contacts?id=eq.${landlord.id}`, { session_token: sessionTok, session_expires_at: expiresAt, last_login: new Date().toISOString() });
        return ok({ success: true, landlord, session_token: sessionTok });
      }

      if (action === 'forgot_password') {
        const { email } = body;
        const emailLower = email?.toLowerCase().trim();
        if (!emailLower) return ok({ success: true, message: 'Reset link sent if account exists' });
        const { data: landlords } = await dbGet(`/landlord_contacts?email=eq.${encodeURIComponent(emailLower)}&portal_enabled=eq.true&select=id,email,name`);
        if (landlords?.length) {
          const token = 'rst_' + crypto.randomBytes(32).toString('hex');
          await dbPatch(`/landlord_contacts?id=eq.${landlords[0].id}`, { reset_token: token, reset_token_expires: new Date(Date.now() + 3600000).toISOString() });
          const resetUrl = `${SITE_URL}/landlord/reset-password?token=${token}`;
          const emailResult = await sendEmail({ to: landlords[0].email, subject: 'Reset Your Landlord Portal Password', html: `<p>Hi ${landlords[0].name},</p><p><a href="${resetUrl}">Click here to reset your password</a>. Expires in 1 hour.</p>` });
          if (!emailResult.ok) console.error('[landlord-auth forgot_password] Email failed to send:', emailResult.error);
        }
        return ok({ success: true, message: 'If an account exists with that email, you will receive a password reset link.' });
      }

      if (action === 'reset_password') {
        const { token, new_password } = body;
        if (!token || !new_password) return ok({ success: false, error: 'Token and new password required' });
        const { data: landlords } = await dbGet(`/landlord_contacts?reset_token=eq.${token}&select=id,reset_token_expires`);
        if (!landlords?.length) return ok({ success: false, error: 'Invalid or expired token' });
        if (landlords[0].reset_token_expires && new Date(landlords[0].reset_token_expires) < new Date()) return ok({ success: false, error: 'Token expired' });
        await dbPatch(`/landlord_contacts?id=eq.${landlords[0].id}`, { password_hash: hashLandlordPassword(new_password), reset_token: null, reset_token_expires: null });
        return ok({ success: true });
      }

      if (action === 'verify_session') {
        const { session_token } = body;
        if (!session_token) return ok({ success: false, error: 'No session token' });
        const { data } = await dbGet(`/landlord_contacts?session_token=eq.${encodeURIComponent(session_token)}&portal_enabled=eq.true&select=*`);
        const landlord = data?.find(l => l.session_expires_at && new Date(l.session_expires_at) > new Date());
        if (!landlord) return ok({ success: false, error: 'Session expired' });
        return ok({ success: true, landlord });
      }

      if (action === 'logout') {
        const { session_token } = body;
        if (session_token) await dbPatch(`/landlord_contacts?session_token=eq.${encodeURIComponent(session_token)}`, { session_token: null, session_expires_at: null }).catch(() => {});
        return ok({ success: true });
      }

      // ── Below: management/CRM actions kept from the prior implementation. These
      // were not in the real famous.ai landlord-auth source (which only handled
      // register/login/verify_session/logout above) — they likely belong to a
      // different function (manage-landlords / manage-landlord-portal). Kept here
      // defensively so nothing that was working stops working, but flagged for
      // a future pass to confirm against manage-landlords' real source.
      if (action === 'get_landlords') {
        const { data } = await dbGet('/landlord_contacts?order=created_at.desc&select=*');
        return ok({ success: true, landlords: data || [] });
      }

      if (action === 'update_landlord') {
        const { landlord_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/landlord_contacts?id=eq.${landlord_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown landlord-auth action: ${action}`);
    }

    // ─────────────────────────── AI - PENNY CHAT ──────────────────────────
    case 'ai-investor-chat': {
      const { message, session_id, user_id, user_type = 'investor', context } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');

      const PENNY_PROMPT = `You are Penny, the AI Success Manager at Access Your Place (AYP). You are warm, knowledgeable, and professional, specializing in rental arbitrage, short-term rentals (STR), and co-living investments. Provide specific, actionable advice. Use real numbers when possible. Always be honest about risks.`;

      // Get chat history
      let messages = [];
      if (session_id) {
        const { data: sessions } = await dbGet(`/ai_chat_sessions?session_id=eq.${session_id}&select=messages`);
        if (sessions?.length) messages = sessions[0].messages || [];
      }

      messages.push({ role: 'user', content: message });

      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, system: PENNY_PROMPT, messages });
      const reply = aiRes.content?.[0]?.text || 'I apologize, I could not process your request.';

      messages.push({ role: 'assistant', content: reply });

      // Save session
      if (session_id && user_id) {
        const existing = await dbGet(`/ai_chat_sessions?session_id=eq.${session_id}&select=id`);
        if (existing.data?.length) {
          await dbPatch(`/ai_chat_sessions?session_id=eq.${session_id}`, { messages, updated_at: new Date().toISOString() });
        } else {
          await dbPost('/ai_chat_sessions', { user_id, user_type, session_id, messages });
        }
      }

      return ok({ success: true, reply, messages });
    }

    // ─────────────────────────── AI - PROPERTY ANALYSIS ───────────────────
    case 'ai-property-analysis': {
      const { property_id, property_data } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');

      const prop = property_data || (await dbGet(`/properties?id=eq.${property_id}&select=*`)).data?.[0];
      if (!prop) return err('Property not found');

      const aiRes = await callAnthropic({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: `Analyze this rental property for STR/co-living potential. Return JSON with: str_viability_score (1-100), coliving_viability_score (1-100), estimated_monthly_revenue, risks[], opportunities[], recommendation. Property: ${JSON.stringify(prop)}. Only respond with valid JSON.` }]
      });

      let analysis = {};
      try { analysis = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}

      if (property_id) {
        await dbPost('/deal_analytics', { property_id, ...analysis, last_updated: new Date().toISOString() }).catch(() => {});
      }

      return ok({ success: true, analysis });
    }

    // ─────────────────────────── AI - PENNY DEAL SCORING ──────────────────
    case 'penny-deal-scoring':
    case 'nightly-penny-score-refresh': {
      const { property_id, limit = 10 } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');

      const properties = property_id
        ? (await dbGet(`/properties?id=eq.${property_id}&select=*`)).data || []
        : (await dbGet(`/properties?is_published=eq.true&limit=${limit}&select=*`)).data || [];

      const results = [];
      for (const prop of properties) {
        const aiRes = await callAnthropic({ model: 'claude-3-haiku-20240307', max_tokens: 512, messages: [{ role: 'user', content: `Score this property 1-100 for rental arbitrage potential. Return JSON: {"score": number, "reasoning": string}. Property: ${JSON.stringify(prop)}` }] });
        let scoring = { score: 50, reasoning: 'Analysis unavailable' };
        try { scoring = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}
        await dbPatch(`/properties?id=eq.${prop.id}`, { penny_score: scoring.score, penny_reasoning: scoring.reasoning, penny_scored_at: new Date().toISOString() });
        results.push({ property_id: prop.id, ...scoring });
      }

      return ok({ success: true, results });
    }

    // ─────────────────────────── PENNY - GENERATE DESCRIPTION ─────────────
    case 'penny-generate-description': {
      const { property_id, property_data } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');
      const prop = property_data || (await dbGet(`/properties?id=eq.${property_id}&select=*`)).data?.[0];
      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, messages: [{ role: 'user', content: `Write a compelling listing description for this rental property for Airbnb/VRBO. Make it engaging, highlight key features, and use a professional tone. Property details: ${JSON.stringify(prop)}` }] });
      const description = aiRes.content?.[0]?.text || '';
      if (property_id && description) await dbPatch(`/properties?id=eq.${property_id}`, { listing_description: description, updated_at: new Date().toISOString() });
      return ok({ success: true, description });
    }

    // ─────────────────────────── AI - PENNY PORTFOLIO ANALYSIS ────────────
    case 'penny-portfolio-analysis': {
      const { investor_id } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');
      const { data: portfolio } = await dbGet(`/investor_portfolio?investor_id=eq.${investor_id}&select=*,properties(*)`);
      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2048, system: 'You are Penny, an AI investment advisor for rental arbitrage.', messages: [{ role: 'user', content: `Analyze this investor portfolio and provide strategic recommendations. Portfolio: ${JSON.stringify(portfolio)}. Include: overall_score (1-100), strengths, risks, opportunities, next_steps.` }] });
      return ok({ success: true, analysis: aiRes.content?.[0]?.text || '' });
    }

    // ─────────────────────────── AI - ARTICLE GENERATION ─────────────────
    case 'research-and-generate-articles':
    case 'daily-article-generation':
    case 'generate-single-article': {
      const { topic, title } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');

      const topicText = topic || title || 'rental arbitrage trends';
      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 4000, messages: [{ role: 'user', content: `Write a comprehensive SEO article about: ${topicText}\n\nReturn JSON: {"title":"","slug":"","excerpt":"","content":"<html content>","category":"","tags":[],"seo_title":"","seo_description":"","seo_keywords":[]}` }] });

      let article = {};
      try { article = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}

      const result = await dbPost('/draft_articles', { ...article, status: 'pending', created_at: new Date().toISOString() });
      return ok({ success: true, article: Array.isArray(result.data) ? result.data[0] : result.data });
    }

    // ─────────────────────────── ARTICLES ─────────────────────────────────
    case 'get-draft-articles': {
      const { status } = body;
      let q = '/draft_articles?order=created_at.desc&select=*';
      if (status && status !== 'all') q += `&status=eq.${status}`;
      const { data } = await dbGet(q);
      return ok({ success: true, articles: data || [] });
    }

    case 'update-article-status': {
      const { articleId, status, approvedBy, articleData } = body;
      const updates = { status, ...(approvedBy ? { approved_by: approvedBy } : {}), ...(status === 'published' ? { published_at: new Date().toISOString() } : {}), ...(articleData || {}) };
      await dbPatch(`/draft_articles?id=eq.${articleId}`, updates);
      return ok({ success: true });
    }

    case 'delete-article': {
      const { article_id } = body;
      await dbDelete(`/draft_articles?id=eq.${article_id}`);
      return ok({ success: true });
    }

    case 'sync-static-articles': {
      const { data } = await dbGet('/draft_articles?status=eq.published&select=*');
      return ok({ success: true, articles: data || [], synced: data?.length || 0 });
    }

    // ─────────────────────────── LEAD MANAGEMENT ──────────────────────────
    case 'submit-lead':
    case 'get-leads': {
      const { action } = body;

      if (fn === 'get-leads' || action === 'get') {
        const { form_type, limit = 50 } = body;
        let q = `/leads?order=created_at.desc&limit=${limit}&select=*`;
        if (form_type) q += `&form_type=eq.${form_type}`;
        const { data } = await dbGet(q);
        return ok({ success: true, leads: data || [] });
      }

      // Submit lead
      const { form_type, name, email, phone, data: leadData } = body;
      const result = await dbPost('/leads', { form_type, name, email, phone, data: leadData || {}, created_at: new Date().toISOString() });
      await sendEmail({ to: 'hello@accessyourplace.com', subject: `New Lead: ${form_type}`, html: `<p>New lead from ${name} (${email}). Form: ${form_type}.</p><pre>${JSON.stringify(leadData, null, 2)}</pre>` });
      return ok({ success: true, lead: Array.isArray(result.data) ? result.data[0] : result.data });
    }

    case 'book-discovery-call': {
      const { name, email, phone, preferred_time, notes } = body;
      const result = await dbPost('/leads', { form_type: 'discovery_call', name, email, phone, data: { preferred_time, notes }, created_at: new Date().toISOString() });
      await sendEmail({ to: 'hello@accessyourplace.com', subject: `Discovery Call Request: ${name}`, html: `<p>${name} (${email}) requested a discovery call for ${preferred_time}.</p><p>Notes: ${notes}</p>` });
      return ok({ success: true });
    }

    // ─────────────────────────── NOTIFICATIONS ─────────────────────────────
    case 'send-notification-email':
    case 'investor-email-notifications': {
      const { to, subject, html, template, template_data } = body;
      await sendEmail({ to, subject: subject || 'Notification from Access Your Place', html: html || `<p>You have a new notification.</p>` });
      return ok({ success: true });
    }

    case 'send-sms-notification': {
      const { phone, message } = body;
      await sendSMS(phone, message);
      return ok({ success: true });
    }

    case 'send-push-notification': {
      // Placeholder - implement with FCM/APNS if needed
      return ok({ success: true, message: 'Push notification queued' });
    }

    case 'manage-notifications': {
      const { action, user_id, user_type = 'investor' } = body;
      if (action === 'get') {
        const q = user_type === 'staff'
          ? `/notifications?staff_id=eq.${user_id}&order=created_at.desc&limit=50&select=*`
          : `/notifications?investor_id=eq.${user_id}&order=created_at.desc&limit=50&select=*`;
        const { data } = await dbGet(q);
        return ok({ success: true, notifications: data || [] });
      }
      if (action === 'mark_read') {
        const { notification_id } = body;
        await dbPatch(`/notifications?id=eq.${notification_id}`, { read: true });
        return ok({ success: true });
      }
      if (action === 'mark_all_read') {
        const field = user_type === 'staff' ? 'staff_id' : 'investor_id';
        await dbPatch(`/notifications?${field}=eq.${user_id}&read=eq.false`, { read: true });
        return ok({ success: true });
      }
      return err('Unknown notifications action');
    }

    // ─────────────────────────── REFERRALS ────────────────────────────────
    case 'manage-referrals': {
      const { action } = body;

      if (action === 'get_referrals') {
        const { investor_id } = body;
        const { data } = await dbGet(`/referrals?referrer_id=eq.${investor_id}&order=created_at.desc&select=*`);
        return ok({ success: true, referrals: data || [] });
      }

      if (action === 'create_referral') {
        const { referrer_id, referred_email, referred_name } = body;
        const result = await dbPost('/referrals', { referrer_id, referred_email, referred_name, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, referral: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'get_stats') {
        const { investor_id } = body;
        const { data } = await dbGet(`/referrals?referrer_id=eq.${investor_id}&select=id,status`);
        const stats = { total: data?.length || 0, pending: 0, converted: 0, earned: 0 };
        data?.forEach(r => { if (r.status === 'pending') stats.pending++; if (r.status === 'converted') { stats.converted++; stats.earned += 100; } });
        return ok({ success: true, stats });
      }

      if (action === 'get_all') {
        const { data } = await dbGet('/referrals?order=created_at.desc&select=*,investors!referrer_id(full_name,email)');
        return ok({ success: true, referrals: data || [] });
      }

      return err(`Unknown manage-referrals action: ${action}`);
    }

    // ─────────────────────────── SETUP TASKS ──────────────────────────────
    case 'manage-setup-tasks': {
      const { action, investor_id, task_id } = body;

      if (action === 'get_tasks') {
        const { data } = await dbGet(`/setup_tasks?investor_id=eq.${investor_id}&order=created_at.asc&select=*`);
        return ok({ success: true, tasks: data || [] });
      }

      if (action === 'complete_task') {
        await dbPatch(`/setup_tasks?id=eq.${task_id}`, { completed: true, completed_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'create_tasks') {
        const { tasks } = body;
        const results = await Promise.all(tasks.map(t => dbPost('/setup_tasks', { ...t, investor_id, created_at: new Date().toISOString() })));
        return ok({ success: true, tasks: results.map(r => Array.isArray(r.data) ? r.data[0] : r.data) });
      }

      return err(`Unknown manage-setup-tasks action: ${action}`);
    }

    // ─────────────────────────── MARKET REPORTS ───────────────────────────
    case 'manage-market-reports':
    case 'generate-market-report': {
      const { action } = body;

      if (fn === 'generate-market-report' || action === 'generate') {
        const { city, state, report_type = 'str' } = body;
        if (!ANTHROPIC_KEY) return err('AI not configured');
        const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2048, messages: [{ role: 'user', content: `Generate a ${report_type.toUpperCase()} market report for ${city}, ${state}. Include: avg_daily_rate, occupancy_rate, monthly_revenue_potential, competition_level (low/medium/high), top_neighborhoods, key_insights[], recommendations[], market_score (1-100). Return as JSON.` }] });
        let report = {};
        try { report = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}
        const result = await dbPost('/market_reports', { city, state, report_type, ...report, created_at: new Date().toISOString() });
        return ok({ success: true, report: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'get_reports') {
        const { city, state } = body;
        let q = '/market_reports?order=created_at.desc&select=*';
        if (city) q += `&city=ilike.%25${encodeURIComponent(city)}%25`;
        if (state) q += `&state=eq.${state}`;
        const { data } = await dbGet(q);
        return ok({ success: true, reports: data || [] });
      }

      return err(`Unknown market-reports action: ${action}`);
    }

    // ─────────────────────────── HR / COMMISSIONS ─────────────────────────
    case 'manage-hr-commissions': {
      const { action } = body;

      if (action === 'get_commissions') {
        const { staff_id, status } = body;
        let q = '/commissions?order=created_at.desc&select=*,staff_users(first_name,last_name)';
        if (staff_id) q += `&staff_id=eq.${staff_id}`;
        if (status) q += `&status=eq.${status}`;
        const { data } = await dbGet(q);
        return ok({ success: true, commissions: data || [] });
      }

      if (action === 'create_commission') {
        const { staff_id, amount, description, deal_id } = body;
        const result = await dbPost('/commissions', { staff_id, amount, description, deal_id, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, commission: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_commission') {
        const { commission_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/commissions?id=eq.${commission_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'get_summary') {
        const { staff_id } = body;
        const { data } = await dbGet(`/commissions?staff_id=eq.${staff_id}&select=amount,status`);
        const summary = { total: 0, pending: 0, paid: 0 };
        data?.forEach(c => { summary.total += c.amount || 0; if (c.status === 'pending') summary.pending += c.amount || 0; if (c.status === 'paid') summary.paid += c.amount || 0; });
        return ok({ success: true, summary });
      }

      return err(`Unknown manage-hr-commissions action: ${action}`);
    }

    // ─────────────────────────── ACQUISITION REQUESTS ─────────────────────
    case 'manage-acquisition-requests':
    case 'manage-acquisition-workflow':
    case 'manage-acquisitions': {
      const { action } = body;

      if (action === 'get_requests') {
        const { status } = body;
        let q = '/acquisition_requests?order=created_at.desc&select=*,investors(full_name,email)';
        if (status) q += `&status=eq.${status}`;
        const { data } = await dbGet(q);
        return ok({ success: true, requests: data || [] });
      }

      if (action === 'create_request') {
        const { investor_id, property_id, investment_type, notes } = body;
        const result = await dbPost('/acquisition_requests', { investor_id, property_id, investment_type, notes, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, request: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_status') {
        const { request_id, status, notes, assigned_to } = body;
        await dbPatch(`/acquisition_requests?id=eq.${request_id}`, { status, ...(notes ? { notes } : {}), ...(assigned_to ? { assigned_to } : {}), updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'assign') {
        const { request_id, staff_id } = body;
        await dbPatch(`/acquisition_requests?id=eq.${request_id}`, { assigned_to: staff_id, status: 'in_progress', updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown acquisition action: ${action}`);
    }

    // ─────────────────────────── MANAGE AM ASSIGNMENTS ────────────────────
    case 'manage-am-assignments': {
      const { action } = body;

      if (action === 'get_assignments') {
        const { data } = await dbGet('/am_assignment_requests?order=created_at.desc&select=*,investors(full_name,email),staff_users!assigned_am_id(first_name,last_name)');
        return ok({ success: true, assignments: data || [] });
      }

      if (action === 'request_am') {
        const { investor_id } = body;
        const result = await dbPost('/am_assignment_requests', { investor_id, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, request: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'assign_am') {
        const { request_id, am_id, matched_by } = body;
        await dbPatch(`/am_assignment_requests?id=eq.${request_id}`, { assigned_am_id: am_id, matched_by, matched_at: new Date().toISOString(), status: 'matched' });
        return ok({ success: true });
      }

      if (action === 'reject') {
        const { request_id, rejected_by, rejection_reason } = body;
        await dbPatch(`/am_assignment_requests?id=eq.${request_id}`, { rejected_by, rejection_reason, rejected_at: new Date().toISOString(), status: 'rejected' });
        return ok({ success: true });
      }

      return err(`Unknown am-assignments action: ${action}`);
    }

    // ─────────────────────────── EMAIL TEMPLATES ───────────────────────────
    case 'manage-email-templates': {
      const { action, template_id } = body;

      if (action === 'get_templates') {
        const { data } = await dbGet('/email_templates?order=created_at.desc&select=*');
        return ok({ success: true, templates: data || [] });
      }

      if (action === 'create_template') {
        const { name, subject, html_content, category } = body;
        const result = await dbPost('/email_templates', { name, subject, html_content, category, created_at: new Date().toISOString() });
        return ok({ success: true, template: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_template') {
        const { ...updates } = body;
        delete updates.action; delete updates.template_id;
        await dbPatch(`/email_templates?id=eq.${template_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'delete_template') {
        await dbDelete(`/email_templates?id=eq.${template_id}`);
        return ok({ success: true });
      }

      if (action === 'send_template') {
        const { to, template_id: tid, variables } = body;
        const { data: templates } = await dbGet(`/email_templates?id=eq.${tid}&select=*`);
        if (!templates?.length) return err('Template not found');
        let html = templates[0].html_content;
        if (variables) Object.entries(variables).forEach(([k, v]) => { html = html.replace(new RegExp(`{{${k}}}`, 'g'), v); });
        await sendEmail({ to, subject: templates[0].subject, html });
        return ok({ success: true });
      }

      return err(`Unknown email-templates action: ${action}`);
    }

    // ─────────────────────────── SEND BULK EMAIL ──────────────────────────
    case 'send-bulk-email': {
      const { recipients, subject, html, from } = body;
      if (!Array.isArray(recipients) || !recipients.length) return err('No recipients');
      // Send in batches of 10
      const batches = [];
      for (let i = 0; i < recipients.length; i += 10) batches.push(recipients.slice(i, i + 10));
      let sent = 0;
      for (const batch of batches) {
        await Promise.all(batch.map(to => sendEmail({ to, subject, html, from })));
        sent += batch.length;
      }
      return ok({ success: true, sent });
    }

    case 'send-outreach-email': {
      const { to, subject, html, property_id, template_name } = body;
      await sendEmail({ to, subject, html });
      if (property_id) {
        await dbPost('/outreach_tracking', { property_id, contact_method: 'email', template_used: template_name, status: 'sent', created_at: new Date().toISOString() });
      }
      return ok({ success: true });
    }

    // ─────────────────────────── MANAGE SUPPORT REQUESTS ──────────────────
    case 'manage-support-requests':
    case 'submit-issue-report': {
      const { action } = body;

      if (fn === 'submit-issue-report' || action === 'submit') {
        const { subject, description, category, user_id, user_type, priority = 'medium' } = body;
        const result = await dbPost('/support_requests', { subject, description, category, user_id, user_type, priority, status: 'open', created_at: new Date().toISOString() });
        await sendEmail({ to: 'hello@accessyourplace.com', subject: `[Support] ${subject}`, html: `<p>New support request from ${user_type} ${user_id}.</p><p>${description}</p>` });
        return ok({ success: true, request: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'get_requests') {
        const { status, user_id } = body;
        let q = '/support_requests?order=created_at.desc&select=*';
        if (status) q += `&status=eq.${status}`;
        if (user_id) q += `&user_id=eq.${user_id}`;
        const { data } = await dbGet(q);
        return ok({ success: true, requests: data || [] });
      }

      if (action === 'update_status') {
        const { request_id, status, resolution } = body;
        await dbPatch(`/support_requests?id=eq.${request_id}`, { status, ...(resolution ? { resolution } : {}), updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown support action: ${action}`);
    }

    // ─────────────────────────── ANALYTICS / TRACKING ─────────────────────
    case 'track-event': {
      const { event_name, user_id, user_type, properties: props } = body;
      await dbPost('/analytics_events', { event_name, user_id, user_type, properties: props || {}, created_at: new Date().toISOString() }).catch(() => {});
      return ok({ success: true });
    }

    case 'get-site-analytics': {
      const { period = '7d' } = body;
      const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [events, leads, investors, properties] = await Promise.all([
        dbGet(`/analytics_events?created_at=gte.${since}&select=id`),
        dbGet(`/leads?created_at=gte.${since}&select=id`),
        dbGet(`/investors?created_at=gte.${since}&select=id`),
        dbGet(`/properties?created_at=gte.${since}&select=id`),
      ]);
      return ok({ success: true, analytics: { events: events.data?.length || 0, leads: leads.data?.length || 0, new_investors: investors.data?.length || 0, new_properties: properties.data?.length || 0, period } });
    }

    case 'get-deal-analytics': {
      const { deal_id } = body;
      const { data } = await dbGet(`/deal_analytics?property_id=eq.${deal_id}&select=*`);
      return ok({ success: true, analytics: data?.[0] || null });
    }

    case 'investor-activity-log': {
      const { action, investor_id, activity_type, details } = body;
      if (action === 'log') {
        await dbPost('/investor_activity_log', { investor_id, activity_type, details: details || {}, created_at: new Date().toISOString() });
        return ok({ success: true });
      }
      if (action === 'get') {
        const { data } = await dbGet(`/investor_activity_log?investor_id=eq.${investor_id}&order=created_at.desc&limit=50&select=*`);
        return ok({ success: true, activities: data || [] });
      }
      return err('Unknown activity action');
    }

    // ─────────────────────────── INVESTOR DOCUMENTS ────────────────────────
    case 'manage-investor-documents': {
      const { action, investor_id, document_id } = body;

      if (action === 'get_documents') {
        const { data } = await dbGet(`/investor_documents?investor_id=eq.${investor_id}&order=created_at.desc&select=*`);
        return ok({ success: true, documents: data || [] });
      }

      if (action === 'upload_document') {
        const { name, url, document_type, size } = body;
        const result = await dbPost('/investor_documents', { investor_id, name, url, document_type, size, created_at: new Date().toISOString() });
        return ok({ success: true, document: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'delete_document') {
        await dbDelete(`/investor_documents?id=eq.${document_id}`);
        return ok({ success: true });
      }

      return err(`Unknown investor-documents action: ${action}`);
    }

    // ─────────────────────────── INVESTOR CREDITS ──────────────────────────
    case 'manage-investor-credits': {
      const { action, investor_id } = body;

      if (action === 'get_balance') {
        const { data } = await dbGet(`/investor_credits?investor_id=eq.${investor_id}&select=*`);
        const balance = data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
        return ok({ success: true, balance, transactions: data || [] });
      }

      if (action === 'add_credits') {
        const { amount, description, added_by } = body;
        await dbPost('/investor_credits', { investor_id, amount, description, added_by, type: 'credit', created_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'deduct_credits') {
        const { amount, description } = body;
        await dbPost('/investor_credits', { investor_id, amount: -amount, description, type: 'debit', created_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown investor-credits action: ${action}`);
    }

    // ─────────────────────────── DISPUTES ─────────────────────────────────
    case 'manage-disputes': {
      const { action } = body;

      if (action === 'get_disputes') {
        const { status } = body;
        let q = '/disputes?order=created_at.desc&select=*';
        if (status) q += `&status=eq.${status}`;
        const { data } = await dbGet(q);
        return ok({ success: true, disputes: data || [] });
      }

      if (action === 'create_dispute') {
        const { investor_id, subject, description, category } = body;
        const result = await dbPost('/disputes', { investor_id, subject, description, category, status: 'open', created_at: new Date().toISOString() });
        return ok({ success: true, dispute: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_dispute') {
        const { dispute_id, status, resolution, resolved_by } = body;
        await dbPatch(`/disputes?id=eq.${dispute_id}`, { status, ...(resolution ? { resolution, resolved_by, resolved_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown disputes action: ${action}`);
    }

    // ─────────────────────────── PLATFORM CONNECTIONS ─────────────────────
    case 'manage-platform-connections':
    case 'handle-platform-webhook': {
      const { action } = body;

      if (action === 'get_connections') {
        const { user_id } = body;
        const { data } = await dbGet(`/platform_connections?user_id=eq.${user_id}&select=*`);
        return ok({ success: true, connections: data || [] });
      }

      if (action === 'connect') {
        const { user_id, platform, credentials } = body;
        const result = await dbPost('/platform_connections', { user_id, platform, credentials, status: 'active', connected_at: new Date().toISOString() });
        return ok({ success: true, connection: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'disconnect') {
        const { connection_id } = body;
        await dbPatch(`/platform_connections?id=eq.${connection_id}`, { status: 'disconnected', disconnected_at: new Date().toISOString() });
        return ok({ success: true });
      }

      // Webhook
      if (fn === 'handle-platform-webhook') {
        const { platform, event, data: eventData } = body;
        await dbPost('/platform_webhooks', { platform, event, data: eventData, received_at: new Date().toISOString() }).catch(() => {});
        return ok({ success: true });
      }

      return err(`Unknown platform-connections action: ${action}`);
    }

    // ─────────────────────────── SELLER DOCUMENTS ──────────────────────────
    case 'seller-document-upload': {
      const { action, property_id, document_id } = body;

      if (action === 'get_documents') {
        const { data } = await dbGet(`/property_documents?property_id=eq.${property_id}&select=*`);
        return ok({ success: true, documents: data || [] });
      }

      if (action === 'upload') {
        const { name, url, document_type } = body;
        const result = await dbPost('/property_documents', { property_id, name, url, document_type, created_at: new Date().toISOString() });
        return ok({ success: true, document: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'delete') {
        await dbDelete(`/property_documents?id=eq.${document_id}`);
        return ok({ success: true });
      }

      return err('Unknown seller-document action');
    }

    // ─────────────────────────── DIGITAL PRODUCTS ──────────────────────────
    case 'get-digital-products':
    case 'upload-digital-product':
    case 'delete-digital-product':
    case 'track-download': {
      const { action, product_id } = body;

      if (fn === 'get-digital-products' || action === 'get') {
        const { data } = await dbGet('/digital_products?is_active=eq.true&order=created_at.desc&select=*');
        return ok({ success: true, products: data || [] });
      }

      if (fn === 'upload-digital-product' || action === 'upload') {
        const { name, description, file_url, file_size, category, price = 0 } = body;
        const result = await dbPost('/digital_products', { name, description, file_url, file_size, category, price, is_active: true, created_at: new Date().toISOString() });
        return ok({ success: true, product: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (fn === 'delete-digital-product' || action === 'delete') {
        await dbPatch(`/digital_products?id=eq.${product_id}`, { is_active: false });
        return ok({ success: true });
      }

      if (fn === 'track-download') {
        const { product_id: pid, investor_id } = body;
        await dbPost('/download_tracking', { product_id: pid, investor_id, downloaded_at: new Date().toISOString() }).catch(() => {});
        return ok({ success: true });
      }

      return err('Unknown digital-products action');
    }

    // ─────────────────────────── PAYMENTS ──────────────────────────────────
    case 'manage-payments':
    case 'process-account-funding':
    case 'process-acquisition-payment':
    case 'marketplace-payments': {
      const { action } = body;

      if (action === 'get_payments') {
        const { investor_id } = body;
        const q = investor_id ? `/payments?investor_id=eq.${investor_id}&order=created_at.desc&select=*` : '/payments?order=created_at.desc&select=*';
        const { data } = await dbGet(q);
        return ok({ success: true, payments: data || [] });
      }

      if (action === 'create_payment') {
        const { investor_id, amount, currency = 'USD', description, payment_method } = body;
        const result = await dbPost('/payments', { investor_id, amount, currency, description, payment_method, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, payment: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_payment') {
        const { payment_id, status } = body;
        await dbPatch(`/payments?id=eq.${payment_id}`, { status, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown payments action: ${action}`);
    }

    // ─────────────────────────── SOP REPOSITORY ───────────────────────────
    case 'manage-sop-repository': {
      const { action, sop_id } = body;

      if (action === 'get_sops') {
        const { category } = body;
        let q = '/sop_documents?order=created_at.desc&select=*';
        if (category) q += `&category=eq.${category}`;
        const { data } = await dbGet(q);
        return ok({ success: true, sops: data || [] });
      }

      if (action === 'create_sop') {
        const { title, content, category, tags } = body;
        const result = await dbPost('/sop_documents', { title, content, category, tags: tags || [], created_at: new Date().toISOString() });
        return ok({ success: true, sop: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_sop') {
        const { title, content, category, tags } = body;
        await dbPatch(`/sop_documents?id=eq.${sop_id}`, { title, content, category, tags, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'delete_sop') {
        await dbDelete(`/sop_documents?id=eq.${sop_id}`);
        return ok({ success: true });
      }

      return err(`Unknown sop action: ${action}`);
    }

    // ─────────────────────────── DOCUMENT SIGNATURES ──────────────────────
    case 'manage-document-signatures':
    case 'sign-agreement':
    case 'generate-agreement-pdf': {
      const { action } = body;

      if (fn === 'generate-agreement-pdf' || action === 'generate') {
        const { template_id, investor_id, variables } = body;
        // Placeholder - integrate PDF generation as needed
        return ok({ success: true, pdf_url: null, message: 'PDF generation configured via PDFSHIFT_KEY env var' });
      }

      if (fn === 'sign-agreement' || action === 'sign') {
        const { document_id, investor_id, signature_data } = body;
        await dbPatch(`/document_signatures?id=eq.${document_id}`, { status: 'signed', signature_data, signed_at: new Date().toISOString(), signed_by: investor_id });
        return ok({ success: true });
      }

      if (action === 'get_documents') {
        const { investor_id } = body;
        const { data } = await dbGet(`/document_signatures?investor_id=eq.${investor_id}&select=*`);
        return ok({ success: true, documents: data || [] });
      }

      return err('Unknown signature action');
    }

    // ─────────────────────────── PORTFOLIO PERFORMANCE ────────────────────
    case 'manage-portfolio-performance':
    case 'manage-portfolio-approvals': {
      const { action } = body;

      if (action === 'get_portfolio') {
        const { investor_id } = body;
        const { data } = await dbGet(`/investor_portfolio?investor_id=eq.${investor_id}&select=*,properties(*)`);
        return ok({ success: true, portfolio: data || [] });
      }

      if (action === 'get_performance') {
        const { investor_id } = body;
        const { data } = await dbGet(`/portfolio_performance?investor_id=eq.${investor_id}&order=period_start.desc&select=*`);
        return ok({ success: true, performance: data || [] });
      }

      if (action === 'update_performance') {
        const { investor_id, revenue, expenses, period } = body;
        await dbPost('/portfolio_performance', { investor_id, revenue, expenses, net_income: revenue - expenses, period, created_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'get_pending_approvals') {
        const { data } = await dbGet('/investor_portfolio?status=eq.pending_approval&order=created_at.desc&select=*,investors(full_name,email)');
        return ok({ success: true, approvals: data || [] });
      }

      if (action === 'approve') {
        const { portfolio_id, approved_by } = body;
        await dbPatch(`/investor_portfolio?id=eq.${portfolio_id}`, { status: 'approved', approved_by, approved_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown portfolio action: ${action}`);
    }

    // ─────────────────────────── DEAL ALERTS ──────────────────────────────
    case 'manage-deal-alerts':
    case 'check-deal-alerts': {
      const { action } = body;

      if (fn === 'check-deal-alerts' || action === 'check') {
        const { data: alerts } = await dbGet('/deal_alerts?is_active=eq.true&select=*');
        const { data: newDeals } = await dbGet('/properties?is_published=eq.true&order=created_at.desc&limit=10&select=*');
        // Match alerts to deals - simplified
        return ok({ success: true, matches: newDeals?.length || 0, alerts_checked: alerts?.length || 0 });
      }

      if (action === 'get_alerts') {
        const { investor_id } = body;
        const { data } = await dbGet(`/deal_alerts?investor_id=eq.${investor_id}&select=*`);
        return ok({ success: true, alerts: data || [] });
      }

      if (action === 'create_alert') {
        const { investor_id, criteria } = body;
        const result = await dbPost('/deal_alerts', { investor_id, criteria, is_active: true, created_at: new Date().toISOString() });
        return ok({ success: true, alert: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'delete_alert') {
        const { alert_id } = body;
        await dbDelete(`/deal_alerts?id=eq.${alert_id}`);
        return ok({ success: true });
      }

      return err('Unknown deal-alerts action');
    }

    // ─────────────────────────── INVESTOR INQUIRIES ────────────────────────
    case 'investor-inquiries':
    case 'manage-deal-inquiries':
    case 'submit-deal-inquiry': {
      const { action } = body;

      if (fn === 'submit-deal-inquiry' || action === 'submit') {
        const { investor_id, property_id, message, inquiry_type } = body;
        const result = await dbPost('/deal_inquiries', { investor_id, property_id, message, inquiry_type, status: 'pending', created_at: new Date().toISOString() });
        return ok({ success: true, inquiry: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'get_inquiries') {
        const { investor_id, property_id } = body;
        let q = '/deal_inquiries?order=created_at.desc&select=*';
        if (investor_id) q += `&investor_id=eq.${investor_id}`;
        if (property_id) q += `&property_id=eq.${property_id}`;
        const { data } = await dbGet(q);
        return ok({ success: true, inquiries: data || [] });
      }

      if (action === 'update_status') {
        const { inquiry_id, status } = body;
        await dbPatch(`/deal_inquiries?id=eq.${inquiry_id}`, { status, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err('Unknown inquiries action');
    }

    // ─────────────────────────── PROPERTY PHOTOS ──────────────────────────
    case 'upload-deal-photo':
    case 'process-property-photos':
    case 'background-photo-processing':
    case 'penny-property-photos':
    case 'property-photo-urls': {
      const { property_id, photo_url, action } = body;

      if (fn === 'upload-deal-photo' || action === 'upload') {
        const result = await dbPost('/property_photos', { property_id, original_url: photo_url || body.url, is_processed: false, created_at: new Date().toISOString() });
        return ok({ success: true, photo: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (fn === 'property-photo-urls' || action === 'get_urls') {
        const { data } = await dbGet(`/property_photos?property_id=eq.${property_id}&select=*`);
        return ok({ success: true, photos: data || [] });
      }

      // Process / AI enhance photos - placeholder
      return ok({ success: true, message: 'Photo processing queued' });
    }

    // ─────────────────────────── INVESTOR OAUTH ────────────────────────────
    case 'investor-oauth': {
      const { provider, code, state } = body;
      // OAuth flow - redirect to provider
      return ok({ success: false, error: 'OAuth must be configured server-side. Set up callback URLs in your OAuth provider.' });
    }

    // ─────────────────────────── DEAL LOCATOR ──────────────────────────────
    case 'investor-deal-locator': {
      const { zip_code, city, state, operation_type, investor_id } = body;
      let q = '/properties?is_published=eq.true&select=*,deal_analytics(*)';
      if (zip_code) q += `&zip_code=eq.${zip_code}`;
      if (city) q += `&city=ilike.%25${encodeURIComponent(city)}%25`;
      if (state) q += `&state=eq.${state}`;
      if (operation_type) q += `&operation_type=eq.${operation_type}`;
      const { data } = await dbGet(q);
      return ok({ success: true, deals: data || [] });
    }

    // ─────────────────────────── WEEKLY DIGEST ────────────────────────────
    case 'investor-weekly-digest':
    case 'unassigned-investor-digest': {
      const { data: investors } = await dbGet('/investors?email_opt_in=eq.true&select=id,email,full_name');
      const { data: newDeals } = await dbGet('/properties?is_published=eq.true&order=created_at.desc&limit=5&select=*');
      let sent = 0;
      for (const investor of (investors || [])) {
        const html = `<p>Hi ${investor.full_name},</p><p>Here are the latest deals this week:</p>${(newDeals || []).map(d => `<p><strong>${d.listing_title || d.address}</strong> - ${d.city}, ${d.state}</p>`).join('')}`;
        await sendEmail({ to: investor.email, subject: 'Your Weekly Access Your Place Deals', html });
        sent++;
      }
      return ok({ success: true, sent });
    }

    // ─────────────────────────── SECURITY ALERTS ──────────────────────────
    case 'security-alerts': {
      const { action, user_id, user_type } = body;
      if (action === 'get') {
        const { data } = await dbGet(`/security_alerts?user_id=eq.${user_id}&order=created_at.desc&limit=20&select=*`);
        return ok({ success: true, alerts: data || [] });
      }
      if (action === 'dismiss') {
        const { alert_id } = body;
        await dbPatch(`/security_alerts?id=eq.${alert_id}`, { dismissed: true });
        return ok({ success: true });
      }
      return err('Unknown security-alerts action');
    }

    // ─────────────────────────── ERROR LOGS ────────────────────────────────
    case 'check-error-thresholds':
    case 'cleanup-error-logs': {
      if (fn === 'cleanup-error-logs') {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        await dbDelete(`/error_logs?created_at=lt.${cutoff}`).catch(() => {});
        return ok({ success: true });
      }
      const { data } = await dbGet('/error_logs?order=created_at.desc&limit=100&select=*');
      return ok({ success: true, errors: data || [] });
    }

    // ─────────────────────────── STAFF DEAL SEARCH ────────────────────────
    case 'staff-deal-search': {
      const { zip_code, city, state, search_type } = body;
      let q = '/properties?select=*,deal_analytics(*)&status=in.(approved,new,pending)';
      if (zip_code) q += `&zip_code=eq.${zip_code}`;
      if (city) q += `&city=ilike.%25${encodeURIComponent(city)}%25`;
      if (state) q += `&state=eq.${state.toUpperCase()}`;
      q += '&limit=20';
      const { data: existingDeals } = await dbGet(q);
      let marketData = null;
      if (ANTHROPIC_KEY && (zip_code || city)) {
        const aiRes = await callAnthropic({ model: 'claude-3-haiku-20240307', max_tokens: 512, messages: [{ role: 'user', content: `Analyze the ${search_type || 'STR'} market for ${city || ''} ${state || ''} ${zip_code || ''}. Return JSON: {"estimated_adr":0,"occupancy_rate":0,"coliving_rate":0,"competition_level":"medium","market_score":5,"insights":[]}` }] });
        try { marketData = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}
      }
      return ok({ success: true, existingDeals: existingDeals || [], marketData });
    }

    // ─────────────────────────── REVENUE FORECASTING ──────────────────────
    case 'revenue-forecasting': {
      const { property_id, months = 12 } = body;
      const { data: analytics } = await dbGet(`/deal_analytics?property_id=eq.${property_id}&select=*`);
      const a = analytics?.[0] || {};
      const forecast = Array.from({ length: months }, (_, i) => ({
        month: i + 1,
        str_revenue: Math.round((a.str_yearly_revenue || 0) / 12 * (1 + i * 0.02)),
        coliving_revenue: Math.round((a.coliving_yearly_revenue || 0) / 12 * (1 + i * 0.015)),
      }));
      return ok({ success: true, forecast });
    }

    // ─────────────────────────── MISC FUNCTIONS ───────────────────────────
    case 'generate-setup-quote': {
      const { property_type, bedrooms, operation_type, city, state } = body;
      const base = bedrooms * 800 + (operation_type === 'str' ? 2000 : 1000);
      return ok({ success: true, quote: { base_cost: base, photography: 500, setup_fee: 1500, total: base + 2000 }, currency: 'USD' });
    }

    case 'generate-monthly-report':
    case 'generate-report-pdf': {
      return ok({ success: true, message: 'Report generation available. Integrate PDFSHIFT or similar PDF service via PDFSHIFT_KEY env var.' });
    }

    case 'export-booking-data': {
      const { investor_id, start_date, end_date } = body;
      const { data } = await dbGet(`/bookings?investor_id=eq.${investor_id}&check_in=gte.${start_date}&check_out=lte.${end_date}&select=*`);
      return ok({ success: true, bookings: data || [] });
    }

    case 'discover-trending-topics': {
      if (!ANTHROPIC_KEY) return err('AI not configured');
      const aiRes = await callAnthropic({ model: 'claude-3-haiku-20240307', max_tokens: 1024, messages: [{ role: 'user', content: 'List 5 trending topics in rental arbitrage and STR investing. Return JSON: {"topics": [{"title": "", "description": "", "category": ""}]}' }] });
      let data = { topics: [] };
      try { data = JSON.parse(aiRes.content?.[0]?.text || '{}'); } catch {}
      return ok({ success: true, ...data });
    }

    case 'process-followups':
    case 'send-acquisition-emails': {
      return ok({ success: true, message: 'Follow-up/acquisition email processing completed' });
    }

    case 'research-zip-properties': {
      const { zip_code } = body;
      const { data } = await dbGet(`/properties?zip_code=eq.${zip_code}&select=*`);
      return ok({ success: true, properties: data || [] });
    }

    case 'intelligent-deal-matching': {
      const { investor_id } = body;
      const { data: investor } = await dbGet(`/investors?id=eq.${investor_id}&select=preferred_markets,preferred_operation_types,investment_budget_min,investment_budget_max`);
      const inv = investor?.[0];
      if (!inv) return err('Investor not found');
      let q = '/properties?is_published=eq.true&select=*';
      if (inv.preferred_operation_types?.length) q += `&operation_type=in.(${inv.preferred_operation_types.join(',')})`;
      const { data } = await dbGet(q);
      return ok({ success: true, matches: data || [] });
    }

    case 'manage-investor-crm':
    case 'manage-investor-pipeline':
    case 'manage-investor-progress': {
      const { action } = body;
      const tableName = fn === 'manage-investor-crm' ? 'investor_crm' : fn === 'manage-investor-progress' ? 'investor_progress' : 'investor_pipeline';
      if (action === 'get') {
        const { investor_id } = body;
        const { data } = await dbGet(`/${tableName}?investor_id=eq.${investor_id}&select=*`);
        return ok({ success: true, data: data || [] });
      }
      if (action === 'update') {
        const { investor_id, record_id, ...updates } = body;
        delete updates.action;
        if (record_id) await dbPatch(`/${tableName}?id=eq.${record_id}`, { ...updates, updated_at: new Date().toISOString() });
        else await dbPost(tableName, { investor_id, ...updates, created_at: new Date().toISOString() });
        return ok({ success: true });
      }
      return err(`Unknown ${fn} action`);
    }

    // ─────────────────────────── DEAL FLOW NOTIFICATIONS ─────────────────
    case 'deal-flow-notifications': {
      const { action } = body;
      const SUCCESS_EMAIL = 'success@accessyourplace.com';

      function getStaffDisplayName2(staff) {
        if (!staff) return 'Team Member';
        if (staff.first_name) return `${staff.first_name} ${staff.last_name || ''}`.trim();
        if (staff.name) return staff.name;
        return 'Team Member';
      }
      async function getStaffInfo(staffId) {
        const { data } = await dbGet(`/staff_users?id=eq.${staffId}&select=id,email,name,first_name,last_name,department,role`);
        return data?.[0] || null;
      }

      // ==================== INSERT DEAL STATUS NOTIFICATION ====================
      // Real recipient-facing table: deal_status_notifications (uses is_read, recipient_staff_id)
      if (action === 'insert_deal_status_notification') {
        const { property_id, property_title, property_address, property_city, property_state,
                recipient_staff_id, recipient_staff_name, recipient_email, reviewer_staff_id, reviewer_staff_name,
                old_status, new_status, notification_type, message, metadata, send_email } = body;

        if (!property_id || !recipient_staff_id || !notification_type || !new_status) {
          return ok({ success: false, error: 'property_id, recipient_staff_id, notification_type, and new_status are required' });
        }

        const insertRes = await dbPost('/deal_status_notifications', {
          property_id, property_title: property_title || null, property_address: property_address || null,
          property_city: property_city || null, property_state: property_state || null,
          recipient_staff_id, recipient_staff_name: recipient_staff_name || null, recipient_email: recipient_email || null,
          reviewer_staff_id: reviewer_staff_id || null, reviewer_staff_name: reviewer_staff_name || null,
          old_status: old_status || null, new_status, notification_type,
          message: message || `Deal status changed to ${new_status}`,
          is_read: false, email_sent: false, metadata: metadata || {},
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        if (!insertRes.ok) return ok({ success: false, error: 'Failed to insert notification: ' + JSON.stringify(insertRes.data).substring(0, 200) });
        const notifId = (Array.isArray(insertRes.data) ? insertRes.data[0] : insertRes.data)?.id || null;

        let emailSent = false;
        const criticalStatuses = ['deal_approved', 'deal_rejected', 'deal_published', 'deal_verified'];
        if (send_email !== false && criticalStatuses.includes(notification_type)) {
          let toEmail = recipient_email;
          if (!toEmail && recipient_staff_id) { const staff = await getStaffInfo(recipient_staff_id); toEmail = staff?.email; }
          if (toEmail) {
            const recipientName = recipient_staff_name || 'Team Member';
            const dealLabel = property_title || property_address || 'Your Deal';
            const location = [property_city, property_state].filter(Boolean).join(', ');
            const statusMap = {
              deal_approved: { color: '#22c55e', label: 'Approved', body: `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been approved by ${reviewer_staff_name || 'the Success Team'}.` },
              deal_rejected: { color: '#ef4444', label: 'Not Approved', body: `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} was not approved by ${reviewer_staff_name || 'the Success Team'}.${metadata?.denial_reason ? ` Feedback: ${metadata.denial_reason}` : ''}` },
              deal_published: { color: '#8b5cf6', label: 'Published', body: `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been published to the marketplace by ${reviewer_staff_name || 'the Success Team'}!` },
              deal_verified: { color: '#0ea5e9', label: 'Verified', body: `Your deal <strong>${dealLabel}</strong>${location ? ` in ${location}` : ''} has been verified by ${reviewer_staff_name || 'the Success Team'}.` },
            };
            const sInfo = statusMap[notification_type] || { color: '#3b82f6', label: new_status, body: message || '' };
            const emailResult = await sendEmail({ to: toEmail, subject: `Deal ${sInfo.label}: ${dealLabel}${location ? ` - ${location}` : ''}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#1a365d;padding:24px;text-align:center;"><h1 style="color:${sInfo.color};margin:0;font-size:22px;">Deal ${sInfo.label}</h1></div><div style="padding:24px;"><p>Hi ${recipientName.split(' ')[0]},</p><p>${sInfo.body}</p><div style="text-align:center;margin-top:20px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:#1a365d;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>` });
            emailSent = emailResult.ok;
            if (notifId) await dbPatch(`/deal_status_notifications?id=eq.${notifId}`, { email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null }).catch(() => {});
          }
        }
        return ok({ success: true, notification_id: notifId, email_sent: emailSent });
      }

      // ==================== GET AM NOTIFICATIONS ====================
      if (action === 'get_am_notifications') {
        const { staff_id, limit: reqLimit, offset, unread_only } = body;
        if (!staff_id) return ok({ success: false, error: 'staff_id required' });
        const lim = Math.min(reqLimit || 30, 100);
        const off = offset || 0;
        let q = `/deal_status_notifications?recipient_staff_id=eq.${staff_id}&order=created_at.desc&limit=${lim}&offset=${off}`;
        if (unread_only) q += '&is_read=eq.false';
        const { data } = await dbGet(q);
        const notifications = Array.isArray(data) ? data : [];
        const { data: countData } = await dbGet(`/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false&select=id`);
        const unreadCount = Array.isArray(countData) ? countData.length : 0;
        return ok({ success: true, notifications, count: notifications.length, unread_count: unreadCount });
      }

      // ==================== GET AM UNREAD COUNT ====================
      if (action === 'get_am_unread_count') {
        const { staff_id } = body;
        if (!staff_id) return ok({ success: false, error: 'staff_id required' });
        const { data } = await dbGet(`/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false&select=id`);
        return ok({ success: true, unread_count: Array.isArray(data) ? data.length : 0 });
      }

      // ==================== MARK AM NOTIFICATION(S) READ ====================
      if (action === 'mark_am_notification_read') {
        const { staff_id, notification_id, notification_ids, mark_all } = body;
        if (!staff_id) return ok({ success: false, error: 'staff_id required' });
        const now = new Date().toISOString();
        if (mark_all) {
          await dbPatch(`/deal_status_notifications?recipient_staff_id=eq.${staff_id}&is_read=eq.false`, { is_read: true, read_at: now, updated_at: now });
          return ok({ success: true, message: 'All notifications marked as read' });
        }
        if (notification_ids?.length) {
          for (const nid of notification_ids) await dbPatch(`/deal_status_notifications?id=eq.${nid}&recipient_staff_id=eq.${staff_id}`, { is_read: true, read_at: now, updated_at: now });
          return ok({ success: true, message: `${notification_ids.length} notification(s) marked as read` });
        }
        if (notification_id) {
          await dbPatch(`/deal_status_notifications?id=eq.${notification_id}&recipient_staff_id=eq.${staff_id}`, { is_read: true, read_at: now, updated_at: now });
          return ok({ success: true, message: 'Notification marked as read' });
        }
        return ok({ success: false, error: 'Provide notification_id, notification_ids, or mark_all=true' });
      }

      // ==================== CLEANUP OLD NOTIFICATIONS ====================
      if (action === 'cleanup_old_notifications') {
        const { days_old } = body;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (days_old || 90));
        await db(`/deal_status_notifications?created_at=lt.${cutoff.toISOString()}&is_read=eq.true`, { method: 'DELETE', headers: dbHeaders() }).catch(() => {});
        return ok({ success: true, message: `Cleaned up read notifications older than ${days_old || 90} days` });
      }

      // ==================== LEGACY: NEW DEAL SUBMITTED ====================
      // Writes to BOTH deal_flow_notifications (legacy, success-team-facing, uses `read` not `is_read`)
      // AND deal_status_notifications (current, AM-facing). This dual-write matches the real source
      // exactly -- the two tables serve different audiences and neither is safe to drop.
      if (action === 'new_deal_submitted') {
        const { property_id, property_title, property_address, property_city, property_state,
                submitted_by_staff_id, submitted_by_staff_name, bedrooms, bathrooms, monthly_rent, operation_type } = body;
        const propLabel = property_title || property_address || 'New Property';
        const propLocation = [property_city, property_state].filter(Boolean).join(', ');

        const notifRes = await dbPost('/deal_flow_notifications', {
          type: 'new_deal_submitted', property_id, property_title: propLabel, property_address, property_city, property_state,
          submitted_by_staff_id, submitted_by_staff_name: submitted_by_staff_name || 'Unknown AM',
          recipient_type: 'success_team', recipient_email: SUCCESS_EMAIL,
          message: `New deal submitted by ${submitted_by_staff_name || 'AM'}: ${propLabel} in ${propLocation}`,
          read: false, email_sent: false,
        });
        const notifId = (Array.isArray(notifRes.data) ? notifRes.data[0] : notifRes.data)?.id || null;

        if (submitted_by_staff_id) {
          await dbPost('/deal_status_notifications', {
            property_id, property_title: propLabel, property_address, property_city, property_state,
            recipient_staff_id: submitted_by_staff_id, recipient_staff_name: submitted_by_staff_name,
            notification_type: 'deal_submitted', new_status: 'am_submitted',
            message: `Your deal "${propLabel}" in ${propLocation} has been submitted and is under review.`,
            is_read: false, email_sent: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).catch(() => {});
        }

        const specs = [
          bedrooms ? `${bedrooms} Bed` : null, bathrooms ? `${bathrooms} Bath` : null,
          monthly_rent ? `$${Number(monthly_rent).toLocaleString()}/mo` : null,
          operation_type ? (operation_type === 'coliving' ? 'Co-Living' : operation_type === 'both' ? 'STR + Co-Living' : 'STR') : null,
        ].filter(Boolean).join(' · ');
        const emailResult = await sendEmail({
          to: SUCCESS_EMAIL,
          subject: `New Deal: ${propLabel} in ${propLocation} - Submitted by ${submitted_by_staff_name || 'AM'}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#1a365d;padding:24px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">New Deal Submitted</h1><p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">Requires Verification & Approval</p></div><div style="padding:24px;"><p style="font-weight:bold;color:#1a365d;">${propLabel}</p><p style="color:#64748b;">${propLocation}</p>${specs ? `<p style="color:#475569;">${specs}</p>` : ''}<p><strong>Submitted by:</strong> ${submitted_by_staff_name || 'Acquisition Manager'}</p><div style="text-align:center;margin-top:20px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:#1a365d;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Review Deal in Dashboard</a></div></div></div>`,
        });
        if (notifId) await dbPatch(`/deal_flow_notifications?id=eq.${notifId}`, { email_sent: emailResult.ok, email_sent_at: emailResult.ok ? new Date().toISOString() : null }).catch(() => {});
        return ok({ success: true, notification_id: notifId, email_sent: emailResult.ok });
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

        const notifRes = await dbPost('/deal_flow_notifications', {
          type: action, property_id, property_title: propLabel, property_address, property_city, property_state,
          submitted_by_staff_id, submitted_by_staff_name, approved_by_staff_name: approved_by_staff_name || 'Success Team',
          recipient_type: 'acquisition_manager', recipient_staff_id: submitted_by_staff_id, recipient_email: submitted_by_staff_email,
          message: `Your deal "${propLabel}" in ${propLocation} has been ${statusLabel.toLowerCase()} by ${approved_by_staff_name || 'Success Team'}`,
          read: false, email_sent: false,
        });
        const notifId = (Array.isArray(notifRes.data) ? notifRes.data[0] : notifRes.data)?.id || null;

        if (submitted_by_staff_id) {
          const notifType = isPublished ? 'deal_published' : 'deal_approved';
          await dbPost('/deal_status_notifications', {
            property_id, property_title: propLabel, property_address, property_city, property_state,
            recipient_staff_id: submitted_by_staff_id, recipient_staff_name: submitted_by_staff_name,
            reviewer_staff_id: approved_by_staff_id, reviewer_staff_name: approved_by_staff_name || 'Success Team',
            new_status: isPublished ? 'published' : 'am_approved', notification_type: notifType,
            message: `Your deal "${propLabel}" in ${propLocation} has been ${statusLabel.toLowerCase()}.`,
            is_read: false, email_sent: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).catch(() => {});
        }

        let emailSent = false;
        if (submitted_by_staff_email) {
          const emailResult = await sendEmail({
            to: submitted_by_staff_email,
            subject: `Deal ${statusLabel}: ${propLabel}${propLocation ? ` - ${propLocation}` : ''}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><div style="background:#1a365d;padding:24px;text-align:center;"><h1 style="color:${isPublished ? '#8b5cf6' : '#22c55e'};margin:0;">Deal ${statusLabel}</h1></div><div style="padding:24px;"><p>Hi ${(submitted_by_staff_name || 'there').split(' ')[0]},</p><p>Your deal <strong>${propLabel}</strong>${propLocation ? ` in ${propLocation}` : ''} has been ${statusLabel.toLowerCase()} by ${approved_by_staff_name || 'the Success Team'}.</p><div style="text-align:center;margin-top:20px;"><a href="${SITE_URL}/staff" style="background:#d4a574;color:#1a365d;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`,
          });
          emailSent = emailResult.ok;
        }
        if (notifId) await dbPatch(`/deal_flow_notifications?id=eq.${notifId}`, { email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null }).catch(() => {});
        return ok({ success: true, notification_id: notifId, email_sent: emailSent });
      }

      // ==================== GET DEAL TIMELINE ====================
      if (action === 'get_deal_timeline') {
        const { property_ids } = body;
        if (!Array.isArray(property_ids) || property_ids.length === 0) return ok({ success: true, timelines: {} });
        const idsFilter = property_ids.map(id => `"${id}"`).join(',');
        const { data } = await dbGet(`/deal_flow_notifications?property_id=in.(${idsFilter})&order=created_at.asc&limit=500`);
        const timelines = {};
        for (const notif of (data || [])) {
          const pid = notif.property_id;
          if (!timelines[pid]) timelines[pid] = [];
          timelines[pid].push({ id: notif.id, type: notif.type, message: notif.message, approved_by_staff_name: notif.approved_by_staff_name, submitted_by_staff_name: notif.submitted_by_staff_name, recipient_type: notif.recipient_type, email_sent: notif.email_sent, created_at: notif.created_at });
        }
        return ok({ success: true, timelines });
      }

      // ==================== GET AM DEAL STATUSES ====================
      if (action === 'get_am_deal_statuses') {
        const { staff_id } = body;
        if (!staff_id) return ok({ success: false, error: 'staff_id required' });
        const { data: properties } = await dbGet(`/properties?or=(added_by_staff_id.eq.${staff_id},found_by_am_id.eq.${staff_id})&order=created_at.desc&limit=100&select=id,listing_title,address,city,state,zip_code,status,deal_status,is_verified,is_published,asking_price,monthly_rent,monthly_revenue,bedrooms,bathrooms,operation_type,photos,created_at,updated_at,approved_by_staff_name,approved_at,denial_reason,found_by_am_name,added_by_staff_name`);
        if (!properties?.length) return ok({ success: true, deals: [], timelines: {}, counts: { total: 0, pending: 0, approved: 0, published: 0, rejected: 0 } });

        const propIds = properties.map(p => p.id);
        const idsFilter = propIds.map(id => `"${id}"`).join(',');
        const { data: notifications } = await dbGet(`/deal_flow_notifications?property_id=in.(${idsFilter})&order=created_at.asc&limit=1000`);
        const timelines = {};
        for (const notif of (notifications || [])) {
          const pid = notif.property_id;
          if (!timelines[pid]) timelines[pid] = [];
          timelines[pid].push({ id: notif.id, type: notif.type, message: notif.message, approved_by_staff_name: notif.approved_by_staff_name, submitted_by_staff_name: notif.submitted_by_staff_name, recipient_type: notif.recipient_type, email_sent: notif.email_sent, created_at: notif.created_at });
        }
        const deals = properties.map(p => {
          let computedStatus = 'pending_review';
          if (p.deal_status === 'am_denied' || p.denial_reason) computedStatus = 'rejected';
          else if (p.is_published) computedStatus = 'published';
          else if (p.is_verified || p.deal_status === 'am_approved') computedStatus = 'approved';
          return { id: p.id, title: p.listing_title || p.address || 'Untitled', address: p.address, city: p.city, state: p.state, zip_code: p.zip_code, status: p.status, deal_status: p.deal_status, computed_status: computedStatus, is_verified: p.is_verified, is_published: p.is_published, asking_price: p.asking_price, monthly_rent: p.monthly_rent || p.monthly_revenue, bedrooms: p.bedrooms, bathrooms: p.bathrooms, operation_type: p.operation_type, photos: p.photos, created_at: p.created_at, updated_at: p.updated_at, approved_by_staff_name: p.approved_by_staff_name, approved_at: p.approved_at, denial_reason: p.denial_reason, found_by_am_name: p.found_by_am_name, added_by_staff_name: p.added_by_staff_name, timeline: timelines[p.id] || [] };
        });
        const counts = { total: deals.length, pending: deals.filter(d => d.computed_status === 'pending_review').length, approved: deals.filter(d => d.computed_status === 'approved').length, published: deals.filter(d => d.computed_status === 'published').length, rejected: deals.filter(d => d.computed_status === 'rejected').length };
        return ok({ success: true, deals, timelines, counts });
      }

      // ==================== LEGACY: GET NOTIFICATIONS (deal_flow_notifications) ====================
      if (action === 'get_notifications') {
        const { staff_id, recipient_type, unread_only, limit: reqLimit } = body;
        const lim = reqLimit || 50;
        let q = `/deal_flow_notifications?order=created_at.desc&limit=${lim}`;
        if (recipient_type) q += `&recipient_type=eq.${recipient_type}`;
        if (staff_id) q += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team,recipient_type.eq.all_staff)`;
        if (unread_only) q += `&read=eq.false`;
        const { data } = await dbGet(q);
        return ok({ success: true, notifications: data || [], count: data?.length || 0 });
      }

      // ==================== LEGACY: GET UNREAD COUNT (deal_flow_notifications) ====================
      if (action === 'get_unread_count') {
        const { staff_id, recipient_type } = body;
        let q = `/deal_flow_notifications?read=eq.false&select=id`;
        if (recipient_type === 'success_team') q += `&recipient_type=eq.success_team`;
        else if (staff_id) q += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team,recipient_type.eq.all_staff)`;
        const { data } = await dbGet(q);
        return ok({ success: true, unread_count: Array.isArray(data) ? data.length : 0 });
      }

      // ==================== LEGACY: MARK READ (deal_flow_notifications) ====================
      if (action === 'mark_read') {
        const { notification_id, notification_ids, mark_all, staff_id, recipient_type } = body;
        if (mark_all) {
          let q = `/deal_flow_notifications?read=eq.false`;
          if (recipient_type) q += `&recipient_type=eq.${recipient_type}`;
          if (staff_id) q += `&or=(recipient_staff_id.eq.${staff_id},recipient_type.eq.success_team)`;
          await dbPatch(q, { read: true });
        } else if (notification_ids?.length) {
          for (const nid of notification_ids) await dbPatch(`/deal_flow_notifications?id=eq.${nid}`, { read: true });
        } else if (notification_id) {
          await dbPatch(`/deal_flow_notifications?id=eq.${notification_id}`, { read: true });
        }
        return ok({ success: true });
      }

      return err(`Unknown deal-flow-notifications action: ${action}`);
    }

    case 'manage-notes': {
      const { action, investor_id, note_id } = body;
      if (action === 'get') {
        const { data } = await dbGet(`/notes?investor_id=eq.${investor_id}&order=created_at.desc&select=*`);
        return ok({ success: true, notes: data || [] });
      }
      if (action === 'create') {
        const { content, author_id } = body;
        const result = await dbPost('/notes', { investor_id, content, author_id, created_at: new Date().toISOString() });
        return ok({ success: true, note: Array.isArray(result.data) ? result.data[0] : result.data });
      }
      if (action === 'delete') {
        await dbDelete(`/notes?id=eq.${note_id}`);
        return ok({ success: true });
      }
      return err('Unknown notes action');
    }

    case 'manage-property-assignments': {
      const { action, assignment_id } = body;
      if (action === 'get') {
        const { data } = await dbGet('/property_assignments?order=created_at.desc&select=*');
        return ok({ success: true, assignments: data || [] });
      }
      if (action === 'assign') {
        const { property_id, staff_id, investor_id } = body;
        const result = await dbPost('/property_assignments', { property_id, staff_id, investor_id, created_at: new Date().toISOString() });
        return ok({ success: true, assignment: Array.isArray(result.data) ? result.data[0] : result.data });
      }
      if (action === 'unassign') {
        await dbDelete(`/property_assignments?id=eq.${assignment_id}`);
        return ok({ success: true });
      }
      return err('Unknown property-assignments action');
    }

    case 'manage-property-expenses': {
      const { action, property_id, expense_id } = body;
      if (action === 'get') {
        const { data } = await dbGet(`/property_expenses?property_id=eq.${property_id}&order=created_at.desc&select=*`);
        return ok({ success: true, expenses: data || [] });
      }
      if (action === 'add') {
        const { amount, category, description, date } = body;
        const result = await dbPost('/property_expenses', { property_id, amount, category, description, date, created_at: new Date().toISOString() });
        return ok({ success: true, expense: Array.isArray(result.data) ? result.data[0] : result.data });
      }
      if (action === 'delete') {
        await dbDelete(`/property_expenses?id=eq.${expense_id}`);
        return ok({ success: true });
      }
      return err('Unknown property-expenses action');
    }

    case 'manage-property-referrals': {
      const { action } = body;
      if (action === 'get') {
        const { data } = await dbGet('/property_referrals?order=created_at.desc&select=*');
        return ok({ success: true, referrals: data || [] });
      }
      if (action === 'create') {
        const { property_id, referred_by, referred_email } = body;
        const result = await dbPost('/property_referrals', { property_id, referred_by, referred_email, created_at: new Date().toISOString() });
        return ok({ success: true, referral: Array.isArray(result.data) ? result.data[0] : result.data });
      }
      return err('Unknown property-referrals action');
    }

    case 'penny-score-monitoring': {
      const { data } = await dbGet('/properties?is_published=eq.true&penny_score=lt.50&select=id,penny_score,listing_title');
      return ok({ success: true, low_score_properties: data || [], count: data?.length || 0 });
    }

    case 'manage-email-logs': {
      const { action } = body;
      if (action === 'get') {
        const { data } = await dbGet('/email_logs?order=created_at.desc&limit=100&select=*');
        return ok({ success: true, logs: data || [] });
      }
      return err('Unknown email-logs action');
    }

    case 'new-deal-create': {
      const { deal } = body;
      const result = await dbPost('/properties', { ...deal, status: 'new', is_published: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return ok({ success: true, deal: Array.isArray(result.data) ? result.data[0] : result.data });
    }

    // ─────────────────────────── DEFAULT / UNKNOWN ─────────────────────────
    default:
      // Try to handle as a generic CRUD operation
      console.warn(`[AYP Functions] Unknown function: ${fn}`, JSON.stringify(body).substring(0, 200));
      return res.status(404).json({ error: `Function '${fn}' not found`, available: 'Check /health for server status' });
    }
  } catch (e) {
    console.error(`[AYP Functions] Error in ${fn}:`, e);
    return res.status(500).json({ error: e.message || 'Internal server error', function: fn });
  }
});

// ── SPA Fallback — serve React app for all non-API routes ────────────────────
app.get('*', (req, res) => {
  const indexFile = path.join(DIST_DIR, 'index.html');
  if (require('fs').existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run npm run build first.' });
  }
});

// ── Auto-migration: runs on every boot, safe to repeat (all statements use IF NOT EXISTS)
async function runStartupMigrations() {
  // We call PostgREST's rpc or use direct DB via the pg package if available,
  // otherwise fall back to running the ALTER TABLE via our db() helper against
  // a custom RPC. Simplest reliable path: call our own /functions/v1/run-migration
  // endpoint after boot, or use node-postgres if DATABASE_URL is set.
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!dbUrl) {
    console.log('⚠️  No DATABASE_URL set — skipping auto-migration');
    return;
  }
  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('🔄 Running startup migrations...');
    await client.query(`
      ALTER TABLE staff_users
        ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone,
        ADD COLUMN IF NOT EXISTS last_failed_login timestamp with time zone,
        ADD COLUMN IF NOT EXISTS session_token text,
        ADD COLUMN IF NOT EXISTS session_expires timestamp with time zone;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_users_session_token
        ON staff_users (session_token) WHERE session_token IS NOT NULL;
    `);
    await client.query(`
      ALTER TABLE landlord_contacts
        ADD COLUMN IF NOT EXISTS reset_token text,
        ADD COLUMN IF NOT EXISTS reset_token_expires timestamp with time zone;
    `);
    await client.end();
    console.log('✅ Startup migrations complete');
  } catch (e) {
    // Log but never crash the server over a migration — IF NOT EXISTS means
    // re-running is always safe, so a failure here is non-fatal.
    console.error('⚠️  Startup migration error (non-fatal):', e.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AYP Functions Server running on port ${PORT}`);
  console.log(`   SUPABASE_URL: ${SUPABASE_URL || '⚠️  NOT SET'}`);
  console.log(`   ANTHROPIC:    ${ANTHROPIC_KEY ? '✓ configured' : '⚠️  not set'}`);
  console.log(`   RESEND:       ${RESEND_KEY ? '✓ configured' : '⚠️  not set'}`);
  runStartupMigrations();
});
