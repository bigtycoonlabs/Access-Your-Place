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

async function db(path: string, method: string, body?: any) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!url || !key) throw new Error('Missing Supabase Edge Function configuration');

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method, headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : text || res.statusText;
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${message}`);
  }

  return method === 'GET' || method === 'POST' ? data : true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, investor_id, property_id } = await req.json();

    if (action === 'list') {
      const favs = await db(`investor_favorites?investor_id=eq.${investor_id}&order=created_at.desc&select=id,created_at,property_id`, 'GET');
      if (favs?.length) {
        const ids = favs.map((f: any) => f.property_id).join(',');
        const props = await db(`properties?id=in.(${ids})&select=*`, 'GET');
        const propsMap = Object.fromEntries((props || []).map((p: any) => [p.id, p]));
        const result = favs.map((f: any) => ({ ...f, properties: propsMap[f.property_id] || null }));
        return new Response(JSON.stringify({ favorites: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ favorites: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'add') {
      // The current schema has no unique (investor_id, property_id) constraint for a
      // PostgREST upsert. Check first so retrying a save does not add another row.
      const existing = await db(`investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`, 'GET');
      if (existing?.length) {
        return new Response(JSON.stringify({ success: true, already_saved: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const inserted = await db('investor_favorites', 'POST', { investor_id, property_id });
      if (!Array.isArray(inserted) || !inserted[0]?.id) {
        throw new Error('Favorite insert did not return a saved record');
      }

      return new Response(JSON.stringify({ success: true, favorite: inserted[0] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'remove') {
      await db(`investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}`, 'DELETE');
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check') {
      const data = await db(`investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`, 'GET');
      return new Response(JSON.stringify({ isFavorite: data?.length > 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

