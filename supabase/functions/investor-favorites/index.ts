import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { action, investor_id, property_id, property_data } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!, supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    if (action === 'list') {
      const res = await fetch(`${supabaseUrl}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&select=*,properties(*)`, { headers })
      const favorites = await res.json()
      return new Response(JSON.stringify({ favorites: favorites || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'add') {
      // Check if already favorited
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`, { headers })
      const existing = await checkRes.json()
      if (existing?.length) return new Response(JSON.stringify({ success: true, already_exists: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      
      await fetch(`${supabaseUrl}/rest/v1/investor_favorites`, { method: 'POST', headers, body: JSON.stringify({ investor_id, property_id, property_data }) })
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'remove') {
      await fetch(`${supabaseUrl}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}`, { method: 'DELETE', headers })
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'check') {
      const res = await fetch(`${supabaseUrl}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`, { headers })
      const data = await res.json()
      return new Response(JSON.stringify({ is_favorited: data?.length > 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
})
