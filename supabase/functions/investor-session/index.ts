import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Simple response helper
function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const dbHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }

  try {
    const body = await req.json()
    const { action } = body

    // ==================== REGISTER ====================
    if (action === 'register') {
      const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code } = body

      if (!email || !password || !full_name) {
        return jsonResponse({ success: false, error: 'Email, password, and name are required' }, 400)
      }

      // Check existing
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
        { headers: dbHeaders }
      )
      const existing = await checkRes.json()

      if (Array.isArray(existing) && existing.length > 0) {
        return jsonResponse({ success: false, error: 'Email already registered' }, 400)
      }

      // Create investor
      const refCode = 'AYP' + Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const createRes = await fetch(`${supabaseUrl}/rest/v1/investors`, {
        method: 'POST',
        headers: dbHeaders,
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password_hash: password,
          full_name: full_name.trim(),
          phone: phone || null,
          sms_opt_in: sms_opt_in || false,
          email_opt_in: email_opt_in !== false,
          referred_by: referral_code || null,
          referral_code: refCode,
          onboarding_completed: false,
          email_verified: false,
          created_at: new Date().toISOString()
        })
      })

      const investors = await createRes.json()
      
      if (!Array.isArray(investors) || !investors[0]?.id) {
        console.error('Create failed:', investors)
        return jsonResponse({ success: false, error: 'Registration failed' }, 500)
      }

      const investor = investors[0]

      // Create session
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
        method: 'POST',
        headers: dbHeaders,
        body: JSON.stringify({
          investor_id: investor.id,
          session_token: sessionToken,
          is_active: true,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })
      })

      return jsonResponse({
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          referral_code: investor.referral_code,
          onboarding_completed: false
        },
        session: { token: sessionToken, expires_at: expiresAt },
        email_verified: false,
        message: 'Account created!'
      })
    }

    // ==================== LOGIN ====================
    if (action === 'login') {
      const { email, password, remember_me } = body

      if (!email || !password) {
        return jsonResponse({ success: false, error: 'Email and password required' }, 400)
      }

      // Find investor
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
        { headers: dbHeaders }
      )
      const investors = await findRes.json()

      if (!Array.isArray(investors) || investors.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid credentials' }, 401)
      }

      const investor = investors[0]
      const storedPwd = investor.password_hash || investor.password

      // Verify password
      let valid = false
      if (storedPwd) {
        if (storedPwd.startsWith('$2')) {
          try {
            const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
            valid = bcrypt.compareSync(password, storedPwd)
          } catch { valid = false }
        } else {
          valid = password === storedPwd
        }
      }

      if (!valid) {
        return jsonResponse({ success: false, error: 'Invalid credentials' }, 401)
      }

      // Create session
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const duration = remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      const expiresAt = new Date(Date.now() + duration).toISOString()

      await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
        method: 'POST',
        headers: dbHeaders,
        body: JSON.stringify({
          investor_id: investor.id,
          session_token: sessionToken,
          is_active: true,
          remember_me: remember_me || false,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })
      })

      // Update last login
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ last_login: new Date().toISOString() })
      })

      return jsonResponse({
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
        session: { token: sessionToken, expires_at: expiresAt },
        email_verified: investor.email_verified || false
      })
    }

    // ==================== VALIDATE SESSION ====================
    if (action === 'validate_session') {
      const { session_token } = body

      if (!session_token) {
        return jsonResponse({ success: false, error: 'No token' }, 400)
      }

      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=*,investors(*)`,
        { headers: dbHeaders }
      )
      const sessions = await sessionRes.json()

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid session' }, 401)
      }

      const session = sessions[0]
      
      if (new Date(session.expires_at) < new Date()) {
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
          method: 'PATCH',
          headers: dbHeaders,
          body: JSON.stringify({ is_active: false })
        })
        return jsonResponse({ success: false, error: 'Session expired' }, 401)
      }

      // Update activity
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ last_activity: new Date().toISOString() })
      })

      const investor = session.investors

      return jsonResponse({
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
          email_opt_in: investor.email_opt_in,
          show_guided_tour: investor.show_guided_tour
        },
        session: { token: session.session_token, expires_at: session.expires_at },
        email_verified: investor.email_verified || false
      })
    }

    // ==================== REFRESH SESSION ====================
    if (action === 'refresh_session') {
      const { session_token } = body

      if (!session_token) {
        return jsonResponse({ success: false, error: 'No token' }, 400)
      }

      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=*`,
        { headers: dbHeaders }
      )
      const sessions = await sessionRes.json()

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid session' }, 401)
      }

      const session = sessions[0]
      const newExpiry = session.remember_me
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)

      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({
          expires_at: newExpiry.toISOString(),
          last_activity: new Date().toISOString()
        })
      })

      return jsonResponse({
        success: true,
        session: { token: session.session_token, expires_at: newExpiry.toISOString() }
      })
    }

    // ==================== LOGOUT ====================
    if (action === 'logout') {
      const { session_token } = body

      if (session_token) {
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}`, {
          method: 'PATCH',
          headers: dbHeaders,
          body: JSON.stringify({ is_active: false })
        })
      }

      return jsonResponse({ success: true })
    }

    // ==================== LOGOUT ALL ====================
    if (action === 'logout_all') {
      const { session_token } = body

      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&select=investor_id`,
        { headers: dbHeaders }
      )
      const sessions = await sessionRes.json()

      if (Array.isArray(sessions) && sessions.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?investor_id=eq.${sessions[0].investor_id}`, {
          method: 'PATCH',
          headers: dbHeaders,
          body: JSON.stringify({ is_active: false })
        })
      }

      return jsonResponse({ success: true })
    }

    // ==================== UPDATE PROFILE ====================
    if (action === 'update_profile') {
      const { session_token, ...updates } = body
      delete updates.action

      // Validate session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers: dbHeaders }
      )
      const sessions = await sessionRes.json()

      if (!Array.isArray(sessions) || sessions.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid session' }, 401)
      }

      const investorId = sessions[0].investor_id

      // Remove sensitive fields
      delete updates.password_hash
      delete updates.email
      delete updates.reset_token

      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
      })

      // Fetch updated
      const investorRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=*`,
        { headers: dbHeaders }
      )
      const investors = await investorRes.json()
      const investor = investors[0]

      return jsonResponse({
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
          email_opt_in: investor.email_opt_in,
          show_guided_tour: investor.show_guided_tour
        }
      })
    }

    // ==================== VERIFY EMAIL ====================
    if (action === 'verify_email') {
      const { verification_token } = body

      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email_verification_token=eq.${verification_token}&select=id,email,full_name,email_verification_expires`,
        { headers: dbHeaders }
      )
      const investors = await findRes.json()

      if (!Array.isArray(investors) || investors.length === 0) {
        return jsonResponse({ success: false, error: 'Invalid token' }, 400)
      }

      const investor = investors[0]

      if (new Date(investor.email_verification_expires) < new Date()) {
        return jsonResponse({ success: false, error: 'Token expired' }, 400)
      }

      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null
        })
      })

      return jsonResponse({
        success: true,
        email: investor.email,
        message: 'Email verified!'
      })
    }

    // ==================== FORGOT PASSWORD ====================
    if (action === 'forgot_password') {
      // Always return success to prevent enumeration
      return jsonResponse({
        success: true,
        message: 'If an account exists, you will receive a reset link.'
      })
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400)

  } catch (error) {
    console.error('Error:', error)
    return jsonResponse({ success: false, error: 'Server error' }, 500)
  }
})
