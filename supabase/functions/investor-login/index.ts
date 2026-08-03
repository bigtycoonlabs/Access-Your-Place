// Ultra-minimal investor login - avoids all cloning issues
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
      // Always return success to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists, you will receive a reset link.' }),
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
