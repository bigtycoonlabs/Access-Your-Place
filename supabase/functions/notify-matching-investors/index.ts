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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { propertyId } = await req.json();

    // Get property details
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      throw new Error('Property not found');
    }

    // Get all investors with matching preferences
    const { data: investors } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');

    const matchingInvestors = investors?.filter(inv => {
      const prefs = inv.investment_preferences || {};
      // Check market match
      if (prefs.markets?.length && !prefs.markets.includes(property.market)) return false;
      // Check budget match
      if (prefs.max_budget && property.asking_price > prefs.max_budget) return false;
      if (prefs.min_budget && property.asking_price < prefs.min_budget) return false;
      // Check property type match
      if (prefs.property_types?.length && !prefs.property_types.includes(property.property_type)) return false;
      return true;
    }) || [];

    // Create in-app notifications for matching investors
    const notifications = matchingInvestors.map(inv => ({
      investor_id: inv.id,
      type: 'new_deal',
      title: 'New Deal Matching Your Criteria!',
      message: `A new property in ${property.market || property.city} is now available. ${property.bedrooms || '?'} bed, ${property.bathrooms || '?'} bath - $${property.asking_price?.toLocaleString() || 'TBD'}`,
      data: { propertyId, address: property.address, market: property.market, price: property.asking_price }
    }));

    if (notifications.length > 0) {
      await supabase.from('investor_notifications').insert(notifications);
    }

    // Track analytics
    await supabase.from('deal_analytics_events').insert({
      event_type: 'deal_published',
      property_id: propertyId,
      market: property.market,
      metadata: { notifiedInvestors: matchingInvestors.length }
    });

    // Send emails if Resend is configured
    if (resendKey && matchingInvestors.length > 0) {
      for (const inv of matchingInvestors.slice(0, 10)) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Rental Arbitrage <deals@rentalarbitrage.com>',
            to: inv.email,
            subject: `New Deal Alert: ${property.market || property.city}`,
            html: `<h2>New Property Matching Your Criteria!</h2><p><strong>${property.address}</strong></p><p>${property.bedrooms} bed, ${property.bathrooms} bath - $${property.asking_price?.toLocaleString()}</p><p><a href="https://rentalarbitrage.com/deals">View Deal</a></p>`
          })
        });
      }
    }

    return new Response(JSON.stringify({ success: true, notified: matchingInvestors.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

