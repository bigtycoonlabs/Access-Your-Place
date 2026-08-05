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

const corsHeaders = {
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

    const body = await req.json();
    const { action } = body;
    const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // ==================== CHECK TOS STATUS ====================
    if (action === 'check_tos_status') {
      const { investor_id } = body;
      if (!investor_id) return json({ success: true, referral_partner_tos_agreed: false, seller_tos_agreed: false });
      const { data: investor } = await supabase.from('investors')
        .select('referral_partner_tos_agreed, seller_tos_agreed, referral_partner_blocked, referral_strike_count')
        .eq('id', investor_id).single();
      return json({
        success: true,
        referral_partner_tos_agreed: investor?.referral_partner_tos_agreed || false,
        seller_tos_agreed: investor?.seller_tos_agreed || false,
        referral_partner_blocked: investor?.referral_partner_blocked || false,
        referral_strike_count: investor?.referral_strike_count || 0
      });
    }

    // ==================== AGREE TO TOS ====================
    if (action === 'agree_to_tos') {
      const { investor_id, tos_type } = body;
      if (!investor_id) return json({ success: false, error: 'Missing investor_id' }, 400);
      const updates: any = {};
      if (tos_type === 'referral' || tos_type === 'both') {
        updates.referral_partner_tos_agreed = true;
        updates.referral_partner_tos_agreed_at = new Date().toISOString();
      }
      if (tos_type === 'seller' || tos_type === 'both') {
        updates.seller_tos_agreed = true;
        updates.seller_tos_agreed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('investors').update(updates).eq('id', investor_id);
      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true });
    }

    // ==================== SUBMIT PROPERTY REFERRAL ====================
    if (action === 'submit_property_referral') {
      const { investor_id, referral_type, property_address, property_city, property_state, property_zip,
        landlord_name, landlord_phone, landlord_email, projected_revenue, average_daily_rate,
        projected_monthly_room_rent, property_rent, deposit_amount, special_negotiations } = body;

      const { data: investor } = await supabase.from('investors')
        .select('referral_partner_blocked, referral_partner_tos_agreed, referral_strike_count')
        .eq('id', investor_id).single();

      if (investor?.referral_partner_blocked) {
        return json({ success: false, error: 'Your referral partner access has been restricted due to multiple failed submissions (4 strikes). Please contact support.' });
      }
      if (!investor?.referral_partner_tos_agreed) {
        return json({ success: false, error: 'You must agree to the Third-Party Seller & Referral Partner Terms of Service before submitting property referrals.' });
      }
      if (!property_address || !referral_type) {
        return json({ success: false, error: 'Property address and referral type are required.' });
      }

      const { data: referral, error } = await supabase.from('property_referrals').insert({
        referrer_id: investor_id, referral_type, property_address,
        property_city: property_city || null, property_state: property_state || null,
        property_zip: property_zip || null, landlord_name: landlord_name || null,
        landlord_phone: landlord_phone || null, landlord_email: landlord_email || null,
        projected_revenue: projected_revenue || null, average_daily_rate: average_daily_rate || null,
        projected_monthly_room_rent: projected_monthly_room_rent || null,
        property_rent: property_rent || null, deposit_amount: deposit_amount || null,
        special_negotiations: special_negotiations || null,
        status: 'pending_review', tos_agreed: true, tos_agreed_at: new Date().toISOString()
      }).select().single();

      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, referral });
    }

    // ==================== GET MY REFERRALS (Investor) ====================
    if (action === 'get_my_referrals') {
      const { investor_id } = body;
      if (!investor_id) return json({ success: true, referrals: [] });
      const { data: referrals } = await supabase.from('property_referrals')
        .select('*').eq('referrer_id', investor_id).order('created_at', { ascending: false });
      return json({ success: true, referrals: referrals || [] });
    }

    // ==================== GET ALL REFERRALS (Staff) ====================
    if (action === 'get_all_referrals') {
      const { status_filter } = body;
      let query = supabase.from('property_referrals').select('*').order('created_at', { ascending: false });
      if (status_filter && status_filter !== 'all') {
        query = query.eq('status', status_filter);
      }
      const { data: referrals, error } = await query;
      if (error) return json({ success: true, referrals: [] });

      // Enrich with referrer names
      const referrerIds = [...new Set((referrals || []).map((r: any) => r.referrer_id).filter(Boolean))];
      let referrerMap: Record<string, string> = {};
      if (referrerIds.length > 0) {
        const { data: investors } = await supabase.from('investors')
          .select('id, full_name').in('id', referrerIds);
        (investors || []).forEach((inv: any) => { referrerMap[inv.id] = inv.full_name; });
      }

      const enriched = (referrals || []).map((r: any) => ({
        ...r,
        referrer_name: referrerMap[r.referrer_id] || 'Unknown'
      }));

      return json({ success: true, referrals: enriched });
    }

    // ==================== UPDATE REFERRAL STATUS (Staff) ====================
    if (action === 'update_referral_status') {
      const { referral_id, status, assigned_am_name, am_notes, payout_amount, rejection_reason } = body;
      if (!referral_id) return json({ success: false, error: 'Missing referral_id' }, 400);

      const updates: any = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (assigned_am_name !== undefined) updates.assigned_am_name = assigned_am_name;
      if (am_notes !== undefined) updates.am_notes = am_notes;
      if (payout_amount !== undefined) updates.payout_amount = payout_amount;
      if (rejection_reason) updates.rejection_reason = rejection_reason;
      if (status === 'paid_out') updates.payout_date = new Date().toISOString();
      if (status === 'approved_payout') updates.payout_status = 'approved';
      if (status === 'paid_out') updates.payout_status = 'paid';

      const { error } = await supabase.from('property_referrals').update(updates).eq('id', referral_id);
      if (error) return json({ success: false, error: error.message }, 400);

      // Four Strikes Rule: increment strike count on rejection
      if (status === 'rejected') {
        const { data: referral } = await supabase.from('property_referrals')
          .select('referrer_id').eq('id', referral_id).single();
        if (referral?.referrer_id) {
          const { data: investor } = await supabase.from('investors')
            .select('referral_strike_count').eq('id', referral.referrer_id).single();
          const newCount = (investor?.referral_strike_count || 0) + 1;
          const blocked = newCount >= 4;
          await supabase.from('investors').update({
            referral_strike_count: newCount,
            referral_partner_blocked: blocked
          }).eq('id', referral.referrer_id);
        }
      }

      return json({ success: true });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error: any) {
    console.error('[property-referrals] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
