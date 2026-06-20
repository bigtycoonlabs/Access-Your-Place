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

// delete-property v7.1 - Comprehensive FK cascade with improved logging
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      console.error('[delete-property v7.1] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return json({ success: false, error: 'Server configuration error: missing environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let body: any = {};
    try { body = await req.json(); } catch (e) { 
      console.error('[delete-property v7.1] Invalid JSON body');
      return json({ success: false, error: 'Invalid JSON body. Send { "property_id": "uuid" }' }); 
    }
    
    const propertyId = body.property_id || body.id;
    const staffId = body.staff_id || null;
    const staffName = body.staff_name || null;
    const softDeleteOnly = body.soft_delete === true;
    console.log(`[delete-property v7.1] ID: ${propertyId}, softDeleteOnly: ${softDeleteOnly}`);

    if (!propertyId) {
      return json({ success: false, error: 'property_id is required. Send { "property_id": "uuid" }' });
    }

    // Verify property exists
    const { data: existingProp, error: fetchErr } = await supabase.from('properties').select('id, address, city, state, status').eq('id', propertyId).single();
    if (fetchErr || !existingProp) {
      console.log(`[delete-property v7.1] Property not found: ${propertyId}`);
      return json({ success: false, error: `Property not found with ID: ${propertyId}`, not_found: true });
    }
    console.log(`[delete-property v7.1] Found property: ${existingProp.address}, ${existingProp.city} ${existingProp.state}`);

    // Soft-delete only mode
    if (softDeleteOnly) {
      const { error: softErr } = await supabase.from('properties').update({ 
        status: 'deleted', is_published: false, deal_status: 'deleted',
        workflow_stage: 'deleted', updated_at: new Date().toISOString() 
      }).eq('id', propertyId);
      if (softErr) {
        console.error(`[delete-property v7.1] Soft-delete failed: ${softErr.message}`);
        return json({ success: false, error: softErr.message });
      }
      console.log(`[delete-property v7.1] Soft-deleted: ${propertyId}`);
      return json({ success: true, message: 'Property soft-deleted (marked as deleted, unpublished)', property_id: propertyId, soft_delete: true });
    }

    // Step 1: Archive
    if (body.archive !== false) {
      try {
        const { data: prop } = await supabase.from('properties').select('*').eq('id', propertyId).single();
        if (prop) {
          await supabase.from('archived_properties').insert({
            original_property_id: prop.id, address: prop.address, city: prop.city, state: prop.state,
            zip_code: prop.zip_code, bedrooms: prop.bedrooms, bathrooms: prop.bathrooms,
            monthly_rent: prop.monthly_rent, listing_title: prop.listing_title,
            listing_description: prop.description || prop.listing_description,
            property_type: prop.property_type, source: prop.source,
            acquisition_fee: prop.acquisition_fee, is_published: prop.is_published,
            is_featured: prop.is_featured, is_verified: prop.is_verified,
            deal_status: prop.deal_status, workflow_stage: prop.workflow_stage,
            status: prop.status, photos: prop.photos, penny_score: prop.penny_score,
            units_available: prop.units_available,
            original_created_at: prop.created_at, original_updated_at: prop.updated_at,
            archived_by_staff_id: staffId, archived_by_staff_name: staffName,
            archive_reason: body.archive_reason || 'deleted', original_data: prop
          });
          console.log('[delete-property v7.1] Archived successfully');
        }
      } catch (e: any) { console.log('[delete-property v7.1] Archive skip:', e?.message); }
    }

    // Step 2: Clean deal_listings and their children
    const cleanedTables: string[] = [];
    try {
      const { data: listings } = await supabase.from('deal_listings').select('id').eq('property_id', propertyId);
      if (listings && listings.length > 0) {
        const lids = listings.map((l: any) => l.id);
        const listingChildTables = [
          'marketplace_verification_alerts','deal_verifications','deal_transactions',
          'marketplace_payments','marketplace_offers','marketplace_interests',
          'marketplace_closed_deals','deal_offers','deal_negotiations'
        ];
        for (const table of listingChildTables) {
          for (const lid of lids) { 
            try { 
              const { count } = await supabase.from(table).delete().eq('listing_id', lid);
              if (count && count > 0) cleanedTables.push(`${table}(${count})`);
            } catch(e){} 
          }
        }
        const { count: listingCount } = await supabase.from('deal_listings').delete().eq('property_id', propertyId);
        if (listingCount && listingCount > 0) cleanedTables.push(`deal_listings(${listingCount})`);
      }
    } catch(e){}

    // Step 3: Nullify acquisition_requests.converted_property_id
    try { 
      await supabase.from('acquisition_requests').update({ converted_property_id: null }).eq('converted_property_id', propertyId); 
      cleanedTables.push('acquisition_requests(nullified)');
    } catch(e){}

    // Step 4: Delete ALL FK-constrained child tables (from actual DB schema inspection)
    const fkTables = [
      'acquisition_payments', 'acquisition_workflow', 'acquisitions',
      'deal_performance_tracking', 'landlord_applications', 'landlord_communications',
      'landlord_properties', 'penny_deal_scores', 'penny_score_alerts',
      'penny_score_history', 'property_assignments'
    ];
    
    for (const table of fkTables) {
      try { 
        const { count } = await supabase.from(table).delete().eq('property_id', propertyId); 
        if (count && count > 0) cleanedTables.push(`${table}(${count})`);
      } catch(e){}
    }

    // Step 5: Clean other non-FK child tables (safe to clean even if they don't exist)
    const otherTables = [
      'property_photos','deal_analytics','property_analytics','outreach_tracking','outreach_notes',
      'deal_activity_log','deal_workflow_stages','deal_inquiries','saved_deals','deal_reservations',
      'investor_favorites','property_expenses','deal_alerts','deal_alert_notifications',
      'deal_scores','property_referrals','deal_matches','portfolio_property_links',
      'setup_tasks','setup_quotes','property_setup_progress',
      'deal_alert_matches','property_notes','deal_notes'
    ];
    for (const table of otherTables) {
      try { 
        const { count } = await supabase.from(table).delete().eq('property_id', propertyId); 
        if (count && count > 0) cleanedTables.push(`${table}(${count})`);
      } catch(e){}
    }
    console.log(`[delete-property v7.1] Cleaned tables: ${cleanedTables.join(', ') || 'none had data'}`);

    // Step 6: Delete the property
    const { error: delErr } = await supabase.from('properties').delete().eq('id', propertyId);
    if (delErr) {
      console.error(`[delete-property v7.1] Hard delete failed: ${delErr.message}`);
      // Soft-delete fallback
      try {
        await supabase.from('properties').update({ 
          status: 'deleted', is_published: false, deal_status: 'deleted',
          workflow_stage: 'deleted', updated_at: new Date().toISOString() 
        }).eq('id', propertyId);
        console.log(`[delete-property v7.1] Soft-deleted as fallback`);
        return json({ 
          success: true, 
          message: 'Property soft-deleted (hard delete failed due to remaining FK constraints)', 
          property_id: propertyId, 
          soft_delete: true,
          hard_delete_error: delErr.message,
          tables_cleaned: cleanedTables
        });
      } catch(e: any) {
        console.error(`[delete-property v7.1] Both hard and soft delete failed: ${e?.message}`);
        return json({ 
          success: false, 
          error: `Hard delete: ${delErr.message}. Soft delete also failed: ${e?.message}`,
          tables_cleaned: cleanedTables
        });
      }
    }

    console.log(`[delete-property v7.1] Successfully deleted: ${propertyId}`);
    return json({ 
      success: true, 
      message: 'Property permanently deleted', 
      property_id: propertyId, 
      soft_delete: false,
      tables_cleaned: cleanedTables
    });
  } catch (error: any) {
    console.error('[delete-property v7.1] Unhandled error:', error?.message);
    return json({ success: false, error: error?.message || String(error) });
  }
});

