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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const gatewayApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!gatewayApiKey) {
      throw new Error('API Gateway key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current date for context
    const currentDate = new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + gatewayApiKey 
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ 
          role: 'user', 
          content: `You are a content strategist for a rental arbitrage and short-term rental investment platform. Generate 8 trending, timely blog topics for ${currentDate} that would interest real estate investors.

Focus on:
- Current market trends and regulations
- Seasonal investment strategies
- Emerging markets for STR/co-living
- Technology and automation in property management
- Tax strategies and financial planning
- Success stories and case studies

Return ONLY a valid JSON array (no markdown, no code blocks):
[
  {
    "title": "Full article title",
    "description": "2-3 sentence description of what the article will cover",
    "category": "Market Analysis|Investment Strategy|Property Management|Regulations|Co-Living|STR Tips",
    "priority": 85,
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]`
        }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    let topics: any[] = [];
    try {
      // Clean up the response and extract JSON
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch (e) { 
      console.error('Parse error:', e, 'Content:', content); 
    }

    if (!topics.length) {
      // Fallback topics if AI fails
      topics = [
        {
          title: "Top 10 Markets for Rental Arbitrage in 2025",
          description: "Analysis of the best markets for rental arbitrage investors based on regulations, demand, and profitability.",
          category: "Market Analysis",
          priority: 90,
          keywords: ["rental arbitrage", "best markets", "2025"]
        },
        {
          title: "How to Set Up a Profitable Co-Living Property",
          description: "Step-by-step guide to converting a single-family home into a high-cash-flow co-living investment.",
          category: "Co-Living",
          priority: 85,
          keywords: ["co-living", "setup guide", "profitability"]
        }
      ];
    }

    let addedToQueue = 0;
    let addedToDiscovered = 0;

    for (const t of topics.slice(0, 8)) {
      // Check if similar topic already exists
      const { data: existing } = await supabase
        .from('discovered_topics')
        .select('id')
        .ilike('title', `%${t.title.substring(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Skip duplicate topics
      }

      // Insert to discovered_topics
      const { error: topicError } = await supabase
        .from('discovered_topics')
        .insert({
          title: String(t.title || 'Untitled'),
          content: String(t.description || ''),
          source: 'AI Discovery',
          source_url: '',
          engagement_score: Math.floor(Math.random() * 20) + 75,
          relevance_score: Number(t.priority) || 80,
          trending_score: Math.floor(Math.random() * 15) + 80,
          priority_score: Number(t.priority) || 80,
          added_to_queue: false
        });

      if (!topicError) {
        addedToDiscovered++;
      }

      // Add high-priority topics to research queue
      if ((t.priority || 80) >= 85) {
        const { error: queueError } = await supabase
          .from('research_queue')
          .insert({
            topic: String(t.title),
            description: String(t.description || ''),
            source: 'AI Discovery',
            priority_score: Number(t.priority) || 85,
            engagement_score: Math.floor(Math.random() * 15) + 80,
            status: 'pending'
          });

        if (!queueError) {
          addedToQueue++;
          // Mark as added to queue
          await supabase
            .from('discovered_topics')
            .update({ added_to_queue: true })
            .eq('title', t.title);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      topicsDiscovered: topics.length,
      addedToDiscovered,
      addedToQueue,
      topics: topics.map(t => ({ title: t.title, category: t.category, priority: t.priority }))
    }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  } catch (error: any) {
    console.error('Discover topics error:', error);
    return new Response(JSON.stringify({ 
      error: error.message, 
      success: false 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
});
