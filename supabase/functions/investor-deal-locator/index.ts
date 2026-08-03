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
// Version 4 - Fixed: Removed AI discovery for investors (staff-only), Added photo fetching from property_photos table
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const headers = {
  'Content-Type': 'application/json',
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`
};

// Validate UUID format
function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Safe array check - ensures we always work with arrays
function ensureArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && data.error) {
    console.error('Database error:', data.error, data.message);
    return [];
  }
  return [];
}

async function dbQuery(table: string, params: string = ''): Promise<any[]> {
  try {
    const url = `${supabaseUrl}/rest/v1/${table}?${params}`;
    console.log('DB Query:', table, params.substring(0, 100));
    
    const res = await fetch(url, {
      method: 'GET',
      headers
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      console.error('DB Query error:', res.status, JSON.stringify(data));
      return [];
    }
    
    return ensureArray(data);
  } catch (error) {
    console.error('DB Query fetch error:', error);
    return [];
  }
}

async function dbInsert(table: string, data: any) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    return res.json();
  } catch (error) {
    console.error('DB Insert error:', error);
    return null;
  }
}

// Fetch photos from property_photos table for multiple properties
async function fetchPropertyPhotos(propertyIds: string[]): Promise<Record<string, string[]>> {
  if (!propertyIds || propertyIds.length === 0) return {};
  
  try {
    const idsParam = propertyIds.join(',');
    const photos = await dbQuery('property_photos', 
      `property_id=in.(${idsParam})&order=display_order.asc&select=property_id,original_url,processed_url,thumbnail_url`
    );
    
    const photosMap: Record<string, string[]> = {};
    
    for (const photo of photos) {
      if (!photosMap[photo.property_id]) {
        photosMap[photo.property_id] = [];
      }
      // Use processed_url first (optimized), then original_url as fallback
      const photoUrl = photo.processed_url || photo.original_url;
      if (photoUrl) {
        photosMap[photo.property_id].push(photoUrl);
      }
    }
    
    return photosMap;
  } catch (error) {
    console.error('Error fetching property photos:', error);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, investor_id, city, state, zip_code, max_price, min_bedrooms, operation_type } = body;

    // NOTE: search_ai parameter is IGNORED for investors - AI discovery is staff-only
    // Investors can only see published marketplace deals

    console.log('Deal Locator request:', { action, investor_id: investor_id?.substring(0, 8), city, state, zip_code });

    // Validate investor_id if provided - MUST be valid UUID format
    if (investor_id && !isValidUUID(investor_id)) {
      console.log('Invalid UUID format:', investor_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid investor ID format. Must be a valid UUID.',
        provided_id: investor_id
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const sanitizeForPublic = (p: any, photosMap?: Record<string, string[]>) => {
      // Get photos from property_photos table first, then fallback to properties.photos array
      let photos = photosMap?.[p.id] || [];
      if (photos.length === 0 && p.photos && Array.isArray(p.photos)) {
        photos = p.photos;
      }
      
      return {
        id: p.id,
        title: p.title || p.listing_title || p.address || `${p.bedrooms}BR Investment Opportunity`,
        listing_title: p.listing_title,
        description: p.description || 'Pre-negotiated rental arbitrage opportunity',
        address: p.address,
        city: p.city,
        state: p.state,
        zip_code: p.zip_code,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        square_feet: p.square_feet,
        monthly_rent: p.monthly_rent,
        acquisition_fee: p.acquisition_fee,
        asking_price: p.asking_price || p.price,
        cap_rate: p.cap_rate,
        operation_type: p.operation_type,
        property_type: p.property_type,
        is_furnished: p.is_furnished,
        is_verified: p.is_verified || p.staff_verified,
        is_featured: p.is_featured,
        photos: photos,
        penny_score: p.penny_score,
        penny_recommendation: p.penny_recommendation,
        status: p.status,
        source: 'marketplace',
        created_at: p.created_at
      };
    };

    // Get saved/favorited deals
    if (action === 'get_saved_deals') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const favs = await dbQuery('investor_favorites', `investor_id=eq.${investor_id}&select=property_id`);
      
      if (favs.length === 0) {
        return new Response(JSON.stringify({ success: true, saved_deals: [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const propertyIds = favs.map((f: any) => f.property_id).filter(Boolean);
      if (propertyIds.length === 0) {
        return new Response(JSON.stringify({ success: true, saved_deals: [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const properties = await dbQuery('properties', `id=in.(${propertyIds.join(',')})`);
      
      // Fetch photos from property_photos table
      const photosMap = await fetchPropertyPhotos(propertyIds);
      
      const deals = properties.map(p => sanitizeForPublic(p, photosMap));
      
      return new Response(JSON.stringify({ success: true, saved_deals: deals }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get investor's inquiries
    if (action === 'get_inquiries') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const inquiries = await dbQuery('deal_inquiries', `investor_id=eq.${investor_id}&order=created_at.desc`);
      return new Response(JSON.stringify({ success: true, inquiries }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get personalized recommendations (published deals only)
    if (action === 'get_recommendations') {
      let queryParams = 'or=(is_published.eq.true,status.eq.published)&assigned_investor_id=is.null&limit=12&order=created_at.desc';
      
      // Try to get investor preferences if investor_id provided
      if (investor_id) {
        const investors = await dbQuery('investors', `id=eq.${investor_id}&select=preferred_markets,budget_min,budget_max,operation_types`);
        const inv = investors[0];
        
        // Could add preference-based filtering here in the future
        if (inv?.preferred_markets?.length > 0) {
          // Filter by preferred markets
        }
      }
      
      const properties = await dbQuery('properties', queryParams);
      const propertyIds = properties.map(p => p.id);
      const photosMap = await fetchPropertyPhotos(propertyIds);
      
      return new Response(JSON.stringify({ 
        success: true, 
        recommendations: properties.map(p => sanitizeForPublic(p, photosMap)) 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get assigned deals with proper address visibility based on payment status
    if (action === 'get_assigned_deals') {
      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('Getting assigned deals for investor:', investor_id);

      // First, get assignments for this investor from property_assignments table
      const assignments = await dbQuery('property_assignments', `investor_id=eq.${investor_id}&order=created_at.desc`);
      console.log('Found assignments:', assignments.length);

      // Also check for legacy assignments (direct assigned_investor_id on properties)
      const legacyDeals = await dbQuery('properties', `assigned_investor_id=eq.${investor_id}`);
      console.log('Found legacy deals:', legacyDeals.length);

      // Collect all property IDs for photo fetching
      const allPropertyIds: string[] = [];
      
      // Process assignments from property_assignments table
      const assignedDeals: any[] = [];
      
      for (const assignment of assignments) {
        if (!assignment.property_id) continue;
        allPropertyIds.push(assignment.property_id);
        
        const properties = await dbQuery('properties', `id=eq.${assignment.property_id}`);
        const property = properties[0];

        if (!property) {
          console.log('Property not found for assignment:', assignment.property_id);
          continue;
        }

        const isPaid = assignment.status === 'paid' || property.acquisition_fee_paid === true;

        assignedDeals.push({
          ...property,
          // Only show full address if assignment is paid
          address: isPaid ? property.address : `Property in ${property.city}, ${property.state}`,
          full_address_visible: isPaid,
          assignment_status: assignment.status || 'pending',
          assignment_id: assignment.id,
          payment_amount: assignment.payment_amount,
          payment_date: assignment.payment_date,
          payment_method: assignment.payment_method,
          assigned_at: assignment.assigned_at || assignment.created_at,
          assignment_notes: assignment.notes,
          // Include workflow stage
          workflow_stage: property.workflow_stage || (isPaid ? 'application_process' : 'payment_received'),
          // Landlord info only visible after payment
          landlord_name: isPaid ? property.landlord_name : null,
          landlord_email: isPaid ? property.landlord_email : null,
          landlord_phone: isPaid ? property.landlord_phone : null
        });
      }

      // Process legacy deals (properties with assigned_investor_id but no property_assignment record)
      for (const property of legacyDeals) {
        // Check if this property is already in assignedDeals
        const alreadyIncluded = assignedDeals.some(d => d.id === property.id);
        if (alreadyIncluded) continue;
        
        allPropertyIds.push(property.id);

        const isPaid = property.acquisition_fee_paid === true || property.acquisition_status === 'paid';

        assignedDeals.push({
          ...property,
          // Only show full address if paid
          address: isPaid ? property.address : `Property in ${property.city}, ${property.state}`,
          full_address_visible: isPaid,
          assignment_status: isPaid ? 'paid' : 'pending',
          assignment_id: null,
          payment_amount: property.acquisition_fee,
          payment_date: property.acquisition_fee_paid_date,
          payment_method: null,
          assigned_at: property.updated_at || property.created_at,
          assignment_notes: null,
          workflow_stage: property.workflow_stage || (isPaid ? 'application_process' : 'payment_received'),
          landlord_name: isPaid ? property.landlord_name : null,
          landlord_email: isPaid ? property.landlord_email : null,
          landlord_phone: isPaid ? property.landlord_phone : null
        });
      }

      // Fetch photos for all assigned deals
      const photosMap = await fetchPropertyPhotos(allPropertyIds);
      
      // Add photos to assigned deals
      for (const deal of assignedDeals) {
        let photos = photosMap[deal.id] || [];
        if (photos.length === 0 && deal.photos && Array.isArray(deal.photos)) {
          photos = deal.photos;
        }
        deal.photos = photos;
      }

      console.log('Total assigned deals:', assignedDeals.length);

      return new Response(JSON.stringify({ success: true, assigned_deals: assignedDeals, deals: assignedDeals }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // SEARCH ACTION - Returns ONLY published marketplace deals for investors
    // AI discovery is DISABLED for investors - that functionality is staff-only via research-zip-properties
    if (action === 'search' || !action) {
      console.log('Executing search - AI discovery disabled for investors');
      
      // Build query params for published marketplace deals ONLY
      let queryParams = 'or=(is_published.eq.true,status.eq.published)&assigned_investor_id=is.null&limit=50';
      
      if (city) queryParams += `&city=ilike.*${encodeURIComponent(city)}*`;
      if (state) queryParams += `&state=ilike.*${encodeURIComponent(state)}*`;
      if (zip_code) queryParams += `&zip_code=eq.${zip_code}`;
      if (max_price) queryParams += `&monthly_rent=lte.${max_price}`;
      if (min_bedrooms) queryParams += `&bedrooms=gte.${min_bedrooms}`;
      if (operation_type && operation_type !== 'all') {
        queryParams += `&operation_type=ilike.*${encodeURIComponent(operation_type)}*`;
      }

      const verifiedDeals = await dbQuery('properties', queryParams);
      console.log('Found marketplace deals:', verifiedDeals.length);
      
      // Fetch photos from property_photos table
      const propertyIds = verifiedDeals.map(p => p.id);
      const photosMap = await fetchPropertyPhotos(propertyIds);
      
      const deals = verifiedDeals.map(p => sanitizeForPublic(p, photosMap));

      // Log activity
      if (investor_id) {
        try {
          await dbInsert('investor_activity_logs', {
            investor_id,
            activity_type: 'deal_search',
            category: 'deals',
            description: `Searched for deals in ${[city, state, zip_code].filter(Boolean).join(', ') || 'all locations'}`,
            metadata: { city, state, zip_code, max_price, min_bedrooms, operation_type, results_count: deals.length }
          });
        } catch (e) {
          // Ignore logging errors
        }
      }

      // NOTE: ai_deals is always empty for investors - AI discovery is staff-only
      // Staff should use the research-zip-properties function for AI discovery
      return new Response(JSON.stringify({
        success: true,
        deals,
        ai_deals: [], // Always empty for investors - AI discovery is staff-only
        total: deals.length,
        note: 'Showing published marketplace deals. For AI-powered property discovery, please contact your acquisition manager.'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Unknown action
    return new Response(JSON.stringify({
      success: false,
      error: `Unknown action: ${action}`,
      valid_actions: ['search', 'get_saved_deals', 'get_inquiries', 'get_recommendations', 'get_assigned_deals']
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Deal locator error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
