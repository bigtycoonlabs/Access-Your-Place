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
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const body = await req.json();
    const { action, investor_id } = body;

    console.log('manage-market-reports action:', action, 'investor_id:', investor_id);

    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };

    // Get reports for an investor
    if (action === 'get_reports') {
      let url = `${supabaseUrl}/rest/v1/market_reports?order=created_at.desc&limit=20`;
      if (investor_id) {
        url += `&investor_id=eq.${investor_id}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching reports:', errorText);
        return new Response(JSON.stringify({ reports: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const reports = await response.json();
      return new Response(JSON.stringify({ reports: reports || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get schedule for an investor
    if (action === 'get_schedule') {
      const url = `${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}&limit=1`;
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return new Response(JSON.stringify({ schedule: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const schedules = await response.json();
      return new Response(JSON.stringify({ schedule: schedules?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save/update schedule
    if (action === 'save_schedule') {
      const { frequency, day_of_week, day_of_month, markets, is_active } = body;

      // Check if schedule exists
      const checkUrl = `${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}&limit=1`;
      const checkResponse = await fetch(checkUrl, { headers });
      const existing = await checkResponse.json();

      let schedule;
      if (existing && existing.length > 0) {
        // Update existing
        const updateUrl = `${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            frequency,
            day_of_week,
            day_of_month,
            markets,
            is_active,
            updated_at: new Date().toISOString()
          })
        });
        const updated = await updateResponse.json();
        schedule = updated?.[0];
      } else {
        // Create new
        const createUrl = `${supabaseUrl}/rest/v1/market_report_schedules`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            investor_id,
            frequency,
            day_of_week,
            day_of_month,
            markets,
            is_active
          })
        });
        const created = await createResponse.json();
        schedule = created?.[0];
      }

      return new Response(JSON.stringify({ schedule }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get dashboard data
    if (action === 'get_dashboard_data') {
      let reports: any[] = [];
      let referrals: any[] = [];
      let acquisitions: any[] = [];
      let favorites: any[] = [];

      try {
        const reportsUrl = `${supabaseUrl}/rest/v1/market_reports?investor_id=eq.${investor_id}&order=created_at.desc&limit=3`;
        const reportsRes = await fetch(reportsUrl, { headers });
        if (reportsRes.ok) reports = await reportsRes.json();
      } catch (e) {
        console.error('Error fetching reports:', e);
      }

      try {
        const referralsUrl = `${supabaseUrl}/rest/v1/investor_referrals?referrer_id=eq.${investor_id}`;
        const referralsRes = await fetch(referralsUrl, { headers });
        if (referralsRes.ok) referrals = await referralsRes.json();
      } catch (e) {
        console.error('Error fetching referrals:', e);
      }

      try {
        const acquisitionsUrl = `${supabaseUrl}/rest/v1/acquisitions?investor_id=eq.${investor_id}&order=created_at.desc`;
        const acquisitionsRes = await fetch(acquisitionsUrl, { headers });
        if (acquisitionsRes.ok) acquisitions = await acquisitionsRes.json();
      } catch (e) {
        console.error('Error fetching acquisitions:', e);
      }

      try {
        const favoritesUrl = `${supabaseUrl}/rest/v1/investor_favorites?investor_id=eq.${investor_id}&limit=5`;
        const favoritesRes = await fetch(favoritesUrl, { headers });
        if (favoritesRes.ok) favorites = await favoritesRes.json();
      } catch (e) {
        console.error('Error fetching favorites:', e);
      }

      const qualifiedReferrals = referrals.filter((r: any) => r.status === 'qualified').length;

      return new Response(JSON.stringify({
        recentReports: reports,
        referralStats: {
          total: referrals.length,
          qualified: qualifiedReferrals,
          earnings: qualifiedReferrals * 300,
          credits: 0
        },
        acquisitions,
        savedDeals: favorites
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get templates
    if (action === 'get_templates') {
      const defaultTemplates = [
        { id: '1', name: 'STR Market Analysis', description: 'Comprehensive short-term rental market analysis' },
        { id: '2', name: 'Investment Opportunity Report', description: 'Detailed investment opportunity analysis' },
        { id: '3', name: 'Market Comparison', description: 'Compare multiple markets side by side' }
      ];

      return new Response(JSON.stringify({ templates: defaultTemplates }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete a report
    if (action === 'delete_report') {
      const { report_id } = body;
      
      let deleteUrl = `${supabaseUrl}/rest/v1/market_reports?id=eq.${report_id}`;
      if (investor_id) {
        deleteUrl += `&investor_id=eq.${investor_id}`;
      }
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('Error deleting report:', errorText);
        throw new Error('Failed to delete report');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('manage-market-reports error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

