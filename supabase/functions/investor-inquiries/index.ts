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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, investor_id, investor_email } = await req.json();

    if (action === 'list') {
      let query = supabase
        .from('deal_inquiries')
        .select(`
          id, investor_name, email, phone, message, status,
          staff_notes, created_at, contacted_at,
          properties (id, city, state, zip_code, bedrooms, bathrooms, photos)
        `)
        .order('created_at', { ascending: false });

      if (investor_email) {
        query = query.eq('email', investor_email);
      }

      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ inquiries: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list_discovery_calls') {
      const { data, error } = await supabase
        .from('discovery_call_requests')
        .select('*')
        .eq('investor_id', investor_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ calls: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
