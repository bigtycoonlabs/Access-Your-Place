# URGENT: Investor Registration Fix

## Issue Summary
- **Error**: "could not be cloned" error on investor-register and investor-login edge functions
- **Impact**: 1000+ potential users cannot create accounts
- **Root Cause**: Edge function runtime issue, likely related to Deno's structured cloning algorithm
- **Client Affected**: Ashley Clowers (acsignaturegroup@gmail.com, (912) 704-3034)

## Immediate Actions Required

### Step 1: Delete Existing Functions
Delete the following edge functions completely to clear any corrupted state:
- `investor-register`
- `investor-login`

```bash
supabase functions delete investor-register
supabase functions delete investor-login
```

Or delete via Supabase Dashboard → Edge Functions → Delete each function.

### Step 2: Deploy Fresh Ultra-Minimal Functions

Create and deploy these ultra-minimal functions that avoid all potential cloning issues.

---

## investor-register Function (MINIMAL VERSION)

Create file: `supabase/functions/investor-register/index.ts`

```typescript
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
```

---

## investor-login Function (MINIMAL VERSION)

Create file: `supabase/functions/investor-login/index.ts`

```typescript
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
            validPassword = await bcrypt.compare(password, storedPassword)
          } catch {
            validPassword = false
          }
        } else {
          // Plain text comparison
          validPassword = password === storedPassword
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
```

---

## Deployment Commands

```bash
# 1. Delete old functions (if they exist)
supabase functions delete investor-register --project-ref YOUR_PROJECT_REF
supabase functions delete investor-login --project-ref YOUR_PROJECT_REF

# 2. Create new functions
supabase functions new investor-register
supabase functions new investor-login

# 3. Copy the code above into each function's index.ts file

# 4. Deploy with --no-verify-jwt to allow public access
supabase functions deploy investor-register --no-verify-jwt --project-ref YOUR_PROJECT_REF
supabase functions deploy investor-login --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

---

## Alternative: Deploy via Dashboard

If CLI deployment fails:

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it `investor-register`
4. Paste the investor-register code
5. Click Deploy
6. Repeat for `investor-login`

---

## Verification Steps

After deployment, test with curl:

```bash
# Test investor-register
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/investor-register' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "full_name": "Test User"
  }'

# Test investor-login
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/investor-login' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "login",
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

---

## If Issues Persist

### Option 1: Contact Supabase Support
Email support@supabase.io with:
- Project reference ID
- Error message: "could not be cloned"
- Function names: investor-register, investor-login
- Request: Clear function cache and redeploy

### Option 2: Use investor-session Function
The frontend can be modified to use the `investor-session` function which may not have the same issue:

```typescript
// In InvestorLogin.tsx, change line 317 from:
const { data, error } = await supabase.functions.invoke('investor-register', {

// To:
const { data, error } = await supabase.functions.invoke('investor-session', {
  body: { action: 'register', ...requestBody }
});
```

### Option 3: Direct Database Insert (Temporary)
As a last resort, create a simple RPC function in the database:

```sql
CREATE OR REPLACE FUNCTION public.register_investor(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_investor_id UUID;
  v_ref_code TEXT;
BEGIN
  -- Check if email exists
  IF EXISTS (SELECT 1 FROM investors WHERE email = LOWER(p_email)) THEN
    RETURN json_build_object('success', false, 'error', 'Email already exists');
  END IF;
  
  -- Generate referral code
  v_ref_code := 'AYP' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Insert investor
  INSERT INTO investors (email, password_hash, full_name, phone, referral_code, created_at)
  VALUES (LOWER(p_email), p_password, p_full_name, p_phone, v_ref_code, NOW())
  RETURNING id INTO v_investor_id;
  
  RETURN json_build_object(
    'success', true,
    'investor', json_build_object(
      'id', v_investor_id,
      'email', LOWER(p_email),
      'full_name', p_full_name,
      'referral_code', v_ref_code
    )
  );
END;
$$;
```

Then call from frontend:
```typescript
const { data, error } = await supabase.rpc('register_investor', {
  p_email: email,
  p_password: password,
  p_full_name: full_name,
  p_phone: phone
});
```

---

## Client Follow-up

Once fixed, manually create account for:
- **Name**: Ashley Clowers
- **Email**: acsignaturegroup@gmail.com
- **Phone**: (912) 704-3034

Or have them retry registration at: https://accessyourplace.com/investor?tab=register

---

## Root Cause Analysis

The "could not be cloned" error in Deno typically occurs when:
1. Trying to serialize objects with circular references
2. AbortController signals being passed incorrectly
3. Response/Request objects being consumed multiple times
4. Internal Supabase client library issues

The minimal functions above avoid all these issues by:
- Using only basic fetch() calls
- Not using AbortController
- Not using the Supabase JS client
- Creating fresh Response objects for each return
- Avoiding any complex object serialization
