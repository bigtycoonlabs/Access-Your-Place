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
    
    const { articles } = await req.json();
    
    if (!articles || !Array.isArray(articles)) {
      return new Response(JSON.stringify({ error: 'Articles array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };

    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/blog_articles?select=slug`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    
    let existingSlugs = new Set<string>();
    if (existingRes.ok) {
      const existingArticles = await existingRes.json();
      existingSlugs = new Set((existingArticles || []).map((a: any) => a.slug));
    }
    
    let synced = 0;
    let skipped = 0;

    for (const article of articles) {
      if (existingSlugs.has(article.slug)) {
        skipped++;
        continue;
      }

      const insertRes = await fetch(
        `${supabaseUrl}/rest/v1/blog_articles`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: article.title,
            slug: article.slug,
            category: article.category || 'General',
            excerpt: article.excerpt || '',
            content: article.content || '',
            meta_description: article.metaDescription || '',
            status: 'published',
            published_at: new Date().toISOString()
          })
        }
      );

      if (insertRes.status === 201 || insertRes.ok) {
        synced++;
        existingSlugs.add(article.slug);
      }
    }

    return new Response(JSON.stringify({ success: true, synced, skipped, total: articles.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
