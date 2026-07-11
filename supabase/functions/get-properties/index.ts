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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Build property object with all fields
    const property = {
      address: body.address || null,
      listing_title: body.listing_title || body.title || `${body.bedrooms || 3}BR in ${body.city}`,
      listing_description: body.description || body.listing_description || null,
      city: body.city,
      state: body.state?.toUpperCase() || 'TX',
      zip_code: body.zip_code || null,
      bedrooms: parseInt(body.bedrooms) || 3,
      bathrooms: parseFloat(body.bathrooms) || 2,
      square_feet: body.square_feet || null,
      monthly_rent: parseFloat(body.monthly_rent) || 0,
      acquisition_fee: parseFloat(body.acquisition_fee) || 2500,
      property_type: body.property_type || 'single_family',
      operation_type: body.operation_type || 'str',
      source: body.source || 'acquisition_team',
      status: body.status || 'new',
      deal_status: body.deal_status || body.status || 'new',
      is_furnished: body.is_furnished || false,
      is_verified: body.is_verified || false,
      is_published: body.is_published || false,
      units_available: body.units_available || 1,
      landlord_name: body.landlord_name || null,
      landlord_email: body.landlord_email || null,
      landlord_phone: body.landlord_phone || null,
      listing_url: body.listing_url || null,
      property_categories: body.property_categories || [],
      assigned_to: body.assigned_to || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insert property
    const response = await fetch(`${supabaseUrl}/rest/v1/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(property)
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to insert property')
    }

    const insertedProperty = Array.isArray(data) ? data[0] : data

    // Create initial analytics record
    if (insertedProperty?.id) {
      await fetch(`${supabaseUrl}/rest/v1/deal_analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          property_id: insertedProperty.id,
          str_adr: 0,
          str_occupancy: 0,
          str_yearly_revenue: 0,
          coliving_adr: 0,
          coliving_occupancy: 0,
          coliving_yearly_revenue: 0,
          str_viability_score: 0,
          coliving_viability_score: 0
        })
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      property: insertedProperty,
      message: 'Property added successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Add property error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
