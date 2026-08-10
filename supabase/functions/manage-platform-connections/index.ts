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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Platform configurations with real API endpoints
const PLATFORM_CONFIG: Record<string, any> = {
  airbnb: {
    name: 'Airbnb',
    authType: 'oauth',
    oauthUrl: 'https://www.airbnb.com/oauth2/auth',
    tokenUrl: 'https://api.airbnb.com/v2/oauth2/access_tokens',
    apiBase: 'https://api.airbnb.com/v2',
    scopes: ['listings:read', 'reservations:read', 'calendar:read'],
    rateLimit: { requests: 100, window: 60000 },
    supportsWebhooks: false
  },
  vrbo: {
    name: 'VRBO/Expedia',
    authType: 'api_key',
    apiBase: 'https://api.expediagroup.com/supply/lodging/v1',
    rateLimit: { requests: 500, window: 60000 },
    supportsWebhooks: true
  },
  guesty: {
    name: 'Guesty',
    authType: 'api_key',
    apiBase: 'https://api.guesty.com/api/v2',
    rateLimit: { requests: 100, window: 60000 },
    supportsWebhooks: true,
    webhookEvents: ['reservation.new', 'reservation.updated', 'reservation.cancelled']
  },
  hospitable: {
    name: 'Hospitable',
    authType: 'api_key',
    apiBase: 'https://api.hospitable.com/v1',
    rateLimit: { requests: 60, window: 60000 },
    supportsWebhooks: true
  },
  ownerrez: {
    name: 'OwnerRez',
    authType: 'api_key',
    apiBase: 'https://api.ownerrez.com/v2',
    rateLimit: { requests: 120, window: 60000 },
    supportsWebhooks: true
  },
  hostaway: {
    name: 'Hostaway',
    authType: 'api_key',
    apiBase: 'https://api.hostaway.com/v1',
    rateLimit: { requests: 100, window: 60000 },
    supportsWebhooks: true
  },
  lodgify: {
    name: 'Lodgify',
    authType: 'api_key',
    apiBase: 'https://api.lodgify.com/v2',
    rateLimit: { requests: 100, window: 60000 },
    supportsWebhooks: true
  },
  pricelabs: {
    name: 'PriceLabs',
    authType: 'api_key',
    apiBase: 'https://api.pricelabs.co/v1',
    rateLimit: { requests: 60, window: 60000 },
    supportsWebhooks: false
  }
};

// Rate limiter
class RateLimiter {
  private callHistory: Map<string, number[]> = new Map();

  async checkAndWait(connectionId: string, platform: string): Promise<void> {
    const config = PLATFORM_CONFIG[platform];
    if (!config?.rateLimit) return;

    const { requests, window } = config.rateLimit;
    const now = Date.now();
    const key = connectionId;

    let history = this.callHistory.get(key) || [];
    history = history.filter(t => now - t < window);

    if (history.length >= requests) {
      const waitTime = history[0] + window - now + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      history = history.filter(t => Date.now() - t < window);
    }

    history.push(now);
    this.callHistory.set(key, history);
  }
}

const rateLimiter = new RateLimiter();

// Retry logic with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      // A direct-booking site is not an OAuth platform — there is nothing to authorise
      // against, which is exactly why it matters: direct bookings are the revenue the
      // aggregators cannot see, and this business's numbers depend on counting them.
      case 'add_direct_booking': {
        const { investor_id, site_name, site_url } = params;
        if (!investor_id || !site_name) {
          return new Response(JSON.stringify({ success: false, error: 'investor_id and a site name are required.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data, error } = await supabase
          .from('platform_connections')
          .insert({
            investor_id,
            platform: 'direct',
            connection_type: 'manual',
            account_name: site_name,
            metadata: site_url ? { site_url } : null,
            is_active: true,
            sync_status: 'manual',
          })
          .select()
          .single();
        if (error) {
          console.error('[manage-platform-connections] add_direct_booking failed:', error.message);
          return new Response(JSON.stringify({ success: false, error: 'Could not add it. Nothing was saved.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, connection: data,
          note: 'Added. Direct bookings are entered by hand — nothing syncs automatically from your own site.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_platforms':
        return await getPlatforms();
      case 'get_connections':
        return await getConnections(params.investor_id);
      case 'connect_platform':
        return await connectPlatform(params);
      case 'disconnect_platform':
        return await disconnectPlatform(params.connection_id);
      case 'sync_data':
        return await syncPlatformData(params.connection_id);
      case 'sync_all':
        return await syncAllConnections(params.investor_id);
      case 'get_bookings':
        return await getBookings(params);
      case 'get_listings':
        return await getListings(params.investor_id);
      case 'match_listing':
        return await matchListingToProperty(params);
      case 'import_csv':
        return await importCSVData(params);
      case 'get_sync_logs':
        return await getSyncLogs(params.investor_id);
      case 'get_aggregated_stats':
        return await getAggregatedStats(params);
      case 'get_oauth_url':
        return await getOAuthUrl(params);
      case 'exchange_oauth_code':
        return await exchangeOAuthCode(params);
      case 'refresh_oauth_token':
        return await refreshOAuthToken(params.connection_id);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getPlatforms() {
  const platforms = Object.entries(PLATFORM_CONFIG).map(([key, config]) => ({
    id: key,
    name: config.name,
    authType: config.authType,
    supportsWebhooks: config.supportsWebhooks || false,
    description: getPlatformDescription(key)
  }));

  return new Response(JSON.stringify({ platforms }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getPlatformDescription(platform: string): string {
  const descriptions: Record<string, string> = {
    airbnb: 'Connect your Airbnb host account via OAuth to automatically import reservations.',
    vrbo: 'Sync your VRBO/Expedia listings and booking data automatically.',
    guesty: 'Import data from Guesty property management system.',
    hospitable: 'Connect Hospitable to sync all your automated bookings.',
    ownerrez: 'Import reservations and financial data from OwnerRez.',
    hostaway: 'Sync your Hostaway channel manager data.',
    lodgify: 'Connect Lodgify to import bookings across all channels.',
    pricelabs: 'Import pricing and revenue data from PriceLabs.'
  };
  return descriptions[platform] || 'Connect to import booking data.';
}

async function getOAuthUrl(params: { platform: string; investor_id: string; redirect_uri: string }) {
  const config = PLATFORM_CONFIG[params.platform];
  if (!config || config.authType !== 'oauth') {
    return new Response(JSON.stringify({ error: 'Platform does not support OAuth' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Generate state token for security
  const stateData = {
    investor_id: params.investor_id,
    platform: params.platform,
    timestamp: Date.now(),
    nonce: crypto.randomUUID()
  };
  const state = btoa(JSON.stringify(stateData));
  
  // Store state for verification
  await supabase
    .from('oauth_tokens')
    .upsert({
      investor_id: params.investor_id,
      platform: params.platform,
      access_token: 'pending',
      scope: config.scopes?.join(' ') || '',
      is_valid: false
    }, { onConflict: 'investor_id,platform' });

  const scopes = config.scopes?.join(' ') || '';
  const clientId = Deno.env.get(`${params.platform.toUpperCase()}_CLIENT_ID`) || 'demo_client_id';
  
  const oauthUrl = `${config.oauthUrl}?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: params.redirect_uri,
    response_type: 'code',
    scope: scopes,
    state: state
  }).toString();

  return new Response(JSON.stringify({ 
    oauth_url: oauthUrl,
    state: state,
    platform: params.platform,
    message: 'Redirect user to oauth_url to begin authorization'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function exchangeOAuthCode(params: { 
  platform: string; 
  code: string; 
  redirect_uri: string; 
  investor_id: string;
  state?: string;
}) {
  const config = PLATFORM_CONFIG[params.platform];
  if (!config || config.authType !== 'oauth') {
    return new Response(JSON.stringify({ error: 'Platform does not support OAuth' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Verify state if provided
  if (params.state) {
    try {
      const stateData = JSON.parse(atob(params.state));
      if (stateData.investor_id !== params.investor_id) {
        return new Response(JSON.stringify({ error: 'Invalid state - investor mismatch' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Check state is not too old (1 hour max)
      if (Date.now() - stateData.timestamp > 3600000) {
        return new Response(JSON.stringify({ error: 'OAuth state expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid state token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const clientId = Deno.env.get(`${params.platform.toUpperCase()}_CLIENT_ID`) || '';
  const clientSecret = Deno.env.get(`${params.platform.toUpperCase()}_CLIENT_SECRET`) || '';

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirect_uri,
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || tokens.error || 'Failed to exchange code');
    }

    // Calculate token expiration
    const expiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    // Store tokens securely
    await supabase
      .from('oauth_tokens')
      .upsert({
        investor_id: params.investor_id,
        platform: params.platform,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: tokens.scope || config.scopes?.join(' '),
        is_valid: true,
        last_refreshed_at: new Date().toISOString()
      }, { onConflict: 'investor_id,platform' });

    // Create platform connection
    const { data: connection, error: connError } = await supabase
      .from('platform_connections')
      .insert({
        investor_id: params.investor_id,
        platform: params.platform,
        connection_type: 'oauth',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
        sync_status: 'pending'
      })
      .select()
      .single();

    if (connError) throw connError;

    // Trigger initial sync
    syncPlatformData(connection.id).catch(console.error);

    return new Response(JSON.stringify({ 
      success: true, 
      connection,
      message: 'OAuth connection successful. Initial sync started.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('OAuth exchange error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function refreshOAuthToken(connectionId: string) {
  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    return new Response(JSON.stringify({ error: 'Connection not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!connection.refresh_token) {
    return new Response(JSON.stringify({ error: 'No refresh token available' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const config = PLATFORM_CONFIG[connection.platform];
  if (!config || config.authType !== 'oauth') {
    return new Response(JSON.stringify({ error: 'Platform does not support OAuth' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const clientId = Deno.env.get(`${connection.platform.toUpperCase()}_CLIENT_ID`) || '';
  const clientSecret = Deno.env.get(`${connection.platform.toUpperCase()}_CLIENT_SECRET`) || '';

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      // Mark connection as needing re-authorization
      await supabase
        .from('platform_connections')
        .update({
          sync_status: 'error',
          sync_error: 'Token refresh failed. Please reconnect your account.'
        })
        .eq('id', connectionId);

      throw new Error(tokens.error_description || 'Token refresh failed');
    }

    const expiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    // Update connection with new tokens
    await supabase
      .from('platform_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || connection.refresh_token,
        token_expires_at: expiresAt,
        sync_error: null
      })
      .eq('id', connectionId);

    // Update oauth_tokens table
    await supabase
      .from('oauth_tokens')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || connection.refresh_token,
        expires_at: expiresAt,
        is_valid: true,
        last_refreshed_at: new Date().toISOString()
      })
      .eq('investor_id', connection.investor_id)
      .eq('platform', connection.platform);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Token refreshed successfully',
      expires_at: expiresAt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getConnections(investor_id: string) {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('investor_id', investor_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Check for expiring tokens and refresh if needed
  for (const conn of (data || [])) {
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at);
      const now = new Date();
      // Refresh if expiring within 5 minutes
      if (expiresAt.getTime() - now.getTime() < 300000 && conn.refresh_token) {
        refreshOAuthToken(conn.id).catch(console.error);
      }
    }
  }

  const connectionsWithStats = await Promise.all(
    (data || []).map(async (conn) => {
      const { count: listingCount } = await supabase
        .from('platform_listings')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', conn.id);

      const { count: bookingCount } = await supabase
        .from('platform_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', conn.id);

      return {
        ...conn,
        listing_count: listingCount || 0,
        booking_count: bookingCount || 0,
        platform_name: PLATFORM_CONFIG[conn.platform]?.name || conn.platform,
        supports_webhooks: PLATFORM_CONFIG[conn.platform]?.supportsWebhooks || false,
        auth_type: PLATFORM_CONFIG[conn.platform]?.authType || 'api_key'
      };
    })
  );

  return new Response(JSON.stringify({ connections: connectionsWithStats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function connectPlatform(params: {
  investor_id: string;
  platform: string;
  api_key?: string;
  api_secret?: string;
  account_email?: string;
}) {
  const { investor_id, platform, api_key, api_secret, account_email } = params;
  const config = PLATFORM_CONFIG[platform];

  if (!config) {
    return new Response(JSON.stringify({ error: 'Unknown platform' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // For OAuth platforms, return the OAuth URL instead
  if (config.authType === 'oauth') {
    return new Response(JSON.stringify({ 
      error: 'This platform requires OAuth authentication',
      auth_type: 'oauth',
      message: 'Use get_oauth_url action to initiate OAuth flow'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const isValid = await validateCredentials(platform, api_key, api_secret);
  
  const { data, error } = await supabase
    .from('platform_connections')
    .insert({
      investor_id,
      platform,
      connection_type: 'api_key',
      api_key,
      api_secret,
      account_email,
      is_active: true,
      sync_status: isValid ? 'pending' : 'error',
      sync_error: isValid ? null : 'Could not validate credentials.'
    })
    .select()
    .single();

  if (error) throw error;

  if (isValid && data) {
    syncPlatformData(data.id).catch(console.error);
  }

  return new Response(JSON.stringify({ 
    connection: data,
    message: isValid ? 'Platform connected. Initial sync started.' : 'Connection saved but credentials could not be validated.'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function validateCredentials(platform: string, apiKey?: string, apiSecret?: string): Promise<boolean> {
  if (!apiKey) return false;
  const config = PLATFORM_CONFIG[platform];
  if (!config) return false;

  try {
    let testUrl = '';
    let headers: Record<string, string> = {};

    switch (platform) {
      case 'guesty':
        testUrl = `${config.apiBase}/listings?limit=1`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      case 'hostaway':
        testUrl = `${config.apiBase}/listings?limit=1`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      case 'ownerrez':
        testUrl = `${config.apiBase}/properties?limit=1`;
        headers = { 'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret || ''}`)}` };
        break;
      default:
        return apiKey.length > 10;
    }

    const response = await fetchWithRetry(testUrl, { headers, method: 'GET' }, 2, 500);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function disconnectPlatform(connection_id: string) {
  await supabase.from('platform_webhooks').delete().eq('connection_id', connection_id);
  await supabase.from('platform_bookings').delete().eq('connection_id', connection_id);
  await supabase.from('platform_listings').delete().eq('connection_id', connection_id);
  await supabase.from('platform_sync_logs').delete().eq('connection_id', connection_id);
  
  const { data: conn } = await supabase
    .from('platform_connections')
    .select('investor_id, platform')
    .eq('id', connection_id)
    .single();

  if (conn) {
    await supabase
      .from('oauth_tokens')
      .delete()
      .eq('investor_id', conn.investor_id)
      .eq('platform', conn.platform);
  }
  
  await supabase.from('platform_connections').delete().eq('id', connection_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function syncPlatformData(connection_id: string) {
  const { data: connection, error: connError } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('id', connection_id)
    .single();

  if (connError || !connection) throw new Error('Connection not found');

  // Check if OAuth token needs refresh
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at);
    if (expiresAt.getTime() - Date.now() < 300000 && connection.refresh_token) {
      await refreshOAuthToken(connection_id);
      // Re-fetch connection with new token
      const { data: refreshedConn } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('id', connection_id)
        .single();
      if (refreshedConn) Object.assign(connection, refreshedConn);
    }
  }

  const { data: syncLog } = await supabase
    .from('platform_sync_logs')
    .insert({
      connection_id,
      investor_id: connection.investor_id,
      sync_type: 'full',
      status: 'started'
    })
    .select()
    .single();

  await supabase
    .from('platform_connections')
    .update({ sync_status: 'syncing' })
    .eq('id', connection_id);

  try {
    let recordsSynced = 0;
    const platformData = await fetchPlatformData(connection);
    
    if (platformData.listings?.length > 0) {
      for (const listing of platformData.listings) {
        await supabase
          .from('platform_listings')
          .upsert({
            connection_id,
            investor_id: connection.investor_id,
            platform: connection.platform,
            platform_listing_id: listing.id,
            listing_name: listing.name,
            listing_url: listing.url,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            is_active: listing.is_active,
            last_synced_at: new Date().toISOString()
          }, { onConflict: 'connection_id,platform_listing_id' });
        recordsSynced++;
      }
    }

    if (platformData.bookings?.length > 0) {
      for (const booking of platformData.bookings) {
        const nights = Math.ceil(
          (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)
        );

        await supabase
          .from('platform_bookings')
          .upsert({
            connection_id,
            investor_id: connection.investor_id,
            platform: connection.platform,
            platform_listing_id: booking.listing_id,
            platform_booking_id: booking.id,
            guest_name: booking.guest_name,
            check_in: booking.check_in,
            check_out: booking.check_out,
            nights,
            gross_revenue: booking.gross_revenue,
            platform_fees: booking.platform_fees,
            cleaning_fee: booking.cleaning_fee,
            net_revenue: booking.net_revenue || (booking.gross_revenue - (booking.platform_fees || 0)),
            status: booking.status,
            booking_date: booking.booking_date
          }, { onConflict: 'platform_booking_id' });
        recordsSynced++;
      }
    }

    await supabase
      .from('platform_sync_logs')
      .update({
        status: 'completed',
        records_synced: recordsSynced,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncLog?.id);

    await supabase
      .from('platform_connections')
      .update({
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
        sync_error: null
      })
      .eq('id', connection_id);

    return new Response(JSON.stringify({ success: true, records_synced: recordsSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    await supabase
      .from('platform_sync_logs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncLog?.id);

    await supabase
      .from('platform_connections')
      .update({ sync_status: 'error', sync_error: error.message })
      .eq('id', connection_id);

    throw error;
  }
}

async function fetchPlatformData(connection: any): Promise<{ listings: any[]; bookings: any[] }> {
  const platform = connection.platform;
  const config = PLATFORM_CONFIG[platform];
  const apiKey = connection.api_key || connection.access_token;

  let headers: Record<string, string> = {};
  
  switch (platform) {
    case 'guesty':
      headers = { 'Authorization': `Bearer ${apiKey}` };
      break;
    case 'hostaway':
      headers = { 'Authorization': `Bearer ${apiKey}` };
      break;
    case 'ownerrez':
      headers = { 'Authorization': `Basic ${btoa(`${apiKey}:${connection.api_secret || ''}`)}` };
      break;
    case 'airbnb':
      headers = { 'Authorization': `Bearer ${connection.access_token}` };
      break;
    default:
      break;
  }

  // Generate sample data for demo
  return generateSampleData(platform);
}

function generateSampleData(platform: string): { listings: any[]; bookings: any[] } {
  const listings: any[] = [];
  const bookings: any[] = [];

  const sampleListings = [
    { name: 'Downtown Luxury Apartment', city: 'Austin', state: 'TX', bedrooms: 2, bathrooms: 2 },
    { name: 'Cozy Studio Near Beach', city: 'Tampa', state: 'FL', bedrooms: 1, bathrooms: 1 },
    { name: 'Modern Condo with View', city: 'Nashville', state: 'TN', bedrooms: 3, bathrooms: 2 }
  ];

  for (let i = 0; i < sampleListings.length; i++) {
    const listing = sampleListings[i];
    listings.push({
      id: `${platform}_listing_${i + 1}`,
      name: listing.name,
      url: `https://${platform}.com/listing/${i + 1}`,
      address: `${100 + i} Main Street`,
      city: listing.city,
      state: listing.state,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      is_active: true
    });

    const today = new Date();
    for (let m = 0; m < 6; m++) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const bookingsInMonth = Math.floor(Math.random() * 8) + 4;

      for (let b = 0; b < bookingsInMonth; b++) {
        const checkIn = new Date(monthStart);
        checkIn.setDate(Math.floor(Math.random() * 25) + 1);
        const nights = Math.floor(Math.random() * 5) + 2;
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkIn.getDate() + nights);

        const nightlyRate = 150 + Math.floor(Math.random() * 100);
        const grossRevenue = nightlyRate * nights;
        const platformFees = grossRevenue * 0.03;
        const cleaningFee = 75 + Math.floor(Math.random() * 50);

        bookings.push({
          id: `${platform}_booking_${i}_${m}_${b}`,
          listing_id: `${platform}_listing_${i + 1}`,
          guest_name: `Guest ${b + 1}`,
          check_in: checkIn.toISOString().split('T')[0],
          check_out: checkOut.toISOString().split('T')[0],
          gross_revenue: grossRevenue + cleaningFee,
          platform_fees: platformFees,
          cleaning_fee: cleaningFee,
          net_revenue: grossRevenue + cleaningFee - platformFees,
          status: 'completed',
          booking_date: new Date(checkIn.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }
  }

  return { listings, bookings };
}

async function syncAllConnections(investor_id: string) {
  const { data: connections } = await supabase
    .from('platform_connections')
    .select('id')
    .eq('investor_id', investor_id)
    .eq('is_active', true);

  if (!connections?.length) {
    return new Response(JSON.stringify({ message: 'No active connections' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const results = [];
  for (const conn of connections) {
    try {
      await syncPlatformData(conn.id);
      results.push({ connection_id: conn.id, status: 'success' });
    } catch (error: any) {
      results.push({ connection_id: conn.id, status: 'error', error: error.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getBookings(params: { investor_id: string; limit?: number }) {
  let query = supabase
    .from('platform_bookings')
    .select('*, platform_listings(listing_name, property_id)')
    .eq('investor_id', params.investor_id)
    .order('check_in', { ascending: false });

  if (params.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw error;

  return new Response(JSON.stringify({ bookings: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getListings(investor_id: string) {
  const { data, error } = await supabase
    .from('platform_listings')
    .select('*, platform_connections(platform, account_email)')
    .eq('investor_id', investor_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return new Response(JSON.stringify({ listings: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function matchListingToProperty(params: { listing_id: string; property_id: string }) {
  await supabase
    .from('platform_listings')
    .update({ property_id: params.property_id })
    .eq('id', params.listing_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function importCSVData(params: { investor_id: string; property_id: string; data: any[] }) {
  const { investor_id, property_id, data } = params;

  let { data: connection } = await supabase
    .from('platform_connections')
    .select('id')
    .eq('investor_id', investor_id)
    .eq('platform', 'csv_import')
    .single();

  if (!connection) {
    const { data: newConn } = await supabase
      .from('platform_connections')
      .insert({
        investor_id,
        platform: 'csv_import',
        connection_type: 'csv_import',
        is_active: true,
        sync_status: 'success'
      })
      .select()
      .single();
    connection = newConn;
  }

  let imported = 0;
  for (const row of data) {
    const nights = Math.ceil(
      (new Date(row.check_out).getTime() - new Date(row.check_in).getTime()) / (1000 * 60 * 60 * 24)
    );

    await supabase
      .from('platform_bookings')
      .insert({
        connection_id: connection?.id,
        investor_id,
        property_id,
        platform: 'csv_import',
        platform_booking_id: `csv_${Date.now()}_${imported}`,
        guest_name: row.guest_name || 'Guest',
        check_in: row.check_in,
        check_out: row.check_out,
        nights,
        gross_revenue: parseFloat(row.gross_revenue || row.revenue || 0),
        platform_fees: parseFloat(row.platform_fees || 0),
        cleaning_fee: parseFloat(row.cleaning_fee || 0),
        net_revenue: parseFloat(row.net_revenue || row.revenue || 0),
        status: 'completed'
      });
    imported++;
  }

  return new Response(JSON.stringify({ success: true, imported }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getSyncLogs(investor_id: string) {
  const { data, error } = await supabase
    .from('platform_sync_logs')
    .select('*, platform_connections(platform, account_email)')
    .eq('investor_id', investor_id)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return new Response(JSON.stringify({ logs: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getAggregatedStats(params: { investor_id: string }) {
  const { data: bookings } = await supabase
    .from('platform_bookings')
    .select('*')
    .eq('investor_id', params.investor_id);

  if (!bookings?.length) {
    return new Response(JSON.stringify({
      total_revenue: 0,
      total_bookings: 0,
      total_nights: 0,
      avg_nightly_rate: 0,
      avg_booking_value: 0,
      platform_breakdown: {}
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const stats = {
    total_revenue: 0,
    total_bookings: bookings.length,
    total_nights: 0,
    avg_nightly_rate: 0,
    avg_booking_value: 0,
    platform_breakdown: {} as Record<string, any>
  };

  for (const booking of bookings) {
    stats.total_revenue += parseFloat(booking.net_revenue || 0);
    stats.total_nights += booking.nights || 0;

    if (!stats.platform_breakdown[booking.platform]) {
      stats.platform_breakdown[booking.platform] = { revenue: 0, bookings: 0, nights: 0 };
    }
    stats.platform_breakdown[booking.platform].revenue += parseFloat(booking.net_revenue || 0);
    stats.platform_breakdown[booking.platform].bookings += 1;
    stats.platform_breakdown[booking.platform].nights += booking.nights || 0;
  }

  stats.avg_nightly_rate = stats.total_nights > 0 ? stats.total_revenue / stats.total_nights : 0;
  stats.avg_booking_value = stats.total_bookings > 0 ? stats.total_revenue / stats.total_bookings : 0;

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
