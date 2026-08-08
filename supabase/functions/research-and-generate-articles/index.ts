// Repointed 6 August 2026 from ai.gateway.fastrouter.io to OpenAI directly.
//
// That gateway is NOT this company's — the owner confirmed it is leftover code — and it
// carried the same GATEWAY_API_KEY as the payment gateway that was tombstoned the same
// day. Every deal search, article and photo description sent through it went to a third
// party nobody here controls.
//
// The gateway spoke the OpenAI chat-completions shape, so this is a base URL, an auth
// header and a model swap. google/gemini-2.5-flash becomes gpt-4o, which is the model the
// rest of this platform already runs on.
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function generateArticle(topic: any, retries = 3): Promise<any> {
  const gatewayKey = Deno.env.get('OPENAI_API_KEY');
  if (!gatewayKey) throw new Error('Gateway API key not configured');

  const prompt = `Write a comprehensive, SEO-optimized blog article about: "${topic.title}"
Topic Category: ${topic.category || 'Rental Arbitrage'}
Target Keywords: ${topic.keywords?.join(', ') || topic.title}

Requirements:
1. Write 1500-2000 words
2. Use proper HTML formatting with <h2>, <h3>, <p>, <ul>, <li>, <strong> tags
3. Include an engaging introduction
4. Break content into 4-6 main sections with H2 headings
5. Include practical tips and actionable advice
6. Add a conclusion with key takeaways
7. Write for investors interested in rental arbitrage
8. Make it informative, professional, and engaging

Return ONLY the HTML content, no markdown.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        if (attempt === retries) throw new Error(`API error: ${response.status}`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No content in response');
      return content;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

function generateExcerpt(content: string): string {
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.substring(0, 200) + (text.length > 200 ? '...' : '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { limit = 5, topic_id } = body;

    // Get pending topics from research_queue
    let query = supabase.from('research_queue').select('*').eq('status', 'pending').order('priority', { ascending: false }).order('created_at', { ascending: true });
    
    if (topic_id) {
      query = supabase.from('research_queue').select('*').eq('id', topic_id);
    } else {
      query = query.limit(limit);
    }

    const { data: topics, error: topicsError } = await query;
    if (topicsError) throw topicsError;
    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending topics', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];
    for (const topic of topics) {
      try {
        // Mark as processing
        await supabase.from('research_queue').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', topic.id);

        // Generate article content
        const htmlContent = await generateArticle(topic);
        const slug = generateSlug(topic.title);
        const excerpt = generateExcerpt(htmlContent);

        // Save to draft_articles
        const { data: article, error: insertError } = await supabase.from('draft_articles').insert({
          title: topic.title,
          slug: slug,
          content: htmlContent,
          excerpt: excerpt,
          category: topic.category || 'Rental Arbitrage',
          tags: topic.keywords || [],
          status: 'draft',
          seo_title: topic.title,
          seo_description: excerpt,
          source_topic_id: topic.id,
          created_at: new Date().toISOString()
        }).select().single();

        if (insertError) throw insertError;

        // Mark topic as completed
        await supabase.from('research_queue').update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          article_id: article.id,
          updated_at: new Date().toISOString()
        }).eq('id', topic.id);

        results.push({ topic_id: topic.id, article_id: article.id, title: topic.title, status: 'success' });
      } catch (error) {
        // Mark as failed
        await supabase.from('research_queue').update({ 
          status: 'failed', 
          error_message: error.message,
          updated_at: new Date().toISOString()
        }).eq('id', topic.id);

        results.push({ topic_id: topic.id, title: topic.title, status: 'failed', error: error.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
