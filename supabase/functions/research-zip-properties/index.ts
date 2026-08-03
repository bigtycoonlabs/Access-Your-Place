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
// Version 2 - Enhanced AI property discovery with better error handling
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Timeout wrapper for fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 15000): Promise<Response> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
  return Promise.race([fetch(url, options), timeoutPromise]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { zip_code, city, state, property_type = 'all', min_beds = 2 } = await req.json();
    
    if (!zip_code) throw new Error('ZIP code is required');

    console.log('Research ZIP properties:', { zip_code, city, state });

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY');
    const googleKey = Deno.env.get('GOOGLE_API_KEY');
    const googleCx = Deno.env.get('GOOGLE_CX');

    let analysis = null;
    let webListings: any[] = [];

    // Use AI to generate market analysis
    if (gatewayApiKey) {
      try {
        console.log('Fetching AI market analysis...');
        const aiRes = await fetchWithTimeout('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': gatewayApiKey },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: `Analyze ZIP code ${zip_code}${city ? ` (${city}, ${state})` : ''} for short-term rental and co-living investment. Return ONLY valid JSON (no markdown): { "str_score": number 1-10, "coliving_score": number 1-10, "avg_rent_2br": number, "avg_rent_3br": number, "str_avg_adr": number, "str_avg_occupancy": number 0-1, "coliving_room_rate": number, "regulations": "friendly|moderate|strict", "competition_level": "low|medium|high", "recommended_strategy": "str|coliving|hybrid", "risk_factors": ["string"], "opportunity_notes": "string", "demand_drivers": ["string"], "peak_months": [number], "slow_months": [number] }`
            }],
            temperature: 0.3,
            max_tokens: 800
          })
        }, 15000);
        
        console.log('AI response status:', aiRes.status);
        
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysis = JSON.parse(jsonMatch[0]);
              console.log('Market analysis parsed successfully');
            } catch (e) {
              console.error('JSON parse error:', e);
            }
          }
        }
      } catch (e: any) {
        console.error('AI analysis error:', e.message);
      }
    }

    // Search for rental listings using Google Custom Search
    if (googleKey && googleCx) {
      try {
        const searchQuery = `rental property ${zip_code} ${city || ''} ${state || ''} for rent ${min_beds}+ bedrooms`;
        console.log('Google search query:', searchQuery);
        
        const searchRes = await fetchWithTimeout(
          `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=10`,
          { method: 'GET' },
          10000
        );
        
        console.log('Google search status:', searchRes.status);
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          
          if (searchData.items && Array.isArray(searchData.items)) {
            console.log('Found Google results:', searchData.items.length);
            
            webListings = searchData.items.map((item: any, idx: number) => {
              const bedroomMatch = (item.title + ' ' + item.snippet).match(/(\d+)\s*(bed|br|bedroom)/i);
              const bathroomMatch = (item.title + ' ' + item.snippet).match(/(\d+\.?\d*)\s*(bath|ba|bathroom)/i);
              const priceMatch = (item.title + ' ' + item.snippet).match(/\$(\d{1,3}(?:,\d{3})*|\d+)/);
              const sqftMatch = (item.title + ' ' + item.snippet).match(/(\d{1,3}(?:,\d{3})*)\s*(?:sq\s*ft|sqft|square\s*feet)/i);

              return {
                id: `web-${Date.now()}-${idx}`,
                title: item.title?.substring(0, 100) || 'Rental Property',
                description: item.snippet || '',
                source_url: item.link,
                bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : null,
                bathrooms: bathroomMatch ? parseFloat(bathroomMatch[1]) : null,
                monthly_rent: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null,
                sqft: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : null,
                city: city || '',
                state: state || '',
                zip_code: zip_code,
                source: 'web_discovery',
                is_verified: false,
                requires_verification: true
              };
            }).filter((l: any) => l.bedrooms && l.bedrooms >= min_beds);
          }
        }
      } catch (e: any) {
        console.error('Google search error:', e.message);
      }
    }

    // Default analysis if AI failed
    if (!analysis) {
      analysis = {
        str_score: 7,
        coliving_score: 7,
        avg_rent_2br: 1800,
        avg_rent_3br: 2400,
        str_avg_adr: 150,
        str_avg_occupancy: 0.65,
        coliving_room_rate: 850,
        regulations: 'moderate',
        competition_level: 'medium',
        recommended_strategy: 'hybrid',
        risk_factors: ['Market conditions vary - verify locally'],
        opportunity_notes: 'Analysis based on regional averages. Recommend local market research.',
        demand_drivers: ['Tourism', 'Business travel', 'Relocations'],
        peak_months: [3, 6, 7, 10],
        slow_months: [1, 2, 9]
      };
    }

    // Format market data for frontend
    const marketData = {
      zip_code,
      city: city || '',
      state: state || '',
      avg_rent_2br: analysis.avg_rent_2br,
      avg_rent_3br: analysis.avg_rent_3br,
      str_avg_adr: analysis.str_avg_adr,
      str_avg_occupancy: analysis.str_avg_occupancy,
      str_regulations: analysis.regulations,
      str_score: analysis.str_score,
      coliving_score: analysis.coliving_score,
      coliving_room_rate: analysis.coliving_room_rate,
      competition_level: analysis.competition_level,
      recommended_strategy: analysis.recommended_strategy,
      risk_factors: analysis.risk_factors,
      opportunity_notes: analysis.opportunity_notes,
      demand_drivers: analysis.demand_drivers,
      peak_months: analysis.peak_months,
      slow_months: analysis.slow_months
    };

    return new Response(JSON.stringify({
      success: true,
      zip_code,
      market_data: marketData,
      listings: webListings,
      properties_found: webListings.length,
      analysis_source: gatewayApiKey ? 'ai' : 'default'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('Research ZIP error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
