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
    const { property_id } = await req.json()
    
    if (!property_id) {
      throw new Error('Property ID is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Delete related records first (if not using CASCADE)
    await fetch(`${supabaseUrl}/rest/v1/deal_analytics?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/property_photos?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_tracking?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    await fetch(`${supabaseUrl}/rest/v1/outreach_notes?property_id=eq.${property_id}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })

    // Delete the property
    const response = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Property deleted successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
