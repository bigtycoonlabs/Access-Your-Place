# staff-login Edge Function

Complete staff authentication with login, password reset, investor account linking, and profile management.
Supports both bcrypt hashed passwords and legacy plain text passwords with auto-upgrade.

**Default Staff Credentials:**
- Email: hello@accessyourplace.com
- Password: VigVission55!

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to check if a string is a bcrypt hash
function isBcryptHash(str: string): boolean {
  return str && str.startsWith('$2') && str.length >= 50
}

// Helper to verify password (supports both hashed and plain text)
async function verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  if (isBcryptHash(storedPassword)) {
    return await bcrypt.compare(inputPassword, storedPassword)
  } else {
    return inputPassword === storedPassword
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, email, password, reset_token, new_password, staff_id, current_password, investor_email } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    // Forgot password - send reset email
    if (action === 'forgot_password') {
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email)}&select=id,email,first_name,last_name`, { headers })
      const users = await res.json()
      
      // Always return success to prevent email enumeration
      if (users?.length) {
        const token = crypto.randomUUID() + '-' + crypto.randomUUID()
        const expires = new Date(Date.now() + 3600000) // 1 hour
        
        await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${users[0].id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            reset_token: token,
            reset_token_expires: expires.toISOString()
          })
        })
        
        const resetUrl = `https://accessyourplace.com/staff/reset-password?token=${token}`
        const userName = users[0].first_name || 'Staff Member'
        
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [email],
              subject: 'Reset Your Staff Password',
              html: `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
                <div style="background:#1e293b;padding:20px;text-align:center;">
                  <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
                  <p style="color:#94a3b8;margin:5px 0 0;">Staff Portal</p>
                </div>
                <div style="padding:30px;background:#f8fafc;">
                  <p>Hi ${userName},</p>
                  <p>We received a request to reset your staff account password. Click the button below to create a new password:</p>
                  <p style="text-align:center;margin:30px 0;">
                    <a href="${resetUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a>
                  </p>
                  <p style="color:#64748b;font-size:12px;">This link expires in 1 hour. If you didn't request this, please contact your administrator.</p>
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
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?reset_token=eq.${reset_token}&select=id,email,first_name,last_name,reset_token_expires`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ valid: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (new Date(users[0].reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: 'Token expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({
        valid: true,
        email: users[0].email,
        name: `${users[0].first_name || ''} ${users[0].last_name || ''}`.trim()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Reset password with token
    if (action === 'reset_password') {
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?reset_token=eq.${reset_token}&select=id,reset_token_expires`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (new Date(users[0].reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const hash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${users[0].id}`, {
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
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}&select=id,password_hash`, { headers })
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
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: hash,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Link investor account
    if (action === 'link_investor_account') {
      // Find investor by email
      const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(investor_email)}&select=id,full_name,email,company_name,phone`, { headers })
      const investors = await invRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ success: false, error: 'No investor found with that email' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      // Update staff user with linked investor
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          linked_investor_id: investor.id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        investor_id: investor.id,
        investor: {
          id: investor.id,
          full_name: investor.full_name,
          email: investor.email,
          company_name: investor.company_name,
          phone: investor.phone
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Unlink investor account
    if (action === 'unlink_investor_account') {
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          linked_investor_id: null,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get linked investor details (returns full investor data for portal switching)
    if (action === 'get_linked_investor') {
      const staffRes = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}&select=linked_investor_id`, { headers })
      const staffUsers = await staffRes.json()
      
      if (!staffUsers?.length || !staffUsers[0].linked_investor_id) {
        return new Response(JSON.stringify({ success: true, investor: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Fetch full investor data for portal switching
      const invRes = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${staffUsers[0].linked_investor_id}&select=*`, { headers })
      const investors = await invRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ success: true, investor: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const inv = investors[0]
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: inv.id,
          email: inv.email,
          full_name: inv.full_name,
          phone: inv.phone,
          company_name: inv.company_name,
          portfolio_count: inv.portfolio_count,
          investment_budget_min: inv.investment_budget_min,
          investment_budget_max: inv.investment_budget_max,
          preferred_markets: inv.preferred_markets,
          preferred_operation_types: inv.preferred_operation_types,
          referral_code: inv.referral_code,
          onboarding_completed: inv.onboarding_completed,
          sms_opt_in: inv.sms_opt_in,
          email_opt_in: inv.email_opt_in
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }


    // Validate invitation token
    if (action === 'validate_invitation') {
      const { invitation_token } = body
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?invitation_token=eq.${invitation_token}&select=id,email,first_name,last_name,department,invitation_expires`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ valid: false, error: 'Invalid invitation' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (users[0].invitation_expires && new Date(users[0].invitation_expires) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: 'Invitation expired' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({
        valid: true,
        email: users[0].email,
        first_name: users[0].first_name,
        last_name: users[0].last_name,
        department: users[0].department
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Complete invitation
    if (action === 'complete_invitation') {
      const { invitation_token, phone, whatsapp_number } = body
      const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?invitation_token=eq.${invitation_token}&select=id`, { headers })
      const users = await res.json()
      
      if (!users?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid invitation' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const hash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${users[0].id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: hash,
          phone: phone || null,
          whatsapp_number: whatsapp_number || null,
          invitation_token: null,
          invitation_expires: null,
          account_completed: true,
          is_active: true,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Default: Login
    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Email and password required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`, { headers })
    const users = await res.json()
    
    if (!users?.length) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const user = users[0]
    const storedPassword = user.password_hash || user.password
    
    if (!storedPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Account not set up. Please check your invitation email or use forgot password.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const valid = await verifyPassword(password, storedPassword)
    
    if (!valid) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // Auto-upgrade plain text password to hashed
    if (!isBcryptHash(storedPassword)) {
      const newHash = await bcrypt.hash(password)
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ password_hash: newHash, updated_at: new Date().toISOString() })
      })
    }
    
    // Update last login
    await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ last_login: new Date().toISOString() })
    })
    
    // Get permissions based on department
    let permissions = user.permissions || []
    if (user.department === 'success_managers') {
      permissions = ['all']
    } else if (user.department === 'acquisition_managers') {
      permissions = ['deals', 'acquisitions', 'investors', 'crm', 'inquiries', 'marketplace']
    } else if (user.department === 'setup_managers') {
      permissions = ['deals', 'setups', 'investors', 'crm']
    }
    
    return new Response(JSON.stringify({
      success: true,
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      team: user.team || user.department,
      role: user.role,
      department: user.department,
      permissions,
      linked_investor_id: user.linked_investor_id
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

## Key Features

1. **Password Security**: Uses bcrypt for secure password hashing
2. **Legacy Support**: Automatically detects and upgrades plain text passwords to bcrypt hashes on login
3. **Password Reset**: Secure token-based password reset with 1-hour expiration
4. **Investor Linking**: Staff can link their account to an investor account for easy switching
5. **Invitation System**: New staff can complete their account setup via invitation link

## Required Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `RESEND_API_KEY` - Resend API key for sending emails (optional but recommended)

## Database Requirements

The `staff_users` table must have these columns:
- `id` (uuid, primary key)
- `email` (text, unique)
- `password_hash` (text)
- `first_name` (text)
- `last_name` (text)
- `phone` (text, nullable)
- `whatsapp_number` (text, nullable)
- `department` (text)
- `role` (text)
- `team` (text, nullable)
- `permissions` (text[], nullable)
- `is_active` (boolean, default true)
- `account_completed` (boolean, default false)
- `reset_token` (text, nullable)
- `reset_token_expires` (timestamptz, nullable)
- `invitation_token` (text, nullable)
- `invitation_expires` (timestamptz, nullable)
- `linked_investor_id` (uuid, nullable, references investors.id)
- `last_login` (timestamptz, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Setup Instructions

1. Create the staff_users table (see DATABASE_SCHEMA.sql)
2. Deploy this edge function to Supabase
3. Insert a default admin user with a bcrypt-hashed password

To generate a bcrypt hash for the default password:
```javascript
// In Deno or Node.js with bcrypt
const hash = await bcrypt.hash('VigVission55!')
// Result: $2a$10$... (use this in your INSERT statement)
```
