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

// Helper to verify password
async function verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
  if (isBcryptHash(storedPassword)) {
    return await bcrypt.compare(inputPassword, storedPassword)
  } else {
    return inputPassword === storedPassword
  }
}

// Generate a secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Generate device fingerprint
function generateDeviceFingerprint(userAgent: string, ip: string): string {
  const data = `${userAgent}-${ip}`
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

// Parse user agent for device info
function parseUserAgent(userAgent: string): { browser: string; os: string; device: string } {
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'
  let device = 'Desktop'

  // Browser detection
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome'
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Edg')) browser = 'Edge'

  // OS detection
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) { os = 'Android'; device = 'Mobile' }
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) { os = 'iOS'; device = userAgent.includes('iPad') ? 'Tablet' : 'Mobile' }

  return { browser, os, device }
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
    const resendKey = Deno.env.get('RESEND_API_KEY')
    
    const headers = { 
      'apikey': supabaseKey, 
      'Authorization': `Bearer ${supabaseKey}`, 
      'Content-Type': 'application/json' 
    }

    // Get client info from request
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const deviceInfo = parseUserAgent(userAgent)

    // ==================== REGISTER ====================
    if (action === 'register') {
      const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code, base_url } = body
      
      // Check if email already exists
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`, 
        { headers }
      )
      const existing = await checkRes.json()
      
      if (existing?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'An account with this email already exists. Please sign in or use a different email.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password)
      
      // Generate referral code and verification token
      const myRefCode = 'AYP' + Math.random().toString(36).substring(2, 8).toUpperCase()
      const verificationToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      
      // Create investor
      const createRes = await fetch(`${supabaseUrl}/rest/v1/investors`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name,
          phone: phone || null,
          sms_opt_in: sms_opt_in || false,
          email_opt_in: email_opt_in !== false,
          referred_by: referral_code || null,
          referral_code: myRefCode,
          onboarding_completed: false,
          email_verified: false,
          email_verification_token: verificationToken,
          email_verification_expires: verificationExpires.toISOString(),
          security_alerts_enabled: true,
          known_devices: [generateDeviceFingerprint(userAgent, clientIp)],
          known_ips: [clientIp],
          show_guided_tour: true
        })
      })
      
      const createData = await createRes.json()
      
      if (createData?.code || createData?.message) {
        console.error('Registration error:', createData)
        return new Response(JSON.stringify({ 
          success: false, 
          error: createData.message || 'Registration failed. Please try again.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = Array.isArray(createData) ? createData[0] : createData
      
      if (!investor?.id) {
        console.error('No investor ID returned:', createData)
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Registration failed. Please try again.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Create session
      const sessionToken = generateSessionToken()
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default
      
      const sessionRes = await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          investor_id: investor.id,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: clientIp,
          user_agent: userAgent,
          is_active: true,
          remember_me: false,
          expires_at: sessionExpires.toISOString(),
          last_activity: new Date().toISOString()
        })
      })
      
      const sessionData = await sessionRes.json()
      
      if (sessionData?.code) {
        console.error('Session creation error:', sessionData)
        // Continue anyway - user is registered, they can log in
      }
      
      // Log the registration
      await fetch(`${supabaseUrl}/rest/v1/investor_login_history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id: investor.id,
          email: email.toLowerCase(),
          ip_address: clientIp,
          user_agent: userAgent,
          device_info: deviceInfo,
          success: true
        })
      })
      
      // Send verification email
      if (resendKey) {
        const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${verificationToken}`
        
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${resendKey}` 
            },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [email],
              subject: 'Verify Your Email - Access Your Place',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Investor Portal</p>
                  </div>
                  <div style="padding: 40px 30px; background: #f8fafc;">
                    <h2 style="color: #1a365d; margin: 0 0 20px 0;">Welcome, ${full_name}!</h2>
                    <p style="color: #475569; line-height: 1.6;">
                      Thank you for creating your investor account. Please verify your email address to access all features of your portal.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Verify Email Address
                      </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                      This verification link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="color: #64748b; font-size: 13px;">
                      Your referral code: <strong style="color: #1a365d;">${myRefCode}</strong><br>
                      Share this code to earn rewards when others sign up!
                    </p>
                  </div>
                  <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} Access Your Place. All rights reserved.
                    </p>
                  </div>
                </div>
              `
            })
          })
        } catch (emailError) {
          console.error('Email sending error:', emailError)
          // Don't fail registration if email fails
        }
      }
      
      return new Response(JSON.stringify({
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
          expires_at: sessionExpires.toISOString()
        },
        email_verified: false,
        message: 'Account created! Please check your email to verify your account.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== LOGIN ====================
    if (action === 'login') {
      const { email, password, remember_me } = body
      
      // Find investor
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`, 
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        // Log failed attempt
        await fetch(`${supabaseUrl}/rest/v1/investor_login_history`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: email.toLowerCase(),
            ip_address: clientIp,
            user_agent: userAgent,
            device_info: deviceInfo,
            success: false,
            failure_reason: 'Email not found'
          })
        })
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid email or password' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      const storedPassword = investor.password_hash || investor.password
      
      if (!storedPassword) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Account not set up. Please use forgot password to set your password.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Verify password
      const validPassword = await verifyPassword(password, storedPassword)
      
      if (!validPassword) {
        // Log failed attempt
        await fetch(`${supabaseUrl}/rest/v1/investor_login_history`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: investor.id,
            email: email.toLowerCase(),
            ip_address: clientIp,
            user_agent: userAgent,
            device_info: deviceInfo,
            success: false,
            failure_reason: 'Invalid password'
          })
        })
        
        // Check for multiple failed attempts (security alert)
        const recentFailsRes = await fetch(
          `${supabaseUrl}/rest/v1/investor_login_history?investor_id=eq.${investor.id}&success=eq.false&created_at=gte.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}&select=id`,
          { headers }
        )
        const recentFails = await recentFailsRes.json()
        
        if (recentFails?.length >= 3 && investor.security_alerts_enabled) {
          // Trigger security alert
          await fetch(`${supabaseUrl}/rest/v1/security_alerts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              investor_id: investor.id,
              alert_type: 'multiple_failed_logins',
              severity: 'high',
              title: 'Multiple Failed Login Attempts',
              description: `${recentFails.length} failed login attempts in the last 30 minutes from IP: ${clientIp}`,
              device_info: deviceInfo,
              ip_address: clientIp
            })
          })
          
          // Send security alert email
          if (resendKey && investor.email) {
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
                  subject: '⚠️ Security Alert: Multiple Failed Login Attempts',
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #dc2626; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0;">Security Alert</h1>
                      </div>
                      <div style="padding: 30px; background: #fef2f2; border: 1px solid #fecaca;">
                        <h2 style="color: #991b1b; margin: 0 0 15px 0;">Multiple Failed Login Attempts Detected</h2>
                        <p style="color: #7f1d1d;">
                          We detected ${recentFails.length} failed login attempts to your account in the last 30 minutes.
                        </p>
                        <p style="color: #7f1d1d;">
                          <strong>IP Address:</strong> ${clientIp}<br>
                          <strong>Device:</strong> ${deviceInfo.browser} on ${deviceInfo.os}
                        </p>
                        <p style="color: #7f1d1d;">
                          If this wasn't you, we recommend changing your password immediately.
                        </p>
                        <div style="text-align: center; margin: 25px 0;">
                          <a href="https://accessyourplace.com/investor" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Review Account Activity
                          </a>
                        </div>
                      </div>
                    </div>
                  `
                })
              })
            } catch (e) {
              console.error('Security alert email error:', e)
            }
          }
        }
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid email or password' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Auto-upgrade plain text password to bcrypt
      if (!isBcryptHash(storedPassword)) {
        const newHash = await bcrypt.hash(password)
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ password_hash: newHash })
        })
      }
      
      // Check for new device/IP (security alerts)
      const deviceFingerprint = generateDeviceFingerprint(userAgent, clientIp)
      const knownDevices = investor.known_devices || []
      const knownIps = investor.known_ips || []
      const isNewDevice = !knownDevices.includes(deviceFingerprint)
      const isNewIp = !knownIps.includes(clientIp)
      
      if ((isNewDevice || isNewIp) && investor.security_alerts_enabled) {
        // Create security alert
        const alertType = isNewDevice ? 'new_device' : 'new_location'
        await fetch(`${supabaseUrl}/rest/v1/security_alerts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: investor.id,
            alert_type: alertType,
            severity: 'medium',
            title: isNewDevice ? 'Login from New Device' : 'Login from New Location',
            description: `Successful login from ${deviceInfo.browser} on ${deviceInfo.os} (IP: ${clientIp})`,
            device_info: deviceInfo,
            ip_address: clientIp
          })
        })
        
        // Send security alert email
        if (resendKey) {
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
                subject: `🔐 New ${isNewDevice ? 'Device' : 'Location'} Login - Access Your Place`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1a365d; padding: 20px; text-align: center;">
                      <h1 style="color: #f59e0b; margin: 0;">Security Notice</h1>
                    </div>
                    <div style="padding: 30px; background: #f8fafc;">
                      <h2 style="color: #1a365d; margin: 0 0 15px 0;">
                        ${isNewDevice ? 'New Device Login' : 'New Location Login'}
                      </h2>
                      <p style="color: #475569;">
                        Your account was just accessed from a ${isNewDevice ? 'new device' : 'new location'}.
                      </p>
                      <div style="background: #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #334155;">
                          <strong>Device:</strong> ${deviceInfo.browser} on ${deviceInfo.os}<br>
                          <strong>IP Address:</strong> ${clientIp}<br>
                          <strong>Time:</strong> ${new Date().toLocaleString()}
                        </p>
                      </div>
                      <p style="color: #475569;">
                        If this was you, no action is needed. If you don't recognize this activity, 
                        please secure your account immediately.
                      </p>
                      <div style="text-align: center; margin: 25px 0;">
                        <a href="https://accessyourplace.com/investor" style="background: #f59e0b; color: #1a365d; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                          Review Active Sessions
                        </a>
                      </div>
                    </div>
                  </div>
                `
              })
            })
          } catch (e) {
            console.error('Security alert email error:', e)
          }
        }
        
        // Update known devices/IPs
        const updatedDevices = isNewDevice ? [...knownDevices, deviceFingerprint] : knownDevices
        const updatedIps = isNewIp ? [...knownIps, clientIp] : knownIps
        
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            known_devices: updatedDevices,
            known_ips: updatedIps
          })
        })
      }
      
      // Create session
      const sessionToken = generateSessionToken()
      const sessionDuration = remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 24 hours
      const sessionExpires = new Date(Date.now() + sessionDuration)
      
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id: investor.id,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: clientIp,
          user_agent: userAgent,
          is_active: true,
          remember_me: remember_me || false,
          expires_at: sessionExpires.toISOString(),
          last_activity: new Date().toISOString()
        })
      })
      
      // Log successful login
      await fetch(`${supabaseUrl}/rest/v1/investor_login_history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id: investor.id,
          email: email.toLowerCase(),
          ip_address: clientIp,
          user_agent: userAgent,
          device_info: deviceInfo,
          success: true
        })
      })
      
      // Update last login
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_login: new Date().toISOString() })
      })
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          phone: investor.phone,
          company_name: investor.company_name,
          portfolio_count: investor.portfolio_count,
          investment_budget_min: investor.investment_budget_min,
          investment_budget_max: investor.investment_budget_max,
          preferred_markets: investor.preferred_markets,
          preferred_operation_types: investor.preferred_operation_types,
          referral_code: investor.referral_code,
          onboarding_completed: investor.onboarding_completed,
          sms_opt_in: investor.sms_opt_in,
          email_opt_in: investor.email_opt_in,
          linked_staff_id: investor.linked_staff_id,
          show_guided_tour: investor.show_guided_tour
        },
        session: {
          token: sessionToken,
          expires_at: sessionExpires.toISOString()
        },
        email_verified: investor.email_verified || false,
        new_device: isNewDevice,
        new_location: isNewIp
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== VALIDATE SESSION ====================
    if (action === 'validate_session') {
      const { session_token } = body
      
      if (!session_token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No session token provided' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=*,investors(*)`,
        { headers }
      )
      const sessions = await sessionRes.json()
      
      if (!sessions?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const session = sessions[0]
      
      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        // Mark session as inactive
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_active: false })
        })
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Session expired' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Update last activity
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ last_activity: new Date().toISOString() })
      })
      
      const investor = session.investors
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          phone: investor.phone,
          company_name: investor.company_name,
          portfolio_count: investor.portfolio_count,
          investment_budget_min: investor.investment_budget_min,
          investment_budget_max: investor.investment_budget_max,
          preferred_markets: investor.preferred_markets,
          preferred_operation_types: investor.preferred_operation_types,
          referral_code: investor.referral_code,
          onboarding_completed: investor.onboarding_completed,
          sms_opt_in: investor.sms_opt_in,
          email_opt_in: investor.email_opt_in,
          linked_staff_id: investor.linked_staff_id,
          show_guided_tour: investor.show_guided_tour
        },
        session: {
          token: session.session_token,
          expires_at: session.expires_at
        },
        email_verified: investor.email_verified || false
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== REFRESH SESSION ====================
    if (action === 'refresh_session') {
      const { session_token } = body
      
      if (!session_token) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No session token provided' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=*`,
        { headers }
      )
      const sessions = await sessionRes.json()
      
      if (!sessions?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const session = sessions[0]
      
      // Extend session
      const newExpiry = session.remember_me 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          expires_at: newExpiry.toISOString(),
          last_activity: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        session: {
          token: session.session_token,
          expires_at: newExpiry.toISOString()
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== LOGOUT ====================
    if (action === 'logout') {
      const { session_token } = body
      
      if (session_token) {
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_active: false })
        })
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==================== LOGOUT ALL SESSIONS ====================
    if (action === 'logout_all') {
      const { session_token } = body
      
      // Get investor ID from current session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&select=investor_id`,
        { headers }
      )
      const sessions = await sessionRes.json()
      
      if (sessions?.length) {
        const investorId = sessions[0].investor_id
        
        // Deactivate all sessions for this investor
        await fetch(`${supabaseUrl}/rest/v1/investor_sessions?investor_id=eq.${investorId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ is_active: false })
        })
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==================== GET ACTIVE SESSIONS ====================
    if (action === 'get_active_sessions') {
      const { session_token } = body
      
      // Get investor ID from current session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers }
      )
      const currentSession = await sessionRes.json()
      
      if (!currentSession?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investorId = currentSession[0].investor_id
      
      // Get all active sessions
      const allSessionsRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?investor_id=eq.${investorId}&is_active=eq.true&expires_at=gt.${new Date().toISOString()}&select=id,device_info,ip_address,last_activity,created_at,session_token&order=last_activity.desc`,
        { headers }
      )
      const allSessions = await allSessionsRes.json()
      
      // Mark current session
      const sessionsWithCurrent = allSessions.map((s: any) => ({
        ...s,
        is_current: s.session_token === session_token,
        session_token: undefined // Don't expose tokens
      }))
      
      return new Response(JSON.stringify({
        success: true,
        sessions: sessionsWithCurrent
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== REVOKE SESSION ====================
    if (action === 'revoke_session') {
      const { session_token, session_id } = body
      
      // Verify the requesting session is valid
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers }
      )
      const currentSession = await sessionRes.json()
      
      if (!currentSession?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investorId = currentSession[0].investor_id
      
      // Revoke the specified session (must belong to same investor)
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?id=eq.${session_id}&investor_id=eq.${investorId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: false })
      })
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==================== GET LOGIN HISTORY ====================
    if (action === 'get_login_history') {
      const { session_token } = body
      
      // Get investor ID from current session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers }
      )
      const currentSession = await sessionRes.json()
      
      if (!currentSession?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investorId = currentSession[0].investor_id
      
      // Get login history
      const historyRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_login_history?investor_id=eq.${investorId}&select=*&order=created_at.desc&limit=50`,
        { headers }
      )
      const history = await historyRes.json()
      
      return new Response(JSON.stringify({
        success: true,
        history
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== VERIFY EMAIL ====================
    if (action === 'verify_email') {
      const { verification_token } = body
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email_verification_token=eq.${verification_token}&select=id,email,full_name,email_verification_expires`,
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid verification token' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      // Check if token is expired
      if (new Date(investor.email_verification_expires) < new Date()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Verification link has expired. Please request a new one.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Mark email as verified
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        email: investor.email,
        message: 'Email verified successfully!'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== RESEND VERIFICATION ====================
    if (action === 'resend_verification') {
      const { email, base_url } = body
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,email,full_name,email_verified`,
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Account not found' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      if (investor.email_verified) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Email is already verified' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Generate new verification token
      const verificationToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          email_verification_token: verificationToken,
          email_verification_expires: verificationExpires.toISOString()
        })
      })
      
      // Send verification email
      if (resendKey) {
        const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${verificationToken}`
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${resendKey}` 
          },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: [investor.email],
            subject: 'Verify Your Email - Access Your Place',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                </div>
                <div style="padding: 40px 30px; background: #f8fafc;">
                  <h2 style="color: #1a365d; margin: 0 0 20px 0;">Verify Your Email</h2>
                  <p style="color: #475569; line-height: 1.6;">
                    Hi ${investor.full_name}, please click the button below to verify your email address.
                  </p>
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">
                    This link will expire in 24 hours.
                  </p>
                </div>
              </div>
            `
          })
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Verification email sent!'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== FORGOT PASSWORD (EMAIL) ====================
    if (action === 'forgot_password') {
      const { email, phone, reset_method, base_url } = body
      
      if (reset_method === 'sms' && phone) {
        // SMS-based password reset
        const findRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?phone=eq.${phone}&select=id,email,full_name,phone`,
          { headers }
        )
        const investors = await findRes.json()
        
        if (!investors?.length) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'No account found with this phone number' 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        
        const investor = investors[0]
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            otp_code: otp,
            otp_expires: otpExpires.toISOString()
          })
        })
        
        // TODO: Send SMS via Twilio or other provider
        // For now, we'll just return success
        console.log(`OTP for ${phone}: ${otp}`) // Remove in production
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Verification code sent to your phone'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Email-based password reset
      if (!email) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Email is required' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,email,full_name`,
        { headers }
      )
      const investors = await findRes.json()
      
      // Always return success to prevent email enumeration
      if (investors?.length) {
        const investor = investors[0]
        const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID()
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            reset_token: resetToken,
            reset_token_expires: resetExpires.toISOString()
          })
        })
        
        if (resendKey) {
          const resetUrl = `${base_url || 'https://accessyourplace.com'}/investor/reset-password?token=${resetToken}`
          
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${resendKey}` 
            },
            body: JSON.stringify({
              from: 'Access Your Place <noreply@accessyourplace.com>',
              to: [investor.email],
              subject: 'Reset Your Password - Access Your Place',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                  </div>
                  <div style="padding: 40px 30px; background: #f8fafc;">
                    <h2 style="color: #1a365d; margin: 0 0 20px 0;">Reset Your Password</h2>
                    <p style="color: #475569; line-height: 1.6;">
                      Hi ${investor.full_name}, we received a request to reset your password. Click the button below to create a new password.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Reset Password
                      </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">
                      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
                    </p>
                  </div>
                </div>
              `
            })
          })
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== VERIFY OTP ====================
    if (action === 'verify_otp') {
      const { phone, otp_code } = body
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?phone=eq.${phone}&select=id,otp_code,otp_expires`,
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid phone number' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      if (!investor.otp_code || investor.otp_code !== otp_code) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid verification code' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (new Date(investor.otp_expires) < new Date()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Verification code has expired' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Generate reset token
      const resetToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          otp_code: null,
          otp_expires: null,
          reset_token: resetToken,
          reset_token_expires: resetExpires.toISOString()
        })
      })
      
      return new Response(JSON.stringify({
        success: true,
        reset_token: resetToken
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== VALIDATE RESET TOKEN ====================
    if (action === 'validate_token') {
      const { reset_token } = body
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?reset_token=eq.${reset_token}&select=id,email,reset_token_expires`,
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ valid: false }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
      
      const investor = investors[0]
      
      if (new Date(investor.reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ 
          valid: false, 
          error: 'Token expired' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({ 
        valid: true, 
        email: investor.email 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== RESET PASSWORD ====================
    if (action === 'reset_password') {
      const { reset_token, new_password } = body
      
      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?reset_token=eq.${reset_token}&select=id,email,reset_token_expires,security_alerts_enabled`,
        { headers }
      )
      const investors = await findRes.json()
      
      if (!investors?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid reset token' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investor = investors[0]
      
      if (new Date(investor.reset_token_expires) < new Date()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Reset token has expired' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const passwordHash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: passwordHash,
          reset_token: null,
          reset_token_expires: null,
          updated_at: new Date().toISOString()
        })
      })
      
      // Invalidate all sessions
      await fetch(`${supabaseUrl}/rest/v1/investor_sessions?investor_id=eq.${investor.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: false })
      })
      
      // Send security alert if enabled
      if (investor.security_alerts_enabled && resendKey) {
        await fetch(`${supabaseUrl}/rest/v1/security_alerts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: investor.id,
            alert_type: 'password_changed',
            severity: 'high',
            title: 'Password Changed',
            description: 'Your password was successfully changed. All active sessions have been logged out.',
            ip_address: clientIp,
            device_info: deviceInfo
          })
        })
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${resendKey}` 
          },
          body: JSON.stringify({
            from: 'Access Your Place Security <security@accessyourplace.com>',
            to: [investor.email],
            subject: '🔐 Password Changed - Access Your Place',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a365d; padding: 20px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0;">Password Changed</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">
                    Your password was successfully changed. All active sessions have been logged out for security.
                  </p>
                  <p style="color: #475569;">
                    <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                    <strong>IP Address:</strong> ${clientIp}
                  </p>
                  <p style="color: #dc2626; font-weight: bold;">
                    If you didn't make this change, please contact support immediately.
                  </p>
                </div>
              </div>
            `
          })
        })
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ==================== UPDATE PROFILE ====================
    if (action === 'update_profile') {
      const { session_token, ...updates } = body
      delete updates.action
      
      // Validate session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers }
      )
      const sessions = await sessionRes.json()
      
      if (!sessions?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investorId = sessions[0].investor_id
      
      // Don't allow updating sensitive fields
      delete updates.password_hash
      delete updates.email
      delete updates.reset_token
      delete updates.email_verification_token
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
      })
      
      // Fetch updated investor
      const investorRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=*`,
        { headers }
      )
      const investors = await investorRes.json()
      const investor = investors[0]
      
      return new Response(JSON.stringify({
        success: true,
        investor: {
          id: investor.id,
          email: investor.email,
          full_name: investor.full_name,
          phone: investor.phone,
          company_name: investor.company_name,
          portfolio_count: investor.portfolio_count,
          investment_budget_min: investor.investment_budget_min,
          investment_budget_max: investor.investment_budget_max,
          preferred_markets: investor.preferred_markets,
          preferred_operation_types: investor.preferred_operation_types,
          referral_code: investor.referral_code,
          onboarding_completed: investor.onboarding_completed,
          sms_opt_in: investor.sms_opt_in,
          email_opt_in: investor.email_opt_in,
          security_alerts_enabled: investor.security_alerts_enabled,
          show_guided_tour: investor.show_guided_tour
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== CHANGE PASSWORD ====================
    if (action === 'change_password') {
      const { session_token, current_password, new_password } = body
      
      // Validate session
      const sessionRes = await fetch(
        `${supabaseUrl}/rest/v1/investor_sessions?session_token=eq.${session_token}&is_active=eq.true&select=investor_id`,
        { headers }
      )
      const sessions = await sessionRes.json()
      
      if (!sessions?.length) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid session' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      const investorId = sessions[0].investor_id
      
      // Get investor
      const investorRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=id,email,password_hash,security_alerts_enabled`,
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
      
      // Verify current password
      const validPassword = await verifyPassword(current_password, investor.password_hash)
      
      if (!validPassword) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Current password is incorrect' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Hash new password
      const passwordHash = await bcrypt.hash(new_password)
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          password_hash: passwordHash,
          updated_at: new Date().toISOString()
        })
      })
      
      // Send security alert
      if (investor.security_alerts_enabled && resendKey) {
        await fetch(`${supabaseUrl}/rest/v1/security_alerts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: investorId,
            alert_type: 'password_changed',
            severity: 'medium',
            title: 'Password Changed',
            description: 'Your password was successfully changed from your account settings.',
            ip_address: clientIp,
            device_info: deviceInfo
          })
        })
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${resendKey}` 
          },
          body: JSON.stringify({
            from: 'Access Your Place Security <security@accessyourplace.com>',
            to: [investor.email],
            subject: '🔐 Password Changed - Access Your Place',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a365d; padding: 20px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0;">Password Changed</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">
                    Your password was successfully changed from your account settings.
                  </p>
                  <p style="color: #475569;">
                    <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Device:</strong> ${deviceInfo.browser} on ${deviceInfo.os}
                  </p>
                  <p style="color: #dc2626;">
                    If you didn't make this change, please contact support immediately.
                  </p>
                </div>
              </div>
            `
          })
        })
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
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
