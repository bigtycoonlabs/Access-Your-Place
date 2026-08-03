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

    const { action, property_id, outreach_id, data } = await req.json();

    let result;

    switch (action) {
      case 'create':
        const { data: newOutreach, error: createErr } = await supabase
          .from('outreach_tracking')
          .insert({ property_id, ...data })
          .select()
          .single();
        if (createErr) throw createErr;
        result = newOutreach;

        // Log activity
        await supabase.from('deal_activity_log').insert({
          property_id,
          activity_type: 'outreach_initiated',
          activity_description: `Outreach initiated via ${data.outreach_method}`,
          performer_name: data.assigned_to_name || 'System'
        });
        break;

      case 'update':
        const { data: updated, error: updateErr } = await supabase
          .from('outreach_tracking')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', outreach_id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        result = updated;
        break;

      case 'get':
        const { data: outreaches, error: getErr } = await supabase
          .from('outreach_tracking')
          .select('*')
          .eq('property_id', property_id)
          .order('created_at', { ascending: false });
        if (getErr) throw getErr;
        result = outreaches;
        break;

      default:
        throw new Error('Invalid action');
    }

    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
