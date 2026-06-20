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
    
    let body: any = {};
    try { body = await req.json(); } catch (e) {}
    
    const status = body.status || 'all';
    
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };

    const allArticles: any[] = [];

    // Get draft articles
    let draftUrl = `${supabaseUrl}/rest/v1/draft_articles?select=*&order=created_at.desc`;
    if (status !== 'all') {
      draftUrl += `&status=eq.${status}`;
    }
    
    try {
      const draftRes = await fetch(draftUrl, { headers });
      if (draftRes.ok) {
        const draftArticles = await draftRes.json();
        if (Array.isArray(draftArticles)) {
          allArticles.push(...draftArticles);
        }
      }
    } catch (e) {
      console.log('Draft articles fetch error:', e);
    }

    // Get published articles from blog_articles table
    try {
      const pubRes = await fetch(
        `${supabaseUrl}/rest/v1/blog_articles?select=*&order=created_at.desc`,
        { headers }
      );
      if (pubRes.ok) {
        const publishedArticles = await pubRes.json();
        if (Array.isArray(publishedArticles)) {
          for (const article of publishedArticles) {
            const exists = allArticles.some(d => d.slug === article.slug || d.title === article.title);
            if (!exists) {
              allArticles.push({
                id: article.id,
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt || article.meta_description || '',
                content: article.content,
                category: article.category,
                tags: article.tags || article.keywords || [],
                status: 'published',
                ai_confidence_score: 1.0,
                research_sources: article.research_sources || [],
                seo_title: article.seo_title || article.title,
                seo_description: article.seo_description || article.meta_description || '',
                seo_keywords: article.seo_keywords || article.keywords || [],
                created_at: article.created_at,
                published_at: article.published_at || article.created_at,
                scheduled_for: article.scheduled_for || null,
                source_table: 'blog_articles'
              });
            }
          }
        }
      }
    } catch (e) {
      console.log('Published articles fetch error:', e);
    }

    allArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ success: true, articles: allArticles }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message, articles: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

