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
    const { topic } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get recent topics from queue
    const { data: queueTopics } = await supabaseClient
      .from('research_queue')
      .select('topic, description')
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Get recent published articles
    const { data: articles } = await supabaseClient
      .from('blog_articles')
      .select('title, excerpt')
      .order('created_at', { ascending: false })
      .limit(20);

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY');
    
    const prompt = `Compare this new topic with existing content. Return ONLY a JSON object.

NEW TOPIC: "${topic.title}"
Description: ${topic.content}

EXISTING QUEUE: ${queueTopics?.map(t => t.topic).join(', ') || 'None'}
RECENT ARTICLES: ${articles?.map(a => a.title).join(', ') || 'None'}

Return JSON:
{"similarityScore": 0-100, "isDuplicate": boolean, "reason": "text", "mostSimilarTo": "title or null"}

Duplicate if score > 80.`;

    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gatewayApiKey
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('AI Response:', JSON.stringify(aiResult));
    
    const resultText = aiResult.choices?.[0]?.message?.content || '';
    
    // Extract JSON
    let jsonText = resultText.trim();
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }
    
    const result = JSON.parse(jsonText);

    // Update discovered topic
    if (topic.id) {
      await supabaseClient
        .from('discovered_topics')
        .update({
          similarity_checked: true,
          is_duplicate: result.isDuplicate,
          similarity_score: result.similarityScore
        })
        .eq('id', topic.id);
    }

    return new Response(JSON.stringify({ 
      isUnique: !result.isDuplicate,
      similarityScore: result.similarityScore,
      reason: result.reason,
      mostSimilarTo: result.mostSimilarTo
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error('Similarity error:', error.message);
    return new Response(JSON.stringify({ 
      isUnique: true,
      similarityScore: 0,
      reason: 'Error: ' + error.message
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});
