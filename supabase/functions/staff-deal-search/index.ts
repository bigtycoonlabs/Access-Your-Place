// Repointed 6 August 2026 from ai.gateway.fastrouter.io to OpenAI directly.
//
// That gateway is NOT this company's — the owner confirmed it is leftover code — and it
// carried the same GATEWAY_API_KEY as the payment gateway that was tombstoned the same
// day. Every deal search, article and photo description sent through it went to a third
// party nobody here controls.
//
// The gateway spoke the OpenAI chat-completions shape, so this is a base URL, an auth
// header and a model swap. google/gemini-2.5-flash becomes gpt-4o, which is the model the
// rest of this platform already runs on.
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
    const body = await req.json();
    const zip_code = body.zip_code || '';
    const city = body.city || '';
    const state = body.state || '';
    const search_type = body.search_type || 'rental';
    
    if (!zip_code && !city && !state) {
      throw new Error('ZIP code, city, or state is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const gatewayApiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY') || '';
    const googleCx = Deno.env.get('GOOGLE_CX') || '';

    // Build query URL for REST API - simple string building
    let dbUrl = supabaseUrl + '/rest/v1/properties?select=*&limit=20';
    
    // Add filters using simple string concatenation
    if (zip_code) {
      dbUrl = dbUrl + '&zip_code=eq.' + zip_code;
    } else if (city && state) {
      dbUrl = dbUrl + '&city=ilike.*' + city + '*&state=ilike.*' + state + '*';
    } else if (city) {
      dbUrl = dbUrl + '&city=ilike.*' + city + '*';
    } else if (state) {
      dbUrl = dbUrl + '&state=ilike.*' + state + '*';
    }

    // Fetch from database using REST API
    const dbResponse = await fetch(dbUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      }
    });

    // A failed read is not zero results. Returning an empty list on a failed query
    // told staff "no existing deals in this ZIP" when the truth was "the lookup did
    // not run". Somebody would then source a property already in the pipeline.
    let dbProperties = [];
    let dealsLookup = 'answered';
    let dealsLookupError = null;
    if (dbResponse.ok) {
      dbProperties = await dbResponse.json();
    } else {
      dealsLookup = 'unavailable';
      dealsLookupError = 'The existing-deal lookup failed with HTTP ' + dbResponse.status
        + '. This is not the same as there being no deals here. ' + (await dbResponse.text()).slice(0, 300);
      console.error('DB Query Error:', dealsLookupError);
    }

    // Map database properties to return format
    const existingDeals = dbProperties.map(function(p) {
      return {
        id: p.id,
        title: p.listing_title || p.title || p.address || (p.bedrooms + 'BR in ' + p.city),
        address: p.address || 'Address not available',
        city: p.city || '',
        state: p.state || '',
        zip_code: p.zip_code || '',
        bedrooms: p.bedrooms || 0,
        bathrooms: p.bathrooms || 0,
        monthly_rent: p.monthly_rent || 0,
        // `price` is a dead column, null on every row, so this always returned 0.
        // The acquisition fee is the price of the operation.
        acquisition_fee: p.acquisition_fee || 0,
        cap_rate: p.cap_rate || 0,
        property_type: p.property_type || 'single_family',
        operation_type: p.operation_type || 'str',
        status: p.status || 'new',
        source: 'database',
        is_in_dealflow: true,
        listing_url: p.listing_url || '',
        landlord_name: p.landlord_name || '',
        created_at: p.created_at
      };
    });

    // Search for rental listings using Google Custom Search
    const searchLocation = zip_code || city || '';
    const searchQuery = searchLocation + ' ' + state + ' house for rent ' + (search_type === 'str' ? 'short term rental airbnb' : 'long term lease');
    
    let listings = [];
    let marketData = null;

    if (googleApiKey && googleCx) {
      try {
        const searchUrl = 'https://www.googleapis.com/customsearch/v1?key=' + googleApiKey + '&cx=' + googleCx + '&q=' + encodeURIComponent(searchQuery) + '&num=10';
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (searchData.items) {
          listings = searchData.items.map(function(item, idx) {
            return {
              id: 'search-' + idx,
              title: item.title,
              snippet: item.snippet,
              link: item.link,
              source: item.displayLink || 'web'
            };
          });
        }
      } catch (e) {
        console.error('Google Search Error:', e);
      }
    }

    // Use AI to analyze market via API Gateway
    if (gatewayApiKey) {
      try {
        const locationParts = [city, state, zip_code].filter(function(x) { return x; });
        const location = locationParts.join(', ') || 'this area';
        
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${gatewayApiKey}` 
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{
              role: 'user',
              content: 'Analyze ' + location + ' for short-term rental and co-living investment. Return ONLY valid JSON (no markdown code blocks): {"estimated_adr": number, "occupancy_rate": number (0-100), "coliving_rate": number (monthly per room), "competition_level": "low"|"medium"|"high", "market_score": number (1-10), "insights": ["insight1", "insight2", "insight3"], "best_strategy": "str"|"coliving"|"ltr", "risk_factors": ["risk1", "risk2"]}'
            }],
            temperature: 0.3,
            max_tokens: 600
          })
        });
        
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try { 
              marketData = JSON.parse(jsonMatch[0]); 
            } catch (e) {
              console.error('JSON parse error:', e);
            }
          }
        }
      } catch (e) {
        console.error('AI Error:', e);
      }
    }

    // Default market data if AI fails
    if (!marketData) {
      marketData = {
        estimated_adr: 150,
        occupancy_rate: 65,
        coliving_rate: 850,
        competition_level: 'medium',
        market_score: 7,
        insights: ['Market data estimated based on regional averages'],
        best_strategy: 'str',
        risk_factors: ['Data based on estimates']
      };
    }

    return new Response(JSON.stringify({
      success: true,
      zip_code: zip_code || city || state,
      existing_deals: existingDeals,
      existing_deals_count: existingDeals.length,
      // 'answered' means the count is real. 'unavailable' means the lookup failed and
      // the count means nothing. Never present an unavailable count as zero deals.
      existing_deals_status: dealsLookup,
      existing_deals_error: dealsLookupError,
      listings: listings,
      listings_count: listings.length,
      market_data: marketData
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Staff deal search error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
