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

// Helper: make authenticated PostgREST requests
async function dbQuery(supabaseUrl: string, apiKey: string, table: string, options: {
  method?: string;
  select?: string;
  filters?: string;
  order?: string;
  body?: any;
  single?: boolean;
  limit?: number;
} = {}): Promise<{ data: any; error: any }> {
  const { method = 'GET', select = '*', filters = '', order = '', body, single = false, limit } = options;
  
  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (filters) url += `&${filters}`;
  if (order) url += `&order=${order}`;
  if (limit) url += `&limit=${limit}`;

  const headers: Record<string, string> = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : method === 'DELETE' ? 'return=representation' : '',
  };
  
  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      try { errorObj = JSON.parse(errorText); } catch { errorObj = { message: errorText }; }
      return { data: null, error: { message: errorObj.message || errorText, code: response.status } };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      const data = await response.json();
      return { data, error: null };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse request body (optional)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }

    // Validate staff session if provided
    const staffSessionId = body?.staff_session_id || body?.staffId;
    if (staffSessionId) {
      const { data: staffUser, error: staffErr } = await dbQuery(supabaseUrl, serviceRoleKey, 'staff', {
        select: 'id,is_active,department',
        filters: `id=eq.${staffSessionId}`,
        single: true
      });

      if (!staffErr && staffUser && staffUser.is_active === false) {
        return new Response(
          JSON.stringify({ error: 'Staff account is deactivated' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Fetch leads
    const { data, error } = await dbQuery(supabaseUrl, serviceRoleKey, 'leads', {
      order: 'created_at.desc'
    });

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true, leads: data || [] }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('[get-leads] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

