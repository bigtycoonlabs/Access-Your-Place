// Ultra-minimal investor registration - avoids all cloning issues
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
    // Parse request body
    const body = await req.json()
    const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code } = body

    // Validate required fields
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, password, and full name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables')
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

    // Check if email already exists
    const checkUrl = `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`
    const checkRes = await fetch(checkUrl, { method: 'GET', headers })
    const existing = await checkRes.json()

    if (Array.isArray(existing) && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'An account with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate referral code
    const myRefCode = 'AYP' + Math.random().toString(36).substring(2, 8).toUpperCase()

    // Create investor record (store password as plain text temporarily - will be hashed on first login)
    const investorData = {
      email: email.toLowerCase().trim(),
      password_hash: password, // Will be upgraded to bcrypt on first login
      full_name: full_name.trim(),
      phone: phone || null,
      sms_opt_in: sms_opt_in || false,
      email_opt_in: email_opt_in !== false,
      referred_by: referral_code || null,
      referral_code: myRefCode,
      onboarding_completed: false,
      email_verified: false,
      created_at: new Date().toISOString()
    }

    const createUrl = `${supabaseUrl}/rest/v1/investors`
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(investorData)
    })

    const createData = await createRes.json()

    // Check for errors
    if (createData?.code || createData?.message) {
      console.error('Database error:', createData)
      return new Response(
        JSON.stringify({ success: false, error: createData.message || 'Registration failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const investor = Array.isArray(createData) ? createData[0] : createData

    if (!investor?.id) {
      console.error('No investor ID returned:', createData)
      return new Response(
        JSON.stringify({ success: false, error: 'Registration failed - no ID returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate simple session token
    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID()
    const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Create session
    const sessionUrl = `${supabaseUrl}/rest/v1/investor_sessions`
    await fetch(sessionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        investor_id: investor.id,
        session_token: sessionToken,
        is_active: true,
        expires_at: sessionExpires,
        created_at: new Date().toISOString()
      })
    })

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          referral_code: investor.referral_code,
          onboarding_completed: false
        },
        session: {
          token: sessionToken,
          expires_at: sessionExpires
        },
        email_verified: false,
        message: 'Account created successfully!'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
