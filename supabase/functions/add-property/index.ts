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
// add-property v8.0 - Save photos to both properties.photos AND property_photos table, trigger background processing
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, error: 'Database configuration missing' }), { 
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const body = await req.json();
    const {
      title, listing_title, address, description, city, state, zip_code, 
      bedrooms, bathrooms, sqft, monthly_rent, price, cap_rate, 
      property_type, operation_type, photos, landlord_name, landlord_email, 
      landlord_phone, listing_url, internal_notes, status = 'new',
      acquisition_fee, is_furnished, property_categories, source,
      is_featured = false, is_published = false, featured = false,
      is_verified = false, staff_verified = false,
      added_by_staff_id, added_by_staff_name
    } = body;

    if (!address?.trim() || !city?.trim() || !state?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Address, city, and state are required' }), { 
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const finalTitle = (listing_title || title || '').trim() || `${bedrooms || 3}BR in ${city.trim()}`;
    const isFurnished = is_furnished === true || is_furnished === 'true';
    const isFeatured = is_featured === true || featured === true;
    
    // Ensure photos is an array
    const photoArray = Array.isArray(photos) ? photos : [];

    const insertData = {
      title: finalTitle,
      listing_title: finalTitle,
      address: address.trim(),
      description: (description || '').trim() || null,
      city: city.trim(),
      state: state.toUpperCase().trim().substring(0, 2),
      zip_code: (zip_code || '').trim() || null,
      bedrooms: parseInt(String(bedrooms)) || 3,
      bathrooms: parseFloat(String(bathrooms)) || 2,
      sqft: parseInt(String(sqft)) || null,
      monthly_rent: parseFloat(String(monthly_rent)) || 0,
      price: parseFloat(String(price)) || null,
      cap_rate: parseFloat(String(cap_rate)) || null,
      property_type: property_type || 'single_family',
      operation_type: operation_type || 'str',
      photos: photoArray, // Save to properties.photos array
      landlord_name: landlord_name || null,
      landlord_email: landlord_email || null,
      landlord_phone: landlord_phone || null,
      listing_url: listing_url || null,
      internal_notes: internal_notes || null,
      status: status,
      deal_status: status,
      workflow_stage: 'new',
      workflow_stage_entered_at: new Date().toISOString(),
      acquisition_fee: parseFloat(String(acquisition_fee)) || 2500,
      is_furnished: isFurnished,
      is_featured: isFeatured,
      featured: isFeatured,
      is_published: is_published === true,
      source: source || 'acquisition_team',
      is_verified: is_verified === true,
      staff_verified: staff_verified === true,
      property_categories: Array.isArray(property_categories) ? property_categories : [],
      units_available: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Inserting property:', insertData.address, insertData.city, 'photos:', photoArray.length);

    const response = await fetch(`${supabaseUrl}/rest/v1/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertData)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Insert error:', response.status, responseText);
      return new Response(JSON.stringify({ success: false, error: responseText }), { 
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const data = JSON.parse(responseText);
    const property = Array.isArray(data) ? data[0] : data;

    if (!property?.id) {
      return new Response(JSON.stringify({ success: false, error: 'Property not created' }), { 
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Save photos to property_photos table AND trigger background processing
    let photosQueued = 0;
    if (photoArray.length > 0) {
      console.log('Saving photos to property_photos table:', photoArray.length);
      
      for (let i = 0; i < photoArray.length; i++) {
        const photoUrl = photoArray[i];
        try {
          // Insert into property_photos table
          const photoInsertResponse = await fetch(`${supabaseUrl}/rest/v1/property_photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              property_id: property.id,
              original_url: photoUrl,
              processed_url: photoUrl, // Initially same as original
              display_order: i,
              is_primary: i === 0,
              processing_status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          });

          if (photoInsertResponse.ok) {
            photosQueued++;
          } else {
            console.error('Failed to insert photo:', await photoInsertResponse.text());
          }
        } catch (e) {
          console.error('Error inserting photo:', e);
        }
      }

      // Trigger background photo processing
      try {
        console.log('Triggering background photo processing for property:', property.id);
        fetch(`${supabaseUrl}/functions/v1/background-photo-processing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            action: 'process_property',
            property_id: property.id
          })
        }).catch(e => console.error('Background processing trigger error:', e));
      } catch (e) {
        console.error('Error triggering background processing:', e);
      }
    }

    // Trigger Penny AI scoring
    let pennyScore = null;
    let pennyRecommendation = null;
    
    try {
      const scoringResponse = await fetch(`${supabaseUrl}/functions/v1/penny-deal-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ action: 'score_property', property_id: property.id, property_data: property })
      });

      if (scoringResponse.ok) {
        const scoreResult = await scoringResponse.json();
        if (scoreResult.score !== undefined) {
          pennyScore = scoreResult.score;
          pennyRecommendation = scoreResult.recommendation;
          
          await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ penny_score: pennyScore, penny_recommendation: pennyRecommendation, penny_scored_at: new Date().toISOString() })
          });
          
          property.penny_score = pennyScore;
          property.penny_recommendation = pennyRecommendation;
        }
      }
    } catch (e) {
      console.error('Penny scoring error:', e);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      property,
      photos_queued: photosQueued,
      penny_score: pennyScore,
      penny_recommendation: pennyRecommendation,
      message: `Property added successfully with ${photosQueued} photos queued for processing` + (pennyScore ? ` (Penny Score: ${pennyScore})` : '')
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('Add property error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

