// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
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

// new-deal-create v4.0 - Simplified for reliability, removed timeout-causing async calls
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    console.log('[new-deal-create v4.0] Starting...');
    console.log('URL exists:', !!supabaseUrl, 'Key exists:', !!supabaseKey);
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error - missing env vars' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    console.log('[new-deal-create v4.0] Body keys:', Object.keys(body));

    // Handle both nested and flat format
    const input = body.property || body;
    
    const {
      title, listing_title, address, description, city, state, zip_code,
      bedrooms, bathrooms, sqft, monthly_rent, price, cap_rate,
      property_type, operation_type, photos, photo_urls,
      landlord_name, landlord_email, landlord_phone, listing_url,
      internal_notes, status, deal_status, workflow_stage,
      acquisition_fee, is_furnished, property_categories, source,
      is_featured, is_published, featured, is_verified, staff_verified,
      added_by_staff_id, added_by_staff_name, created_by_name, penny_score
    } = input;

    // Validate required fields
    if (!address?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Address is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    if (!city?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'City is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    if (!state?.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'State is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Process photos
    let photoArray: string[] = [];
    const rawPhotos = photos || photo_urls || [];
    if (Array.isArray(rawPhotos)) {
      photoArray = rawPhotos.map((p: any) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object' && p.url) return p.url;
        return null;
      }).filter(Boolean) as string[];
    }

    const finalTitle = (listing_title || title || '').trim() || `${bedrooms || 3}BR in ${city.trim()}`;
    const finalStatus = status || deal_status || 'new';

    const propertyData: Record<string, any> = {
      title: finalTitle,
      listing_title: finalTitle,
      address: address.trim(),
      description: (description || '').trim() || null,
      city: city.trim(),
      state: state.toUpperCase().trim().substring(0, 2),
      zip_code: (zip_code || '').trim() || null,
      bedrooms: parseInt(String(bedrooms)) || 3,
      bathrooms: parseFloat(String(bathrooms)) || 2,
      sqft: sqft ? parseInt(String(sqft)) : null,
      monthly_rent: parseFloat(String(monthly_rent)) || 0,
      price: price ? parseFloat(String(price)) : null,
      cap_rate: cap_rate ? parseFloat(String(cap_rate)) : null,
      property_type: property_type || 'single_family',
      operation_type: operation_type || 'str',
      photos: photoArray,
      landlord_name: landlord_name || null,
      landlord_email: landlord_email || null,
      landlord_phone: landlord_phone || null,
      listing_url: listing_url || null,
      internal_notes: internal_notes || null,
      status: finalStatus,
      deal_status: finalStatus,
      workflow_stage: workflow_stage || 'new',
      workflow_stage_entered_at: new Date().toISOString(),
      acquisition_fee: parseFloat(String(acquisition_fee)) || 2500,
      is_furnished: is_furnished === true || is_furnished === 'true',
      is_featured: is_featured === true || featured === true,
      featured: is_featured === true || featured === true,
      is_published: is_published === true,
      source: source || 'acquisition_team',
      is_verified: is_verified === true,
      staff_verified: staff_verified === true,
      property_categories: Array.isArray(property_categories) ? property_categories : [],
      units_available: 1,
      penny_score: penny_score ? parseInt(String(penny_score)) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[new-deal-create v4.0] Inserting:', propertyData.address, propertyData.city);

    const { data: property, error: insertError } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .single();

    if (insertError) {
      console.error('[new-deal-create v4.0] Insert error:', insertError);
      return new Response(JSON.stringify({ success: false, error: insertError.message }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('[new-deal-create v4.0] Created:', property.id);

    // Save photos to property_photos table (non-blocking, don't fail if this errors)
    let photosQueued = 0;
    if (photoArray.length > 0) {
      try {
        const photoInserts = photoArray.map((url: string, i: number) => ({
          property_id: property.id,
          original_url: url,
          processed_url: url,
          display_order: i,
          is_primary: i === 0,
          processing_status: 'complete',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        const { error: photoError } = await supabase.from('property_photos').insert(photoInserts);
        if (!photoError) photosQueued = photoArray.length;
        else console.log('[new-deal-create v4.0] Photo insert note:', photoError.message);
      } catch (e) {
        console.log('[new-deal-create v4.0] Photo insert skipped:', e);
      }
    }

    // Log activity (non-blocking)
    try {
      await supabase.from('deal_activity_log').insert({
        property_id: property.id,
        activity_type: 'property_created',
        description: `New deal created: ${property.address}, ${property.city}`,
        new_value: JSON.stringify({ source: property.source, status: property.deal_status }),
        performer_name: created_by_name || added_by_staff_name || 'Staff',
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('[new-deal-create v4.0] Activity log skipped');
    }

    return new Response(JSON.stringify({
      success: true,
      property,
      photos_queued: photosQueued,
      message: 'Deal created successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[new-deal-create v4.0] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
