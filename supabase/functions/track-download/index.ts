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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { productId, name, email, phone } = await req.json();

    if (!productId || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product ID and email are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Track the download
    await fetch(
      `${supabaseUrl}/rest/v1/download_tracking`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product_id: productId,
          email
        })
      }
    );

    // Also add to leads table
    await fetch(
      `${supabaseUrl}/rest/v1/leads`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          form_type: 'resource_download',
          name: name || 'Unknown',
          email,
          phone: phone || null,
          data: { product_id: productId }
        })
      }
    );

    return new Response(
      JSON.stringify({ success: true, message: 'Download tracked successfully' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
