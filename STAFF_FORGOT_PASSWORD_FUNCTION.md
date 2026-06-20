# staff-forgot-password Edge Function

Sends password reset emails to staff users via Resend.

**Requirements:**
- RESEND_API_KEY must be set in Supabase Edge Function secrets
- Domain accessyourplace.com must be verified in Resend dashboard
- staff_users table must have reset_token and reset_token_expires columns

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, base_url } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    // Find user
    const res = await fetch(`${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=id,email,name`, { headers })
    const users = await res.json()
    
    // Always return success to prevent email enumeration
    if (!users?.length) {
      return new Response(JSON.stringify({ success: true, message: 'If this email exists, a reset link will be sent.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const user = users[0]
    
    // Generate reset token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID()
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save token to database
    await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${user.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ reset_token: token, reset_token_expires: expires.toISOString() })
    })

    // Build reset URL
    const resetUrl = `${base_url}/staff/reset-password?token=${token}`

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Access Your Place <noreply@accessyourplace.com>',
        to: [user.email],
        subject: 'Reset Your Staff Portal Password',
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="color:#f59e0b;margin:0;font-size:28px;">Access Your Place</h1><p style="color:#94a3b8;margin:10px 0 0;">Staff Portal</p></div><div style="background:#f8fafc;padding:30px;border-radius:0 0 12px 12px;"><h2 style="color:#1e293b;margin-top:0;">Password Reset Request</h2><p style="color:#475569;">Hi ${user.name},</p><p style="color:#475569;">We received a request to reset your password. Click the button below to set a new password:</p><div style="text-align:center;margin:30px 0;"><a href="${resetUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Reset Password</a></div><p style="color:#64748b;font-size:14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"><p style="color:#94a3b8;font-size:12px;text-align:center;">Access Your Place - Staff Portal</p></div></body></html>`
      })
    })

    // Log email
    await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
      method: 'POST', headers,
      body: JSON.stringify({ template_type: 'staff_password_reset', recipient_email: user.email, subject: 'Reset Your Staff Portal Password', status: emailRes.ok ? 'sent' : 'failed' })
    })

    return new Response(JSON.stringify({ success: true, message: 'If this email exists, a reset link will be sent.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

## Troubleshooting

If emails are not being sent:
1. Check RESEND_API_KEY is set in Supabase Dashboard > Edge Functions > Secrets
2. Verify accessyourplace.com domain is verified in Resend dashboard
3. Check email_logs table for status and error messages
4. Test with Resend's test endpoint first
