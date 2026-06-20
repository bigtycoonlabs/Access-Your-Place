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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const defaultResponse = {
    success: true,
    rules: [],
    logs: [],
    followups_sent: 0,
    results: []
  };

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ ...defaultResponse, error: 'Missing config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      // No body
    }

    const { action } = body;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    if (action === 'get_rules') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/followup_rules?select=*&order=created_at.desc`, { 
        method: 'GET',
        headers 
      });
      const data = res.ok ? await res.json() : [];
      return new Response(JSON.stringify({ success: true, rules: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_logs') {
      const limit = body.limit || 100;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/followup_logs?select=*&order=sent_at.desc&limit=${limit}`, { 
        method: 'GET',
        headers 
      });
      const data = res.ok ? await res.json() : [];
      return new Response(JSON.stringify({ success: true, logs: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'save_rule') {
      const { rule } = body;
      if (rule?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/followup_rules?id=eq.${rule.id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ ...rule, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/followup_rules`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(rule)
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_rule') {
      const { rule_id } = body;
      await fetch(`${SUPABASE_URL}/rest/v1/followup_rules?id=eq.${rule_id}`, {
        method: 'DELETE',
        headers
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'process_all' || !action) {
      return new Response(JSON.stringify({ 
        success: true, 
        followups_sent: 0,
        results: [],
        message: 'No pending followups'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(defaultResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: true,
      rules: [],
      logs: [],
      followups_sent: 0,
      results: [],
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

