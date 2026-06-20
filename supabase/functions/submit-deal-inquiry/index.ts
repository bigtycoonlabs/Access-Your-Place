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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { property_id, name, email, phone, message, investment_type } = await req.json();
    
    if (!property_id || !name || !email) {
      throw new Error('Property ID, name, and email are required');
    }

    const { data, error } = await supabase.from('deal_inquiries').insert({
      property_id,
      investor_name: name,
      investor_email: email,
      investor_phone: phone || null,
      message: message || null,
      investment_type: investment_type || 'general',
      status: 'new',
      created_at: new Date().toISOString()
    }).select().single();

    if (error) throw error;

    // Add note to property
    await supabase.from('outreach_notes').insert({
      property_id,
      content: `New inquiry from ${name} (${email}): ${message || 'No message'}`,
      note_type: 'general',
      author_name: 'System',
      is_pinned: true
    });

    return new Response(JSON.stringify({ success: true, inquiry: data }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

