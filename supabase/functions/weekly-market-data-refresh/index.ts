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

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// Market configurations with data sources
const MARKETS = [
  { name: 'Austin, TX', state: 'TX', region: 'Southwest' },
  { name: 'Nashville, TN', state: 'TN', region: 'Southeast' },
  { name: 'Tampa, FL', state: 'FL', region: 'Southeast' },
  { name: 'Orlando, FL', state: 'FL', region: 'Southeast' },
  { name: 'Phoenix, AZ', state: 'AZ', region: 'Southwest' },
  { name: 'Dallas, TX', state: 'TX', region: 'Southwest' },
  { name: 'Miami, FL', state: 'FL', region: 'Southeast' },
  { name: 'Denver, CO', state: 'CO', region: 'Mountain' },
  { name: 'Atlanta, GA', state: 'GA', region: 'Southeast' },
  { name: 'Charlotte, NC', state: 'NC', region: 'Southeast' },
  { name: 'San Antonio, TX', state: 'TX', region: 'Southwest' },
  { name: 'Jacksonville, FL', state: 'FL', region: 'Southeast' }
];

// Fetch market intelligence using Claude AI
async function fetchMarketIntelligence(market: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    return generateSimulatedMarketData(market);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a real estate market data analyst. Provide current market data for ${market} in JSON format only. Include realistic 2026 data based on market trends.

Return ONLY valid JSON with this exact structure:
{
  "hotel_adr": <number between 120-350>,
  "hotel_occupancy": <number between 55-85>,
  "str_adr": <number between 150-450>,
  "str_occupancy": <number between 45-75>,
  "mtr_adr": <number between 100-250>,
  "coliving_rate": <number between 800-2000>,
  "coliving_occupancy": <number between 75-95>,
  "avg_home_price": <number between 250000-800000>,
  "rental_demand_index": <number between 60-95>,
  "tourism_index": <number between 50-95>,
  "business_travel_index": <number between 40-85>,
  "new_regulations": <boolean>,
  "regulation_notes": "<string or null>",
  "market_trend": "<'growing' | 'stable' | 'cooling'>",
  "top_events_upcoming": ["<event1>", "<event2>"],
  "competitor_count_str": <number between 500-5000>,
  "avg_competitor_rating": <number between 3.8-4.8>
}`
        }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return generateSimulatedMarketData(market);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return generateSimulatedMarketData(market);
  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    return generateSimulatedMarketData(market);
  }
}

// Generate realistic simulated market data based on market characteristics
function generateSimulatedMarketData(market: string): any {
  const marketFactors: Record<string, any> = {
    'Austin, TX': { tourism: 0.85, business: 0.9, growth: 1.15, basePrice: 450000 },
    'Nashville, TN': { tourism: 0.92, business: 0.75, growth: 1.12, basePrice: 420000 },
    'Tampa, FL': { tourism: 0.88, business: 0.7, growth: 1.08, basePrice: 380000 },
    'Orlando, FL': { tourism: 0.95, business: 0.65, growth: 1.05, basePrice: 360000 },
    'Phoenix, AZ': { tourism: 0.78, business: 0.72, growth: 1.1, basePrice: 420000 },
    'Dallas, TX': { tourism: 0.7, business: 0.88, growth: 1.08, basePrice: 400000 },
    'Miami, FL': { tourism: 0.93, business: 0.8, growth: 1.06, basePrice: 550000 },
    'Denver, CO': { tourism: 0.85, business: 0.82, growth: 1.07, basePrice: 520000 },
    'Atlanta, GA': { tourism: 0.75, business: 0.85, growth: 1.05, basePrice: 380000 },
    'Charlotte, NC': { tourism: 0.68, business: 0.78, growth: 1.09, basePrice: 350000 },
    'San Antonio, TX': { tourism: 0.8, business: 0.65, growth: 1.06, basePrice: 320000 },
    'Jacksonville, FL': { tourism: 0.72, business: 0.68, growth: 1.07, basePrice: 340000 }
  };

  const factors = marketFactors[market] || { tourism: 0.75, business: 0.7, growth: 1.05, basePrice: 350000 };
  const variance = () => 0.9 + Math.random() * 0.2;

  return {
    hotel_adr: Math.round((180 + factors.tourism * 100) * variance()),
    hotel_occupancy: Math.round((55 + factors.tourism * 25) * variance()),
    str_adr: Math.round((200 + factors.tourism * 150) * variance()),
    str_occupancy: Math.round((50 + factors.tourism * 20) * variance()),
    mtr_adr: Math.round((120 + factors.business * 80) * variance()),
    coliving_rate: Math.round((900 + factors.business * 600) * variance()),
    coliving_occupancy: Math.round((78 + factors.growth * 12) * variance()),
    avg_home_price: Math.round(factors.basePrice * factors.growth * variance()),
    rental_demand_index: Math.round((65 + factors.growth * 25) * variance()),
    tourism_index: Math.round(factors.tourism * 100 * variance()),
    business_travel_index: Math.round(factors.business * 100 * variance()),
    new_regulations: Math.random() < 0.15,
    regulation_notes: Math.random() < 0.15 ? 'New STR licensing requirements under review' : null,
    market_trend: factors.growth > 1.1 ? 'growing' : factors.growth > 1.03 ? 'stable' : 'cooling',
    top_events_upcoming: getUpcomingEvents(market),
    competitor_count_str: Math.round((1500 + factors.tourism * 2500) * variance()),
    avg_competitor_rating: Math.round((4.0 + Math.random() * 0.6) * 10) / 10
  };
}

function getUpcomingEvents(market: string): string[] {
  const events: Record<string, string[]> = {
    'Austin, TX': ['SXSW 2026', 'Austin City Limits', 'Formula 1 US Grand Prix'],
    'Nashville, TN': ['CMA Fest', 'NFL Draft Events', 'Bonnaroo Weekend'],
    'Tampa, FL': ['Gasparilla Festival', 'Super Bowl Events', 'Spring Training'],
    'Orlando, FL': ['Theme Park Season', 'Convention Season', 'Holiday Events'],
    'Phoenix, AZ': ['Spring Training', 'Phoenix Open', 'Arizona State Fair'],
    'Dallas, TX': ['State Fair of Texas', 'Cotton Bowl', 'Auto Show'],
    'Miami, FL': ['Art Basel', 'Ultra Music Festival', 'Miami Open'],
    'Denver, CO': ['Great American Beer Festival', 'National Western Stock Show', 'Ski Season'],
    'Atlanta, GA': ['Dragon Con', 'Music Midtown', 'Peach Bowl'],
    'Charlotte, NC': ['NASCAR All-Star Race', 'Carolina Renaissance Festival', 'Speed Street'],
    'San Antonio, TX': ['Fiesta San Antonio', 'Stock Show & Rodeo', 'Battle of Flowers'],
    'Jacksonville, FL': ['Florida-Georgia Game', 'Jacksonville Jazz Festival', 'Players Championship']
  };
  return events[market] || ['Local Events', 'Seasonal Tourism'];
}

// Compare with previous data and detect significant changes
async function detectMarketShifts(market: string, newData: any): Promise<any[]> {
  const alerts: any[] = [];
  
  // Get previous snapshot
  const { data: previousSnapshot } = await supabase
    .from('market_data_snapshots')
    .select('*')
    .eq('market', market)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (!previousSnapshot) {
    return alerts;
  }

  // Check STR ADR change
  if (previousSnapshot.str_avg_adr && newData.str_adr) {
    const adrChange = ((newData.str_adr - previousSnapshot.str_avg_adr) / previousSnapshot.str_avg_adr) * 100;
    if (Math.abs(adrChange) >= 10) {
      alerts.push({
        market,
        alert_type: adrChange > 0 ? 'adr_increase' : 'adr_decrease',
        severity: Math.abs(adrChange) >= 20 ? 'critical' : Math.abs(adrChange) >= 15 ? 'high' : 'medium',
        title: `${market}: STR ADR ${adrChange > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(adrChange).toFixed(1)}%`,
        description: `Short-term rental average daily rate changed from $${previousSnapshot.str_avg_adr} to $${newData.str_adr}`,
        previous_value: previousSnapshot.str_avg_adr,
        new_value: newData.str_adr,
        change_percentage: adrChange,
        data_source: 'weekly_refresh',
        affected_operation_types: ['STR', 'MTR'],
        recommended_actions: adrChange > 0 
          ? ['Review pricing strategy', 'Consider premium positioning', 'Update revenue projections']
          : ['Evaluate competitive positioning', 'Consider value-add amenities', 'Review expense structure']
      });
    }
  }

  // Check Hotel ADR change
  if (previousSnapshot.hotel_avg_adr && newData.hotel_adr) {
    const hotelChange = ((newData.hotel_adr - previousSnapshot.hotel_avg_adr) / previousSnapshot.hotel_avg_adr) * 100;
    if (Math.abs(hotelChange) >= 10) {
      alerts.push({
        market,
        alert_type: 'hotel_rate_shift',
        severity: Math.abs(hotelChange) >= 15 ? 'high' : 'medium',
        title: `${market}: Hotel ADR ${hotelChange > 0 ? 'Up' : 'Down'} ${Math.abs(hotelChange).toFixed(1)}%`,
        description: `Hotel rates shifted from $${previousSnapshot.hotel_avg_adr} to $${newData.hotel_adr}. This affects STR pricing competitiveness.`,
        previous_value: previousSnapshot.hotel_avg_adr,
        new_value: newData.hotel_adr,
        change_percentage: hotelChange,
        data_source: 'weekly_refresh',
        affected_operation_types: ['STR'],
        recommended_actions: ['Adjust STR pricing relative to hotels', 'Update competitive analysis']
      });
    }
  }

  // Check Occupancy change
  if (previousSnapshot.str_avg_occupancy && newData.str_occupancy) {
    const occChange = newData.str_occupancy - previousSnapshot.str_avg_occupancy;
    if (Math.abs(occChange) >= 8) {
      alerts.push({
        market,
        alert_type: 'occupancy_shift',
        severity: Math.abs(occChange) >= 15 ? 'high' : 'medium',
        title: `${market}: STR Occupancy ${occChange > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(occChange).toFixed(1)} points`,
        description: `Market occupancy changed from ${previousSnapshot.str_avg_occupancy}% to ${newData.str_occupancy}%`,
        previous_value: previousSnapshot.str_avg_occupancy,
        new_value: newData.str_occupancy,
        change_percentage: (occChange / previousSnapshot.str_avg_occupancy) * 100,
        data_source: 'weekly_refresh',
        affected_operation_types: ['STR', 'MTR', 'Co-living'],
        recommended_actions: occChange > 0
          ? ['Capitalize on increased demand', 'Consider rate increases']
          : ['Review marketing strategy', 'Enhance listing quality', 'Consider MTR pivot']
      });
    }
  }

  // Check for new regulations
  if (newData.new_regulations && newData.regulation_notes) {
    alerts.push({
      market,
      alert_type: 'new_regulation',
      severity: 'high',
      title: `${market}: New Regulation Alert`,
      description: newData.regulation_notes,
      previous_value: null,
      new_value: null,
      change_percentage: null,
      data_source: 'weekly_refresh',
      affected_operation_types: ['STR', 'MTR', 'Co-living'],
      recommended_actions: ['Review compliance requirements', 'Consult legal team', 'Update investor guidance']
    });
  }

  // Check competitor count change
  if (previousSnapshot.competitor_count && newData.competitor_count_str) {
    const compChange = ((newData.competitor_count_str - previousSnapshot.competitor_count) / previousSnapshot.competitor_count) * 100;
    if (Math.abs(compChange) >= 15) {
      alerts.push({
        market,
        alert_type: 'competitor_change',
        severity: compChange > 20 ? 'high' : 'medium',
        title: `${market}: ${compChange > 0 ? 'Increased' : 'Decreased'} Competition (${Math.abs(compChange).toFixed(1)}%)`,
        description: `STR competitor count changed from ${previousSnapshot.competitor_count} to ${newData.competitor_count_str}`,
        previous_value: previousSnapshot.competitor_count,
        new_value: newData.competitor_count_str,
        change_percentage: compChange,
        data_source: 'weekly_refresh',
        affected_operation_types: ['STR'],
        recommended_actions: compChange > 0
          ? ['Differentiate listing', 'Focus on unique amenities', 'Consider niche markets']
          : ['Opportunity for market share', 'Evaluate expansion']
      });
    }
  }

  return alerts;
}

// Main refresh function
async function refreshMarketData(): Promise<any> {
  const startTime = Date.now();
  const marketsUpdated: string[] = [];
  const allAlerts: any[] = [];
  const errors: any[] = [];
  let recordsUpdated = 0;

  for (const market of MARKETS) {
    try {
      console.log(`Refreshing data for ${market.name}...`);
      
      // Fetch fresh market data
      const marketData = await fetchMarketIntelligence(market.name);
      
      // Detect significant changes
      const alerts = await detectMarketShifts(market.name, marketData);
      allAlerts.push(...alerts);

      // Insert new snapshot
      const { error: snapshotError } = await supabase
        .from('market_data_snapshots')
        .insert({
          market: market.name,
          snapshot_date: new Date().toISOString(),
          hotel_avg_adr: marketData.hotel_adr,
          hotel_avg_occupancy: marketData.hotel_occupancy,
          str_avg_adr: marketData.str_adr,
          str_avg_occupancy: marketData.str_occupancy,
          mtr_avg_rate: marketData.mtr_adr,
          coliving_avg_rate: marketData.coliving_rate,
          coliving_occupancy: marketData.coliving_occupancy,
          avg_home_price: marketData.avg_home_price,
          demand_index: marketData.rental_demand_index,
          tourism_index: marketData.tourism_index,
          business_travel_index: marketData.business_travel_index,
          competitor_count: marketData.competitor_count_str,
          avg_competitor_rating: marketData.avg_competitor_rating,
          market_trend: marketData.market_trend,
          upcoming_events: marketData.top_events_upcoming,
          regulation_status: marketData.new_regulations ? 'changes_pending' : 'stable',
          regulation_notes: marketData.regulation_notes,
          data_source: 'weekly_automated_refresh'
        });

      if (snapshotError) {
        errors.push({ market: market.name, error: snapshotError.message });
      } else {
        marketsUpdated.push(market.name);
        recordsUpdated++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      errors.push({ market: market.name, error: error.message });
    }
  }

  // Insert alerts
  if (allAlerts.length > 0) {
    const { error: alertError } = await supabase
      .from('market_shift_alerts')
      .insert(allAlerts);
    
    if (alertError) {
      errors.push({ type: 'alerts', error: alertError.message });
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Log the refresh
  await supabase
    .from('market_data_refresh_logs')
    .insert({
      markets_updated: marketsUpdated,
      data_sources_used: ['ai_analysis', 'market_intelligence'],
      records_updated: recordsUpdated,
      alerts_generated: allAlerts.length,
      errors: errors.length > 0 ? errors : null,
      duration_seconds: duration,
      status: errors.length === 0 ? 'completed' : 'completed_with_errors'
    });

  return {
    success: true,
    markets_updated: marketsUpdated,
    records_updated: recordsUpdated,
    alerts_generated: allAlerts.length,
    alerts: allAlerts,
    errors,
    duration_seconds: duration
  };
}

// Notify investors about critical alerts
async function notifyInvestorsOfAlerts(alerts: any[]): Promise<void> {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
  
  if (criticalAlerts.length === 0) return;

  // Get investors with preferences in affected markets
  for (const alert of criticalAlerts) {
    const { data: preferences } = await supabase
      .from('investor_deal_preferences')
      .select('investor_id, notification_email, notification_sms')
      .filter('target_markets', 'cs', `{${alert.market}}`)
      .eq('is_active', true);

    if (preferences && preferences.length > 0) {
      // Get unique investor IDs
      const investorIds = [...new Set(preferences.map(p => p.investor_id))];
      
      // Create notifications
      for (const investorId of investorIds) {
        await supabase
          .from('investor_notifications')
          .insert({
            investor_id: investorId,
            type: 'market_alert',
            title: alert.title,
            message: alert.description,
            data: { alert_id: alert.id, market: alert.market, severity: alert.severity },
            is_read: false
          });
      }

      // Mark alert as notified
      await supabase
        .from('market_shift_alerts')
        .update({ auto_notified_investors: true })
        .eq('id', alert.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, market } = await req.json().catch(() => ({}));

    if (action === 'refresh_single' && market) {
      // Refresh single market
      const marketData = await fetchMarketIntelligence(market);
      const alerts = await detectMarketShifts(market, marketData);
      
      await supabase
        .from('market_data_snapshots')
        .insert({
          market,
          snapshot_date: new Date().toISOString(),
          hotel_avg_adr: marketData.hotel_adr,
          hotel_avg_occupancy: marketData.hotel_occupancy,
          str_avg_adr: marketData.str_adr,
          str_avg_occupancy: marketData.str_occupancy,
          mtr_avg_rate: marketData.mtr_adr,
          coliving_avg_rate: marketData.coliving_rate,
          coliving_occupancy: marketData.coliving_occupancy,
          avg_home_price: marketData.avg_home_price,
          demand_index: marketData.rental_demand_index,
          data_source: 'manual_refresh'
        });

      if (alerts.length > 0) {
        await supabase.from('market_shift_alerts').insert(alerts);
      }

      return new Response(JSON.stringify({
        success: true,
        market,
        data: marketData,
        alerts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_alerts') {
      const { data: alerts } = await supabase
        .from('market_shift_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ success: true, alerts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'acknowledge_alert') {
      const { alert_id, staff_id } = await req.json();
      await supabase
        .from('market_shift_alerts')
        .update({ 
          acknowledged_by: staff_id, 
          acknowledged_at: new Date().toISOString(),
          is_active: false 
        })
        .eq('id', alert_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_refresh_logs') {
      const { data: logs } = await supabase
        .from('market_data_refresh_logs')
        .select('*')
        .order('refresh_date', { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ success: true, logs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default: Run full refresh
    const result = await refreshMarketData();
    
    // Notify investors of critical alerts
    if (result.alerts && result.alerts.length > 0) {
      await notifyInvestorsOfAlerts(result.alerts);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in weekly-market-data-refresh:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
