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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...data } = await req.json();

    switch (action) {
      case 'list': {
        const { data: landlords, error } = await supabase
          .from('landlord_contacts')
          .select('*, landlord_properties(property_id), landlord_communications(id)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ landlords }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'create': {
        const { data: landlord, error } = await supabase
          .from('landlord_contacts')
          .insert([data.landlord])
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ landlord }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'update': {
        const { data: landlord, error } = await supabase
          .from('landlord_contacts')
          .update({ ...data.updates, updated_at: new Date().toISOString() })
          .eq('id', data.landlord_id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ landlord }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'link_property': {
        const { data: link, error } = await supabase
          .from('landlord_properties')
          .insert([data.link])
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ link }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'log_communication': {
        const { data: comm, error } = await supabase
          .from('landlord_communications')
          .insert([data.communication])
          .select()
          .single();
        if (error) throw error;
        
        // Update response rate
        await supabase.rpc('update_landlord_response_rate', { lid: data.communication.landlord_id });
        
        return new Response(JSON.stringify({ communication: comm }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_communications': {
        const { data: comms, error } = await supabase
          .from('landlord_communications')
          .select('*')
          .eq('landlord_id', data.landlord_id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ communications: comms }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_follow_ups': {
        const { data: followUps, error } = await supabase
          .from('landlord_communications')
          .select('*, landlord_contacts(name, company_name)')
          .eq('follow_up_required', true)
          .lte('follow_up_date', data.date || new Date().toISOString().split('T')[0])
          .order('follow_up_date', { ascending: true });
        if (error) throw error;
        return new Response(JSON.stringify({ followUps }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_analytics': {
        const { data: landlords } = await supabase
          .from('landlord_contacts')
          .select('response_rate, total_communications, total_responses, status');
        
        const { data: apps } = await supabase
          .from('landlord_applications')
          .select('application_status');
        
        const analytics = {
          totalLandlords: landlords?.length || 0,
          avgResponseRate: landlords?.reduce((a, b) => a + (b.response_rate || 0), 0) / (landlords?.length || 1),
          totalCommunications: landlords?.reduce((a, b) => a + (b.total_communications || 0), 0),
          applicationsByStatus: apps?.reduce((acc, a) => { acc[a.application_status] = (acc[a.application_status] || 0) + 1; return acc; }, {})
        };
        return new Response(JSON.stringify({ analytics }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'submit_inquiry': {
        const { data: inquiry, error } = await supabase
          .from('landlord_inquiries')
          .insert([data.inquiry])
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ inquiry, success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
