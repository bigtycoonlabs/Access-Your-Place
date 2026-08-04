// geocode-address — resolve a free-text address or place to a normalized LOCATION (ZIP, city, state,
// coordinates) using Google Maps Geocoding.
//
// Why this exists: operators find properties off-platform (Zillow, driving around, a listing) and want
// Penny to run AYP's numbers on them. AYP's projection/deal engine is keyed on ZIP, so an address that
// doesn't include a ZIP can't be analyzed. This turns "4200 Manor Rd, Austin TX" or "a place in
// Denver" into the ZIP the engine needs.
//
// HONESTY — this is the whole reason to be careful here: geocoding resolves WHERE a place is. It does
// NOT know the home's bedrooms, its price, or its rent, and this function never returns or guesses any
// of those. Penny still gets the property's real details from the user (or asks). Nothing about the
// specific home is ever invented. If the key is missing or Google can't resolve the text, it returns
// success:false and Penny falls back to asking for a ZIP — a missing answer, never a made-up one.
//
// No DB, no money, no PII stored. verify_jwt false (callable by Penny and the platform tooling).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pickComponent(components: any[], type: string, useShort = false): string {
  const c = components.find((x) => Array.isArray(x.types) && x.types.includes(type))
  return c ? (useShort ? c.short_name : c.long_name) : ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const address = String(body?.address || '').trim()
    if (!address) {
      return new Response(JSON.stringify({ success: false, error: 'address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const key = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'geocoding not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
    const res = await fetch(url)
    const data = await res.json()

    // Surface Google's own status honestly so a restricted/disabled key is diagnosable, not silently
    // swallowed. status REQUEST_DENIED / OVER_QUERY_LIMIT etc. mean the key isn't usable here.
    if (data?.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'not_resolved', google_status: data?.status || 'unknown', google_message: data?.error_message || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const top = data.results[0]
    const comps = Array.isArray(top.address_components) ? top.address_components : []
    const zip = pickComponent(comps, 'postal_code')
    const city = pickComponent(comps, 'locality') || pickComponent(comps, 'sublocality') || pickComponent(comps, 'postal_town')
    const state = pickComponent(comps, 'administrative_area_level_1', true)
    const loc = top.geometry?.location || null

    return new Response(JSON.stringify({
      success: true,
      zip: zip || null,
      city: city || null,
      state: state || null,
      formatted_address: top.formatted_address || null,
      location: loc ? { lat: loc.lat, lng: loc.lng } : null,
      partial_match: top.partial_match === true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('geocode-address error:', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'geocode failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
