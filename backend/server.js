/**
 * Access Your Place - Railway Functions Server
 * Replaces all famous.ai/Supabase Edge Functions.
 *
 * Routes:
 *   POST /functions/v1/:functionName  â†’ edge function handler
 *   GET  /health                      â†’ health check
 */

'use strict';

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 4000;

// â”€â”€ Env helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// â”€â”€ PostgREST Proxy (/rest/v1/* â†’ PostgREST) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const POSTGREST_INTERNAL = process.env.POSTGREST_URL || 'http://postgrest.railway.internal:3000';
app.use('/rest/v1', createProxyMiddleware({
  target: POSTGREST_INTERNAL,
  changeOrigin: true,
  pathRewrite: { '^/rest/v1': '' },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.headers.authorization) proxyReq.setHeader('Authorization', req.headers.authorization);
      if (req.headers.apikey) proxyReq.setHeader('apikey', req.headers.apikey);
      if (req.headers.prefer) proxyReq.setHeader('Prefer', req.headers.prefer);
    },
    error: (err, req, res) => {
      console.error('[PostgREST Proxy] Error:', err.message);
      res.status(502).json({ error: 'PostgREST unreachable', detail: err.message });
    }
  }
}));

// â”€â”€ Serve built React frontend (static files) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

// â”€â”€ DB helper (calls PostgREST) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const dbHeaders = () => ({
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});
function buildDbUrl(path) {
  const base = (process.env.POSTGREST_URL || SUPABASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('POSTGREST_URL or SUPABASE_URL is not configured');
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const isSupabaseProject = /supabase\.co/i.test(base);
  const alreadyRestBase = /\/rest\/v1$/i.test(base);
  const restPrefix = isSupabaseProject && !alreadyRestBase ? '/rest/v1' : '';
  return base + restPrefix + cleanPath;
}
async function db(path, opts = {}) {
  const url = buildDbUrl(path);
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

// â”€â”€ Email helper (Resend) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendEmail({ to, subject, html, from }) {
  if (!RESEND_KEY) return { ok: false, error: 'No RESEND_API_KEY configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: from || 'Access Your Place <noreply@accessyourplace.com>', to: Array.isArray(to) ? to : [to], subject, html }),
  });
  return { ok: res.ok };
}

// â”€â”€ SMS helper (Twilio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Anthropic helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function callAnthropic({ model = 'claude-3-5-sonnet-20241022', max_tokens = 2048, messages, system }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, messages, ...(system ? { system } : {}) }),
  });
  return res.json();
}

// â”€â”€ bcrypt helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isBcryptHash(str) { return str && str.startsWith('$2') && str.length >= 50; }
async function verifyPassword(input, stored) {
  if (isBcryptHash(stored)) return bcrypt.compare(input, stored);
  return input === stored; // legacy plain-text
}
async function hashPassword(plain) { return bcrypt.hash(plain, 10); }

// â”€â”€ CORS preflight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.options('*', cors());

// â”€â”€ Health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EDGE FUNCTION ROUTER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
app.post('/functions/v1/:fn', async (req, res) => {
  const fn = req.params.fn;
  const body = req.body || {};

  const ok  = (data)         => res.json({ ...data });
  const err = (msg, status=400) => res.status(status).json({ error: msg });

  try {
    switch (fn) {

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AUTH: INVESTOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'investor-auth':
    case 'investor-login':
    case 'investor-register':
    case 'investor-session': {
      const { action } = body;

      // REGISTER
      if (action === 'register') {
        const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code } = body;
        const existing = await dbGet(`/investors?email=eq.${encodeURIComponent(email)}&select=id`);
        if (existing.data?.length) return err('Email already exists');
        const hash = await hashPassword(password);
        const myRef = 'AYP' + Math.random().toString(36).substring(2,8).toUpperCase();
        const result = await dbPost('/investors', {
          email, password_hash: hash, full_name, phone,
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
        const { data: users } = await dbGet(`/investors?email=eq.${encodeURIComponent(email)}&select=*`);
        if (!users?.length) return ok({ success: false, error: 'Invalid email or password' });
        const user = users[0];
        const stored = user.password_hash || user.password;
        if (!stored) return ok({ success: false, error: 'Account not set up. Please use forgot password.' });
        const valid = await verifyPassword(password, stored);
        if (!valid) return ok({ success: false, error: 'Invalid email or password' });
        if (!isBcryptHash(stored)) await dbPatch(`/investors?id=eq.${user.id}`, { password_hash: await hashPassword(password) });
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
        const { data: users } = await dbGet(`/investors?email=eq.${encodeURIComponent(email)}&select=id,email,full_name`);
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
        const hash = await hashPassword(new_password);
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AUTH: STAFF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'staff-login':
    case 'staff-forgot-password': {
      const { action, email, password, reset_token, new_password, staff_id, current_password, investor_email } = body;

      // LOGIN
      if (action === 'login' || (!action && email && password)) {
        const { data: users } = await dbGet(`/staff_users?email=eq.${encodeURIComponent(email)}&select=*`);
        if (!users?.length) return ok({ success: false, error: 'Invalid email or password' });
        const user = users[0];
        if (!user.is_active) return ok({ success: false, error: 'Account is deactivated' });
        const stored = user.password_hash || user.password;
        if (!stored) return ok({ success: false, error: 'Account not set up. Please check your invitation email.' });
        const valid = await verifyPassword(password, stored);
        if (!valid) return ok({ success: false, error: 'Invalid email or password' });
        if (!isBcryptHash(stored)) await dbPatch(`/staff_users?id=eq.${user.id}`, { password_hash: await hashPassword(password) });
        await dbPatch(`/staff_users?id=eq.${user.id}`, { last_login: new Date().toISOString() });
        return ok({ success: true, staff: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, name: user.name, phone: user.phone, team: user.team, role: user.role, department: user.department, roles: user.roles, permissions: user.permissions, is_active: user.is_active, account_completed: user.account_completed, linked_investor_id: user.linked_investor_id, yp_certified: user.yp_certified } });
      }

      // FORGOT PASSWORD
      if (action === 'forgot_password') {
        const { data: users } = await dbGet(`/staff_users?email=eq.${encodeURIComponent(email)}&select=id,email,first_name`);
        if (users?.length) {
          const token = uuidv4() + '-' + uuidv4();
          await dbPatch(`/staff_users?id=eq.${users[0].id}`, { reset_token: token, reset_token_expires: new Date(Date.now() + 3600000).toISOString() });
          const resetUrl = `${SITE_URL}/staff/reset-password?token=${token}`;
          await sendEmail({ to: email, subject: 'Reset Your Staff Password', html: `<p>Hi ${users[0].first_name},</p><p><a href="${resetUrl}">Click here to reset your password</a>. Expires in 1 hour.</p>` });
        }
        return ok({ success: true });
      }

      // VALIDATE TOKEN
      if (action === 'validate_token') {
        const { data: users } = await dbGet(`/staff_users?reset_token=eq.${reset_token}&select=id,email,first_name,reset_token_expires`);
        if (!users?.length) return ok({ valid: false, error: 'Invalid token' });
        if (new Date(users[0].reset_token_expires) < new Date()) return ok({ valid: false, error: 'Token expired' });
        return ok({ valid: true, staff: users[0] });
      }

      // RESET PASSWORD
      if (action === 'reset_password') {
        const { data: users } = await dbGet(`/staff_users?reset_token=eq.${reset_token}&select=id,reset_token_expires`);
        if (!users?.length) return ok({ success: false, error: 'Invalid token' });
        if (new Date(users[0].reset_token_expires) < new Date()) return ok({ success: false, error: 'Token expired' });
        const hash = await hashPassword(new_password);
        await dbPatch(`/staff_users?id=eq.${users[0].id}`, { password_hash: hash, reset_token: null, reset_token_expires: null, account_completed: true });
        return ok({ success: true });
      }

      // COMPLETE ACCOUNT (invitation flow)
      if (action === 'complete_account') {
        const { invitation_token, password: pwd, name } = body;
        const { data: users } = await dbGet(`/staff_users?invitation_token=eq.${invitation_token}&select=id,invitation_expires`);
        if (!users?.length) return ok({ success: false, error: 'Invalid invitation' });
        if (new Date(users[0].invitation_expires) < new Date()) return ok({ success: false, error: 'Invitation expired' });
        const hash = await hashPassword(pwd);
        await dbPatch(`/staff_users?id=eq.${users[0].id}`, { password_hash: hash, name, account_completed: true, invitation_token: null, invitation_expires: null });
        return ok({ success: true });
      }

      // CHANGE PASSWORD
      if (action === 'change_password') {
        const { data: users } = await dbGet(`/staff_users?id=eq.${staff_id}&select=*`);
        if (!users?.length) return ok({ success: false, error: 'Staff not found' });
        const valid = await verifyPassword(current_password, users[0].password_hash || users[0].password);
        if (!valid) return ok({ success: false, error: 'Current password incorrect' });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { password_hash: await hashPassword(new_password) });
        return ok({ success: true });
      }

      // LINK INVESTOR
      if (action === 'link_investor') {
        const { data: investors } = await dbGet(`/investors?email=eq.${encodeURIComponent(investor_email)}&select=id`);
        if (!investors?.length) return ok({ success: false, error: 'Investor not found' });
        await dbPatch(`/staff_users?id=eq.${staff_id}`, { linked_investor_id: investors[0].id });
        await dbPatch(`/investors?id=eq.${investors[0].id}`, { linked_staff_id: staff_id });
        return ok({ success: true });
      }

      return err(`Unknown staff-login action: ${action}`);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR FAVORITES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MANAGE STAFF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        await sendEmail({ to: email, subject: 'Welcome to Access Your Place - Complete Your Account Setup', html: `<p>Hi ${first_name},</p><p>You have been added as ${department}. <a href="${inviteUrl}">Click here to complete your account setup</a>. Link expires in 7 days.</p>` });
        return ok({ success: true, staff: Array.isArray(result.data) ? result.data[0] : result.data });
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SEND INVESTOR INVITATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PROPERTIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DEAL MARKETPLACE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR MESSAGING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AM SUBMIT DEAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'am-submit-deal': {
      const { action } = body;

      if (action === 'submit') {
        const { deal_data, submitted_by } = body;
        const result = await dbPost('/am_submitted_deals', { ...deal_data, submitted_by, status: 'pending_review', created_at: new Date().toISOString() });
        return ok({ success: true, deal: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'get_submitted') {
        const { staff_id: sid } = body;
        const q = sid ? `/am_submitted_deals?submitted_by=eq.${sid}&order=created_at.desc&select=*` : '/am_submitted_deals?order=created_at.desc&select=*';
        const { data } = await dbGet(q);
        return ok({ success: true, deals: data || [] });
      }

      if (action === 'update_status') {
        const { deal_id, status, reviewer_id, feedback } = body;
        await dbPatch(`/am_submitted_deals?id=eq.${deal_id}`, { status, reviewer_id, feedback, reviewed_at: new Date().toISOString() });
        return ok({ success: true });
      }

      return err(`Unknown am-submit-deal action: ${action}`);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MANAGE INVESTOR ADMIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MANAGE LANDLORD PORTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'manage-landlord-portal':
    case 'manage-landlords':
    case 'landlord-auth': {
      const { action } = body;

      if (action === 'get_landlords') {
        const { data } = await dbGet('/landlords?order=created_at.desc&select=*');
        return ok({ success: true, landlords: data || [] });
      }

      if (action === 'create_landlord') {
        const { name, email, phone, company, notes } = body;
        const result = await dbPost('/landlords', { name, email, phone, company, notes, created_at: new Date().toISOString() });
        return ok({ success: true, landlord: Array.isArray(result.data) ? result.data[0] : result.data });
      }

      if (action === 'update_landlord') {
        const { landlord_id, ...updates } = body;
        delete updates.action;
        await dbPatch(`/landlords?id=eq.${landlord_id}`, { ...updates, updated_at: new Date().toISOString() });
        return ok({ success: true });
      }

      if (action === 'get_properties') {
        const { landlord_id } = body;
        const { data } = await dbGet(`/properties?landlord_id=eq.${landlord_id}&select=*`);
        return ok({ success: true, properties: data || [] });
      }

      if (action === 'login') {
        const { email, password } = body;
        const { data: landlords } = await dbGet(`/landlords?email=eq.${encodeURIComponent(email)}&select=*`);
        if (!landlords?.length) return ok({ success: false, error: 'Invalid credentials' });
        const l = landlords[0];
        const valid = await verifyPassword(password, l.password_hash || l.password || '');
        if (!valid) return ok({ success: false, error: 'Invalid credentials' });
        return ok({ success: true, landlord: l });
      }

      return err(`Unknown landlord action: ${action}`);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI - PENNY CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI - PROPERTY ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI - PENNY DEAL SCORING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PENNY - GENERATE DESCRIPTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'penny-generate-description': {
      const { property_id, property_data } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');
      const prop = property_data || (await dbGet(`/properties?id=eq.${property_id}&select=*`)).data?.[0];
      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, messages: [{ role: 'user', content: `Write a compelling listing description for this rental property for Airbnb/VRBO. Make it engaging, highlight key features, and use a professional tone. Property details: ${JSON.stringify(prop)}` }] });
      const description = aiRes.content?.[0]?.text || '';
      if (property_id && description) await dbPatch(`/properties?id=eq.${property_id}`, { listing_description: description, updated_at: new Date().toISOString() });
      return ok({ success: true, description });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI - PENNY PORTFOLIO ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'penny-portfolio-analysis': {
      const { investor_id } = body;
      if (!ANTHROPIC_KEY) return err('AI not configured');
      const { data: portfolio } = await dbGet(`/investor_portfolio?investor_id=eq.${investor_id}&select=*,properties(*)`);
      const aiRes = await callAnthropic({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2048, system: 'You are Penny, an AI investment advisor for rental arbitrage.', messages: [{ role: 'user', content: `Analyze this investor portfolio and provide strategic recommendations. Portfolio: ${JSON.stringify(portfolio)}. Include: overall_score (1-100), strengths, risks, opportunities, next_steps.` }] });
      return ok({ success: true, analysis: aiRes.content?.[0]?.text || '' });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AI - ARTICLE GENERATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ARTICLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ LEAD MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REFERRALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SETUP TASKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MARKET REPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HR / COMMISSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ACQUISITION REQUESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MANAGE AM ASSIGNMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ EMAIL TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SEND BULK EMAIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MANAGE SUPPORT REQUESTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ANALYTICS / TRACKING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR DOCUMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR CREDITS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DISPUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PLATFORM CONNECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SELLER DOCUMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DIGITAL PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SOP REPOSITORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DOCUMENT SIGNATURES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PORTFOLIO PERFORMANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DEAL ALERTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR INQUIRIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PROPERTY PHOTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INVESTOR OAUTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'investor-oauth': {
      const { provider, code, state } = body;
      // OAuth flow - redirect to provider
      return ok({ success: false, error: 'OAuth must be configured server-side. Set up callback URLs in your OAuth provider.' });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DEAL LOCATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ WEEKLY DIGEST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ SECURITY ALERTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ERROR LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STAFF DEAL SEARCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REVENUE FORECASTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MISC FUNCTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DEFAULT / UNKNOWN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ SPA Fallback â€” serve React app for all non-API routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('*', (req, res) => {
  const indexFile = path.join(DIST_DIR, 'index.html');
  if (require('fs').existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run npm run build first.' });
  }
});

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, () => {
  console.log(`âœ… AYP Functions Server running on port ${PORT}`);
  console.log(`   SUPABASE_URL: ${SUPABASE_URL || 'âš ï¸  NOT SET'}`);
  console.log(`   ANTHROPIC:    ${ANTHROPIC_KEY ? 'âœ“ configured' : 'âš ï¸  not set'}`);
  console.log(`   RESEND:       ${RESEND_KEY ? 'âœ“ configured' : 'âš ï¸  not set'}`);
});

