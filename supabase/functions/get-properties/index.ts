import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // THIS FUNCTION IS NAMED get-properties AND ONLY EVER CREATED ONE. Two screens called it
  // expecting a read and got a property inserted or an error. The name has been a lie since
  // it was written, and the acquisition manager's deal list has been empty because of it.
  //
  // Adding the read the name promises rather than renaming the function, because the slug
  // is deployed and referenced elsewhere.
  try {
    const peek = await req.clone().json().catch(() => ({}));

    // FETCHING ONE PROPERTY BY ID. This branch did not exist. The deal detail page has always
    // called this function with { id }, got back a list-shaped response with no matching
    // property, fallen through to a direct query, and shown "not found" on deals that are
    // right there on the marketplace.
    //
    // Every deal card was clickable and every one of them dead-ended.
    if (peek?.id && !peek?.action) {
      const u = Deno.env.get('SUPABASE_URL');
      const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const isStaff = peek.caller_type === 'staff';
      let q = `${u}/rest/v1/properties?select=*&id=eq.${encodeURIComponent(String(peek.id))}&limit=1`;
      // A non-staff caller may only see a published deal. Staff see it whatever its state.
      if (!isStaff) q += `&or=(is_published.is.true,status.in.(published,active,approved))`;
      const r = await fetch(q, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
      if (!r.ok) {
        console.error('get-properties by_id_http', r.status);
        return new Response(JSON.stringify({ success: false, error: `Could not load that deal (${r.status}).` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rows = await r.json();
      const property = Array.isArray(rows) ? rows[0] : null;
      if (!property) {
        return new Response(JSON.stringify({ success: false, error: 'That deal is not available.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // The address and the landlord are withheld from anyone who is not staff. The deal
      // presentation mechanic depends on this, so it is stripped SERVER SIDE rather than
      // nulled in the browser where it would still be on the wire.
      if (!isStaff) {
        property.address = null;
        property.landlord_name = null;
        property.landlord_phone = null;
        property.landlord_email = null;
        property.original_url = null;
        property.processed_url = null;
      }
      return new Response(JSON.stringify({ success: true, property }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (peek?.action === 'get_all') {
      const u = Deno.env.get('SUPABASE_URL');
      const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      let q = `${u}/rest/v1/properties?select=*&order=created_at.desc&limit=500`;
      // Private deals are staff-only. Default to published unless explicitly asked.
      if (!peek.include_private) q += `&or=(is_published.is.true,status.in.(published,active,approved))`;
      const r = await fetch(q, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: `Could not load properties (${r.status}).` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const raw = await r.json();
      // The list is public. Strip the address, the landlord and the source URLs unless the
      // caller is staff, SERVER SIDE -- nulling these in the browser leaves the real values
      // on the wire for anyone who opens devtools, which is what the deal presentation
      // mechanic exists to prevent.
      const isStaffList = peek.caller_type === 'staff' || peek.include_private === true;
      const properties = Array.isArray(raw) && !isStaffList
        ? raw.map((row: Record<string, unknown>) => ({
            ...row,
            address: null, landlord_name: null, landlord_phone: null,
            landlord_email: null, original_url: null, processed_url: null,
          }))
        : raw;
      return new Response(JSON.stringify({ success: true, properties, count: properties?.length ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch { /* not a read; fall through to the create path below */ }

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
