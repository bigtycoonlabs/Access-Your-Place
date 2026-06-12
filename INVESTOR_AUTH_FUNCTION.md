# investor-auth Edge Function

Complete investor authentication with registration, login, profile updates, password reset, and staff account linking.
Supports both bcrypt hashed passwords and legacy plain text passwords with auto-upgrade.

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

// Helper to check if a string is a bcrypt hash
function isBcryptHash(str: string): boolean {
  return str && str.startsWith('$2') && str.length >= 50
}

// Helper to verify password (supports both hashed and plain text)
async function verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  if (isBcryptHash(storedPassword)) {
    // It's a bcrypt hash, compare properly
    return await bcrypt.compare(inputPassword, storedPassword)
  } else {
    // It's plain text (legacy), do direct comparison
    return inputPassword === storedPassword
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    // Register new investor
    if (action === 'register') {
      const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code } = body
      
      // Check if email already exists
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email)}&select=id`, { headers })
      const existing = await checkRes.json()
      if (existing?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Email already exists' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const hash = await bcrypt.hash(password)
      const myRefCode = 'AYP' + Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          email,
          password_hash: hash,
          full_name,
          phone,
          sms_opt_in: sms_opt_in || false,
          email_opt_in: email_opt_in !== false,
          referred_by: referral_code || null,
          referral_code: myRefCode,
          onboarding_completed: false
        })
      })
      const data = await res.json()
      
      if (data?.code || data?.message) {
        return new Response(JSON.stringify({ success: false, error: data.message || 'Registration failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const inv = data[0] || data
      
      // Send welcome email
      if (resendKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [email],
              subject: 'Welcome to Access Your Place!',
              html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
                <div style="background:#1e293b;padding:20px;text-align:center;">
                  <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
                </div>
                <div style="padding:30px;background:#f8fafc;">
                  <p>Hi ${full_name},</p>
                  <p>Welcome to Access Your Place! Your investor account has been created.</p>
                  <p>Your referral code is: <strong>${myRefCode}</strong></p>
                  <p style="text-align:center;margin:30px 0;">
                    <a href="https://accessyourplace.com/investor/portal" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">Go to Portal</a>
                  </p>
                </div>
              </div>`
            })
          })
        } catch (e) { console.error('Email error:', e) }
      }
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: inv.id,
          email: inv.email,
          full_name: inv.full_name,
          referral_code: inv.referral_code,
          onboarding_completed: false
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Login
    if (action === 'login') {
      const { email, password } = body
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email)}&select=*`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const user = users[0]
      const storedPassword = user.password_hash || user.password
      
      if (!storedPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Account not set up. Please use forgot password.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const valid = await verifyPassword(password, storedPassword)
      
      if (!valid) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Auto-upgrade plain text password to hashed
      if (!isBcryptHash(storedPassword)) {
        const newHash = await bcrypt.hash(password)
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${user.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ password_hash: newHash, updated_at: new Date().toISOString() })
        })
      }
      
      // Update last login
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_login: new Date().toISOString() })
      })
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          company_name: user.company_name,
          portfolio_count: user.portfolio_count,
          investment_budget_min: user.investment_budget_min,
          investment_budget_max: user.investment_budget_max,
          preferred_markets: user.preferred_markets,
          preferred_operation_types: user.preferred_operation_types,
          referral_code: user.referral_code,
          onboarding_completed: user.onboarding_completed,
          sms_opt_in: user.sms_opt_in,
          email_opt_in: user.email_opt_in,
          linked_staff_id: user.linked_staff_id // Include linked staff ID for account switching
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get linked staff account (for investors who are also staff members)
    if (action === 'get_linked_staff') {
      const { investor_id } = body
      
      // First get the investor's linked_staff_id
      const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=linked_staff_id`, { headers })
      const investors = await invRes.json()
      
      if (!investors?.length || !investors[0].linked_staff_id) {
        return new Response(JSON.stringify({ staff_id: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({ 
        staff_id: investors[0].linked_staff_id 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Switch to staff account (for investors who are also staff members)
    if (action === 'switch_to_staff') {
      const { investor_id } = body
      
      // Get investor's linked staff ID
      const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=linked_staff_id`, { headers })
      const investors = await invRes.json()
      
      if (!investors?.length || !investors[0].linked_staff_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No linked staff account found' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const staffId = investors[0].linked_staff_id
      
      // Fetch full staff data
      const staffRes = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staffId}&select=*`, { headers })
      const staffUsers = await staffRes.json()
      
      if (!staffUsers?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Staff account not found' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const staff = staffUsers[0]
      
      // Update staff last login
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staffId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_login: new Date().toISOString() })
      })
      
      return new Response(JSON.stringify({
        success: true,
        staff: {
          id: staff.id,
          email: staff.email,
          first_name: staff.first_name,
          last_name: staff.last_name,
          name: staff.first_name ? `${staff.first_name} ${staff.last_name || ''}`.trim() : staff.email,
          team: staff.team,
          role: staff.role,
          department: staff.department,
          permissions: staff.permissions || ['all'],
          linked_investor_id: investor_id
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Update profile
    if (action === 'update_profile') {
      const { investor_id, ...updates } = body
      delete updates.action
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
      })
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=*`, { headers })
      const u = (await res.json())[0]
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone: u.phone,
          company_name: u.company_name,
          portfolio_count: u.portfolio_count,
          investment_budget_min: u.investment_budget_min,
          investment_budget_max: u.investment_budget_max,
          preferred_markets: u.preferred_markets,
          preferred_operation_types: u.preferred_operation_types,
          referral_code: u.referral_code,
          onboarding_completed: u.onboarding_completed,
          linked_staff_id: u.linked_staff_id
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Forgot password
    if (action === 'forgot_password') {
      const { email, base_url } = body
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email)}&select=id,email,full_name`, { headers })
      const users = await res.json()
      
      // Always return success to prevent email enumeration
      if (users?.length) {
        const token = crypto.randomUUID() + '-' + crypto.randomUUID()
        const expires = new Date(Date.now() + 3600000) // 1 hour
        
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${users[0].id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            reset_token: token,
            reset_token_expires: expires.toISOString()
          })
        })
        
        const resetUrl = `${base_url || 'https://accessyourplace.com'}/investor/reset-password?token=${token}`
        
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [email],
              subject: 'Reset Your Password',
              html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
                <div style="background:#1e293b;padding:20px;text-align:center;">
                  <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
                </div>
                <div style="padding:30px;background:#f8fafc;">
                  <p>Hi ${users[0].full_name},</p>
                  <p>We received a request to reset your password. Click the button below to create a new password:</p>
                  <p style="text-align:center;margin:30px 0;">
                    <a href="${resetUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a>
                  </p>
                  <p style="color:#64748b;font-size:12px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                </div>
              </div>`
            })
          })
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate reset token
    if (action === 'validate_token') {
      const { reset_token } = body
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?reset_token=eq.${reset_token}&select=id,email,full_name,reset_token_expires`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (new Date(users[0].reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: 'Token expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({ valid: true, email: users[0].email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Reset password
    if (action === 'reset_password') {
      const { reset_token, new_password } = body
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?reset_token=eq.${reset_token}&select=id,reset_token_expires`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (new Date(users[0].reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const hash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${users[0].id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: hash,
          reset_token: null,
          reset_token_expires: null,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Change password (for authenticated users)
    if (action === 'change_password') {
      const { investor_id, current_password, new_password } = body
      
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=id,password_hash`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const storedPassword = users[0].password_hash
      const valid = await verifyPassword(current_password, storedPassword)
      
      if (!valid) {
        return new Response(JSON.stringify({ success: false, error: 'Current password is incorrect' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const hash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: hash,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // List investors (for admin)
    if (action === 'list') {
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?select=id,email,full_name,phone,company_name,created_at,last_login,onboarding_completed&order=created_at.desc`, { headers })
      const investors = await res.json()
      return new Response(JSON.stringify({ success: true, investors }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

## Key Features

1. **Password Security**: Uses bcrypt for secure password hashing
2. **Legacy Support**: Automatically detects and upgrades plain text passwords to bcrypt hashes on login
3. **Password Reset**: Secure token-based password reset with 1-hour expiration
4. **Email Notifications**: Sends welcome and password reset emails via Resend API
5. **Staff Account Linking**: Supports linking investor accounts to staff accounts for dual-role users

## New Actions for Staff/Investor Account Switching

### `get_linked_staff`
Returns the linked staff ID for an investor account.

**Request:**
```json
{
  "action": "get_linked_staff",
  "investor_id": "uuid"
}
```

**Response:**
```json
{
  "staff_id": "uuid" // or null if no linked staff account
}
```

### `switch_to_staff`
Switches from investor to staff account, returning full staff session data.

**Request:**
```json
{
  "action": "switch_to_staff",
  "investor_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "staff": {
    "id": "uuid",
    "email": "staff@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "name": "John Doe",
    "team": "acquisition",
    "role": "manager",
    "department": "acquisition_managers",
    "permissions": ["all"],
    "linked_investor_id": "uuid"
  }
}
```

## Required Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `RESEND_API_KEY` - Resend API key for sending emails

## Database Requirements

The `investors` table must have these columns:
- `id` (uuid, primary key)
- `email` (text, unique)
- `password_hash` (text)
- `full_name` (text)
- `phone` (text, nullable)
- `reset_token` (text, nullable)
- `reset_token_expires` (timestamptz, nullable)
- `referral_code` (text)
- `onboarding_completed` (boolean)
- `last_login` (timestamptz, nullable)
- `linked_staff_id` (uuid, nullable, references staff_users.id)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

The `staff_users` table must have:
- `linked_investor_id` (uuid, nullable, references investors.id)
