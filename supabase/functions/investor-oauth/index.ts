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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip'
};

const genToken = () => {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 64; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
};

const genState = () => {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const googleApiKey = Deno.env.get('GOOGLE_API_KEY') ?? '';

  // Note: In production, you would need to set these environment variables:
  // GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_CLIENT_ID, APPLE_CLIENT_SECRET
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
  const appleClientId = Deno.env.get('APPLE_CLIENT_ID') ?? '';
  const appleClientSecret = Deno.env.get('APPLE_CLIENT_SECRET') ?? '';

  if (!url || !key) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get client IP
  let clientIP = 'unknown';
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) clientIP = forwarded.split(',')[0].trim();
    else {
      const realIP = req.headers.get('x-real-ip');
      if (realIP) clientIP = realIP;
    }
  } catch (e) { /* ignore */ }

  // DB helper with retry
  const db = async (table: string, method: string, data?: any, query?: string): Promise<{ ok: boolean; status: number; data: any }> => {
    const delays = [100, 300, 1000];
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const r = await fetch(`${url}/rest/v1/${table}${query || ''}`, {
          method,
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: data && (method === 'POST' || method === 'PATCH' || method === 'DELETE') ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if ((r.status === 502 || r.status === 504) && attempt < 3) { await sleep(delays[attempt]); continue; }
        const txt = await r.text();
        let res; try { res = JSON.parse(txt); } catch { res = txt; }
        return { ok: r.ok, status: r.status, data: res };
      } catch (e: any) {
        if (attempt < 3) { await sleep(delays[attempt]); continue; }
        return { ok: false, status: 500, data: e?.message || 'Database request failed' };
      }
    }
    return { ok: false, status: 504, data: 'All retries exhausted' };
  };

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  };

  // Clean up expired OAuth states
  const cleanupExpiredStates = async () => {
    await db('oauth_states', 'DELETE', null, `?expires_at=lt.${new Date().toISOString()}`);
  };

  try {
    const body = await req.json();
    const { action } = body;
    console.log(`[investor-oauth] Action: ${action}, IP: ${clientIP}`);

    // Cleanup expired states periodically
    cleanupExpiredStates().catch(() => {});

    // ============================================
    // ACTION: initiate_oauth - Start OAuth flow
    // ============================================
    if (action === 'initiate_oauth') {
      const { provider, redirect_uri, investor_id, oauth_action } = body;
      
      if (!provider || !['google', 'apple'].includes(provider)) {
        return jsonResponse({ success: false, error: 'Invalid provider. Supported: google, apple' }, 400);
      }
      
      if (!redirect_uri) {
        return jsonResponse({ success: false, error: 'Redirect URI is required' }, 400);
      }

      // Generate state for CSRF protection
      const state = genState();
      
      // Store state in database
      await db('oauth_states', 'POST', {
        state,
        provider,
        redirect_uri,
        investor_id: investor_id || null,
        action: oauth_action || 'login'
      });

      let authUrl = '';
      
      if (provider === 'google') {
        if (!googleClientId) {
          return jsonResponse({ success: false, error: 'Google OAuth not configured. Please contact support.' }, 503);
        }
        
        const params = new URLSearchParams({
          client_id: googleClientId,
          redirect_uri: redirect_uri,
          response_type: 'code',
          scope: 'openid email profile',
          state: state,
          access_type: 'offline',
          prompt: 'consent'
        });
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      } 
      else if (provider === 'apple') {
        if (!appleClientId) {
          return jsonResponse({ success: false, error: 'Apple OAuth not configured. Please contact support.' }, 503);
        }
        
        const params = new URLSearchParams({
          client_id: appleClientId,
          redirect_uri: redirect_uri,
          response_type: 'code id_token',
          scope: 'name email',
          state: state,
          response_mode: 'form_post'
        });
        authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
      }

      return jsonResponse({ 
        success: true, 
        auth_url: authUrl, 
        state: state,
        provider 
      });
    }

    // ============================================
    // ACTION: handle_callback - Process OAuth callback
    // ============================================
    if (action === 'handle_callback') {
      const { code, state, provider, id_token } = body;
      
      if (!state) {
        return jsonResponse({ success: false, error: 'Invalid state parameter' }, 400);
      }

      // Verify state exists and hasn't expired
      const stateResult = await db('oauth_states', 'GET', null, `?state=eq.${encodeURIComponent(state)}&select=*`);
      if (!stateResult.ok || !stateResult.data?.length) {
        return jsonResponse({ success: false, error: 'Invalid or expired OAuth state. Please try again.' }, 400);
      }

      const oauthState = stateResult.data[0];
      if (new Date(oauthState.expires_at) < new Date()) {
        await db('oauth_states', 'DELETE', null, `?id=eq.${oauthState.id}`);
        return jsonResponse({ success: false, error: 'OAuth session expired. Please try again.' }, 400);
      }

      // Delete the used state
      await db('oauth_states', 'DELETE', null, `?id=eq.${oauthState.id}`);

      let userInfo: any = null;
      let accessToken = '';
      let refreshToken = '';
      let tokenExpiresAt: Date | null = null;

      // Exchange code for tokens based on provider
      if (oauthState.provider === 'google') {
        if (!code) {
          return jsonResponse({ success: false, error: 'Authorization code is required' }, 400);
        }

        if (!googleClientId || !googleClientSecret) {
          return jsonResponse({ success: false, error: 'Google OAuth not properly configured' }, 503);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: oauthState.redirect_uri,
            grant_type: 'authorization_code'
          })
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
          console.error('[investor-oauth] Google token error:', tokenData);
          return jsonResponse({ success: false, error: 'Failed to authenticate with Google' }, 400);
        }

        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || '';
        if (tokenData.expires_in) {
          tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        }

        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        userInfo = await userResponse.json();
        
        if (!userInfo.id) {
          return jsonResponse({ success: false, error: 'Failed to get user info from Google' }, 400);
        }

        userInfo = {
          provider: 'google',
          provider_user_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatar_url: userInfo.picture,
          verified_email: userInfo.verified_email
        };
      }
      else if (oauthState.provider === 'apple') {
        // Apple sends user info in the id_token
        if (!id_token) {
          return jsonResponse({ success: false, error: 'ID token is required for Apple Sign-In' }, 400);
        }

        // Decode the JWT (without verification for now - in production, verify with Apple's public keys)
        const parts = id_token.split('.');
        if (parts.length !== 3) {
          return jsonResponse({ success: false, error: 'Invalid Apple ID token' }, 400);
        }

        try {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          
          userInfo = {
            provider: 'apple',
            provider_user_id: payload.sub,
            email: payload.email,
            name: body.user?.name ? `${body.user.name.firstName || ''} ${body.user.name.lastName || ''}`.trim() : null,
            avatar_url: null,
            verified_email: payload.email_verified === 'true' || payload.email_verified === true
          };
        } catch (e) {
          console.error('[investor-oauth] Apple token decode error:', e);
          return jsonResponse({ success: false, error: 'Failed to decode Apple ID token' }, 400);
        }
      }

      if (!userInfo) {
        return jsonResponse({ success: false, error: 'Failed to get user information' }, 400);
      }

      // Check if this social account is already linked to an investor
      const existingSocial = await db('investor_social_accounts', 'GET', null, 
        `?provider=eq.${userInfo.provider}&provider_user_id=eq.${encodeURIComponent(userInfo.provider_user_id)}&select=*,investors(*)`);

      // CASE 1: Account Linking (investor_id provided in state)
      if (oauthState.investor_id) {
        // Check if this social account is already linked to another investor
        if (existingSocial.data?.length && existingSocial.data[0].investor_id !== oauthState.investor_id) {
          return jsonResponse({ 
            success: false, 
            error: 'This social account is already linked to a different investor account.' 
          }, 400);
        }

        // Check if investor already has this provider linked
        const existingLink = await db('investor_social_accounts', 'GET', null,
          `?investor_id=eq.${oauthState.investor_id}&provider=eq.${userInfo.provider}&select=*`);
        
        if (existingLink.data?.length) {
          // Update existing link
          await db('investor_social_accounts', 'PATCH', {
            provider_user_id: userInfo.provider_user_id,
            provider_email: userInfo.email,
            provider_name: userInfo.name,
            provider_avatar_url: userInfo.avatar_url,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: tokenExpiresAt?.toISOString(),
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, `?id=eq.${existingLink.data[0].id}`);
        } else {
          // Create new link
          await db('investor_social_accounts', 'POST', {
            investor_id: oauthState.investor_id,
            provider: userInfo.provider,
            provider_user_id: userInfo.provider_user_id,
            provider_email: userInfo.email,
            provider_name: userInfo.name,
            provider_avatar_url: userInfo.avatar_url,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: tokenExpiresAt?.toISOString(),
            raw_user_meta: userInfo
          });
        }

        return jsonResponse({ 
          success: true, 
          action: 'linked',
          message: `${userInfo.provider.charAt(0).toUpperCase() + userInfo.provider.slice(1)} account linked successfully!`,
          provider: userInfo.provider
        });
      }

      // CASE 2: Login with existing social account
      if (existingSocial.data?.length) {
        const socialAccount = existingSocial.data[0];
        const investor = socialAccount.investors;

        if (!investor) {
          return jsonResponse({ success: false, error: 'Linked investor account not found' }, 400);
        }

        // Update last used
        await db('investor_social_accounts', 'PATCH', {
          last_used_at: new Date().toISOString(),
          access_token: accessToken,
          refresh_token: refreshToken || socialAccount.refresh_token,
          token_expires_at: tokenExpiresAt?.toISOString()
        }, `?id=eq.${socialAccount.id}`);

        // Create session
        const sessToken = `sess_${genToken()}`;
        const expires = new Date(Date.now() + 86400000); // 24 hours

        await db('investor_sessions', 'POST', {
          investor_id: investor.id,
          session_token: sessToken,
          device_info: { deviceType: 'Web', loginMethod: userInfo.provider },
          ip_address: clientIP,
          remember_me: false,
          expires_at: expires.toISOString(),
          is_active: true,
          last_activity: new Date().toISOString()
        });

        const { password_hash, reset_token, reset_token_expires, email_verification_token, ...safeInvestor } = investor;

        return jsonResponse({
          success: true,
          action: 'login',
          investor: safeInvestor,
          session: { token: sessToken, expires: expires.getTime() },
          email_verified: investor.email_verified || false,
          provider: userInfo.provider
        });
      }

      // CASE 3: Register new account with social login
      if (oauthState.action === 'login' || oauthState.action === 'register') {
        // Check if email already exists
        if (userInfo.email) {
          const existingEmail = await db('investors', 'GET', null, 
            `?email=eq.${encodeURIComponent(userInfo.email.toLowerCase())}&select=id,email,full_name`);
          
          if (existingEmail.data?.length) {
            // Email exists - prompt to link accounts
            return jsonResponse({
              success: false,
              error: 'An account with this email already exists. Please log in with your password and link your social account in settings.',
              existing_email: true,
              email: userInfo.email
            }, 409);
          }
        }

        // Create new investor account
        const newInvestor = await db('investors', 'POST', {
          email: userInfo.email?.toLowerCase(),
          full_name: userInfo.name || userInfo.email?.split('@')[0] || 'Investor',
          email_verified: userInfo.verified_email || false,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (!newInvestor.ok || !newInvestor.data?.length) {
          console.error('[investor-oauth] Failed to create investor:', newInvestor);
          return jsonResponse({ success: false, error: 'Failed to create account' }, 500);
        }

        const investor = newInvestor.data[0];

        // Link social account
        await db('investor_social_accounts', 'POST', {
          investor_id: investor.id,
          provider: userInfo.provider,
          provider_user_id: userInfo.provider_user_id,
          provider_email: userInfo.email,
          provider_name: userInfo.name,
          provider_avatar_url: userInfo.avatar_url,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt?.toISOString(),
          raw_user_meta: userInfo
        });

        // Create session
        const sessToken = `sess_${genToken()}`;
        const expires = new Date(Date.now() + 86400000);

        await db('investor_sessions', 'POST', {
          investor_id: investor.id,
          session_token: sessToken,
          device_info: { deviceType: 'Web', loginMethod: userInfo.provider },
          ip_address: clientIP,
          remember_me: false,
          expires_at: expires.toISOString(),
          is_active: true,
          last_activity: new Date().toISOString()
        });

        const { password_hash, reset_token, reset_token_expires, email_verification_token, ...safeInvestor } = investor;

        return jsonResponse({
          success: true,
          action: 'register',
          investor: safeInvestor,
          session: { token: sessToken, expires: expires.getTime() },
          email_verified: investor.email_verified || false,
          provider: userInfo.provider,
          message: 'Account created successfully!'
        });
      }

      return jsonResponse({ success: false, error: 'Invalid OAuth action' }, 400);
    }

    // ============================================
    // ACTION: get_linked_accounts - Get linked social accounts for an investor
    // ============================================
    if (action === 'get_linked_accounts') {
      const { investor_id } = body;
      
      if (!investor_id) {
        return jsonResponse({ success: false, error: 'Investor ID is required' }, 400);
      }

      const result = await db('investor_social_accounts', 'GET', null,
        `?investor_id=eq.${investor_id}&select=id,provider,provider_email,provider_name,provider_avatar_url,linked_at,last_used_at`);

      return jsonResponse({
        success: true,
        accounts: result.data || []
      });
    }

    // ============================================
    // ACTION: unlink_account - Unlink a social account
    // ============================================
    if (action === 'unlink_account') {
      const { investor_id, provider } = body;
      
      if (!investor_id || !provider) {
        return jsonResponse({ success: false, error: 'Investor ID and provider are required' }, 400);
      }

      // Check if investor has a password set (can't unlink if no other login method)
      const investor = await db('investors', 'GET', null, `?id=eq.${investor_id}&select=id,password_hash`);
      if (!investor.data?.length) {
        return jsonResponse({ success: false, error: 'Investor not found' }, 404);
      }

      // Count linked accounts
      const linkedAccounts = await db('investor_social_accounts', 'GET', null,
        `?investor_id=eq.${investor_id}&select=id,provider`);
      
      const hasPassword = !!investor.data[0].password_hash;
      const accountCount = linkedAccounts.data?.length || 0;

      // Must have at least one login method
      if (!hasPassword && accountCount <= 1) {
        return jsonResponse({ 
          success: false, 
          error: 'Cannot unlink your only login method. Please set a password first or link another social account.' 
        }, 400);
      }

      // Delete the link
      await db('investor_social_accounts', 'DELETE', null,
        `?investor_id=eq.${investor_id}&provider=eq.${provider}`);

      return jsonResponse({
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`
      });
    }

    // ============================================
    // ACTION: check_oauth_config - Check if OAuth providers are configured
    // ============================================
    if (action === 'check_oauth_config') {
      return jsonResponse({
        success: true,
        providers: {
          google: !!googleClientId,
          apple: !!appleClientId
        }
      });
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400);

  } catch (e: any) {
    console.error('[investor-oauth] Error:', e?.message);
    return jsonResponse({ success: false, error: 'An unexpected error occurred.' }, 500);
  }
});

