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
// get-deal-analytics v2.0 â€” Migrated from createClient to direct PostgREST REST API
// Eliminates intermittent 'Authorization token is required' bug

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };
}

async function dbGet(table: string, params: string = ''): Promise<any[]> {
  try {
    const url = `${supabaseUrl}/rest/v1/${table}${params ? '?' + params : ''}`;
    const r = await fetch(url, { method: 'GET', headers: getHeaders() });
    if (!r.ok) {
      const errText = await r.text();
      console.log(`[v2.0] dbGet ${table} error: ${r.status} ${errText.substring(0, 200)}`);
      return [];
    }
    return (await r.json()) || [];
  } catch (e: any) {
    console.log(`[v2.0] dbGet ${table} exception: ${e.message}`);
    return [];
  }
}

// Default empty analytics response
const defaultAnalytics = {
  overview: {
    totalInquiries: 0,
    convertedInquiries: 0,
    conversionRate: 0,
    totalRevenue: 0,
    avgDealSize: 0,
    activeInvestors: 0,
    totalInvestors: 0,
    totalProperties: 0
  },
  topMarkets: [],
  pipelineStats: [
    { stage: 'lead', count: 0 },
    { stage: 'qualified', count: 0 },
    { stage: 'negotiating', count: 0 },
    { stage: 'under_contract', count: 0 },
    { stage: 'due_diligence', count: 0 },
    { stage: 'closed', count: 0 }
  ],
  inquiries: [],
  acquisitions: []
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[v2.0] get-deal-analytics request received');

  try {
    if (!supabaseUrl || !supabaseKey) {
      console.error('[v2.0] Missing environment variables');
      return new Response(JSON.stringify(defaultAnalytics), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Parse request body safely
    let dateRange = '30';
    try {
      const body = await req.json();
      dateRange = body?.dateRange || '30';
    } catch (e) {
      console.log('[v2.0] No body or invalid JSON, using default dateRange');
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    const dateFilter = daysAgo.toISOString();

    console.log(`[v2.0] Fetching data for last ${dateRange} days (since ${dateFilter})`);

    // Fetch all data in parallel using direct REST API
    const [inquiries, acquisitions, properties, investors] = await Promise.all([
      dbGet('deal_inquiries', `created_at=gte.${encodeURIComponent(dateFilter)}&select=*`),
      dbGet('acquisitions', `created_at=gte.${encodeURIComponent(dateFilter)}&select=*`),
      dbGet('properties', `select=id,market,status,price,city,state&limit=1000`),
      dbGet('investors', `select=id,status,created_at&limit=5000`)
    ]);

    console.log(`[v2.0] Data fetched â€” Inquiries: ${inquiries.length}, Acquisitions: ${acquisitions.length}, Properties: ${properties.length}, Investors: ${investors.length}`);

    // Calculate metrics safely
    const totalInquiries = inquiries.length;
    const convertedInquiries = inquiries.filter((i: any) => i.status === 'converted').length;
    const conversionRate = totalInquiries > 0
      ? parseFloat((convertedInquiries / totalInquiries * 100).toFixed(1))
      : 0;

    // Market performance
    const marketStats: Record<string, { inquiries: number; conversions: number; revenue: number }> = {};

    inquiries.forEach((inq: any) => {
      const market = inq.property_market || inq.market || 'Unknown';
      if (!marketStats[market]) {
        marketStats[market] = { inquiries: 0, conversions: 0, revenue: 0 };
      }
      marketStats[market].inquiries++;
      if (inq.status === 'converted') {
        marketStats[market].conversions++;
      }
    });

    acquisitions.forEach((acq: any) => {
      const market = acq.market || 'Unknown';
      if (!marketStats[market]) {
        marketStats[market] = { inquiries: 0, conversions: 0, revenue: 0 };
      }
      const price = parseFloat(acq.purchase_price) || 0;
      marketStats[market].revenue += price;
    });

    const topMarkets = Object.entries(marketStats)
      .map(([market, stats]) => ({ market, ...stats }))
      .sort((a, b) => b.inquiries - a.inquiries)
      .slice(0, 10);

    // Pipeline stages
    const stages = ['lead', 'qualified', 'negotiating', 'under_contract', 'due_diligence', 'closed'];
    const pipelineStats = stages.map(stage => ({
      stage,
      count: acquisitions.filter((a: any) => a.stage === stage || a.status === stage).length
    }));

    // Revenue calculations
    const totalRevenue = acquisitions.reduce((sum: number, a: any) => {
      const price = parseFloat(a.purchase_price) || 0;
      return sum + price;
    }, 0);

    const avgDealSize = acquisitions.length > 0
      ? totalRevenue / acquisitions.length
      : 0;

    // Active investors (those with inquiries in the period)
    const activeInvestorIds = new Set(inquiries.map((i: any) => i.investor_id).filter(Boolean));
    const activeInvestors = activeInvestorIds.size;

    const response = {
      overview: {
        totalInquiries,
        convertedInquiries,
        conversionRate,
        totalRevenue,
        avgDealSize,
        activeInvestors,
        totalInvestors: investors.length,
        totalProperties: properties.length
      },
      topMarkets,
      pipelineStats,
      inquiries: inquiries.slice(0, 100),
      acquisitions: acquisitions.slice(0, 50)
    };

    console.log(`[v2.0] Response prepared â€” totalInvestors: ${investors.length}, totalProperties: ${properties.length}`);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[v2.0] Unexpected error:', error.message || error);

    return new Response(JSON.stringify(defaultAnalytics), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
