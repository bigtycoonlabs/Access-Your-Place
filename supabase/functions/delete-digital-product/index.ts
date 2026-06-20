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
    const { productId, fileUrl } = await req.json();

    if (!productId || !fileUrl) {
      return new Response(
        JSON.stringify({ error: 'Product ID and file URL required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Extract file path from URL
    const urlParts = fileUrl.split('/digital-products/');
    const filePath = urlParts[1];

    // Delete from storage
    const { error: storageError } = await Deno.env.get('SUPABASE_URL') 
      ? await fetch(`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/digital-products/${filePath}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
          }
        })
      : { error: null };

    // Delete from database
    const deleteResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/digital_products?id=eq.${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        'Content-Type': 'application/json'
      }
    });

    if (!deleteResponse.ok) {
      throw new Error('Failed to delete from database');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Product deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
