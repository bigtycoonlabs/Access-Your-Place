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
// create-property v2.3 - NOT NULL safety + address_needs_update flag for placeholder addresses
// Save photos to both properties.photos AND property_photos table, trigger background processing
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const propertyData = await req.json();

    // v2.1: listing_description is a GENERATED column (GENERATED ALWAYS AS (description) STORED).
    if ('listing_description' in propertyData) {
      if (!propertyData.description && propertyData.listing_description) {
        propertyData.description = propertyData.listing_description;
      }
      delete propertyData.listing_description;
      console.log('[create-property v2.3] Stripped listing_description from payload, mapped to description');
    }

    // v2.3: Track whether we had to use a fallback address
    let usedFallbackAddress = false;

    // v2.2: Enforce NOT NULL constraints for address, city, state.
    if (!propertyData.address) {
      const parts = [propertyData.city, propertyData.state, propertyData.zip_code].filter(Boolean);
      propertyData.address = parts.length > 0 ? parts.join(', ') : '(Address pending)';
      usedFallbackAddress = true;
      console.log('[create-property v2.3] address was null, set fallback:', propertyData.address);
    }
    if (!propertyData.city) {
      propertyData.city = 'Unknown';
      console.log('[create-property v2.3] city was null, set fallback: Unknown');
    }
    if (!propertyData.state) {
      propertyData.state = 'XX';
      console.log('[create-property v2.3] state was null, set fallback: XX');
    }

    // v2.3: Detect placeholder-style addresses even if they were passed in explicitly
    const addr = (propertyData.address || '').trim();
    if (
      addr === '(Address pending)' ||
      addr === '' ||
      // Matches "City, ST" or "City, ST ZIP" patterns (no street number/name)
      /^[A-Za-z\s]+,\s*[A-Z]{2}(\s+\d{5})?$/.test(addr)
    ) {
      usedFallbackAddress = true;
    }

    // v2.3: Set the address_needs_update flag
    if (usedFallbackAddress) {
      propertyData.address_needs_update = true;
      console.log('[create-property v2.3] Flagged address_needs_update=true for:', propertyData.address);
    } else if (propertyData.address_needs_update === undefined) {
      propertyData.address_needs_update = false;
    }

    // Set default acquisition fee if not provided
    if (!propertyData.acquisition_fee) {
      propertyData.acquisition_fee = propertyData.furnished || propertyData.is_furnished ? 3000 : 2500;
    }

    // Ensure required fields have defaults
    propertyData.status = propertyData.status || 'new';
    propertyData.deal_status = propertyData.deal_status || propertyData.status || 'new';
    propertyData.workflow_stage = propertyData.workflow_stage || 'new';
    propertyData.workflow_stage_entered_at = propertyData.workflow_stage_entered_at || new Date().toISOString();
    propertyData.is_verified = propertyData.is_verified || false;
    propertyData.staff_verified = propertyData.staff_verified || false;
    propertyData.units_available = propertyData.units_available || 1;
    propertyData.created_at = new Date().toISOString();
    propertyData.updated_at = new Date().toISOString();

    // Ensure photos is an array and stored in properties.photos
    const photoArray = Array.isArray(propertyData.photos) ? propertyData.photos : [];
    propertyData.photos = photoArray;

    console.log('Creating property:', { 
      address: propertyData.address, 
      city: propertyData.city, 
      state: propertyData.state,
      address_needs_update: propertyData.address_needs_update,
      staff_verified: propertyData.staff_verified,
      photos_count: photoArray.length,
      has_description: !!propertyData.description
    });

    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .single();

    if (propError) {
      console.error('Property insert error:', propError);
      throw propError;
    }

    console.log('Property created:', property.id);

    // Save photos to property_photos table AND trigger background processing
    let photosQueued = 0;
    if (photoArray.length > 0) {
      console.log('Saving photos to property_photos table:', photoArray.length);
      
      for (let i = 0; i < photoArray.length; i++) {
        const photoUrl = photoArray[i];
        try {
          const { error: photoError } = await supabase
            .from('property_photos')
            .insert({
              property_id: property.id,
              original_url: photoUrl,
              processed_url: photoUrl,
              display_order: i,
              is_primary: i === 0,
              processing_status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (!photoError) {
            photosQueued++;
          } else {
            console.error('Failed to insert photo:', photoError);
          }
        } catch (e) {
          console.error('Error inserting photo:', e);
        }
      }

      // Trigger background photo processing (fire and forget)
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

    // Log activity
    try {
      await supabase.from('deal_activity_log').insert({
        property_id: property.id,
        activity_type: 'property_created',
        description: `Property created: ${property.address}, ${property.city} with ${photosQueued} photos${usedFallbackAddress ? ' (address needs update)' : ''}`,
        new_value: JSON.stringify({ source: property.source, status: property.deal_status, photos: photosQueued, address_needs_update: usedFallbackAddress }),
        performer_name: propertyData.created_by_name || 'System',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error logging activity:', e);
    }

    // Trigger Penny AI scoring automatically
    let pennyScore = null;
    let pennyRecommendation = null;
    try {
      console.log('Triggering Penny AI scoring for property:', property.id);
      const scoringResponse = await fetch(`${supabaseUrl}/functions/v1/penny-deal-scoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          action: 'score_property',
          property_id: property.id,
          property_data: property
        })
      });

      if (scoringResponse.ok) {
        const scoreResult = await scoringResponse.json();
        console.log('Penny Score calculated:', scoreResult.score);
        
        if (scoreResult.score !== undefined) {
          pennyScore = scoreResult.score;
          pennyRecommendation = scoreResult.recommendation;
          
          await supabase
            .from('properties')
            .update({
              penny_score: pennyScore,
              penny_recommendation: pennyRecommendation,
              penny_scored_at: new Date().toISOString()
            })
            .eq('id', property.id);
          
          property.penny_score = pennyScore;
          property.penny_recommendation = pennyRecommendation;
        }
      } else {
        console.error('Penny scoring failed:', await scoringResponse.text());
      }
    } catch (e) {
      console.error('Error triggering Penny scoring:', e);
    }

    // Notify matching investors about new deal
    if (property.deal_status === 'published' || property.deal_status === 'active') {
      try {
        await fetch(`${supabaseUrl}/functions/v1/notify-matching-investors`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${supabaseKey}` 
          },
          body: JSON.stringify({ type: 'new_deal', data: { property } })
        });
      } catch (e) { 
        console.error('Notification error:', e); 
      }
    }

    // Trigger intelligent deal matching for published deals
    if (property.deal_status === 'published' || property.deal_status === 'active') {
      try {
        await fetch(`${supabaseUrl}/functions/v1/intelligent-deal-matching`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${supabaseKey}` 
          },
          body: JSON.stringify({ 
            action: 'match_new_property', 
            property_id: property.id 
          })
        });
      } catch (e) { 
        console.error('Deal matching error:', e); 
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      property,
      photos_queued: photosQueued,
      penny_score: pennyScore,
      penny_recommendation: pennyRecommendation,
      address_needs_update: usedFallbackAddress,
      message: `Property created with ${photosQueued} photos queued for processing${usedFallbackAddress ? ' - address needs correction' : ''}`
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error: any) {
    console.error('Create property error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

