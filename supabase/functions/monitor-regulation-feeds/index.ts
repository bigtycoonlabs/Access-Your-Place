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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const apifyKey = Deno.env.get('APIFY_API_KEY') ?? '';
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const alerts = [];

    // Search for regulation news using Apify
    const regulationQueries = [
      'short term rental ban 2024',
      'airbnb regulations new law',
      'rental arbitrage illegal city',
      'str permit requirements changes'
    ];

    for (const query of regulationQueries) {
      try {
        const actorRun = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${apifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: query,
            maxPagesPerQuery: 1,
            resultsPerPage: 5,
            languageCode: 'en',
            countryCode: 'us'
          })
        });

        const runData = await actorRun.json();
        const runId = runData.data.id;

        // Wait for completion
        await new Promise(resolve => setTimeout(resolve, 5000));

        const resultsResponse = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}/dataset/items?token=${apifyKey}`);
        const results = await resultsResponse.json();

        for (const item of results.slice(0, 2)) {
          if (item.title && item.description) {
            // Determine severity based on keywords
            let severity = 'medium';
            const lowerTitle = item.title.toLowerCase();
            if (lowerTitle.includes('ban') || lowerTitle.includes('illegal')) {
              severity = 'critical';
            } else if (lowerTitle.includes('new law') || lowerTitle.includes('regulation')) {
              severity = 'high';
            }

            const alert = {
              title: item.title,
              description: item.description,
              source: 'Google News',
              source_url: item.url,
              city: extractCity(item.title),
              state: extractState(item.title),
              alert_type: 'regulation_change',
              severity
            };
            alerts.push(alert);
          }
        }
      } catch (error) {
        console.error(`Regulation search error:`, error);
      }
    }

    // Insert alerts and add high priority to queue
    let addedToQueue = 0;
    for (const alert of alerts) {
      const { data: inserted } = await supabaseClient
        .from('regulation_alerts')
        .insert(alert)
        .select()
        .single();

      if (inserted && (alert.severity === 'critical' || alert.severity === 'high')) {
        await supabaseClient.from('research_queue').insert({
          topic: `Breaking: ${alert.title}`,
          description: alert.description,
          source: 'Regulation Alert',
          source_url: alert.source_url,
          priority_score: alert.severity === 'critical' ? 95 : 85,
          status: 'pending'
        });
        
        await supabaseClient
          .from('regulation_alerts')
          .update({ added_to_queue: true })
          .eq('id', inserted.id);
          
        addedToQueue++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      alertsFound: alerts.length,
      addedToQueue
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('Regulation monitoring error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

function extractCity(text: string): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Austin', 'Denver', 'Miami', 'Atlanta', 'Nashville'];
  for (const city of cities) {
    if (text.includes(city)) return city;
  }
  return '';
}

function extractState(text: string): string {
  const states = ['CA', 'TX', 'NY', 'FL', 'CO', 'AZ', 'GA', 'TN'];
  for (const state of states) {
    if (text.includes(state)) return state;
  }
  return '';
}
