import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { zip_code, city, state, search_type } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const googleKey = Deno.env.get('GOOGLE_API_KEY')
    const googleCx = Deno.env.get('GOOGLE_CX')

    // 1. Search existing database properties
    let dbQuery = `${supabaseUrl}/rest/v1/properties?select=*&status=in.(approved,new,pending)`
    if (zip_code) dbQuery += `&zip_code=eq.${zip_code}`
    if (city) dbQuery += `&city=ilike.%${city}%`
    if (state) dbQuery += `&state=eq.${state.toUpperCase()}`
    dbQuery += '&limit=20'

    const dbResponse = await fetch(dbQuery, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const existingDeals = await dbResponse.json()

    // 2. Search web for additional listings using Google Custom Search
    let webListings: any[] = []
    if (googleKey && googleCx) {
      const searchQuery = `${search_type === 'str' ? 'vacation rental' : 'rental property'} ${city || ''} ${state || ''} ${zip_code || ''}`
      const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=10`
      
      try {
        const googleRes = await fetch(googleUrl)
        const googleData = await googleRes.json()
        
        if (googleData.items) {
          webListings = googleData.items.map((item: any, idx: number) => ({
            id: `web-${idx}-${Date.now()}`,
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: new URL(item.link).hostname
          }))
        }
      } catch (e) {
        console.error('Google search error:', e)
      }
    }

    // 3. Generate AI market analysis
    let marketData = null
    if (anthropicKey && (zip_code || city)) {
      try {
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: `Analyze the ${search_type === 'str' ? 'short-term rental' : 'rental'} market for ${city || ''} ${state || ''} ${zip_code || ''}. 
              
              Provide a JSON response with:
              {
                "estimated_adr": number (average daily rate for STR),
                "occupancy_rate": number (percentage),
                "coliving_rate": number (monthly per room),
                "competition_level": "low" | "medium" | "high",
                "market_score": number (1-10),
                "insights": string[] (3-5 key insights)
              }
              
              Only respond with valid JSON, no other text.`
            }]
          })
        })

        const aiData = await aiResponse.json()
        if (aiData.content?.[0]?.text) {
          marketData = JSON.parse(aiData.content[0].text)
        }
      } catch (e) {
        console.error('AI analysis error:', e)
        // Provide fallback market data
        marketData = {
          estimated_adr: 150,
          occupancy_rate: 65,
          coliving_rate: 850,
          competition_level: 'medium',
          market_score: 7,
          insights: ['Market data analysis in progress', 'Check back for updated insights']
        }
      }
    }

    return new Response(JSON.stringify({
      existing_deals: existingDeals || [],
      existing_deals_count: existingDeals?.length || 0,
      listings: webListings,
      listings_count: webListings.length,
      market_data: marketData,
      zip_code,
      city,
      state,
      search_type
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
