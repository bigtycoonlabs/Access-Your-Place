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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'generate_forecast':
        return await generateForecast(params);
      case 'get_forecasts':
        return await getForecasts(params);
      case 'update_actuals':
        return await updateActuals(params);
      case 'get_alerts':
        return await getAlerts(params);
      case 'get_forecast_chart_data':
        return await getForecastChartData(params);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateForecast(params: { investor_id: string; property_id?: string; months_ahead?: number }) {
  const { investor_id, property_id, months_ahead = 6 } = params;

  // Get historical booking data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 12);

  let bookingsQuery = supabase
    .from('platform_bookings')
    .select('*, platform_listings(property_id, city, state)')
    .eq('investor_id', investor_id)
    .gte('check_in', sixMonthsAgo.toISOString());

  if (property_id) {
    bookingsQuery = bookingsQuery.eq('platform_listings.property_id', property_id);
  }

  const { data: bookings } = await bookingsQuery;

  // Get portfolio properties
  let propertiesQuery = supabase
    .from('investor_portfolio')
    .select('*')
    .eq('investor_id', investor_id)
    .eq('property_status', 'active');

  if (property_id) {
    propertiesQuery = propertiesQuery.eq('id', property_id);
  }

  const { data: properties } = await propertiesQuery;

  if (!properties || properties.length === 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'No properties found in portfolio' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get market benchmarks
  const { data: benchmarks } = await supabase
    .from('market_benchmarks')
    .select('*')
    .order('month', { ascending: false })
    .limit(50);

  // Analyze historical data by month
  const monthlyStats: Record<string, any> = {};
  
  for (const booking of (bookings || [])) {
    const checkIn = new Date(booking.check_in);
    const month = checkIn.getMonth() + 1;
    const propertyId = booking.platform_listings?.property_id || booking.property_id;
    
    if (!propertyId) continue;

    const key = `${propertyId}_${month}`;
    if (!monthlyStats[key]) {
      monthlyStats[key] = {
        property_id: propertyId,
        month,
        revenues: [],
        occupancies: [],
        adrs: []
      };
    }

    monthlyStats[key].revenues.push(parseFloat(booking.net_revenue || 0));
    if (booking.nights > 0) {
      monthlyStats[key].adrs.push(parseFloat(booking.net_revenue || 0) / booking.nights);
    }
  }

  // Generate AI-powered forecasts
  const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY');
  const forecasts: any[] = [];
  const today = new Date();

  for (const property of properties) {
    // Calculate seasonal patterns
    const propertyStats: Record<number, any> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${property.id}_${m}`;
      if (monthlyStats[key]) {
        const revenues = monthlyStats[key].revenues;
        const adrs = monthlyStats[key].adrs;
        propertyStats[m] = {
          avg_revenue: revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length,
          avg_adr: adrs.length > 0 ? adrs.reduce((a: number, b: number) => a + b, 0) / adrs.length : 0,
          data_points: revenues.length
        };
      }
    }

    // Get market benchmark for this property's location
    const marketBenchmark = benchmarks?.find(b => 
      b.city?.toLowerCase() === property.city?.toLowerCase()
    );

    // Generate forecasts for each month ahead
    for (let i = 1; i <= months_ahead; i++) {
      const forecastDate = new Date(today);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const forecastMonth = forecastDate.getMonth() + 1;

      // Base prediction on historical data for this month
      const historicalData = propertyStats[forecastMonth];
      let predictedRevenue = property.monthly_earnings || 3000;
      let predictedOccupancy = 65;
      let predictedADR = 175;
      let confidenceScore = 50;

      if (historicalData && historicalData.data_points >= 2) {
        predictedRevenue = historicalData.avg_revenue;
        predictedADR = historicalData.avg_adr;
        confidenceScore = Math.min(95, 50 + historicalData.data_points * 10);
      }

      // Apply seasonal adjustments
      const seasonalFactors = getSeasonalFactors(forecastMonth, property.city, property.state);
      predictedRevenue *= seasonalFactors.revenueMultiplier;
      predictedOccupancy = seasonalFactors.expectedOccupancy;

      // Apply market trend adjustments
      if (marketBenchmark) {
        const marketTrend = 1.02; // Assume 2% YoY growth
        predictedRevenue *= marketTrend;
      }

      // Calculate factors affecting the forecast
      const factors = {
        seasonal_adjustment: seasonalFactors.revenueMultiplier,
        market_trend: marketBenchmark ? 1.02 : 1.0,
        historical_data_points: historicalData?.data_points || 0,
        local_events: getLocalEvents(forecastDate, property.city, property.state),
        market_conditions: marketBenchmark?.notes || 'Standard market conditions'
      };

      forecasts.push({
        investor_id,
        property_id: property.id,
        forecast_date: forecastDate.toISOString().split('T')[0],
        predicted_revenue: Math.round(predictedRevenue * 100) / 100,
        predicted_occupancy: Math.round(predictedOccupancy * 10) / 10,
        predicted_adr: Math.round(predictedADR * 100) / 100,
        confidence_score: Math.round(confidenceScore),
        factors
      });
    }
  }

  // Use AI to enhance predictions if available
  if (gatewayApiKey && forecasts.length > 0) {
    try {
      const aiPrompt = `Analyze these revenue forecasts for short-term rental properties and provide any adjustments based on market knowledge:

Properties: ${JSON.stringify(properties.map(p => ({ city: p.city, state: p.state, bedrooms: p.bedrooms })))}
Initial Forecasts: ${JSON.stringify(forecasts.slice(0, 6))}

Consider:
1. Seasonal tourism patterns
2. Major events in these cities
3. Economic conditions
4. Competition trends

Respond with JSON array of adjustment factors (1.0 = no change, 1.1 = 10% increase, etc.) for each forecast.`;

      const aiResponse = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayApiKey
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';
        
        // Try to parse AI adjustments
        try {
          const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const adjustments = JSON.parse(jsonMatch[0]);
            for (let i = 0; i < Math.min(adjustments.length, forecasts.length); i++) {
              if (typeof adjustments[i] === 'number') {
                forecasts[i].predicted_revenue *= adjustments[i];
                forecasts[i].factors.ai_adjustment = adjustments[i];
              }
            }
          }
        } catch (e) {
          console.log('Could not parse AI adjustments');
        }
      }
    } catch (e) {
      console.error('AI enhancement failed:', e);
    }
  }

  // Save forecasts to database
  for (const forecast of forecasts) {
    await supabase
      .from('revenue_forecasts')
      .upsert(forecast, { 
        onConflict: 'investor_id,property_id,forecast_date',
        ignoreDuplicates: false 
      });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    forecasts,
    message: `Generated ${forecasts.length} forecasts for ${properties.length} properties`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function getSeasonalFactors(month: number, city?: string, state?: string): { revenueMultiplier: number; expectedOccupancy: number } {
  // Default seasonal patterns
  const defaultFactors: Record<number, { revenueMultiplier: number; expectedOccupancy: number }> = {
    1: { revenueMultiplier: 0.85, expectedOccupancy: 55 },
    2: { revenueMultiplier: 0.90, expectedOccupancy: 58 },
    3: { revenueMultiplier: 1.05, expectedOccupancy: 68 },
    4: { revenueMultiplier: 1.10, expectedOccupancy: 72 },
    5: { revenueMultiplier: 1.15, expectedOccupancy: 75 },
    6: { revenueMultiplier: 1.25, expectedOccupancy: 82 },
    7: { revenueMultiplier: 1.30, expectedOccupancy: 85 },
    8: { revenueMultiplier: 1.25, expectedOccupancy: 82 },
    9: { revenueMultiplier: 1.10, expectedOccupancy: 70 },
    10: { revenueMultiplier: 1.05, expectedOccupancy: 68 },
    11: { revenueMultiplier: 0.95, expectedOccupancy: 62 },
    12: { revenueMultiplier: 1.00, expectedOccupancy: 65 }
  };

  // Location-specific adjustments
  const locationAdjustments: Record<string, Record<number, { revenueMultiplier: number; expectedOccupancy: number }>> = {
    'FL': {
      1: { revenueMultiplier: 1.20, expectedOccupancy: 80 },
      2: { revenueMultiplier: 1.25, expectedOccupancy: 85 },
      3: { revenueMultiplier: 1.30, expectedOccupancy: 88 },
      6: { revenueMultiplier: 0.90, expectedOccupancy: 60 },
      7: { revenueMultiplier: 0.85, expectedOccupancy: 55 },
      8: { revenueMultiplier: 0.85, expectedOccupancy: 55 }
    },
    'AZ': {
      1: { revenueMultiplier: 1.15, expectedOccupancy: 75 },
      2: { revenueMultiplier: 1.25, expectedOccupancy: 82 },
      3: { revenueMultiplier: 1.30, expectedOccupancy: 85 },
      6: { revenueMultiplier: 0.75, expectedOccupancy: 45 },
      7: { revenueMultiplier: 0.70, expectedOccupancy: 40 },
      8: { revenueMultiplier: 0.70, expectedOccupancy: 40 }
    },
    'CO': {
      12: { revenueMultiplier: 1.35, expectedOccupancy: 88 },
      1: { revenueMultiplier: 1.30, expectedOccupancy: 85 },
      2: { revenueMultiplier: 1.25, expectedOccupancy: 82 },
      6: { revenueMultiplier: 1.20, expectedOccupancy: 78 },
      7: { revenueMultiplier: 1.25, expectedOccupancy: 80 }
    }
  };

  let factors = defaultFactors[month] || { revenueMultiplier: 1.0, expectedOccupancy: 65 };

  if (state && locationAdjustments[state]?.[month]) {
    factors = locationAdjustments[state][month];
  }

  return factors;
}

function getLocalEvents(date: Date, city?: string, state?: string): string[] {
  const events: string[] = [];
  const month = date.getMonth() + 1;

  // Major events by location and month
  const eventCalendar: Record<string, Record<number, string[]>> = {
    'Austin': {
      3: ['SXSW Conference (+40% demand)'],
      10: ['ACL Music Festival (+35% demand)']
    },
    'Nashville': {
      4: ['CMA Fest preparations'],
      6: ['CMA Fest (+50% demand)'],
      7: ['Summer tourism peak']
    },
    'Tampa': {
      1: ['Gasparilla Festival (+25% demand)'],
      2: ['Super Bowl (if applicable)'],
      3: ['Spring Break (+30% demand)']
    },
    'Phoenix': {
      2: ['Spring Training starts (+40% demand)'],
      3: ['Spring Training peak (+50% demand)'],
      4: ['Spring Training ends']
    },
    'Orlando': {
      3: ['Spring Break (+35% demand)'],
      6: ['Summer vacation starts (+40% demand)'],
      7: ['Peak summer (+45% demand)'],
      12: ['Holiday season (+30% demand)']
    }
  };

  if (city && eventCalendar[city]?.[month]) {
    events.push(...eventCalendar[city][month]);
  }

  // General holiday events
  if (month === 11) events.push('Thanksgiving travel (+20% demand)');
  if (month === 12) events.push('Holiday season (+25% demand)');
  if (month === 7) events.push('July 4th weekend (+15% demand)');

  return events;
}

async function getForecasts(params: { investor_id: string; property_id?: string; start_date?: string; end_date?: string }) {
  let query = supabase
    .from('revenue_forecasts')
    .select('*, investor_portfolio(city, state, address)')
    .eq('investor_id', params.investor_id)
    .order('forecast_date', { ascending: true });

  if (params.property_id) {
    query = query.eq('property_id', params.property_id);
  }
  if (params.start_date) {
    query = query.gte('forecast_date', params.start_date);
  }
  if (params.end_date) {
    query = query.lte('forecast_date', params.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Response(JSON.stringify({ forecasts: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updateActuals(params: { investor_id: string; property_id: string; month: number; year: number; actual_revenue: number; actual_occupancy?: number }) {
  const forecastDate = new Date(params.year, params.month - 1, 1).toISOString().split('T')[0];

  const { data: forecast } = await supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('investor_id', params.investor_id)
    .eq('property_id', params.property_id)
    .eq('forecast_date', forecastDate)
    .single();

  if (forecast) {
    const variancePct = ((params.actual_revenue - forecast.predicted_revenue) / forecast.predicted_revenue) * 100;

    await supabase
      .from('revenue_forecasts')
      .update({
        actual_revenue: params.actual_revenue,
        actual_occupancy: params.actual_occupancy,
        variance_pct: Math.round(variancePct * 10) / 10
      })
      .eq('id', forecast.id);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getAlerts(params: { investor_id: string }) {
  // Get forecasts with actuals that are significantly below prediction
  const { data: underperforming } = await supabase
    .from('revenue_forecasts')
    .select('*, investor_portfolio(city, state, address)')
    .eq('investor_id', params.investor_id)
    .not('actual_revenue', 'is', null)
    .lt('variance_pct', -10) // More than 10% below forecast
    .order('variance_pct', { ascending: true })
    .limit(10);

  // Get upcoming forecasts with low confidence
  const today = new Date().toISOString().split('T')[0];
  const { data: lowConfidence } = await supabase
    .from('revenue_forecasts')
    .select('*, investor_portfolio(city, state, address)')
    .eq('investor_id', params.investor_id)
    .gte('forecast_date', today)
    .lt('confidence_score', 60)
    .order('forecast_date', { ascending: true })
    .limit(5);

  const alerts: any[] = [];

  for (const forecast of (underperforming || [])) {
    alerts.push({
      type: 'underperforming',
      severity: forecast.variance_pct < -20 ? 'high' : 'medium',
      property: forecast.investor_portfolio,
      message: `${forecast.investor_portfolio?.city || 'Property'} is ${Math.abs(forecast.variance_pct).toFixed(1)}% below forecast`,
      forecast_date: forecast.forecast_date,
      predicted: forecast.predicted_revenue,
      actual: forecast.actual_revenue,
      variance_pct: forecast.variance_pct
    });
  }

  for (const forecast of (lowConfidence || [])) {
    alerts.push({
      type: 'low_confidence',
      severity: 'low',
      property: forecast.investor_portfolio,
      message: `Low confidence forecast for ${forecast.investor_portfolio?.city || 'property'} in ${new Date(forecast.forecast_date).toLocaleDateString('en-US', { month: 'long' })}`,
      forecast_date: forecast.forecast_date,
      confidence_score: forecast.confidence_score
    });
  }

  return new Response(JSON.stringify({ alerts }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getForecastChartData(params: { investor_id: string; property_id?: string; months?: number }) {
  const months = params.months || 12;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 6);
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + months);

  let query = supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('investor_id', params.investor_id)
    .gte('forecast_date', startDate.toISOString().split('T')[0])
    .lte('forecast_date', endDate.toISOString().split('T')[0])
    .order('forecast_date', { ascending: true });

  if (params.property_id) {
    query = query.eq('property_id', params.property_id);
  }

  const { data: forecasts } = await query;

  // Aggregate by month
  const chartData: Record<string, any> = {};

  for (const forecast of (forecasts || [])) {
    const monthKey = forecast.forecast_date.substring(0, 7); // YYYY-MM
    
    if (!chartData[monthKey]) {
      chartData[monthKey] = {
        month: monthKey,
        predicted_revenue: 0,
        actual_revenue: 0,
        predicted_occupancy: 0,
        actual_occupancy: 0,
        count: 0
      };
    }

    chartData[monthKey].predicted_revenue += forecast.predicted_revenue || 0;
    chartData[monthKey].actual_revenue += forecast.actual_revenue || 0;
    chartData[monthKey].predicted_occupancy += forecast.predicted_occupancy || 0;
    chartData[monthKey].actual_occupancy += forecast.actual_occupancy || 0;
    chartData[monthKey].count++;
  }

  // Calculate averages for occupancy
  const data = Object.values(chartData).map((d: any) => ({
    ...d,
    predicted_occupancy: d.count > 0 ? d.predicted_occupancy / d.count : 0,
    actual_occupancy: d.count > 0 ? d.actual_occupancy / d.count : null
  }));

  return new Response(JSON.stringify({ chart_data: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

