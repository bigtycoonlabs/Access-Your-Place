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

// batch-score-properties - Background job to score all unscored properties
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

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database configuration missing');
    }

    const body = await req.json().catch(() => ({}));
    const { 
      limit = 50, 
      include_expired = true,
      force_rescore = false,
      market_filter = null 
    } = body;

    console.log('Batch scoring properties:', { limit, include_expired, force_rescore, market_filter });

    // Build query to find properties needing scoring
    let query = `select=id,listing_title,address,city,state,bedrooms,bathrooms,monthly_rent,property_type,operation_type,is_furnished,penny_score,penny_scored_at&limit=${limit}`;
    
    if (force_rescore) {
      // Rescore all properties
      query += '&order=created_at.desc';
    } else if (include_expired) {
      // Get properties without score OR with expired scores (older than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query += `&or=(penny_score.is.null,penny_scored_at.lt.${sevenDaysAgo})&order=penny_scored_at.asc.nullsfirst`;
    } else {
      // Only get properties without any score
      query += '&penny_score=is.null&order=created_at.desc';
    }

    if (market_filter) {
      query += `&city=ilike.*${market_filter}*`;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/properties?${query}`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch properties: ${response.status}`);
    }

    const properties = await response.json();
    console.log(`Found ${properties.length} properties to score`);

    if (properties.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No properties need scoring',
        scored: 0,
        failed: 0
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Score each property
    const results = {
      scored: 0,
      failed: 0,
      scores: [] as { id: string; title: string; score: number | null; error?: string }[]
    };

    for (const property of properties) {
      try {
        console.log(`Scoring property: ${property.id} - ${property.listing_title || property.address}`);
        
        const scoringResponse = await fetch(`${supabaseUrl}/functions/v1/penny-deal-scoring`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            action: 'score_property',
            property_id: property.id,
            property_data: property
          })
        });

        if (scoringResponse.ok) {
          const scoreResult = await scoringResponse.json();
          
          if (scoreResult.score !== undefined) {
            // Update property with penny_score
            await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                penny_score: scoreResult.score,
                penny_recommendation: scoreResult.recommendation,
                penny_scored_at: new Date().toISOString()
              })
            });
            
            results.scored++;
            results.scores.push({
              id: property.id,
              title: property.listing_title || property.address,
              score: scoreResult.score
            });
            console.log(`Scored ${property.id}: ${scoreResult.score}`);
          } else {
            results.failed++;
            results.scores.push({
              id: property.id,
              title: property.listing_title || property.address,
              score: null,
              error: 'No score returned'
            });
          }
        } else {
          const errorText = await scoringResponse.text();
          results.failed++;
          results.scores.push({
            id: property.id,
            title: property.listing_title || property.address,
            score: null,
            error: errorText.substring(0, 100)
          });
          console.error(`Failed to score ${property.id}:`, errorText);
        }

        // Small delay to avoid overwhelming the scoring function
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err: any) {
        results.failed++;
        results.scores.push({
          id: property.id,
          title: property.listing_title || property.address,
          score: null,
          error: err.message
        });
        console.error(`Error scoring ${property.id}:`, err);
      }
    }

    // Log batch scoring activity
    try {
      await fetch(`${supabaseUrl}/rest/v1/system_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          log_type: 'batch_scoring',
          message: `Batch scored ${results.scored} properties, ${results.failed} failed`,
          details: { scored: results.scored, failed: results.failed, limit, include_expired },
          created_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Error logging batch scoring:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Batch scoring complete: ${results.scored} scored, ${results.failed} failed`,
      scored: results.scored,
      failed: results.failed,
      details: results.scores
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Batch scoring error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
