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
// get-properties v5.2 - Relaxed blacklist publish filter + debug_filter echo
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    console.log('[get-properties v5.2] Starting...');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error', properties: [] }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const getHeaders = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };

    const body = await req.json().catch(() => ({}));
    const {
      status, source, property_type, zip_code, address,
      limit = 500, is_featured, is_published, include_all, id,
      // caller context for visibility control
      caller_type,       // 'staff' | 'funded_investor' | 'investor' | 'public'
      caller_investor_id, // investor ID if applicable
      // debug flag â€” echoes back the applied PostgREST filter string so we can
      // confirm production behavior without tailing edge function logs.
      debug_filter
    } = body;

    const isStaff = caller_type === 'staff';
    const isFundedInvestor = caller_type === 'funded_investor';

    let queryParts: string[] = [];
    queryParts.push('select=*');

    if (id) {
      queryParts.push(`id=eq.${id}`);
    } else if (!include_all) {
      if (status) queryParts.push(`status=eq.${status}`);
      if (source) queryParts.push(`source=eq.${source}`);
      if (property_type) queryParts.push(`property_type=eq.${property_type}`);
      if (zip_code) queryParts.push(`zip_code=eq.${zip_code}`);
      if (address) queryParts.push(`address=ilike.*${encodeURIComponent(address)}*`);
      if (is_featured !== undefined) queryParts.push(`is_featured=eq.${is_featured}`);
      if (is_published !== undefined) queryParts.push(`is_published=eq.${is_published}`);
    }

    // ========== SERVER-SIDE PUBLISH FILTER (v5.2 â€” BLACKLIST) ==========
    // Previous v5.1 used a strict whitelist
    //   or=(is_published.eq.true,status.in.(approved,published,active),workflow_stage.eq.published)
    // which returned 0 rows in production because most legitimate listings have
    // status values like 'for_sale', 'listed', 'under_contract', or null.
    //
    // v5.2 switches to a SAFER BLACKLIST that keeps every legitimate listing
    // visible while still hiding drafts, leads, archived/rejected/deleted rows,
    // pending-review, and internal-only records. A row is visible to non-staff if
    // ANY of the following is true:
    //   - is_published = true
    //   - workflow_stage = 'published'
    //   - status IS NULL
    //   - status NOT IN (draft, new_lead, archived, rejected, deleted, pending_review, internal_only)
    //
    // Staff callers bypass this filter entirely and see every record.
    // Specific-id lookups also bypass the filter (non-staff still get field-level
    // visibility stripping below).
    let appliedPublishFilter: string | null = null;

    if (!isStaff && !id) {
      appliedPublishFilter =
        'or=(is_published.eq.true,workflow_stage.eq.published,status.is.null,status.not.in.(draft,new_lead,archived,rejected,deleted,pending_review,internal_only))';
      queryParts.push(appliedPublishFilter);
      console.log(`[get-properties v5.2] Applied blacklist publish filter for caller_type=${caller_type || 'public'}: ${appliedPublishFilter}`);
    } else {
      console.log(`[get-properties v5.2] Publish filter BYPASSED (isStaff=${isStaff}, id=${id ? 'yes' : 'no'})`);
    }

    queryParts.push('order=is_featured.desc.nullsfirst,created_at.desc');
    queryParts.push(`limit=${limit}`);

    const queryString = queryParts.join('&');
    const url = `${supabaseUrl}/rest/v1/properties?${queryString}`;

    console.log(`[get-properties v5.2] Fetching: caller_type=${caller_type || 'unknown'}, isStaff=${isStaff}, include_all=${!!include_all}, limit=${limit}`);

    const response = await fetch(url, { method: 'GET', headers: getHeaders });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[get-properties v5.2] REST API error (${response.status}):`, errText);
      return new Response(JSON.stringify({
        success: false,
        error: `Database query failed: ${errText}`,
        properties: [],
        ...(debug_filter ? { debug: { applied_publish_filter: appliedPublishFilter, query_string: queryString, url } } : {})
      }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let properties = await response.json();

    if (!Array.isArray(properties)) {
      return new Response(JSON.stringify({ success: false, error: 'Unexpected response format', properties: [] }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log(`[get-properties v5.2] Found ${properties.length} properties`);

    // Enrich with photos from property_photos table if needed
    if (properties.length > 0) {
      try {
        const idsWithoutPhotos = properties
          .filter((p: any) => !p.photos || !Array.isArray(p.photos) || p.photos.length === 0)
          .map((p: any) => p.id);

        if (idsWithoutPhotos.length > 0 && idsWithoutPhotos.length <= 100) {
          const idsParam = idsWithoutPhotos.map((id: string) => `"${id}"`).join(',');
          const photosUrl = `${supabaseUrl}/rest/v1/property_photos?property_id=in.(${idsParam})&select=property_id,original_url,processed_url,thumbnail_url,display_order,is_primary&order=display_order.asc`;
          const photosRes = await fetch(photosUrl, { headers: getHeaders });
          if (photosRes.ok) {
            const photosData = await photosRes.json();
            if (Array.isArray(photosData) && photosData.length > 0) {
              const photosMap: Record<string, string[]> = {};
              for (const photo of photosData) {
                if (!photosMap[photo.property_id]) photosMap[photo.property_id] = [];
                const photoUrl = photo.processed_url || photo.original_url;
                if (photoUrl) photosMap[photo.property_id].push(photoUrl);
              }
              for (const property of properties) {
                const tablePhotos = photosMap[property.id];
                if (tablePhotos && tablePhotos.length > 0) {
                  property.photos = tablePhotos;
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.log('[get-properties v5.2] Photos enrichment skipped:', e.message);
      }
    }

    // ========== VISIBILITY FILTERING ==========
    // Staff sees everything. Others get field-level filtered based on visibility_settings.
    if (!isStaff) {
      properties = properties.map((p: any) => {
        const vis = p.visibility_settings || {
          show_address: false,
          show_community_name: false,
          show_landlord_contact: false,
          show_full_photos: true,
          show_financials: true
        };

        // Always strip landlord contact for non-staff
        const cleaned: any = { ...p };
        cleaned.landlord_name = null;
        cleaned.landlord_email = null;
        cleaned.landlord_phone = null;

        // Always strip internal notes for non-staff
        cleaned.internal_notes = null;
        cleaned.denial_reason = null;

        // Community name: only show if visibility allows
        if (!vis.show_community_name) {
          cleaned.community_name = null;
        }

        // Address: funded investors can see if visibility allows, public never sees
        if (isFundedInvestor && vis.show_address) {
          // Funded investor with address visibility enabled - keep address
        } else {
          // Public or unfunded investor - strip address, keep only zip
          cleaned.address = null;
        }

        // Landlord contact: only if explicitly enabled AND funded investor
        if (isFundedInvestor && vis.show_landlord_contact) {
          cleaned.landlord_name = p.landlord_name;
          cleaned.landlord_email = p.landlord_email;
          cleaned.landlord_phone = p.landlord_phone;
        }

        return cleaned;
      });

      console.log(`[get-properties v5.2] Visibility filtered for caller_type=${caller_type}`);
    }

    const debugPayload = debug_filter
      ? {
          debug: {
            version: 'v5.2',
            caller_type: caller_type || 'public',
            is_staff: isStaff,
            is_funded_investor: isFundedInvestor,
            filter_bypassed: isStaff || !!id,
            applied_publish_filter: appliedPublishFilter,
            query_string: queryString,
            url,
            result_count: properties.length
          }
        }
      : {};

    if (id && properties.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        property: properties[0],
        properties,
        total: properties.length,
        ...debugPayload
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      properties,
      total: properties.length,
      ...debugPayload
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[get-properties v5.2] Fatal error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message, properties: [] }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

