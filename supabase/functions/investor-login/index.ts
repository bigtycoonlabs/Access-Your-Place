// Ultra-minimal investor login - avoids all cloning issues
// Adds a REAL password reset flow:
//   - forgot_password: generates a one-hour token, stores it on the investor row, and emails a
//     working reset link (https://accessyourplace.com/investor/reset-password?token=...). Always
//     returns a generic success to prevent email enumeration.
//   - reset_password: validates the token + expiry and sets a new bcrypt password_hash, clearing
//     the token so it can't be reused.
// Login / logout / validate_session are unchanged.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, email, password, remember_me, session_token, reset_method, phone, base_url, otp_code, reset_token, new_password } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }

    // ==================== LOGIN ====================
    if (action === 'login') {
      if (!email || !password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Find investor
      const findUrl = `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`
      const findRes = await fetch(findUrl, { method: 'GET', headers })
      const investors = await findRes.json()

      if (!Array.isArray(investors) || investors.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid email or password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const investor = investors[0]
      const storedPassword = investor.password_hash || investor.password

      // Simple password check (supports both plain text and bcrypt)
      let validPassword = false
      if (storedPassword) {
        if (storedPassword.startsWith('$2')) {
          // bcrypt hash - use dynamic import
          try {
            const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
            validPassword = bcrypt.compareSync(password, storedPassword)
          } catch {
            validPassword = false
          }
        } else {
          // Legacy plain-text password: verify it, then upgrade to bcrypt in place so it is
          // never stored in plain text again (self-healing; best-effort, never blocks login).
          validPassword = password === storedPassword
          if (validPassword) {
            try {
              const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
              const upgraded = bcrypt.hashSync(password)
              await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                body: JSON.stringify({ password_hash: upgraded })
              })
            } catch { /* upgrade is best-effort; login still succeeds */ }
          }
        }
      }

      if (!validPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid email or password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create session
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const sessionDuration = remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      const sessionExpires = new Date(Date.now() + sessionDuration).toISOString()

      await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id: investor.id,
          session_token: sessionToken,
          is_active: true,
          remember_me: remember_me || false,
          expires_at: sessionExpires,
          created_at: new Date().toISOString()
        })
      })

      // RECOGNITION RUNS FIRST, BEFORE last_login IS OVERWRITTEN.
      //
      // The whole decision rests on how long they have been away, and that figure lives in
      // last_login. Stamping the new time first destroys the only evidence that this was a
      // return — every client would look like they signed in seconds ago.
      //
      // Best-effort: a client must never fail to sign in because a notification did not
      // fire. The failure is logged, not swallowed silently and not raised to them.
      try {
        const rec = await fetch(`${supabaseUrl}/rest/v1/rpc/ayp_client_signed_in`, {
          method: 'POST', headers,
          body: JSON.stringify({ p_investor_id: investor.id }),
        })
        if (!rec.ok) console.error('investor-login recognition_failed', rec.status)
      } catch (e) {
        console.error('investor-login recognition_threw', e instanceof Error ? e.message : String(e))
      }

      // Update last login
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_login: new Date().toISOString() })
      })

      return new Response(
        JSON.stringify({
          success: true,
          investor: {
            id: investor.id,
            email: investor.email,
            full_name: investor.full_name,
            phone: investor.phone,
            company_name: investor.company_name,
            referral_code: investor.referral_code,
            onboarding_completed: investor.onboarding_completed,
            sms_opt_in: investor.sms_opt_in,
            email_opt_in: investor.email_opt_in
          },
          session: {
            token: sessionToken,
            expires_at: sessionExpires
          },
          email_verified: investor.email_verified || false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==================== LOGOUT ====================
    if (action === 'logout') {
      if (session_token) {
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_active: false })
        })
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==================== FORGOT PASSWORD ====================
    if (action === 'forgot_password') {
      // Generic response used for every outcome so we never reveal whether an email exists.
      const genericOk = () => new Response(
        JSON.stringify({ success: true, message: 'If an account exists for that email, a password reset link is on its way.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

      try {
        if (!email) return genericOk()

        const findUrl = `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=id,email,full_name`
        const findRes = await fetch(findUrl, { method: 'GET', headers })
        const investors = await findRes.json()
        if (!Array.isArray(investors) || investors.length === 0) return genericOk()
        const investor = investors[0]

        // One-hour reset token, stored on the investor row.
        const token = crypto.randomUUID() + '-' + crypto.randomUUID()
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ reset_token: token, reset_token_expires: expires, updated_at: new Date().toISOString() })
        })

        const base = (typeof base_url === 'string' && base_url.startsWith('https://'))
          ? base_url.replace(/\/+$/, '')
          : 'https://accessyourplace.com'
        const resetLink = `${base}/investor/reset-password?token=${token}`
        const name = investor.full_name || 'there'

        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (resendKey) {
          const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;">` +
            `<p>Hi ${name},</p>` +
            `<p>We received a request to reset the password for your Access Your Place account.</p>` +
            `<p>Click the button below to choose a new password. This link is valid for one hour.</p>` +
            `<p><a href="${resetLink}" style="display:inline-block;background:#b07d4b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;">Reset my password</a></p>` +
            `<p>Or paste this link into your browser:<br><a href="${resetLink}">${resetLink}</a></p>` +
            `<p>If you didn't request this, you can safely ignore this email &mdash; your password won't change.</p>` +
            `<p>Warmly,<br>Access Your Place</p></div>`
          const text = `Hi ${name},\n\nWe received a request to reset the password for your Access Your Place account.\n\nOpen this link to choose a new password (valid for one hour):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email - your password won't change.\n\nWarmly,\nAccess Your Place`
          try {
            const sendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Access Your Place <noreply@accessyourplace.com>',
                to: [investor.email],
                reply_to: 'success@accessyourplace.com',
                subject: 'Reset your Access Your Place password',
                html,
                text
              })
            })
            if (!sendRes.ok) {
              console.error('forgot_password: reset email send failed', sendRes.status, await sendRes.text())
            }
          } catch (sendErr) {
            console.error('forgot_password: reset email send threw', sendErr)
          }
        } else {
          console.error('forgot_password: RESEND_API_KEY not configured; token stored but no email sent')
        }

        return genericOk()
      } catch (e) {
        console.error('forgot_password error:', e)
        return genericOk()
      }
    }

    // ==================== RESET PASSWORD ====================
    // ---- validate_token ------------------------------------------------------
    // InvestorResetPassword.tsx calls this on load to decide whether to show the form.
    // It was never implemented here — investor-login had forgot_password, login, logout,
    // reset_password and validate_session, and nothing else. So the call fell through,
    // the page treated the failure as a bad token, and a perfectly valid investor reset
    // link reported itself invalid. Identical to the bug just fixed on the staff side;
    // found by cross-checking every action the front end sends against what each auth
    // function actually implements.
    //
    // The token IS the secret, so confirming it to whoever holds it reveals nothing they
    // do not already have. Returns the name so the page can greet them.
    if (action === 'validate_token') {
      if (!reset_token) {
        return new Response(
          JSON.stringify({ success: true, valid: false, error: 'No token supplied.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const vUrl = `${supabaseUrl}/rest/v1/investors?reset_token=eq.${encodeURIComponent(String(reset_token))}&select=id,email,full_name,reset_token_expires,is_active&limit=1`
      const vRes = await fetch(vUrl, { method: 'GET', headers })
      if (!vRes.ok) {
        console.error('validate_token lookup failed', vRes.status)
        return new Response(
          JSON.stringify({ success: false, valid: false, error: 'We could not check that link right now. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const vRows = await vRes.json().catch(() => [])
      const inv = Array.isArray(vRows) ? vRows[0] : null
      if (!inv) {
        return new Response(
          JSON.stringify({ success: true, valid: false, error: 'This reset link is invalid or has already been used. Please request a new one.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (inv.is_active === false) {
        return new Response(
          JSON.stringify({ success: true, valid: false, error: 'This account is inactive. Please contact your acquisition manager.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (!inv.reset_token_expires || new Date(inv.reset_token_expires).getTime() < Date.now()) {
        return new Response(
          JSON.stringify({ success: true, valid: false, error: 'This reset link has expired. Please request a new one.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ success: true, valid: true, email: inv.email || '', name: inv.full_name || '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'reset_password') {
      if (!reset_token || !new_password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Reset token and new password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (String(new_password).length < 8) {
        return new Response(
          JSON.stringify({ success: false, error: 'Password must be at least 8 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const findUrl = `${supabaseUrl}/rest/v1/investors?reset_token=eq.${encodeURIComponent(String(reset_token))}&select=id,reset_token_expires`
      const findRes = await fetch(findUrl, { method: 'GET', headers })
      const rows = await findRes.json()
      if (!Array.isArray(rows) || rows.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'This reset link is invalid or has already been used. Please request a new one.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const inv = rows[0]
      if (!inv.reset_token_expires || new Date(inv.reset_token_expires).getTime() < Date.now()) {
        return new Response(
          JSON.stringify({ success: false, error: 'This reset link has expired. Please request a new one.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let newHash: string
      try {
        const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
        newHash = bcrypt.hashSync(String(new_password))
      } catch (e) {
        console.error('reset_password hashing error:', e)
        return new Response(
          JSON.stringify({ success: false, error: 'Could not process the new password. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${inv.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ password_hash: newHash, reset_token: null, reset_token_expires: null, updated_at: new Date().toISOString() })
      })

      return new Response(
        JSON.stringify({ success: true, message: 'Your password has been reset. You can now log in.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==================== VALIDATE SESSION ====================
    if (action === 'validate_session') {
      if (!session_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'No session token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const sessionUrl = `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=*,investors(*)`
      const sessionRes = await fetch(sessionUrl, { method: 'GET', headers })
      const sessions = await sessionRes.json()

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const session = sessions[0]
      if (new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Session expired' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const investor = session.investors

      return new Response(
        JSON.stringify({
          success: true,
          investor: {
            id: investor.id,
            email: investor.email,
            full_name: investor.full_name,
            referral_code: investor.referral_code,
            onboarding_completed: investor.onboarding_completed
          },
          session: {
            token: session.session_token,
            expires_at: session.expires_at
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
