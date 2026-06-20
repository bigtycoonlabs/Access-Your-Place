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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const b = await req.json();
    const fullName = (b.full_name || '').trim();
    const email = (b.email || '').trim().toLowerCase();
    if (!fullName || !email) {
      return new Response(JSON.stringify({ error: 'Full name and email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upsert resident
    let residentId: string;
    const { data: existing } = await supabase
      .from('residents').select('id, access_token').eq('email', email).maybeSingle();
    let accessToken: string;
    if (existing) {
      residentId = existing.id;
      accessToken = existing.access_token;
    } else {
      const { data: created, error: cErr } = await supabase.from('residents').insert({
        full_name: fullName, email, phone_number: b.phone_number || null
      }).select('id, access_token').single();
      if (cErr) throw cErr;
      residentId = created.id;
      accessToken = created.access_token;
    }

    const { data: reqRow, error: rErr } = await supabase.from('resident_requests').insert({
      resident_id: residentId,
      full_name: fullName,
      email,
      phone_number: b.phone_number || null,
      target_city: b.target_city || null,
      target_state: b.target_state || null,
      budget_monthly: b.budget_monthly ? Number(b.budget_monthly) : null,
      duration_months: b.duration_months ? Number(b.duration_months) : null,
      move_in_date: b.move_in_date || null,
      notes: b.notes || null
    }).select('id').single();
    if (rErr) throw rErr;

    return new Response(JSON.stringify({
      ok: true, request_id: reqRow.id, resident_id: residentId, access_token: accessToken
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

