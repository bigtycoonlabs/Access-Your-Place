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
    const body = await req.json()
    const { action, investor_id, city, state, zip_code, max_price, min_bedrooms, operation_type, search_ai } = body
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    // Handle different actions
    if (action === 'get_recommendations') {
      // Get investor preferences
      const investorRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=*`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const investors = await investorRes.json()
      const investor = investors?.[0]

      // Get recommended properties based on preferences
      let query = `${supabaseUrl}/rest/v1/properties?select=*&status=eq.approved`
      if (investor?.preferred_markets?.length > 0) {
        const markets = investor.preferred_markets.map((m: string) => `city.ilike.%${m}%`).join(',')
        query += `&or=(${markets})`
      }
      query += '&limit=6&order=created_at.desc'

      const propsRes = await fetch(query, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      })
      const recommendations = await propsRes.json()

      return new Response(JSON.stringify({ recommendations: recommendations || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'get_assigned_deals') {
      // Get deals assigned to this investor
      const assignedRes = await fetch(
        `${supabaseUrl}/rest/v1/acquisition_assignments?investor_id=eq.${investor_id}&select=*,properties(*)`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const assigned = await assignedRes.json()

      return new Response(JSON.stringify({ assigned_deals: assigned || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Default: Search for deals
    let query = `${supabaseUrl}/rest/v1/properties?select=*&status=eq.approved`
    if (city) query += `&city=ilike.%${city}%`
    if (state) query += `&state=eq.${state.toUpperCase()}`
    if (zip_code) query += `&zip_code=eq.${zip_code}`
    if (max_price) query += `&monthly_rent=lte.${max_price}`
    if (min_bedrooms) query += `&bedrooms=gte.${min_bedrooms}`
    if (operation_type && operation_type !== 'all') query += `&operation_type=eq.${operation_type}`
    query += '&limit=50&order=created_at.desc'

    const dealsRes = await fetch(query, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    const deals = await dealsRes.json()

    // AI-discovered deals (simulated for now, would use web scraping in production)
    let aiDeals: any[] = []
    if (search_ai && anthropicKey && (city || zip_code)) {
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
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: `Generate 3 realistic rental property listings for ${city || 'the area'}, ${state || 'TX'} ${zip_code || ''}.
              
              Each listing should have:
              - title: Property title
              - city: City name
              - state: State abbreviation
              - zip_code: ZIP code
              - bedrooms: Number of bedrooms (3-5)
              - bathrooms: Number of bathrooms (2-4)
              - description: Brief description
              - estimated_rent: Monthly rent estimate
              
              Return as JSON array. Only respond with valid JSON, no other text.`
            }]
          })
        })

        const aiData = await aiResponse.json()
        if (aiData.content?.[0]?.text) {
          const parsed = JSON.parse(aiData.content[0].text)
          aiDeals = parsed.map((p: any, idx: number) => ({
            ...p,
            id: `ai-${idx}-${Date.now()}`,
            source: 'penny_ai',
            verified: false
          }))
        }
      } catch (e) {
        console.error('AI search error:', e)
      }
    }

    return new Response(JSON.stringify({
      deals: deals || [],
      ai_deals: aiDeals,
      total: (deals?.length || 0) + aiDeals.length
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
