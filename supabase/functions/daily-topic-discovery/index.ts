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
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if today is Monday-Friday
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Weekend - topic discovery skipped',
        dayOfWeek
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Starting daily topic discovery for weekday:', dayOfWeek);

    // Run trending topics discovery
    const topicsResponse = await fetch(`${supabaseUrl}/functions/v1/discover-trending-topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({})
    });

    const topicsData = await topicsResponse.json();
    console.log('Topics discovered:', topicsData);

    // Run regulation monitoring
    const regulationsResponse = await fetch(`${supabaseUrl}/functions/v1/monitor-regulation-feeds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({})
    });

    const regulationsData = await regulationsResponse.json();
    console.log('Regulations monitored:', regulationsData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily topic discovery and regulation monitoring completed',
      topicsDiscovered: topicsData.topicsDiscovered || 0,
      regulationAlerts: regulationsData.alertsFound || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error in daily topic discovery:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

