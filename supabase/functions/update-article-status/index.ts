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
    
    const { articleId, status, staffNotes, approvedBy, articleData, sourceTable } = await req.json();
    
    console.log('Update article status:', { articleId, status, sourceTable });
    
    if (!articleId) {
      throw new Error('Article ID is required');
    }
    
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (status) updateData.status = status;
    if (staffNotes) updateData.staff_notes = staffNotes;
    if (approvedBy) updateData.approved_by = approvedBy;
    
    if (status === 'approved' || status === 'published') {
      updateData.approved_at = new Date().toISOString();
      if (status === 'published') {
        updateData.published_at = new Date().toISOString();
      }
    }
    
    if (status === 'scheduled' && articleData?.scheduled_for) {
      updateData.scheduled_for = articleData.scheduled_for;
    }
    
    if (articleData) {
      if (articleData.title) updateData.title = articleData.title;
      if (articleData.excerpt) updateData.excerpt = articleData.excerpt;
      if (articleData.content) updateData.content = articleData.content;
      if (articleData.category) updateData.category = articleData.category;
      if (articleData.tags) updateData.tags = articleData.tags;
      if (articleData.seo_title) updateData.seo_title = articleData.seo_title;
      if (articleData.seo_description) updateData.seo_description = articleData.seo_description;
      if (articleData.seo_keywords) updateData.seo_keywords = articleData.seo_keywords;
      if (articleData.scheduled_for) updateData.scheduled_for = articleData.scheduled_for;
      if (articleData.image_url) updateData.image_url = articleData.image_url;
      if (articleData.city) updateData.city = articleData.city;
      if (articleData.state) updateData.state = articleData.state;
    }
    
    let result = null;
    let updatedInTable = null;

    // Try draft_articles first
    try {
      console.log('Trying to update draft_articles...');
      const draftRes = await fetch(
        `${supabaseUrl}/rest/v1/draft_articles?id=eq.${articleId}`,
        { method: 'PATCH', headers, body: JSON.stringify(updateData) }
      );
      
      console.log('Draft articles response status:', draftRes.status);
      
      if (draftRes.ok) {
        const data = await draftRes.json();
        if (Array.isArray(data) && data.length > 0) {
          result = data[0];
          updatedInTable = 'draft_articles';
          console.log('Updated in draft_articles');
        }
      }
    } catch (e) {
      console.log('Draft update error:', e);
    }

    // If not found in draft_articles, try blog_articles
    if (!result) {
      try {
        console.log('Trying to update blog_articles...');
        const blogUpdateData: any = { ...updateData };
        if (articleData?.seo_description) blogUpdateData.meta_description = articleData.seo_description;
        if (articleData?.seo_keywords) blogUpdateData.keywords = articleData.seo_keywords;
        if (articleData?.tags) blogUpdateData.keywords = articleData.tags;
        
        const blogRes = await fetch(
          `${supabaseUrl}/rest/v1/blog_articles?id=eq.${articleId}`,
          { method: 'PATCH', headers, body: JSON.stringify(blogUpdateData) }
        );
        
        console.log('Blog articles response status:', blogRes.status);
        
        if (blogRes.ok) {
          const data = await blogRes.json();
          if (Array.isArray(data) && data.length > 0) {
            result = data[0];
            updatedInTable = 'blog_articles';
            console.log('Updated in blog_articles');
          }
        }
      } catch (e) {
        console.log('Blog update error:', e);
      }
    }

    // If article was published and found in draft_articles, also sync to blog_articles for the knowledge library
    if (status === 'published' && result && updatedInTable === 'draft_articles') {
      try {
        console.log('Syncing published article to blog_articles...');
        
        // Check if article already exists in blog_articles by slug
        const slug = result.slug || articleId;
        const checkRes = await fetch(
          `${supabaseUrl}/rest/v1/blog_articles?slug=eq.${encodeURIComponent(slug)}&select=id`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const existing = await checkRes.json();
        
        const blogArticleData = {
          title: result.title,
          slug: slug,
          category: result.category || 'General',
          excerpt: result.excerpt || '',
          content: result.content || '',
          meta_description: result.seo_description || result.excerpt || '',
          image_url: result.image_url,
          city: result.city,
          state: result.state,
          status: 'published',
          published_at: new Date().toISOString()
        };
        
        if (existing && existing.length > 0) {
          // Update existing
          await fetch(
            `${supabaseUrl}/rest/v1/blog_articles?id=eq.${existing[0].id}`,
            { method: 'PATCH', headers, body: JSON.stringify(blogArticleData) }
          );
          console.log('Updated existing blog_articles entry');
        } else {
          // Insert new
          await fetch(
            `${supabaseUrl}/rest/v1/blog_articles`,
            { method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(blogArticleData) }
          );
          console.log('Created new blog_articles entry');
        }
      } catch (e) {
        console.log('Blog sync error (non-critical):', e);
      }
    }

    if (!result) {
      return new Response(JSON.stringify({ success: false, error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      article: result,
      updatedInTable 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
