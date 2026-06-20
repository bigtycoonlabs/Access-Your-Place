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

// Optimized database helper - single function for all operations
async function db(method: string, table: string, params?: string, body?: any): Promise<any> {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return method === 'GET' ? [] : null;
  
  const opts: RequestInit = {
    method,
    headers: { 
      'Content-Type': 'application/json', 
      'apikey': key, 
      'Authorization': `Bearer ${key}`,
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${url}/rest/v1/${table}${params ? '?' + params : ''}`, opts);
    if (!res.ok) return method === 'GET' ? [] : null;
    const data = await res.json();
    return Array.isArray(data) ? data : [data];
  } catch { return method === 'GET' ? [] : null; }
}

// All 23 markets with comprehensive data - kept in memory for speed
const MARKETS: Record<string, {
  name: string;
  strAdr: number;
  strOcc: number;
  colivingRate: number;
  colivingOcc: number;
  regRisk: 'low' | 'medium' | 'high';
  trend: 'declining' | 'stable' | 'growing' | 'booming';
  competition: 'low' | 'medium' | 'high';
  peakMonths: number[];
  slowMonths: number[];
  setupCost: number;
}> = {
  austin: { name: 'Austin, TX', strAdr: 235, strOcc: 62, colivingRate: 950, colivingOcc: 92, regRisk: 'medium', trend: 'growing', competition: 'high', peakMonths: [3, 10], slowMonths: [1, 8], setupCost: 20000 },
  nashville: { name: 'Nashville, TN', strAdr: 220, strOcc: 58, colivingRate: 900, colivingOcc: 88, regRisk: 'high', trend: 'stable', competition: 'high', peakMonths: [4, 5, 6, 9, 10], slowMonths: [1, 2], setupCost: 23000 },
  tampa: { name: 'Tampa, FL', strAdr: 160, strOcc: 68, colivingRate: 850, colivingOcc: 90, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [1, 2, 3], slowMonths: [8, 9], setupCost: 16000 },
  orlando: { name: 'Orlando, FL', strAdr: 240, strOcc: 78, colivingRate: 800, colivingOcc: 85, regRisk: 'low', trend: 'booming', competition: 'high', peakMonths: [3, 6, 7, 12], slowMonths: [9], setupCost: 27000 },
  phoenix: { name: 'Phoenix, AZ', strAdr: 190, strOcc: 60, colivingRate: 800, colivingOcc: 88, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [2, 3], slowMonths: [6, 7, 8], setupCost: 18000 },
  denver: { name: 'Denver, CO', strAdr: 220, strOcc: 64, colivingRate: 1000, colivingOcc: 90, regRisk: 'high', trend: 'stable', competition: 'medium', peakMonths: [1, 2, 6, 7, 12], slowMonths: [4, 11], setupCost: 21000 },
  miami: { name: 'Miami, FL', strAdr: 290, strOcc: 62, colivingRate: 1100, colivingOcc: 88, regRisk: 'high', trend: 'growing', competition: 'high', peakMonths: [12, 1, 2, 3], slowMonths: [8, 9], setupCost: 32000 },
  dallas: { name: 'Dallas, TX', strAdr: 170, strOcc: 60, colivingRate: 900, colivingOcc: 92, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [9, 10], slowMonths: [7, 8], setupCost: 19000 },
  atlanta: { name: 'Atlanta, GA', strAdr: 165, strOcc: 55, colivingRate: 850, colivingOcc: 90, regRisk: 'medium', trend: 'stable', competition: 'medium', peakMonths: [3, 4, 9, 10], slowMonths: [7, 8, 12], setupCost: 17000 },
  jacksonville: { name: 'Jacksonville, FL', strAdr: 145, strOcc: 64, colivingRate: 750, colivingOcc: 88, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3, 4, 5, 6, 7], slowMonths: [11, 12, 1], setupCost: 14500 },
  charlotte: { name: 'Charlotte, NC', strAdr: 162, strOcc: 58, colivingRate: 875, colivingOcc: 90, regRisk: 'medium', trend: 'growing', competition: 'medium', peakMonths: [3, 4, 5, 9, 10], slowMonths: [7, 8, 12], setupCost: 18000 },
  sanantonio: { name: 'San Antonio, TX', strAdr: 145, strOcc: 60, colivingRate: 750, colivingOcc: 88, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3, 4, 10], slowMonths: [8, 1], setupCost: 16000 },
  raleighdurham: { name: 'Raleigh-Durham, NC', strAdr: 155, strOcc: 62, colivingRate: 900, colivingOcc: 91, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3, 4, 5, 10], slowMonths: [1, 2, 12], setupCost: 17000 },
  houston: { name: 'Houston, TX', strAdr: 150, strOcc: 58, colivingRate: 850, colivingOcc: 90, regRisk: 'low', trend: 'stable', competition: 'medium', peakMonths: [2, 3, 10], slowMonths: [7, 8], setupCost: 18000 },
  scottsdale: { name: 'Scottsdale, AZ', strAdr: 280, strOcc: 65, colivingRate: 950, colivingOcc: 85, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [1, 2, 3, 11], slowMonths: [6, 7, 8], setupCost: 25000 },
  panamacitybeach: { name: 'Panama City Beach, FL', strAdr: 220, strOcc: 72, colivingRate: 700, colivingOcc: 82, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [3, 4, 6, 7], slowMonths: [11, 12, 1], setupCost: 15000 },
  staugustine: { name: 'St Augustine, FL', strAdr: 185, strOcc: 68, colivingRate: 800, colivingOcc: 85, regRisk: 'low', trend: 'stable', competition: 'low', peakMonths: [3, 4, 10, 11], slowMonths: [8, 9], setupCost: 16000 },
  myrtlebeach: { name: 'Myrtle Beach, SC', strAdr: 175, strOcc: 70, colivingRate: 700, colivingOcc: 80, regRisk: 'low', trend: 'stable', competition: 'medium', peakMonths: [5, 6, 7, 8], slowMonths: [11, 12, 1, 2], setupCost: 14000 },
  fayetteville: { name: 'Fayetteville, NC', strAdr: 120, strOcc: 55, colivingRate: 650, colivingOcc: 88, regRisk: 'low', trend: 'stable', competition: 'low', peakMonths: [4, 5, 9], slowMonths: [12, 1, 2], setupCost: 12000 },
  birmingham: { name: 'Birmingham, AL', strAdr: 130, strOcc: 52, colivingRate: 700, colivingOcc: 86, regRisk: 'low', trend: 'stable', competition: 'low', peakMonths: [4, 5, 10], slowMonths: [1, 2, 7], setupCost: 13000 },
  westpalmbeach: { name: 'West Palm Beach, FL', strAdr: 250, strOcc: 65, colivingRate: 1000, colivingOcc: 87, regRisk: 'medium', trend: 'growing', competition: 'medium', peakMonths: [12, 1, 2, 3], slowMonths: [8, 9], setupCost: 28000 },
  albuquerque: { name: 'Albuquerque, NM', strAdr: 135, strOcc: 58, colivingRate: 700, colivingOcc: 85, regRisk: 'low', trend: 'stable', competition: 'low', peakMonths: [4, 5, 9, 10], slowMonths: [1, 2, 7], setupCost: 14000 },
  santafe: { name: 'Santa Fe, NM', strAdr: 195, strOcc: 62, colivingRate: 850, colivingOcc: 82, regRisk: 'low', trend: 'stable', competition: 'low', peakMonths: [6, 7, 8, 9, 12], slowMonths: [1, 2, 3], setupCost: 18000 }
};

// Normalize city name to market key
function getMarketKey(city: string): string | null {
  if (!city) return null;
  const normalized = city.toLowerCase().replace(/[^a-z]/g, '');
  
  // Direct match
  if (MARKETS[normalized]) return normalized;
  
  // Partial matches
  const aliases: Record<string, string> = {
    'raleigh': 'raleighdurham', 'durham': 'raleighdurham',
    'panamacity': 'panamacitybeach', 'pcb': 'panamacitybeach',
    'staugustine': 'staugustine', 'saintaugustine': 'staugustine',
    'myrtle': 'myrtlebeach',
    'westpalm': 'westpalmbeach', 'wpb': 'westpalmbeach',
    'santafe': 'santafe'
  };
  
  for (const [alias, key] of Object.entries(aliases)) {
    if (normalized.includes(alias)) return key;
  }
  
  // Check if city contains any market name
  for (const key of Object.keys(MARKETS)) {
    if (normalized.includes(key) || key.includes(normalized)) return key;
  }
  
  return null;
}

// Fast scoring algorithm - no external API calls
function scoreProperty(property: any): {
  score: number;
  confidence: number;
  recommendation: string;
  components: Record<string, number>;
  projections: any;
  analysis: any;
} {
  const marketKey = getMarketKey(property.city);
  
  if (!marketKey) {
    return {
      score: 50,
      confidence: 30,
      recommendation: 'needs_review',
      components: { market: 50, regulation: 50, financial: 50, competition: 50, seasonality: 50, location: 50 },
      projections: { error: 'Market not supported' },
      analysis: { summary: `Market "${property.city}" is not in our supported markets. Manual review required.` }
    };
  }
  
  const m = MARKETS[marketKey];
  const month = new Date().getMonth() + 1;
  const rent = property.monthly_rent || property.estimated_rent || 2000;
  const beds = property.bedrooms || 3;
  const baths = property.bathrooms || 2;
  
  // Calculate revenues
  const strMonthly = Math.round(m.strAdr * 30 * (m.strOcc / 100));
  const colivingMonthly = Math.round(m.colivingRate * beds * (m.colivingOcc / 100));
  const bestRevenue = Math.max(strMonthly, colivingMonthly);
  const profitMargin = ((bestRevenue - rent) / rent) * 100;
  
  // Component scores (0-100)
  const marketScore = m.trend === 'booming' ? 90 : m.trend === 'growing' ? 75 : m.trend === 'stable' ? 60 : 40;
  const regScore = m.regRisk === 'low' ? 90 : m.regRisk === 'medium' ? 65 : 35;
  const finScore = profitMargin >= 100 ? 95 : profitMargin >= 75 ? 85 : profitMargin >= 50 ? 75 : profitMargin >= 30 ? 60 : profitMargin >= 15 ? 45 : 30;
  const compScore = m.competition === 'low' ? 85 : m.competition === 'medium' ? 65 : 45;
  const seasonScore = m.peakMonths.includes(month) ? 85 : m.slowMonths.includes(month) ? 40 : 60;
  let locScore = 70;
  if (beds >= 4) locScore += 10;
  if (baths >= 2) locScore += 5;
  if (property.is_furnished) locScore += 10;
  locScore = Math.min(locScore, 95);
  
  const components = { market: marketScore, regulation: regScore, financial: finScore, competition: compScore, seasonality: seasonScore, location: locScore };
  
  // Weighted score
  const score = Math.round(
    marketScore * 0.20 + regScore * 0.15 + finScore * 0.30 + 
    compScore * 0.10 + seasonScore * 0.10 + locScore * 0.15
  );
  
  // Confidence
  let confidence = 70;
  if (m.trend === 'booming' || m.trend === 'growing') confidence += 10;
  if (m.regRisk === 'low') confidence += 10;
  confidence = Math.min(confidence, 95);
  
  // Recommendation
  let recommendation = 'hold';
  if (score >= 80 && regScore >= 60) recommendation = 'strong_buy';
  else if (score >= 65 && regScore >= 50) recommendation = 'buy';
  else if (score >= 50) recommendation = 'hold';
  else if (regScore < 40) recommendation = 'needs_review';
  else recommendation = 'avoid';
  
  const bestStrategy = colivingMonthly > strMonthly ? 'coliving' : 'str';
  const monthlyProfit = bestRevenue - rent;
  
  const projections = {
    str: { estimatedAdr: m.strAdr, estimatedOccupancy: m.strOcc, monthlyRevenue: strMonthly, monthlyProfit: strMonthly - rent, annualProfit: (strMonthly - rent) * 12 },
    coliving: { roomsAvailable: beds, avgRoomRate: m.colivingRate, estimatedOccupancy: m.colivingOcc, monthlyRevenue: colivingMonthly, monthlyProfit: colivingMonthly - rent, annualProfit: (colivingMonthly - rent) * 12 },
    mtr: { estimatedMonthlyRate: Math.round(rent * 1.5), estimatedOccupancy: 85, monthlyRevenue: Math.round(rent * 1.5 * 0.85) },
    bestStrategy,
    setupCostEstimate: m.setupCost,
    breakEvenMonths: monthlyProfit > 0 ? Math.ceil(m.setupCost / monthlyProfit) : 999
  };
  
  const strategyName = bestStrategy === 'coliving' ? 'co-living' : 'short-term rental';
  let summary = '';
  if (recommendation === 'strong_buy') {
    summary = `Excellent opportunity in ${m.name}! Score: ${score}/100. Best as ${strategyName} with ~$${monthlyProfit.toLocaleString()}/mo profit. Market is ${m.trend} with ${m.regRisk} regulatory risk.`;
  } else if (recommendation === 'buy') {
    summary = `Good investment in ${m.name}. Score: ${score}/100. Recommended: ${strategyName} with ~$${monthlyProfit.toLocaleString()}/mo profit potential.`;
  } else if (recommendation === 'hold') {
    summary = `Moderate opportunity in ${m.name} (${score}/100). ${strategyName} could work but margins are tighter. Thorough due diligence recommended.`;
  } else {
    summary = `Caution advised for ${m.name} (${score}/100). Regulatory or market conditions may limit profitability.`;
  }
  
  const analysis = {
    summary,
    market: { name: m.name, trend: m.trend, competition: m.competition, regRisk: m.regRisk },
    risks: regScore < 50 ? ['High regulatory risk'] : compScore < 50 ? ['High competition'] : ['Standard risks apply'],
    opportunities: [
      `${m.trend.charAt(0).toUpperCase() + m.trend.slice(1)} market`,
      `$${monthlyProfit.toLocaleString()}/mo profit potential`,
      bestStrategy === 'coliving' ? `Co-living outperforms STR by $${(colivingMonthly - strMonthly).toLocaleString()}/mo` : 'STR strategy optimal'
    ]
  };
  
  return { score, confidence, recommendation, components, projections, analysis };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { action, property_id, property_data, market } = body;

    // Score a property (main action)
    if (action === 'score_property' || action === 'score_deal') {
      let property = property_data;
      
      if (property_id && !property) {
        const props = await db('GET', 'properties', `id=eq.${property_id}&limit=1`);
        property = props[0];
      }
      
      if (!property) {
        return new Response(JSON.stringify({ success: false, error: 'Property data required' }), 
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const result = scoreProperty(property);
      
      // Save score to database (non-blocking)
      const propId = property_id || property.id;
      if (propId) {
        db('POST', 'penny_deal_scores', '', {
          property_id: propId,
          penny_score: result.score,
          confidence_level: result.confidence,
          recommendation: result.recommendation,
          market_score: result.components.market,
          regulation_score: result.components.regulation,
          financial_score: result.components.financial,
          competition_score: result.components.competition,
          seasonality_score: result.components.seasonality,
          location_score: result.components.location,
          str_analysis: result.projections.str,
          coliving_analysis: result.projections.coliving,
          mtr_analysis: result.projections.mtr,
          best_strategy: result.projections.bestStrategy,
          scored_at: new Date().toISOString()
        });
        
        // Update property with score
        db('PATCH', 'properties', `id=eq.${propId}`, {
          penny_score: result.score,
          penny_recommendation: result.recommendation,
          penny_scored_at: new Date().toISOString()
        });
      }

      return new Response(JSON.stringify({
        success: true,
        score: result.score,
        confidence: result.confidence,
        recommendation: result.recommendation,
        componentScores: result.components,
        analysis: result.analysis,
        projections: result.projections,
        executionTimeMs: Date.now() - startTime
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Get cached score
    if (action === 'get_score') {
      const scores = await db('GET', 'penny_deal_scores', `property_id=eq.${property_id}&order=scored_at.desc&limit=1`);
      if (!scores.length) {
        return new Response(JSON.stringify({ success: false, error: 'No score found' }), 
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(JSON.stringify({ success: true, ...scores[0] }), 
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Get market data
    if (action === 'get_market_data') {
      const key = getMarketKey(market);
      if (!key) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Market not found',
          availableMarkets: Object.values(MARKETS).map(m => m.name)
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(JSON.stringify({ success: true, market: MARKETS[key] }), 
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Get all markets
    if (action === 'get_all_markets') {
      const markets = Object.entries(MARKETS).map(([key, m]) => ({
        id: key, name: m.name, trend: m.trend, regRisk: m.regRisk, 
        competition: m.competition, strAdr: m.strAdr, strOcc: m.strOcc
      }));
      return new Response(JSON.stringify({ success: true, markets }), 
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Batch score
    if (action === 'batch_score') {
      const { property_ids } = body;
      if (!property_ids?.length) {
        return new Response(JSON.stringify({ success: false, error: 'property_ids required' }), 
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      const props = await db('GET', 'properties', `id=in.(${property_ids.join(',')})`);
      const scores = props.map((p: any) => {
        const r = scoreProperty(p);
        return { property_id: p.id, title: p.listing_title || p.title, city: p.city, penny_score: r.score, recommendation: r.recommendation };
      }).sort((a: any, b: any) => b.penny_score - a.penny_score);
      
      return new Response(JSON.stringify({ success: true, count: scores.length, scores }), 
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action',
      validActions: ['score_property', 'score_deal', 'get_score', 'get_market_data', 'get_all_markets', 'batch_score']
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});

