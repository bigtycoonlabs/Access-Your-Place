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

    // Check if today is Monday-Friday
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ 
        message: 'Skipped: Weekend day',
        day: dayOfWeek 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Starting daily article generation (10 articles)...');

    // Call the research-and-generate-articles function to generate 10 articles
    const articleResponse = await fetch(`${supabaseUrl}/functions/v1/research-and-generate-articles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        count: 10 // Generate 10 articles per day = 50 per week
      })
    });

    const articleData = await articleResponse.json();
    console.log('Article generation completed:', articleData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily article generation completed',
      articlesGenerated: articleData.articlesGenerated || 0,
      details: articleData
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error in daily article generation:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
