import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action } = body
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const headers = { 
      'apikey': supabaseKey, 
      'Authorization': `Bearer ${supabaseKey}`, 
      'Content-Type': 'application/json' 
    }

    // ==================== GET ALERTS ====================
    if (action === 'get_alerts') {
      const { investor_id } = body
      
      if (!investor_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Investor ID is required' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const alertsRes = await fetch(
        `${supabaseUrl}/rest/v1/security_alerts?investor_id=eq.${investor_id}&select=*&order=created_at.desc&limit=50`,
        { headers }
      )
      const alerts = await alertsRes.json()
      
      return new Response(JSON.stringify({
        success: true,
        alerts: alerts || []
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== UPDATE SETTINGS ====================
    if (action === 'update_settings') {
      const { investor_id, security_alerts_enabled } = body
      
      if (!investor_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Investor ID is required' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          security_alerts_enabled,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: security_alerts_enabled 
          ? 'Security alerts enabled' 
          : 'Security alerts disabled'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== CLEAR KNOWN DEVICES ====================
    if (action === 'clear_known_devices') {
      const { investor_id } = body
      
      if (!investor_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Investor ID is required' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          known_devices: [],
          known_ips: [],
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Known devices and locations cleared. You will receive alerts on your next login.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== ACKNOWLEDGE ALERT ====================
    if (action === 'acknowledge_alert') {
      const { alert_id } = body
      
      if (!alert_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Alert ID is required' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      await fetch(`${supabaseUrl}/rest/v1/security_alerts?id=eq.${alert_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Alert acknowledged'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== CREATE ALERT ====================
    if (action === 'create_alert') {
      const { investor_id, alert_type, severity, title, description, device_info, ip_address, location } = body
      
      if (!investor_id || !alert_type || !title) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Check if investor has security alerts enabled
      const investorRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=email,full_name,security_alerts_enabled`,
        { headers }
      )
      const investors = await investorRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Investor not found' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      // Create the alert
      const alertRes = await fetch(`${supabaseUrl}/rest/v1/security_alerts`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          investor_id,
          alert_type,
          severity: severity || 'medium',
          title,
          description,
          device_info: device_info || {},
          ip_address,
          location,
          is_acknowledged: false
        })
      })
      
      const alertData = await alertRes.json()
      
      // Send email if alerts are enabled
      if (investor.security_alerts_enabled) {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        
        if (resendKey) {
          const severityColors: Record<string, { bg: string; text: string }> = {
            high: { bg: '#fef2f2', text: '#991b1b' },
            medium: { bg: '#fffbeb', text: '#92400e' },
            low: { bg: '#f0fdf4', text: '#166534' }
          }
          
          const colors = severityColors[severity] || severityColors.medium
          
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${resendKey}` 
              },
              body: JSON.stringify({
                from: 'Access Your Place Security <security@accessyourplace.com>',
                to: [investor.email],
                subject: `🔐 Security Alert: ${title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1a365d; padding: 20px; text-align: center;">
                      <h1 style="color: #f59e0b; margin: 0;">Security Alert</h1>
                    </div>
                    <div style="padding: 30px; background: ${colors.bg}; border: 1px solid ${colors.text}20;">
                      <h2 style="color: ${colors.text}; margin: 0 0 15px 0;">${title}</h2>
                      <p style="color: ${colors.text};">${description}</p>
                      ${device_info ? `
                        <p style="color: ${colors.text};">
                          <strong>Device:</strong> ${device_info.browser || 'Unknown'} on ${device_info.os || 'Unknown'}
                        </p>
                      ` : ''}
                      ${ip_address ? `
                        <p style="color: ${colors.text};">
                          <strong>IP Address:</strong> ${ip_address}
                        </p>
                      ` : ''}
                      <p style="color: ${colors.text};">
                        <strong>Time:</strong> ${new Date().toLocaleString()}
                      </p>
                      <div style="text-align: center; margin: 25px 0;">
                        <a href="https://accessyourplace.com/investor" style="background: #f59e0b; color: #1a365d; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Review Account Activity
                        </a>
                      </div>
                      <p style="color: ${colors.text}; font-size: 14px;">
                        If you don't recognize this activity, please change your password immediately.
                      </p>
                    </div>
                    <div style="background: #1e293b; padding: 15px; text-align: center;">
                      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        You're receiving this because security alerts are enabled for your account.
                        <br>
                        <a href="https://accessyourplace.com/investor" style="color: #f59e0b;">Manage notification settings</a>
                      </p>
                    </div>
                  </div>
                `
              })
            })
          } catch (emailError) {
            console.error('Failed to send security alert email:', emailError)
          }
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        alert: Array.isArray(alertData) ? alertData[0] : alertData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
