// staff-forgot-password — request a reset link, and COMPLETE the reset.
//
// WHAT WAS BROKEN, AND WHY NOBODY NOTICED
//
// This function only ever handled the REQUEST leg. It destructured { email, base_url }
// and ignored `action` entirely. But StaffResetPassword.tsx calls it with
// { action: 'reset_password', reset_token, new_password } — no email at all.
//
// So the lookup ran as email=eq.undefined, matched nobody, and returned the
// anti-enumeration reply: HTTP 200, { success: true }. The page reads that as a win,
// shows "Password Reset Successful!", and redirects to login. The password was never
// changed. Its own fallback to staff-login never fired either, because the fallback is
// gated on an error and there was no error — a 200 is not an error. staff-login has no
// reset_password action either, so no path existed that could have worked.
//
// Net effect: every staff password reset silently did nothing while reporting success.
// The person then types the new password, gets "Invalid email or password", and has no
// way to know the reset was what failed.
//
// That is this platform's signature defect sitting in the credential path, which is the
// worst place for it: a green checkmark that lies, and a blind owner with no way to see
// that nothing changed.
//
// Also added: the Accept-Profile / Content-Profile shim that 117 other functions carry
// and this one did not. public.staff_users is a VIEW over the real table, so this was
// not reading different data — but relying on that is luck, not design.

import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';

// A blanket global-fetch shim forcing Accept-Profile was added here and the owner
// immediately hit "We could not process that request" — the staff_users lookup was
// returning not-ok. Before that shim this function reached the DEFAULT schema, where
// staff_users is a VIEW over the same rows, and it demonstrably worked (five reset
// emails in email_logs).
//
// I do not have a way to call PostgREST from where I am working, so I cannot prove
// which profile it accepts. Rather than guess and leave the owner locked out, this
// tries the data schema FIRST and falls back to the default profile if that read is
// rejected — and logs which one answered, so the next person knows rather than
// theorises. Whichever profile succeeds for the read is then reused for the write, so a
// reset can never read one schema and write another.
type Profile = 'data' | 'default';

function withProfile(headers: Record<string, string>, profile: Profile): Record<string, string> {
  return profile === 'data'
    ? { ...headers, 'Accept-Profile': DATA_SCHEMA, 'Content-Profile': DATA_SCHEMA }
    : headers;
}

// Runs a REST read against the data schema, then the default. Returns the rows AND the
// profile that worked, so callers can write back through the same one.
async function restRead(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; rows: any[]; profile: Profile; status: number }> {
  for (const profile of ['data', 'default'] as Profile[]) {
    const res = await fetch(url, { headers: withProfile(headers, profile) });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      console.log('staff-forgot-password read_ok', JSON.stringify({ profile }));
      return { ok: true, rows: Array.isArray(rows) ? rows : [], profile, status: res.status };
    }
    console.error('staff-forgot-password read_failed', JSON.stringify({
      profile, status: res.status, body: (await res.text()).slice(0, 200),
    }));
    if (profile === 'default') return { ok: false, rows: [], profile, status: res.status };
  }
  return { ok: false, rows: [], profile: 'default', status: 0 };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Identical for "no such account" and "sent", so this cannot be used to discover which
// addresses belong to staff.
const GENERIC = 'If this email exists, a reset link will be sent.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'request_reset');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error('staff-forgot-password missing_config');
      return json({ success: false, error: 'Server configuration error' }, 500);
    }
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    /* --------------------------- VALIDATE A TOKEN --------------------------- */
    // The reset page calls this on load to decide whether to show the form.
    //
    // It used to call staff-login with action 'validate_token' — an action staff-login
    // does not implement. That request fell through to the LOGIN path with no email,
    // returned 401, and the page's fallback then tried to read staff_users straight from
    // the browser with the anon key, which RLS blocks. So a perfectly good token was
    // reported as "This link is not valid", and the only clue was in a console the owner
    // cannot see.
    //
    // Returns the name and email so the page can greet the person, and nothing else. The
    // token IS the secret here, so confirming it is valid to whoever holds it reveals
    // nothing they do not already have.
    if (action === 'validate_token') {
      const token = String(body.reset_token || '').trim();
      if (!token) return json({ success: true, valid: false, error: 'No token supplied.' });

      const look = await restRead(
        `${supabaseUrl}/rest/v1/staff_users?reset_token=eq.${encodeURIComponent(token)}&select=id,email,name,first_name,last_name,reset_token_expires,is_active&limit=1`,
        headers,
      );
      if (!look.ok) {
        return json({ success: false, valid: false, error: 'We could not check that link right now. Please try again.' }, 502);
      }
      const u = look.rows[0];
      if (!u) return json({ success: true, valid: false, error: 'This reset link is not valid. It may already have been used.' });
      if (u.is_active === false) return json({ success: true, valid: false, error: 'This account is inactive. Please contact an administrator.' });
      if (!u.reset_token_expires || new Date(u.reset_token_expires).getTime() < Date.now()) {
        return json({ success: true, valid: false, error: 'This reset link has expired. Please request a new one.' });
      }

      return json({
        success: true,
        valid: true,
        email: u.email || '',
        name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        is_new_account: false,
      });
    }

    /* ------------------------- COMPLETE THE RESET ------------------------- */
    if (action === 'reset_password') {
      const token = String(body.reset_token || '').trim();
      const newPassword = String(body.new_password || '');

      if (!token) return json({ success: false, error: 'This reset link is missing its token. Please request a new one.' }, 400);
      if (newPassword.length < 8) {
        return json({ success: false, error: 'Choose a password of at least 8 characters.' }, 400);
      }

      const lookup = await restRead(
        `${supabaseUrl}/rest/v1/staff_users?reset_token=eq.${encodeURIComponent(token)}&select=id,email,name,reset_token_expires,is_active&limit=1`,
        headers,
      );
      if (!lookup.ok) {
        return json({ success: false, error: 'We could not check that reset link. Please try again.' }, 502);
      }
      const user = lookup.rows[0] || null;

      if (!user) {
        return json({ success: false, error: 'This reset link is not valid. It may already have been used. Please request a new one.' }, 400);
      }
      if (user.is_active === false) {
        return json({ success: false, error: 'This account is inactive. Please contact an administrator.' }, 403);
      }
      if (!user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
        return json({ success: false, error: 'This reset link has expired. Please request a new one.' }, 400);
      }

      const hash = bcrypt.hashSync(newPassword);

      const patch = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { ...withProfile(headers, lookup.profile), Prefer: 'return=representation' },
        body: JSON.stringify({
          password_hash: hash,
          reset_token: null,
          reset_token_expires: null,
          failed_login_attempts: 0,
          locked_until: null,
          session_token: null,
          session_expires: null,
          updated_at: new Date().toISOString(),
        }),
      });

      // The point of this rewrite: report success ONLY if the write actually landed.
      if (!patch.ok) {
        console.error('staff-forgot-password reset_write_failed', patch.status, (await patch.text()).slice(0, 200));
        return json({ success: false, error: 'We could not save your new password. Please try again.' }, 502);
      }
      const saved = await patch.json().catch(() => []);
      if (!Array.isArray(saved) || !saved.length) {
        console.error('staff-forgot-password reset_write_no_rows');
        return json({ success: false, error: 'We could not save your new password. Please try again.' }, 502);
      }

      console.log('staff-forgot-password reset_completed', JSON.stringify({ staff_id: user.id }));
      return json({ success: true, message: 'Your password has been updated. You can sign in with it now.' });
    }

    /* ------------------------- REQUEST A RESET LINK ------------------------- */
    const email = String(body.email || '').trim().toLowerCase();
    const baseUrl = String(body.base_url || 'https://accessyourplace.com').replace(/\/+$/, '');
    if (!email) return json({ success: false, error: 'Enter the email address on your staff account.' }, 400);

    const read = await restRead(
      `${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=id,email,name&limit=1`,
      headers,
    );
    if (!read.ok) {
      return json({ success: false, error: 'We could not process that request. Please try again.' }, 502);
    }
    const users = read.rows;
    if (!users.length) return json({ success: true, message: GENERIC });

    const user = users[0];
    const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    const saveToken = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      headers: withProfile(headers, read.profile),
      body: JSON.stringify({ reset_token: token, reset_token_expires: expires.toISOString() }),
    });
    // Previously unchecked. If the token never saved, the emailed link cannot work.
    if (!saveToken.ok) {
      console.error('staff-forgot-password token_write_failed', saveToken.status);
      return json({ success: false, error: 'We could not start a password reset. Please try again.' }, 502);
    }

    const resetUrl = `${baseUrl}/staff/reset-password?token=${token}`;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    let emailOk = false;
    let emailErr = '';

    if (!resendKey) {
      emailErr = 'no_resend_key';
      console.error('staff-forgot-password missing RESEND_API_KEY');
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'Penny <penny@accessyourplace.com>',
          reply_to: ['success@accessyourplace.com'],
          to: [user.email],
          subject: 'Reset your Access Your Place staff password',
          text:
            `Hi ${user.name || 'there'},\n\n` +
            `You asked to reset your staff password. Open this link within the next hour to choose a new one:\n\n${resetUrl}\n\n` +
            `If you didn't ask for this, ignore this email and your password stays as it is.\n\n` +
            `Penny\nClient Success | Access Your Place`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;margin:0;padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-top:24px;padding-bottom:24px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td bgcolor="#1a365d" style="background-color:#1a365d;padding-top:24px;padding-bottom:24px;text-align:center;"><span style="color:#ffffff;font-size:20px;font-weight:bold;">Access Your Place</span></td></tr><tr><td style="padding-top:28px;padding-right:28px;padding-bottom:28px;padding-left:28px;background-color:#ffffff;"><p style="font-size:16px;line-height:1.6;color:#333333;">Hi ${user.name || 'there'},</p><p style="font-size:16px;line-height:1.6;color:#333333;">You asked to reset your staff password. Use the link below within the next hour to choose a new one.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#d4a574" style="background-color:#d4a574;padding-top:14px;padding-right:28px;padding-bottom:14px;padding-left:28px;"><a href="${resetUrl}" style="color:#1a365d;font-size:16px;font-weight:bold;text-decoration:none;">Choose a new password</a></td></tr></table><p style="font-size:14px;line-height:1.6;color:#666666;">If the button does not work, paste this into your browser:<br>${resetUrl}</p><p style="font-size:14px;line-height:1.6;color:#666666;">If you did not ask for this, ignore this email and your password stays as it is.</p><p style="font-size:16px;line-height:1.6;color:#333333;">Penny<br><span style="font-size:14px;color:#666666;">Client Success | Access Your Place</span></p></td></tr></table></td></tr></table></body></html>`,
        }),
      });
      emailOk = emailRes.ok;
      if (!emailRes.ok) {
        emailErr = (await emailRes.text()).slice(0, 200);
        console.error('staff-forgot-password send_failed', emailRes.status, emailErr);
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
      method: 'POST',
      headers: withProfile(headers, read.profile),
      body: JSON.stringify({
        template_type: 'staff_password_reset',
        recipient_email: user.email,
        subject: 'Reset your Access Your Place staff password',
        status: emailOk ? 'sent' : 'failed',
        error_message: emailOk ? null : emailErr || null,
      }),
    }).catch(() => undefined);

    // The generic reply exists to hide WHETHER an account exists, not to hide that our
    // own mail provider is down. Telling someone to wait for an email that was never
    // accepted is the same lie in a friendlier voice.
    if (!emailOk) {
      return json({ success: false, error: 'We could not send the reset email just now. Please try again in a moment.' }, 502);
    }

    return json({ success: true, message: GENERIC });
  } catch (error) {
    console.error('staff-forgot-password threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Something went wrong. Please try again.' }, 500);
  }
});
