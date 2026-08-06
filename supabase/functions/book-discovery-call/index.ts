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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { investor_id, property_id, search_result_data, request_type, preferred_date, preferred_time, notes } = await req.json();

    const { data, error } = await supabase.from('discovery_call_requests').insert({
      investor_id,
      property_id,
      search_result_data,
      request_type,
      preferred_date,
      preferred_time,
      notes,
      status: 'pending'
    }).select().single();

    if (error) throw error;

    // Send notification email to staff
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const { data: investor } = await supabase.from('investors').select('full_name, email, phone').eq('id', investor_id).single();
      
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Access Your Place <notifications@accessyourplace.com>',
          to: ['team@rentalarbitrage.com'],
          subject: `New Discovery Call Request - ${request_type}`,
          html: `<h2>New Discovery Call Request</h2>
            <p><strong>Investor:</strong> ${investor?.full_name || 'Unknown'}</p>
            <p><strong>Email:</strong> ${investor?.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${investor?.phone || 'N/A'}</p>
            <p><strong>Request Type:</strong> ${request_type}</p>
            <p><strong>Preferred Date:</strong> ${preferred_date || 'Flexible'}</p>
            <p><strong>Preferred Time:</strong> ${preferred_time || 'Flexible'}</p>
            <p><strong>Notes:</strong> ${notes || 'None'}</p>`
        })
      });
    }

    return new Response(JSON.stringify({ success: true, request: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
