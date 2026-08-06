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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const resendKey = Deno.env.get('RESEND_API_KEY');

    const { subject, content, investor_ids, filters, staff_name } = await req.json();

    let investors = [];
    
    if (investor_ids?.length) {
      const { data } = await supabase.from('investor_profiles')
        .select('id, email, full_name').in('id', investor_ids).eq('is_active', true);
      investors = data || [];
    } else if (filters) {
      let query = supabase.from('investor_profiles').select('id, email, full_name').eq('is_active', true);
      if (filters.activity_level && filters.activity_level !== 'all') {
        query = query.eq('activity_level', filters.activity_level);
      }
      if (filters.min_budget) query = query.gte('investment_budget_min', filters.min_budget);
      if (filters.max_budget) query = query.lte('investment_budget_max', filters.max_budget);
      if (filters.markets?.length) query = query.overlaps('preferred_markets', filters.markets);
      const { data } = await query;
      investors = data || [];
    }

    if (!investors.length) {
      return new Response(JSON.stringify({ error: 'No investors match criteria' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let sent = 0, failed = 0;
    
    for (const investor of investors) {
      const personalizedContent = content
        .replace(/{{name}}/g, investor.full_name)
        .replace(/{{email}}/g, investor.email);

      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
            to: investor.email,
            subject,
            html: personalizedContent
          })
        });

        if (emailRes.ok) {
          sent++;
          await supabase.from('investor_communications').insert({
            investor_id: investor.id,
            type: 'email',
            direction: 'outbound',
            subject,
            content: personalizedContent,
            status: 'sent',
            staff_name
          });
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: investors.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
