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

import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date().toISOString();
    
    const { data: scheduledArticles, error: fetchError } = await supabase
      .from('draft_articles')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now);

    if (fetchError) throw fetchError;

    const results = { published: 0, failed: 0, errors: [] as string[] };

    for (const article of scheduledArticles || []) {
      try {
        await supabase.from('blog_articles').upsert({
          id: article.id, title: article.title, slug: article.slug,
          excerpt: article.excerpt, content: article.content, category: article.category,
          tags: article.tags, keywords: article.seo_keywords || article.tags,
          meta_description: article.seo_description || article.excerpt,
          seo_title: article.seo_title, seo_description: article.seo_description,
          seo_keywords: article.seo_keywords, featured_image: article.featured_image,
          author: article.author || 'Staff', research_sources: article.research_sources,
          published_at: now, created_at: article.created_at
        }, { onConflict: 'slug' });

        await supabase.from('draft_articles')
          .update({ status: 'published', published_at: now })
          .eq('id', article.id);

        results.published++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${article.title}: ${err.message}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, message: `Published ${results.published} articles`, results
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

