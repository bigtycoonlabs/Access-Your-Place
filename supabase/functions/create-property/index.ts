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
    const body = await req.json().catch(() => ({}))
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Build query URL with filters
    let url = `${supabaseUrl}/rest/v1/properties?select=*,deal_analytics(*),property_photos(*)&order=created_at.desc`
    
    if (body.status) url += `&status=eq.${body.status}`
    if (body.source) url += `&source=eq.${body.source}`
    if (body.property_type) url += `&property_type=eq.${body.property_type}`
    if (body.is_published !== undefined) url += `&is_published=eq.${body.is_published}`
    if (body.zip_code) url += `&zip_code=eq.${body.zip_code}`
    if (body.city) url += `&city=ilike.*${body.city}*`
    if (body.address) url += `&or=(address.ilike.*${body.address}*,listing_title.ilike.*${body.address}*)`
    if (body.limit) url += `&limit=${body.limit}`

    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    const properties = await response.json()

    return new Response(JSON.stringify({ 
      properties: properties || [],
      count: properties?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get properties error:', error)
    return new Response(JSON.stringify({ 
      properties: [], 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
