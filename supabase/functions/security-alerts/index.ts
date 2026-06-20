const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// UUID generator
const makeUUID = () => {
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// Parse user agent for device fingerprint
const parseUserAgent = (ua: string) => {
  let deviceType = 'Unknown';
  let browser = 'Unknown';
  let os = 'Unknown';
  
  if (!ua) return { deviceType, browser, os, fingerprint: 'unknown' };
  
  // Device type
  if (/mobile/i.test(ua)) deviceType = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'Tablet';
  else deviceType = 'Desktop';
  
  // Browser
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  
  // OS
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  
  // Create a fingerprint from device info
  const fingerprint = `${deviceType}-${browser}-${os}`.toLowerCase();
  
  return { deviceType, browser, os, fingerprint };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  // Direct PostgREST fetch helper
  const dbFetch = async (table: string, method: string, data?: any, query?: string) => {
    const url = `${supabaseUrl}/rest/v1/${table}${query || ''}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if (data && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = text; }
      return { ok: response.ok, status: response.status, data: result };
    } catch (err) {
      console.error('DB fetch error:', err);
      return { ok: false, status: 500, data: err.message };
    }
  };

  // Send email via Resend
  const sendEmail = async (to: string, subject: string, html: string) => {
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Access Your Place Security <security@accessyourplace.com>',
          to: [to],
          subject,
          html
        })
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.text();
        console.error('Resend error:', error);
        return { success: false, error };
      }
    } catch (err) {
      console.error('Email send error:', err);
      return { success: false, error: err.message };
    }
  };

  // Generate security alert email HTML
  const generateAlertEmail = (alertType: string, investor: any, details: any, baseUrl: string) => {
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    let alertTitle = '';
    let alertDescription = '';
    let alertColor = '#f59e0b'; // amber for medium severity
    let icon = 'ðŸ””';

    switch (alertType) {
      case 'new_device':
        alertTitle = 'New Device Login Detected';
        alertDescription = `A login to your account was detected from a new device or browser.`;
        alertColor = '#f59e0b';
        icon = 'ðŸ’»';
        break;
      case 'new_location':
        alertTitle = 'Login from New Location';
        alertDescription = `Your account was accessed from a new IP address or location.`;
        alertColor = '#f59e0b';
        icon = 'ðŸ“';
        break;
      case 'failed_attempts':
        alertTitle = 'Multiple Failed Login Attempts';
        alertDescription = `We detected ${details.failedCount || 'multiple'} failed login attempts on your account.`;
        alertColor = '#ef4444'; // red for high severity
        icon = 'âš ï¸';
        break;
      case 'password_changed':
        alertTitle = 'Password Changed';
        alertDescription = `Your account password was recently changed.`;
        alertColor = '#10b981'; // green for info
        icon = 'ðŸ”';
        break;
    }

    const deviceInfo = details.deviceInfo || {};
    const sessionUrl = `${baseUrl}/investor?tab=settings`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); border-radius: 12px 12px 0 0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                      Security Alert
                    </h1>
                    <p style="margin: 8px 0 0; color: #d4a574; font-size: 14px;">
                      Access Your Place Account Security
                    </p>
                  </td>
                  <td align="right">
                    <span style="font-size: 40px;">${icon}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="padding: 0;">
              <div style="background-color: ${alertColor}; padding: 16px 40px;">
                <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">
                  ${alertTitle}
                </h2>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${investor.full_name || 'there'},
              </p>
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                ${alertDescription}
              </p>

              <!-- Details Box -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; color: #1a365d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Login Details
                </h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Time:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${timestamp}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Device:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${deviceInfo.deviceType || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Browser:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${deviceInfo.browser || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Operating System:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${deviceInfo.os || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">IP Address:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${details.ipAddress || 'Unknown'}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${sessionUrl}" style="display: inline-block; background: linear-gradient(135deg, #d4a574 0%, #c49464 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(212, 165, 116, 0.3);">
                  Review Active Sessions
                </a>
              </div>

              <!-- Security Tips -->
              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>Wasn't you?</strong> If you don't recognize this activity, we recommend:
                </p>
                <ul style="margin: 10px 0 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <li>Change your password immediately</li>
                  <li>Review and revoke any suspicious sessions</li>
                  <li>Enable additional security measures</li>
                </ul>
              </div>

              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If this was you, you can safely ignore this email. We're just keeping your account secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;">
                This is an automated security notification from Access Your Place.<br>
                You can manage your security alert preferences in your account settings.
              </p>
              <p style="margin: 15px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Â© ${new Date().getFullYear()} Access Your Place. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  };

  try {
    const body = await req.json();
    const { action, investor_id, ip_address, user_agent, base_url } = body;

    // ==================== CHECK LOGIN SECURITY ====================
    if (action === 'check_login') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor details
      const investorResult = await dbFetch('investors', 'GET', null, 
        `?id=eq.${investor_id}&select=id,email,full_name,security_alerts_enabled,known_devices,known_ips`);
      
      if (!investorResult.ok || !investorResult.data || investorResult.data.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investorResult.data[0];
      
      // If security alerts are disabled, skip checks
      if (!investor.security_alerts_enabled) {
        return new Response(JSON.stringify({ success: true, alerts_disabled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const deviceInfo = parseUserAgent(user_agent || '');
      const knownDevices = investor.known_devices || [];
      const knownIps = investor.known_ips || [];
      const alerts: any[] = [];

      // Check for new device
      const isNewDevice = !knownDevices.includes(deviceInfo.fingerprint);
      if (isNewDevice && knownDevices.length > 0) {
        alerts.push({
          type: 'new_device',
          severity: 'medium',
          title: 'New Device Login Detected',
          description: `Login from ${deviceInfo.browser} on ${deviceInfo.os}`
        });
      }

      // Check for new IP
      const isNewIp = ip_address && !knownIps.includes(ip_address);
      if (isNewIp && knownIps.length > 0) {
        alerts.push({
          type: 'new_location',
          severity: 'medium',
          title: 'Login from New Location',
          description: `Login from IP: ${ip_address}`
        });
      }

      // Update known devices and IPs
      const updatedDevices = isNewDevice ? [...knownDevices, deviceInfo.fingerprint].slice(-10) : knownDevices;
      const updatedIps = isNewIp ? [...knownIps, ip_address].slice(-20) : knownIps;

      await dbFetch('investors', 'PATCH', {
        known_devices: updatedDevices,
        known_ips: updatedIps
      }, `?id=eq.${investor_id}`);

      // Send alerts and log them
      const siteUrl = base_url || 'https://accessyourplace.com';
      
      for (const alert of alerts) {
        // Log the alert
        await dbFetch('security_alerts', 'POST', {
          id: makeUUID(),
          investor_id,
          alert_type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          device_info: deviceInfo,
          ip_address,
          email_sent: true
        });

        // Send email
        const emailHtml = generateAlertEmail(alert.type, investor, {
          deviceInfo,
          ipAddress: ip_address
        }, siteUrl);

        await sendEmail(
          investor.email,
          `Security Alert: ${alert.title} - Access Your Place`,
          emailHtml
        );
      }

      return new Response(JSON.stringify({ 
        success: true, 
        alerts_sent: alerts.length,
        is_new_device: isNewDevice,
        is_new_ip: isNewIp
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== CHECK FAILED ATTEMPTS ====================
    if (action === 'check_failed_attempts') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor details
      const investorResult = await dbFetch('investors', 'GET', null, 
        `?id=eq.${investor_id}&select=id,email,full_name,security_alerts_enabled`);
      
      if (!investorResult.ok || !investorResult.data || investorResult.data.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investorResult.data[0];

      // Get recent failed login attempts (last 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const historyResult = await dbFetch('investor_login_history', 'GET', null, 
        `?investor_id=eq.${investor_id}&success=eq.false&login_at=gte.${encodeURIComponent(thirtyMinutesAgo)}&select=id,ip_address,login_at`);

      const failedAttempts = historyResult.data || [];
      const failedCount = failedAttempts.length;

      // Alert if 3 or more failed attempts
      if (failedCount >= 3 && investor.security_alerts_enabled) {
        const deviceInfo = parseUserAgent(user_agent || '');
        const siteUrl = base_url || 'https://accessyourplace.com';

        // Check if we already sent an alert recently (within last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentAlertResult = await dbFetch('security_alerts', 'GET', null, 
          `?investor_id=eq.${investor_id}&alert_type=eq.failed_attempts&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`);

        if (!recentAlertResult.data || recentAlertResult.data.length === 0) {
          // Log the alert
          await dbFetch('security_alerts', 'POST', {
            id: makeUUID(),
            investor_id,
            alert_type: 'failed_attempts',
            severity: 'high',
            title: 'Multiple Failed Login Attempts',
            description: `${failedCount} failed login attempts detected in the last 30 minutes`,
            device_info: deviceInfo,
            ip_address,
            email_sent: true
          });

          // Send email
          const emailHtml = generateAlertEmail('failed_attempts', investor, {
            deviceInfo,
            ipAddress: ip_address,
            failedCount
          }, siteUrl);

          await sendEmail(
            investor.email,
            `Security Alert: Multiple Failed Login Attempts - Access Your Place`,
            emailHtml
          );

          return new Response(JSON.stringify({ 
            success: true, 
            alert_sent: true,
            failed_count: failedCount
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        alert_sent: false,
        failed_count: failedCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== GET SECURITY ALERTS ====================
    if (action === 'get_alerts') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const alertsResult = await dbFetch('security_alerts', 'GET', null, 
        `?investor_id=eq.${investor_id}&order=created_at.desc&limit=50&select=*`);

      return new Response(JSON.stringify({ 
        success: true, 
        alerts: alertsResult.data || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== ACKNOWLEDGE ALERT ====================
    if (action === 'acknowledge_alert') {
      const { alert_id } = body;
      
      if (!alert_id) {
        return new Response(JSON.stringify({ success: false, error: 'Alert ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbFetch('security_alerts', 'PATCH', {
        acknowledged: true,
        acknowledged_at: new Date().toISOString()
      }, `?id=eq.${alert_id}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== UPDATE SECURITY SETTINGS ====================
    if (action === 'update_settings') {
      const { security_alerts_enabled } = body;
      
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbFetch('investors', 'PATCH', {
        security_alerts_enabled: security_alerts_enabled
      }, `?id=eq.${investor_id}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== CLEAR KNOWN DEVICES ====================
    if (action === 'clear_known_devices') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbFetch('investors', 'PATCH', {
        known_devices: [],
        known_ips: []
      }, `?id=eq.${investor_id}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Known devices and locations cleared. You will receive alerts for your next login.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== SEND PASSWORD CHANGE ALERT ====================
    if (action === 'password_changed') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investorResult = await dbFetch('investors', 'GET', null, 
        `?id=eq.${investor_id}&select=id,email,full_name,security_alerts_enabled`);
      
      if (!investorResult.ok || !investorResult.data || investorResult.data.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investorResult.data[0];
      const deviceInfo = parseUserAgent(user_agent || '');
      const siteUrl = base_url || 'https://accessyourplace.com';

      // Always send password change alerts regardless of settings
      await dbFetch('security_alerts', 'POST', {
        id: makeUUID(),
        investor_id,
        alert_type: 'password_changed',
        severity: 'low',
        title: 'Password Changed',
        description: 'Your account password was changed',
        device_info: deviceInfo,
        ip_address,
        email_sent: true
      });

      const emailHtml = generateAlertEmail('password_changed', investor, {
        deviceInfo,
        ipAddress: ip_address
      }, siteUrl);

      await sendEmail(
        investor.email,
        `Security Alert: Password Changed - Access Your Place`,
        emailHtml
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Security alerts error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

