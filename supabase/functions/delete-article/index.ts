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
    const body = await req.json();
    const articleId = body.articleId || body.id;
    
    if (!articleId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Article ID is required (pass articleId or id)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing Supabase configuration' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    let totalDeleted = 0;

    // Try blog_articles table
    try {
      const blogRes = await fetch(
        `${supabaseUrl}/rest/v1/blog_articles?id=eq.${articleId}`,
        { method: 'DELETE', headers }
      );
      if (blogRes.ok) {
        const data = await blogRes.json();
        totalDeleted += Array.isArray(data) ? data.length : 0;
      }
    } catch (e) {
      console.log('blog_articles delete error:', e);
    }

    // Try draft_articles table
    try {
      const draftRes = await fetch(
        `${supabaseUrl}/rest/v1/draft_articles?id=eq.${articleId}`,
        { method: 'DELETE', headers }
      );
      if (draftRes.ok) {
        const data = await draftRes.json();
        totalDeleted += Array.isArray(data) ? data.length : 0;
      }
    } catch (e) {
      console.log('draft_articles delete error:', e);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: totalDeleted > 0 ? `Deleted ${totalDeleted} article(s)` : 'No article found',
      articleId,
      deletedCount: totalDeleted
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
