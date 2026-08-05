const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const trim = (value: unknown, max = 500) => value == null ? null : String(value).slice(0, max);
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ ok: false, error: 'Server configuration error' }, 500);
    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events : [body];
    const rows = events.filter((e: any) => e && typeof e === 'object').map((e: any) => ({
      event_type: trim(e.event_type || 'pageview', 50),
      event_name: trim(e.event_name, 100),
      page: trim(e.page || e.path, 500),
      path: trim(e.path || e.page, 500),
      url: trim(e.url, 1000),
      referrer: trim(e.referrer, 1000),
      session_id: trim(e.session_id, 128),
      user_id: trim(e.user_id, 128),
      investor_id: trim(e.investor_id, 128),
      staff_id: trim(e.staff_id, 128),
      user_type: trim(e.user_type, 50),
      metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : {},
      properties: e.properties && typeof e.properties === 'object' ? e.properties : {},
      data: e.data && typeof e.data === 'object' ? e.data : {},
      user_agent: trim(e.user_agent || req.headers.get('user-agent'), 1000),
      ip: null,
      created_at: new Date().toISOString(),
    }));
    if (!rows.length) return json({ ok: true, inserted: 0 });
    const res = await fetch(`${url}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) return json({ ok: false, error: await res.text() }, 500);
    return json({ ok: true, inserted: rows.length });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
