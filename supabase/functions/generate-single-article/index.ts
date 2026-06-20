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
    const { topic, category, tone, word_count } = await req.json();

    if (!topic) {
      throw new Error('Topic is required');
    }

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY');
    if (!gatewayApiKey) {
      throw new Error('API Gateway key not configured');
    }

    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, authoritative tone with industry terminology.',
      conversational: 'Use a friendly, conversational tone as if talking to a friend.',
      educational: 'Use an educational, instructive tone that explains concepts clearly.',
      persuasive: 'Use a persuasive tone that encourages action and highlights benefits.'
    };

    const prompt = `Write a comprehensive blog article about: "${topic}"

Category: ${category || 'Investment Strategy'}
Target word count: ${word_count || 1000} words
Tone: ${toneInstructions[tone] || toneInstructions.professional}

The article is for a rental arbitrage and short-term rental investment platform. The audience includes real estate investors interested in:
- Short-term rentals (Airbnb/VRBO)
- Co-living investments
- Rental arbitrage strategies
- Property management

Requirements:
1. Write engaging, SEO-optimized content
2. Include practical tips and actionable advice
3. Use headers (H2, H3) to structure the content
4. Include relevant statistics or data points where appropriate
5. End with a strong call-to-action

Return your response in this exact JSON format:
{
  "title": "Compelling article title",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence summary for previews",
  "content": "Full HTML content with <h2>, <h3>, <p>, <ul>, <li> tags",
  "category": "${category || 'Investment Strategy'}",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seo_title": "SEO optimized title under 60 chars",
  "seo_description": "Meta description under 160 chars"
}`;

    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gatewayApiKey
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content writer specializing in real estate investment, short-term rentals, and rental arbitrage. You write engaging, SEO-optimized articles that provide real value to investors. Always respond with valid JSON only, no markdown code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Failed to generate article: ' + response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let article;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        article = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content.substring(0, 500));
      // Create a fallback article structure
      article = {
        title: topic,
        slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        excerpt: `An in-depth look at ${topic} for real estate investors.`,
        content: `<h2>${topic}</h2><p>${content}</p>`,
        category: category || 'Investment Strategy',
        tags: ['real estate', 'investment', 'rental'],
        seo_title: topic.substring(0, 60),
        seo_description: `Learn about ${topic} and how it can benefit your real estate investment strategy.`.substring(0, 160)
      };
    }

    return new Response(JSON.stringify({
      success: true,
      article
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Generate article error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

