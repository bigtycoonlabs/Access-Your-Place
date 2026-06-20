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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'get_portfolio_with_performance':
        return await getPortfolioWithPerformance(params.investor_id);
      case 'save_monthly_data':
        return await saveMonthlyData(params);
      case 'get_suggestions':
        return await getSuggestions(params.investor_id);
      case 'generate_ai_suggestions':
        return await generateAISuggestions(params.investor_id);
      case 'update_suggestion':
        return await updateSuggestion(params);
      case 'get_platform_aggregated_data':
        return await getPlatformAggregatedData(params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function getPortfolioWithPerformance(investor_id: string) {
  // Get properties
  const { data: properties, error: propError } = await supabase
    .from('investor_properties')
    .select('*')
    .eq('investor_id', investor_id)
    .order('created_at', { ascending: false });

  if (propError) throw propError;
  if (!properties || properties.length === 0) {
    return new Response(JSON.stringify({ success: true, properties: [], summary: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get monthly data for each property
  const propertyIds = properties.map(p => p.id);
  const { data: monthlyData } = await supabase
    .from('portfolio_monthly_data')
    .select('*')
    .in('property_id', propertyIds)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  // Get platform bookings data
  const { data: platformBookings } = await supabase
    .from('platform_bookings')
    .select('*')
    .eq('investor_id', investor_id)
    .gte('check_in', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  // Get market benchmarks
  const cities = [...new Set(properties.map(p => p.city))];
  const { data: benchmarks } = await supabase
    .from('market_benchmarks')
    .select('*')
    .in('city', cities);

  // Enhance properties with performance data
  const enhancedProperties = properties.map(property => {
    const propMonthlyData = monthlyData?.filter(d => d.property_id === property.id) || [];
    const latestData = propMonthlyData[0];
    const benchmark = benchmarks?.find(b => 
      b.city.toLowerCase() === property.city?.toLowerCase()
    );

    // Calculate platform data for this property
    const propPlatformBookings = platformBookings?.filter(b => b.property_id === property.id) || [];
    let platformRevenue = 0;
    let platformNights = 0;
    propPlatformBookings.forEach(b => {
      platformRevenue += parseFloat(b.net_revenue || 0);
      platformNights += b.nights || 0;
    });

    // Calculate performance vs market
    let performanceVsMarket = null;
    if (benchmark && latestData) {
      performanceVsMarket = {
        revenue_diff: ((latestData.revenue - benchmark.average_monthly_revenue) / benchmark.average_monthly_revenue * 100),
        occupancy_diff: latestData.occupancy_rate - benchmark.average_occupancy,
        adr_diff: (latestData.revenue / (latestData.occupancy_rate / 100 * 30)) - benchmark.average_adr
      };
    }

    return {
      ...property,
      monthly_data: propMonthlyData,
      latest_performance: latestData ? {
        gross_revenue: latestData.revenue,
        occupancy_rate: latestData.occupancy_rate,
        average_daily_rate: latestData.revenue / Math.max(1, latestData.occupancy_rate / 100 * 30)
      } : null,
      platform_data: {
        revenue_3mo: platformRevenue,
        nights_3mo: platformNights,
        booking_count: propPlatformBookings.length
      },
      market_benchmark: benchmark,
      performance_vs_market: performanceVsMarket
    };
  });

  // Calculate portfolio summary
  const propertiesWithData = enhancedProperties.filter(p => p.latest_performance);
  const totalInvested = properties.reduce((sum, p) => sum + (p.initial_investment || 0), 0);
  
  let avgRevenue = 0, avgOccupancy = 0, avgADR = 0;
  if (propertiesWithData.length > 0) {
    avgRevenue = propertiesWithData.reduce((sum, p) => sum + (p.latest_performance?.gross_revenue || 0), 0) / propertiesWithData.length;
    avgOccupancy = propertiesWithData.reduce((sum, p) => sum + (p.latest_performance?.occupancy_rate || 0), 0) / propertiesWithData.length;
    avgADR = propertiesWithData.reduce((sum, p) => sum + (p.latest_performance?.average_daily_rate || 0), 0) / propertiesWithData.length;
  }

  // Calculate market benchmark averages
  let marketAvgRevenue = 0, marketAvgOccupancy = 0, marketAvgADR = 0;
  if (benchmarks && benchmarks.length > 0) {
    marketAvgRevenue = benchmarks.reduce((sum, b) => sum + b.average_monthly_revenue, 0) / benchmarks.length;
    marketAvgOccupancy = benchmarks.reduce((sum, b) => sum + b.average_occupancy, 0) / benchmarks.length;
    marketAvgADR = benchmarks.reduce((sum, b) => sum + b.average_adr, 0) / benchmarks.length;
  }

  const summary = {
    total_properties: properties.length,
    total_invested: totalInvested,
    avg_monthly_revenue: avgRevenue,
    avg_occupancy: avgOccupancy,
    avg_adr: avgADR,
    total_net_profit_3mo: propertiesWithData.reduce((sum, p) => sum + (p.platform_data?.revenue_3mo || 0), 0),
    annual_roi: totalInvested > 0 ? ((avgRevenue * 12) / totalInvested * 100) : 0,
    vs_market: {
      revenue_diff: marketAvgRevenue > 0 ? ((avgRevenue - marketAvgRevenue) / marketAvgRevenue * 100) : 0,
      occupancy_diff: avgOccupancy - marketAvgOccupancy,
      adr_diff: avgADR - marketAvgADR
    },
    market_benchmarks: {
      avg_revenue: marketAvgRevenue,
      avg_occupancy: marketAvgOccupancy,
      avg_adr: marketAvgADR
    }
  };

  return new Response(JSON.stringify({ 
    success: true, 
    properties: enhancedProperties,
    summary 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function saveMonthlyData(params: {
  investor_id: string;
  property_id: string;
  month: string;
  data: any;
}) {
  const { investor_id, property_id, month, data } = params;
  const date = new Date(month);
  const monthNum = date.getMonth() + 1;
  const year = date.getFullYear();

  // Calculate occupancy if not provided
  let occupancy = data.occupancy_rate;
  if (!occupancy && data.total_nights_booked) {
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    occupancy = (data.total_nights_booked / daysInMonth) * 100;
  }

  // Calculate ADR if not provided
  let adr = data.average_daily_rate;
  if (!adr && data.gross_revenue && data.total_nights_booked) {
    adr = data.gross_revenue / data.total_nights_booked;
  }

  // Calculate total expenses
  const totalExpenses = (data.rent_expense || 0) + (data.cleaning_expenses || 0) + 
    (data.utility_expenses || 0) + (data.maintenance_expenses || 0) + (data.other_expenses || 0);

  const { error } = await supabase
    .from('portfolio_monthly_data')
    .upsert({
      property_id,
      investor_id,
      month: monthNum,
      year,
      revenue: data.gross_revenue || 0,
      expenses: totalExpenses,
      occupancy_rate: occupancy || 0,
      notes: data.notes
    }, { onConflict: 'property_id,month,year' });

  if (error) throw error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getSuggestions(investor_id: string) {
  const { data, error } = await supabase
    .from('portfolio_ai_suggestions')
    .select('*')
    .eq('investor_id', investor_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return new Response(JSON.stringify({ suggestions: data || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function generateAISuggestions(investor_id: string) {
  // Get portfolio data
  const portfolioResponse = await getPortfolioWithPerformance(investor_id);
  const portfolioData = await portfolioResponse.json();

  if (!portfolioData.properties || portfolioData.properties.length === 0) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get platform connection data
  const { data: platformBookings } = await supabase
    .from('platform_bookings')
    .select('*')
    .eq('investor_id', investor_id)
    .order('check_in', { ascending: false })
    .limit(100);

  // Build context for AI
  const context = {
    portfolio_summary: portfolioData.summary,
    properties: portfolioData.properties.map((p: any) => ({
      city: p.city,
      state: p.state,
      bedrooms: p.bedrooms,
      monthly_earnings: p.monthly_earnings,
      latest_revenue: p.latest_performance?.gross_revenue,
      latest_occupancy: p.latest_performance?.occupancy_rate,
      vs_market: p.performance_vs_market,
      platform_revenue_3mo: p.platform_data?.revenue_3mo
    })),
    platform_data: {
      total_bookings: platformBookings?.length || 0,
      platforms_connected: [...new Set(platformBookings?.map(b => b.platform) || [])]
    }
  };

  if (!anthropicKey) {
    // Generate default suggestions without AI
    const suggestions = generateDefaultSuggestions(portfolioData);
    
    // Save suggestions
    for (const suggestion of suggestions) {
      await supabase.from('portfolio_ai_suggestions').insert({
        investor_id,
        ...suggestion,
        status: 'active'
      });
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Call Claude for AI suggestions
  const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze this rental arbitrage portfolio and provide 3-5 specific optimization suggestions.

Portfolio Data:
${JSON.stringify(context, null, 2)}

For each suggestion, provide:
1. suggestion_type: one of "pricing", "amenity", "market_expansion", "operational", "seasonal"
2. title: short title (max 50 chars)
3. description: detailed recommendation (max 200 chars)
4. priority: "high", "medium", or "low"
5. potential_impact: estimated impact (e.g., "+$500/month", "+10% occupancy")

Respond in JSON format: { "suggestions": [...] }`
      }]
    })
  });

  const aiData = await aiResponse.json();
  let suggestions = [];

  try {
    const content = aiData.content[0].text;
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{"suggestions":[]}');
    suggestions = parsed.suggestions || [];
  } catch (e) {
    suggestions = generateDefaultSuggestions(portfolioData);
  }

  // Clear old suggestions and save new ones
  await supabase
    .from('portfolio_ai_suggestions')
    .update({ status: 'dismissed' })
    .eq('investor_id', investor_id)
    .eq('status', 'active');

  for (const suggestion of suggestions) {
    await supabase.from('portfolio_ai_suggestions').insert({
      investor_id,
      suggestion_type: suggestion.suggestion_type || 'operational',
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority || 'medium',
      potential_impact: suggestion.potential_impact,
      status: 'active'
    });
  }

  // Fetch the saved suggestions
  const { data: savedSuggestions } = await supabase
    .from('portfolio_ai_suggestions')
    .select('*')
    .eq('investor_id', investor_id)
    .eq('status', 'active');

  return new Response(JSON.stringify({ suggestions: savedSuggestions || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function generateDefaultSuggestions(portfolioData: any) {
  const suggestions = [];
  const summary = portfolioData.summary;

  if (summary?.vs_market?.revenue_diff < 0) {
    suggestions.push({
      suggestion_type: 'pricing',
      title: 'Increase Nightly Rates',
      description: `Your revenue is ${Math.abs(summary.vs_market.revenue_diff).toFixed(0)}% below market average. Consider raising rates by $10-20/night.`,
      priority: 'high',
      potential_impact: '+$200-400/month'
    });
  }

  if (summary?.vs_market?.occupancy_diff < -5) {
    suggestions.push({
      suggestion_type: 'operational',
      title: 'Improve Listing Photos',
      description: 'Your occupancy is below market average. Professional photos can increase bookings by 20-30%.',
      priority: 'high',
      potential_impact: '+15% occupancy'
    });
  }

  if (summary?.total_properties < 3) {
    suggestions.push({
      suggestion_type: 'market_expansion',
      title: 'Expand Your Portfolio',
      description: 'Consider adding properties in high-demand markets to diversify and increase total revenue.',
      priority: 'medium',
      potential_impact: '+$2,000-4,000/month'
    });
  }

  suggestions.push({
    suggestion_type: 'amenity',
    title: 'Add Premium Amenities',
    description: 'Hot tubs, game rooms, or outdoor spaces can justify 20-30% higher nightly rates.',
    priority: 'medium',
    potential_impact: '+$300-500/month'
  });

  return suggestions;
}

async function updateSuggestion(params: {
  investor_id: string;
  suggestion_id: string;
  status: string;
}) {
  const { error } = await supabase
    .from('portfolio_ai_suggestions')
    .update({ status: params.status })
    .eq('id', params.suggestion_id)
    .eq('investor_id', params.investor_id);

  if (error) throw error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getPlatformAggregatedData(params: {
  investor_id: string;
  property_id?: string;
  months?: number;
}) {
  const { investor_id, property_id, months = 6 } = params;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let query = supabase
    .from('platform_bookings')
    .select('*')
    .eq('investor_id', investor_id)
    .gte('check_in', startDate.toISOString().split('T')[0]);

  if (property_id) {
    query = query.eq('property_id', property_id);
  }

  const { data: bookings } = await query;

  // Aggregate by month
  const monthlyData: Record<string, any> = {};
  
  (bookings || []).forEach(booking => {
    const date = new Date(booking.check_in);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[key]) {
      monthlyData[key] = {
        month: key,
        revenue: 0,
        bookings: 0,
        nights: 0,
        platforms: {}
      };
    }
    
    monthlyData[key].revenue += parseFloat(booking.net_revenue || 0);
    monthlyData[key].bookings += 1;
    monthlyData[key].nights += booking.nights || 0;
    
    if (!monthlyData[key].platforms[booking.platform]) {
      monthlyData[key].platforms[booking.platform] = { revenue: 0, bookings: 0 };
    }
    monthlyData[key].platforms[booking.platform].revenue += parseFloat(booking.net_revenue || 0);
    monthlyData[key].platforms[booking.platform].bookings += 1;
  });

  return new Response(JSON.stringify({ 
    monthly_data: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

