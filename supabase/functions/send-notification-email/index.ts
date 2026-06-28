import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, data, test_email } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')!

    // Get template from database
    const res = await fetch(
      `${supabaseUrl}/rest/v1/email_templates?template_type=eq.${type}&is_active=eq.true&select=*`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const templates = await res.json()
    
    if (!templates?.length) {
      return new Response(JSON.stringify({ success: false, error: 'Template not found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const template = templates[0]
    
    // Replace variables in template
    let html = template.html_template
    let subject = template.subject_template
    
    for (const [key, value] of Object.entries(data || {})) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }

    // Wrap in branded template
    const brandedHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;">Access Your Place</h1>
    </div>
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      ${html}
    </div>
    <div style="text-align:center;padding:20px;color:#64748b;font-size:12px;">
      <p>Access Your Place - Rental Arbitrage Experts</p>
      <p><a href="https://accessyourplace.com" style="color:#f59e0b;">accessyourplace.com</a></p>
    </div>
  </div>
</body>
</html>`

    // Determine recipient
    const recipient = test_email || data.investor_email || data.email

    if (!recipient) {
      return new Response(JSON.stringify({ success: false, error: 'No recipient email' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Access Your Place <noreply@accessyourplace.com>',
        to: [recipient],
        subject: subject,
        html: brandedHtml
      })
    })

    const emailResult = await emailRes.json()

    // Log email
    await fetch(`${supabaseUrl}/rest/v1/email_logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        template_type: type,
        recipient_email: recipient,
        subject: subject,
        status: emailRes.ok ? 'sent' : 'failed',
        error_message: emailRes.ok ? null : JSON.stringify(emailResult)
      })
    })

    return new Response(JSON.stringify({ success: emailRes.ok, message_id: emailResult.id }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
