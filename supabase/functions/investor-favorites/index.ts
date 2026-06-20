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
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method, headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined
  });
  return method === 'GET' || method === 'POST' ? res.json() : res.ok;
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
      await db('investor_favorites', 'POST', { investor_id, property_id });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'remove') {
      const url = Deno.env.get('SUPABASE_URL')!; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${url}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&property_id=eq.${property_id}`, { method: 'DELETE', headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
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

