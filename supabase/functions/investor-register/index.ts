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
// Investor registration v12.0.0 - 2026-01-23
// Added Success Team notification on new investor registration
// Includes full Terms of Service in welcome email

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Custom UUID v4 generator
function makeUUID(): string {
  const h = '0123456789abcdef';
  let u = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      u += '-';
    } else if (i === 14) {
      u += '4';
    } else if (i === 19) {
      u += h[(Math.random() * 4) | 8];
    } else {
      u += h[(Math.random() * 16) | 0];
    }
  }
  return u;
}

function genToken(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 64; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
}

function generateSalt(): string {
  let salt = '';
  for (let i = 0; i < 32; i++) {
    salt += Math.floor(Math.random() * 16).toString(16);
  }
  return salt;
}

function simpleHash(str: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  
  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  
  let combined = h1 + h2;
  for (let pass = 0; pass < 100; pass++) {
    let newHash1 = 5381;
    let newHash2 = 52711;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      newHash1 = ((newHash1 << 5) + newHash1) ^ char;
      newHash2 = ((newHash2 << 5) + newHash2) ^ char;
    }
    combined = (newHash1 >>> 0).toString(16).padStart(8, '0') + 
               (newHash2 >>> 0).toString(16).padStart(8, '0') +
               combined.substring(0, 48);
  }
  
  return combined.substring(0, 64);
}

function hashPassword(password: string, salt: string): string {
  return simpleHash(salt + password + salt);
}

function getTermsOfServiceHTML(): string {
  return `
    <div style="background:#f8fafc;padding:30px;border-radius:8px;margin:30px 0;border:1px solid #e2e8f0;">
      <h2 style="color:#1a365d;margin:0 0 20px 0;font-size:24px;border-bottom:2px solid #d4a574;padding-bottom:10px;">Terms of Service</h2>
      <p style="color:#64748b;font-size:12px;margin-bottom:20px;">
        <strong>Effective Date:</strong> January 23, 2026<br>
        <strong>Entity:</strong> Set Up Your Place LLC d/b/a Access Your Place (a Cooper Family Inc. Company)<br>
        <strong>Corporate Address:</strong> 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
      </p>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">1. Scope of Service</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;">
        Access Your Place operates as an acquisition and launch engine for rental arbitrage. We handle property sourcing, lease negotiations, and physical property setup.
      </p>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">2. Payment Terms & Refund Policy</h3>
      <div style="background:#fef2f2;border:1px solid #ef4444;padding:15px;border-radius:8px;margin:10px 0;">
        <p style="color:#991b1b;font-size:13px;margin:0;"><strong>No Refunds Policy:</strong> All fees are non-refundable under all circumstances. The only exception is for Private Sales between investors where a deal falls through due to the seller or landlord - in which case funds are released back to the buyer. This exception does NOT apply to YP Verified Deals or AYP Approved operations.</p>
      </div>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">3. First Right of Refusal</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;">
        Requesting investors receive a 24-hour first right of refusal. If not exercised, the deal becomes available to all qualified investors.
      </p>
      
      <div style="background:#1a365d;color:white;padding:20px;border-radius:8px;margin-top:20px;text-align:center;">
        <p style="margin:0;font-size:14px;">
          By creating an account, you agree to these Terms of Service.
        </p>
        <p style="margin:10px 0 0 0;font-size:12px;opacity:0.8;">
          Full Terms: <a href="https://accessyourplace.com/terms-of-service" style="color:#d4a574;">accessyourplace.com/terms-of-service</a>
        </p>
      </div>
    </div>
  `;
}

async function handleRegistration(req: Request): Promise<Response> {
  console.log('[v12] investor-register starting');
  
  try {
    const body = await req.json();
    const { email, password, full_name, phone, sms_opt_in, email_opt_in, referral_code, base_url } = body;

    console.log('[v12] Processing registration for:', email);

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, password, and full name are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters long' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[v12] Missing env vars');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error. Please contact support.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const cleanEmail = email.toLowerCase().trim();
    const checkUrl = `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(cleanEmail)}&select=id`;
    
    const checkRes = await fetch(checkUrl, { method: 'GET', headers });
    const existing = await checkRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'An account with this email already exists.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    const passwordHash = `v1$${salt}$${hash}`;

    const myRefCode = 'AYP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const verificationToken = genToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const investorData = {
      email: cleanEmail,
      password_hash: passwordHash,
      full_name: full_name.trim(),
      phone: phone || null,
      sms_opt_in: sms_opt_in || false,
      email_opt_in: email_opt_in !== false,
      referred_by: referral_code || null,
      referral_code: myRefCode,
      onboarding_completed: false,
      email_verified: false,
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires,
      created_at: new Date().toISOString()
    };

    const createUrl = `${supabaseUrl}/rest/v1/investors`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(investorData)
    });

    const createData = await createRes.json();

    if (createData?.code || createData?.message) {
      console.error('[v12] DB error:', JSON.stringify(createData));
      return new Response(
        JSON.stringify({ success: false, error: createData.message || 'Registration failed.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const investor = Array.isArray(createData) ? createData[0] : createData;

    if (!investor?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Registration failed - please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[v12] Investor created:', investor.id);

    // Create session
    const sessionToken = makeUUID() + '-' + makeUUID();
    const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${supabaseUrl}/rest/v1/investor_sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        investor_id: investor.id,
        session_token: sessionToken,
        is_active: true,
        expires_at: sessionExpires,
        created_at: new Date().toISOString()
      })
    });

    // NOTIFY SUCCESS TEAM about new investor registration
    console.log('[v12] Notifying success team about new registration');
    try {
      await fetch(`${supabaseUrl}/rest/v1/staff_notifications`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          notification_type: 'new_investor_registration',
          title: 'New Investor Registration',
          message: `${full_name.trim()} (${cleanEmail}) has created an investor account.${referral_code ? ` Referred by: ${referral_code}` : ''}`,
          priority: 'medium',
          target_department: 'success_managers',
          metadata: {
            investor_id: investor.id,
            investor_email: cleanEmail,
            investor_name: full_name.trim(),
            phone: phone || null,
            referral_code: referral_code || null
          },
          created_at: new Date().toISOString()
        })
      });
      console.log('[v12] Success team notification created');
    } catch (notifErr) {
      console.error('[v12] Failed to create success team notification:', notifErr);
    }

    // Send email to success team about new registration
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <notifications@accessyourplace.com>',
            to: ['success@accessyourplace.com'],
            subject: `New Investor Registration: ${full_name.trim()}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0;">New Investor Registration</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <p style="color: #475569;">A new investor has created an account on the platform.</p>
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${full_name.trim()}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${cleanEmail}</p>
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                    <p style="margin: 5px 0;"><strong>Referral Code:</strong> ${referral_code || 'None'}</p>
                    <p style="margin: 5px 0;"><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
                  </div>
                  <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;">
                      <strong>Action Required:</strong> This investor does not have an Acquisition Manager assigned yet. Please assign an AM or wait for them to indicate who they've been working with.
                    </p>
                  </div>
                  <a href="https://accessyourplace.com/staff" style="display: inline-block; background: #d4a574; color: #1a365d; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    View in Staff Dashboard
                  </a>
                </div>
              </div>
            `
          })
        });
        console.log('[v12] Success team email sent');
      } catch (emailErr) {
        console.error('[v12] Failed to send success team email:', emailErr);
      }
    }

    // Send verification email to investor
    if (resendKey) {
      const verifyUrl = `${base_url || 'https://accessyourplace.com'}/investor/verify-email?token=${verificationToken}`;
      
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: [cleanEmail],
            subject: 'Welcome to Access Your Place - Verify Your Email',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; background: #f8fafc;">
                <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">Access Your Place</h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Investor Portal</p>
                </div>
                <div style="padding: 40px 30px;">
                  <h2 style="color: #1a365d; margin: 0 0 20px 0;">Welcome, ${full_name.trim()}!</h2>
                  <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                    Thanks for joining! We're stoked to help you build your rental arbitrage portfolio.
                  </p>
                  
                  <div style="background:#eff6ff;border:1px solid #3b82f6;padding:20px;border-radius:8px;margin:25px 0;">
                    <h3 style="color:#1e40af;margin:0 0 10px 0;">Verify Your Email</h3>
                    <p style="color:#1e40af;margin:0 0 15px 0;font-size:14px;">Click below to verify your email and unlock all portal features.</p>
                    <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a365d; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Verify Email Address
                    </a>
                  </div>
                  
                  <p style="color: #64748b; font-size: 14px;">
                    This link expires in 24 hours.
                  </p>
                  
                  <div style="background:#f0fdf4;border:1px solid #22c55e;padding:15px;border-radius:8px;margin:20px 0;">
                    <p style="color: #166534; font-size: 14px; margin:0;">
                      <strong>Your Referral Code:</strong> <span style="background:#1a365d;color:white;padding:4px 12px;border-radius:4px;font-family:monospace;">${myRefCode}</span><br>
                      <span style="font-size:13px;">Share this to earn $250 in credits when friends complete their first acquisition!</span>
                    </p>
                  </div>
                  
                  ${getTermsOfServiceHTML()}
                </div>
                <div style="background: #1e293b; padding: 20px; text-align: center;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Â© ${new Date().getFullYear()} Access Your Place. All rights reserved.<br>
                    1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
                  </p>
                </div>
              </div>
            `
          })
        });
        console.log('[v12] Verification email sent to:', cleanEmail);
      } catch (emailErr) {
        console.error('[v12] Email error:', emailErr);
      }
    }

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
        message: 'Account created! Please check your email to verify your account.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[v12] Registration error:', error.name, error.message);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return handleRegistration(req);
});

