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

// Database helper
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
      'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${url}/rest/v1/${table}${params ? '?' + params : ''}`, opts);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`DB ${method} ${table} failed:`, errText);
      return method === 'GET' ? [] : null;
    }
    const text = await res.text();
    if (!text) return method === 'GET' ? [] : null;
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  } catch (e) {
    console.error(`DB error:`, e);
    return method === 'GET' ? [] : null;
  }
}

// Invoke another edge function
async function invokeFunction(name: string, body: any): Promise<any> {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'apikey': key
      },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error(`[invokeFunction] ${name} failed:`, e);
    return null;
  }
}

// Market data for OTA insights
const MARKET_OTA_DATA: Record<string, {
  name: string;
  topOTAs: string[];
  hotelOccupancy: number;
  hotelADR: number;
  strADR: number;
  strOccupancy: number;
  colivingRate: number;
  colivingOccupancy: number;
  avgListingCount: number;
  trend: string;
  regRisk: string;
  peakSeason: string;
  slowSeason: string;
}> = {
  austin: { name: 'Austin, TX', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 68, hotelADR: 185, strADR: 235, strOccupancy: 62, colivingRate: 950, colivingOccupancy: 92, avgListingCount: 12500, trend: 'growing', regRisk: 'medium', peakSeason: 'Mar-Oct (SXSW, ACL, F1)', slowSeason: 'Jan-Feb' },
  nashville: { name: 'Nashville, TN', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Expedia'], hotelOccupancy: 72, hotelADR: 195, strADR: 220, strOccupancy: 58, colivingRate: 900, colivingOccupancy: 88, avgListingCount: 8200, trend: 'stable', regRisk: 'high', peakSeason: 'Apr-Jun, Sep-Oct', slowSeason: 'Jan-Feb' },
  tampa: { name: 'Tampa, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'TripAdvisor'], hotelOccupancy: 74, hotelADR: 165, strADR: 160, strOccupancy: 68, colivingRate: 850, colivingOccupancy: 90, avgListingCount: 6800, trend: 'growing', regRisk: 'low', peakSeason: 'Jan-Mar (snowbirds)', slowSeason: 'Aug-Sep' },
  orlando: { name: 'Orlando, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Expedia', 'Hotels.com'], hotelOccupancy: 78, hotelADR: 175, strADR: 240, strOccupancy: 78, colivingRate: 800, colivingOccupancy: 85, avgListingCount: 15000, trend: 'booming', regRisk: 'low', peakSeason: 'Mar, Jun-Jul, Dec', slowSeason: 'Sep' },
  phoenix: { name: 'Phoenix, AZ', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 66, hotelADR: 155, strADR: 190, strOccupancy: 60, colivingRate: 800, colivingOccupancy: 88, avgListingCount: 9500, trend: 'growing', regRisk: 'low', peakSeason: 'Feb-Mar (spring training)', slowSeason: 'Jun-Aug' },
  denver: { name: 'Denver, CO', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 70, hotelADR: 180, strADR: 220, strOccupancy: 64, colivingRate: 1000, colivingOccupancy: 90, avgListingCount: 7200, trend: 'stable', regRisk: 'high', peakSeason: 'Jan-Feb, Jun-Jul, Dec', slowSeason: 'Apr, Nov' },
  miami: { name: 'Miami, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Expedia', 'Hotels.com'], hotelOccupancy: 76, hotelADR: 245, strADR: 290, strOccupancy: 62, colivingRate: 1100, colivingOccupancy: 88, avgListingCount: 18000, trend: 'growing', regRisk: 'high', peakSeason: 'Dec-Mar', slowSeason: 'Aug-Sep' },
  dallas: { name: 'Dallas, TX', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 65, hotelADR: 145, strADR: 170, strOccupancy: 60, colivingRate: 900, colivingOccupancy: 92, avgListingCount: 8000, trend: 'growing', regRisk: 'low', peakSeason: 'Sep-Oct', slowSeason: 'Jul-Aug' },
  atlanta: { name: 'Atlanta, GA', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 64, hotelADR: 140, strADR: 165, strOccupancy: 55, colivingRate: 850, colivingOccupancy: 90, avgListingCount: 9000, trend: 'stable', regRisk: 'medium', peakSeason: 'Mar-Apr, Sep-Oct', slowSeason: 'Jul-Aug, Dec' },
  jacksonville: { name: 'Jacksonville, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 62, hotelADR: 130, strADR: 145, strOccupancy: 64, colivingRate: 750, colivingOccupancy: 88, avgListingCount: 3500, trend: 'growing', regRisk: 'low', peakSeason: 'Mar-Jul', slowSeason: 'Nov-Jan' },
  charlotte: { name: 'Charlotte, NC', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 66, hotelADR: 138, strADR: 162, strOccupancy: 58, colivingRate: 875, colivingOccupancy: 90, avgListingCount: 4800, trend: 'growing', regRisk: 'medium', peakSeason: 'Mar-May, Sep-Oct', slowSeason: 'Jul-Aug, Dec' },
  sanantonio: { name: 'San Antonio, TX', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 63, hotelADR: 125, strADR: 145, strOccupancy: 60, colivingRate: 750, colivingOccupancy: 88, avgListingCount: 5200, trend: 'growing', regRisk: 'low', peakSeason: 'Mar-Apr, Oct', slowSeason: 'Aug, Jan' },
  houston: { name: 'Houston, TX', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Furnished Finder'], hotelOccupancy: 62, hotelADR: 135, strADR: 150, strOccupancy: 58, colivingRate: 850, colivingOccupancy: 90, avgListingCount: 7500, trend: 'stable', regRisk: 'low', peakSeason: 'Feb-Mar, Oct', slowSeason: 'Jul-Aug' },
  westpalmbeach: { name: 'West Palm Beach, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Expedia'], hotelOccupancy: 72, hotelADR: 210, strADR: 250, strOccupancy: 65, colivingRate: 1000, colivingOccupancy: 87, avgListingCount: 4200, trend: 'growing', regRisk: 'medium', peakSeason: 'Dec-Mar', slowSeason: 'Aug-Sep' },
  scottsdale: { name: 'Scottsdale, AZ', topOTAs: ['Airbnb', 'VRBO', 'Booking.com', 'Expedia'], hotelOccupancy: 70, hotelADR: 225, strADR: 280, strOccupancy: 65, colivingRate: 950, colivingOccupancy: 85, avgListingCount: 3800, trend: 'growing', regRisk: 'low', peakSeason: 'Jan-Mar, Nov', slowSeason: 'Jun-Aug' },
  panamacitybeach: { name: 'Panama City Beach, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 68, hotelADR: 155, strADR: 220, strOccupancy: 72, colivingRate: 700, colivingOccupancy: 82, avgListingCount: 4500, trend: 'growing', regRisk: 'low', peakSeason: 'Mar-Apr, Jun-Jul', slowSeason: 'Nov-Jan' },
  staugustine: { name: 'St Augustine, FL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 65, hotelADR: 145, strADR: 185, strOccupancy: 68, colivingRate: 800, colivingOccupancy: 85, avgListingCount: 2200, trend: 'stable', regRisk: 'low', peakSeason: 'Mar-Apr, Oct-Nov', slowSeason: 'Aug-Sep' },
  albuquerque: { name: 'Albuquerque, NM', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 60, hotelADR: 115, strADR: 135, strOccupancy: 58, colivingRate: 700, colivingOccupancy: 85, avgListingCount: 2800, trend: 'stable', regRisk: 'low', peakSeason: 'Apr-May, Sep-Oct', slowSeason: 'Jan-Feb, Jul' },
  santafe: { name: 'Santa Fe, NM', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 62, hotelADR: 165, strADR: 195, strOccupancy: 62, colivingRate: 850, colivingOccupancy: 82, avgListingCount: 1800, trend: 'stable', regRisk: 'low', peakSeason: 'Jun-Sep, Dec', slowSeason: 'Jan-Mar' },
  fayetteville: { name: 'Fayetteville, NC', topOTAs: ['Airbnb', 'VRBO', 'Furnished Finder'], hotelOccupancy: 55, hotelADR: 95, strADR: 120, strOccupancy: 55, colivingRate: 650, colivingOccupancy: 88, avgListingCount: 1200, trend: 'stable', regRisk: 'low', peakSeason: 'Apr-May, Sep', slowSeason: 'Dec-Feb' },
  birmingham: { name: 'Birmingham, AL', topOTAs: ['Airbnb', 'VRBO', 'Booking.com'], hotelOccupancy: 56, hotelADR: 105, strADR: 130, strOccupancy: 52, colivingRate: 700, colivingOccupancy: 86, avgListingCount: 2000, trend: 'stable', regRisk: 'low', peakSeason: 'Apr-May, Oct', slowSeason: 'Jan-Feb, Jul' },
};

function getMarketKey(city: string): string | null {
  if (!city) return null;
  const normalized = city.toLowerCase().replace(/[^a-z]/g, '');
  if (MARKET_OTA_DATA[normalized]) return normalized;
  const aliases: Record<string, string> = {
    'raleigh': 'raleighdurham', 'durham': 'raleighdurham',
    'panamacity': 'panamacitybeach', 'pcb': 'panamacitybeach',
    'staugustine': 'staugustine', 'saintaugustine': 'staugustine',
    'myrtle': 'myrtlebeach', 'westpalm': 'westpalmbeach', 'wpb': 'westpalmbeach',
    'sanantonio': 'sanantonio', 'san antonio': 'sanantonio'
  };
  for (const [alias, key] of Object.entries(aliases)) {
    if (normalized.includes(alias)) return key;
  }
  for (const key of Object.keys(MARKET_OTA_DATA)) {
    if (normalized.includes(key) || key.includes(normalized)) return key;
  }
  return null;
}

// Generate AI-powered personalized insights
async function generateAIInsights(params: {
  investorName: string;
  propertyAddress: string;
  city: string;
  state: string;
  pennyScore: number;
  recommendation: string;
  portfolioSize: number;
  operationType: string;
  marketData: any;
  projections: any;
}): Promise<string> {
  const gatewayApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!gatewayApiKey) {
    console.warn('[penny-portfolio-analysis] No GATEWAY_API_KEY, using template insights');
    return generateTemplateInsights(params);
  }

  const prompt = `You are Penny, the AI investment analyst for Access Your Place, a real estate arbitrage platform. Write a personalized analysis email section for an investor who just added a property to their portfolio.

INVESTOR CONTEXT:
- Name: ${params.investorName}
- Portfolio Size: ${params.portfolioSize} properties (${params.portfolioSize <= 1 ? 'just starting out' : params.portfolioSize <= 3 ? 'building their portfolio' : params.portfolioSize <= 7 ? 'experienced investor' : 'seasoned portfolio operator'})
- Operation Type: ${params.operationType || 'short-term rental'}

PROPERTY DETAILS:
- Address: ${params.propertyAddress}
- Market: ${params.city}, ${params.state}
- Penny Score: ${params.pennyScore}/100
- Recommendation: ${params.recommendation}

MARKET DATA:
- Hotel Occupancy: ${params.marketData?.hotelOccupancy || 'N/A'}%
- Hotel ADR: $${params.marketData?.hotelADR || 'N/A'}
- STR ADR: $${params.marketData?.strADR || 'N/A'}
- STR Occupancy: ${params.marketData?.strOccupancy || 'N/A'}%
- Co-Living Room Rate: $${params.marketData?.colivingRate || 'N/A'}/mo
- Co-Living Occupancy: ${params.marketData?.colivingOccupancy || 'N/A'}%
- Top OTA Platforms: ${params.marketData?.topOTAs?.join(', ') || 'Airbnb, VRBO'}
- Market Trend: ${params.marketData?.trend || 'stable'}
- Regulatory Risk: ${params.marketData?.regRisk || 'low'}
- Peak Season: ${params.marketData?.peakSeason || 'varies'}
- Slow Season: ${params.marketData?.slowSeason || 'varies'}
- Active Listings in Market: ${params.marketData?.avgListingCount?.toLocaleString() || 'N/A'}

REVENUE PROJECTIONS:
- STR Monthly Revenue: $${params.projections?.str?.monthlyRevenue?.toLocaleString() || 'N/A'}
- STR Monthly Profit: $${params.projections?.str?.monthlyProfit?.toLocaleString() || 'N/A'}
- Co-Living Monthly Revenue: $${params.projections?.coliving?.monthlyRevenue?.toLocaleString() || 'N/A'}
- Co-Living Monthly Profit: $${params.projections?.coliving?.monthlyProfit?.toLocaleString() || 'N/A'}
- Best Strategy: ${params.projections?.bestStrategy || 'STR'}
- Break-Even Months: ${params.projections?.breakEvenMonths || 'N/A'}

Write the analysis in these sections (use HTML formatting with inline styles for email):
1. **Score Summary** - Brief explanation of the ${params.pennyScore}/100 score and what it means
2. **Market Pulse** - Current market conditions, hotel occupancy trends, and what they signal for STR/co-living
3. **OTA Platform Strategy** - Which platforms to prioritize and why, based on the market
4. **Revenue Outlook** - Projected earnings with the recommended strategy, monthly and annual
5. **Scaling Advice** - Personalized advice based on their portfolio size (${params.portfolioSize} properties) and operation type
6. **Action Items** - 3 specific next steps they should take

Keep the tone professional but warm. Use data-driven insights. Be specific with numbers. Keep each section concise (2-3 sentences max). Format as clean HTML with inline styles suitable for email.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + gatewayApiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('[penny-portfolio-analysis] AI Gateway error:', response.status);
      return generateTemplateInsights(params);
    }

    const data = await response.json();
    const aiContent = data?.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      return generateTemplateInsights(params);
    }

    return aiContent;
  } catch (e) {
    console.error('[penny-portfolio-analysis] AI generation failed:', e);
    return generateTemplateInsights(params);
  }
}

// Fallback template-based insights
function generateTemplateInsights(params: any): string {
  const m = params.marketData;
  const p = params.projections;
  const bestStrategy = p?.bestStrategy === 'coliving' ? 'co-living' : 'short-term rental';
  const bestRevenue = p?.bestStrategy === 'coliving' ? p?.coliving?.monthlyRevenue : p?.str?.monthlyRevenue;
  const bestProfit = p?.bestStrategy === 'coliving' ? p?.coliving?.monthlyProfit : p?.str?.monthlyProfit;
  
  const portfolioAdvice = params.portfolioSize <= 1 
    ? 'As you\'re just getting started, focus on optimizing this first property before scaling. Master your pricing strategy and guest experience.'
    : params.portfolioSize <= 3
    ? 'With a growing portfolio, consider standardizing your operations across properties. SOPs and automation tools will save you time.'
    : 'As a seasoned operator, look for economies of scale. Bulk purchasing, shared cleaning teams, and dynamic pricing across your portfolio can boost margins.';

  return `
    <div style="margin:20px 0;">
      <h3 style="color:#1a365d;margin:0 0 8px;font-size:16px;">Score Summary</h3>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.6;">
        Your property scored <strong>${params.pennyScore}/100</strong> â€” ${params.pennyScore >= 80 ? 'an excellent score indicating strong investment potential' : params.pennyScore >= 60 ? 'a solid score with good fundamentals' : 'a moderate score that warrants careful consideration'}. 
        The ${params.city} market is currently <strong>${m?.trend || 'stable'}</strong> with ${m?.regRisk || 'low'} regulatory risk.
      </p>
      
      <h3 style="color:#1a365d;margin:0 0 8px;font-size:16px;">Market Pulse</h3>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.6;">
        Hotel occupancy in ${params.city} sits at <strong>${m?.hotelOccupancy || 65}%</strong> with an ADR of <strong>$${m?.hotelADR || 150}</strong>, signaling ${(m?.hotelOccupancy || 65) > 70 ? 'strong demand' : 'moderate demand'} for short-term accommodations. 
        STR occupancy is at <strong>${m?.strOccupancy || 60}%</strong> with approximately <strong>${(m?.avgListingCount || 5000).toLocaleString()}</strong> active listings competing in the market.
        Peak season is <strong>${m?.peakSeason || 'varies by market'}</strong>.
      </p>
      
      <h3 style="color:#1a365d;margin:0 0 8px;font-size:16px;">OTA Platform Strategy</h3>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.6;">
        For ${params.city}, prioritize listing on <strong>${m?.topOTAs?.slice(0, 3).join(', ') || 'Airbnb, VRBO, Booking.com'}</strong>. 
        ${m?.topOTAs?.includes('Furnished Finder') ? 'Furnished Finder is also strong here for mid-term rental demand from traveling professionals.' : 'Consider adding Furnished Finder for mid-term rental diversification.'}
      </p>
      
      <h3 style="color:#1a365d;margin:0 0 8px;font-size:16px;">Revenue Outlook</h3>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.6;">
        Based on our analysis, the recommended <strong>${bestStrategy}</strong> strategy projects <strong>$${(bestRevenue || 0).toLocaleString()}/mo</strong> in revenue with an estimated profit of <strong>$${(bestProfit || 0).toLocaleString()}/mo</strong> ($${((bestProfit || 0) * 12).toLocaleString()}/year).
        ${p?.breakEvenMonths && p.breakEvenMonths < 999 ? `Expected break-even in <strong>${p.breakEvenMonths} months</strong>.` : ''}
      </p>
      
      <h3 style="color:#1a365d;margin:0 0 8px;font-size:16px;">Scaling Advice</h3>
      <p style="color:#475569;margin:0 0 16px;font-size:14px;line-height:1.6;">
        ${portfolioAdvice}
      </p>
    </div>
  `;
}

// Build the full email HTML
function buildAnalysisEmail(params: {
  investorName: string;
  propertyAddress: string;
  city: string;
  state: string;
  pennyScore: number;
  recommendation: string;
  marketData: any;
  projections: any;
  aiInsights: string;
  operationType: string;
}): string {
  const { investorName, propertyAddress, city, state, pennyScore, recommendation, marketData, projections, aiInsights, operationType } = params;
  const firstName = (investorName || 'Investor').split(' ')[0];
  const m = marketData;
  
  const scoreColor = pennyScore >= 80 ? '#10b981' : pennyScore >= 60 ? '#f59e0b' : pennyScore >= 40 ? '#f97316' : '#ef4444';
  const scoreLabel = pennyScore >= 80 ? 'Excellent' : pennyScore >= 60 ? 'Good' : pennyScore >= 40 ? 'Caution' : 'Needs Review';
  const recLabel = recommendation === 'strong_buy' ? 'Strong Buy' : recommendation === 'buy' ? 'Buy' : recommendation === 'hold' ? 'Hold' : recommendation === 'needs_review' ? 'Needs Review' : 'Avoid';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Penny AI Analysis</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Your Portfolio Property Report</p>
    </div>

    <div style="padding:32px 24px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 8px;">Hi ${firstName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
        I've completed my analysis of your newly added property. Here's everything you need to know to maximize your returns.
      </p>

      <!-- Property & Score Card -->
      <div style="background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:0 0 28px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <p style="font-weight:700;color:#1a365d;margin:0 0 4px;font-size:17px;">${propertyAddress}</p>
            <p style="color:#64748b;margin:0 0 12px;font-size:14px;">${city}, ${state}</p>
            <span style="background:#e0e7ff;color:#3730a3;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${(operationType || 'STR').toUpperCase()}</span>
          </div>
          <div style="text-align:center;">
            <div style="width:72px;height:72px;border-radius:50%;background:${scoreColor};display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:28px;font-weight:800;">${pennyScore}</span>
            </div>
            <p style="color:${scoreColor};font-size:12px;font-weight:700;margin:6px 0 0;">${scoreLabel}</p>
            <p style="color:#94a3b8;font-size:11px;margin:2px 0 0;">${recLabel}</p>
          </div>
        </div>
      </div>

      <!-- Market Snapshot -->
      <div style="margin:0 0 28px;">
        <h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;border-bottom:2px solid #d4a574;padding-bottom:8px;">Market Snapshot: ${city}, ${state}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px;background:#f0fdf4;border-radius:8px 0 0 0;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#16a34a;font-size:22px;font-weight:800;">${m?.hotelOccupancy || 'N/A'}%</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Hotel Occupancy</p>
            </td>
            <td style="padding:10px;background:#eff6ff;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#2563eb;font-size:22px;font-weight:800;">$${m?.hotelADR || 'N/A'}</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Hotel ADR</p>
            </td>
            <td style="padding:10px;background:#faf5ff;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#7c3aed;font-size:22px;font-weight:800;">$${m?.strADR || 'N/A'}</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">STR ADR</p>
            </td>
            <td style="padding:10px;background:#fefce8;border-radius:0 8px 0 0;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#ca8a04;font-size:22px;font-weight:800;">${m?.strOccupancy || 'N/A'}%</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">STR Occupancy</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:10px;background:#f8fafc;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#1a365d;font-size:16px;font-weight:700;">$${m?.colivingRate || 'N/A'}/mo</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Co-Living Room Rate (${m?.colivingOccupancy || 'N/A'}% occ.)</p>
            </td>
            <td colspan="2" style="padding:10px;background:#f8fafc;text-align:center;border:1px solid #e2e8f0;">
              <p style="margin:0;color:#1a365d;font-size:16px;font-weight:700;">${(m?.avgListingCount || 0).toLocaleString()}</p>
              <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Active STR Listings</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- OTA Platforms -->
      <div style="margin:0 0 28px;">
        <h2 style="color:#1a365d;font-size:18px;margin:0 0 12px;">Top OTA Platforms for ${city}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${(m?.topOTAs || ['Airbnb', 'VRBO', 'Booking.com']).map((ota: string) => 
            `<span style="background:#e0e7ff;color:#3730a3;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;">${ota}</span>`
          ).join('')}
        </div>
      </div>

      <!-- Revenue Projections -->
      <div style="margin:0 0 28px;">
        <h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;border-bottom:2px solid #d4a574;padding-bottom:8px;">Revenue Projections</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:8px;text-align:center;width:33%;vertical-align:top;">
              <p style="margin:0;color:#2563eb;font-size:11px;font-weight:600;text-transform:uppercase;">Short-Term Rental</p>
              <p style="margin:8px 0 4px;color:#1e40af;font-size:24px;font-weight:800;">$${(projections?.str?.monthlyRevenue || 0).toLocaleString()}</p>
              <p style="margin:0;color:#64748b;font-size:12px;">per month</p>
              <p style="margin:8px 0 0;color:${(projections?.str?.monthlyProfit || 0) >= 0 ? '#16a34a' : '#dc2626'};font-size:13px;font-weight:700;">
                ${(projections?.str?.monthlyProfit || 0) >= 0 ? '+' : ''}$${(projections?.str?.monthlyProfit || 0).toLocaleString()} profit
              </p>
            </td>
            <td style="width:8px;"></td>
            <td style="padding:16px;background:linear-gradient(135deg,#faf5ff,#ede9fe);border-radius:8px;text-align:center;width:33%;vertical-align:top;">
              <p style="margin:0;color:#7c3aed;font-size:11px;font-weight:600;text-transform:uppercase;">Co-Living</p>
              <p style="margin:8px 0 4px;color:#5b21b6;font-size:24px;font-weight:800;">$${(projections?.coliving?.monthlyRevenue || 0).toLocaleString()}</p>
              <p style="margin:0;color:#64748b;font-size:12px;">per month</p>
              <p style="margin:8px 0 0;color:${(projections?.coliving?.monthlyProfit || 0) >= 0 ? '#16a34a' : '#dc2626'};font-size:13px;font-weight:700;">
                ${(projections?.coliving?.monthlyProfit || 0) >= 0 ? '+' : ''}$${(projections?.coliving?.monthlyProfit || 0).toLocaleString()} profit
              </p>
            </td>
            <td style="width:8px;"></td>
            <td style="padding:16px;background:linear-gradient(135deg,#f0fdfa,#ccfbf1);border-radius:8px;text-align:center;width:33%;vertical-align:top;">
              <p style="margin:0;color:#0d9488;font-size:11px;font-weight:600;text-transform:uppercase;">Mid-Term Rental</p>
              <p style="margin:8px 0 4px;color:#0f766e;font-size:24px;font-weight:800;">$${(projections?.mtr?.estimatedMonthlyRate || 0).toLocaleString()}</p>
              <p style="margin:0;color:#64748b;font-size:12px;">per month</p>
              <p style="margin:8px 0 0;color:#64748b;font-size:13px;font-weight:600;">
                ${projections?.mtr?.estimatedOccupancy || 85}% est. occ.
              </p>
            </td>
          </tr>
        </table>
        ${projections?.breakEvenMonths && projections.breakEvenMonths < 999 ? `
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin-top:12px;text-align:center;">
            <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">Estimated Break-Even: ${projections.breakEvenMonths} months</p>
          </div>
        ` : ''}
      </div>

      <!-- AI Insights -->
      <div style="margin:0 0 28px;">
        <h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;border-bottom:2px solid #d4a574;padding-bottom:8px;">Penny's Personalized Insights</h2>
        ${aiInsights}
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://accessyourplace.com/investor-login" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;box-shadow:0 4px 12px rgba(212,165,116,0.3);">
          View Full Analysis in Portal
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:24px 0 0;text-align:center;">
        This analysis is generated by Penny AI using current market data and is for informational purposes only. 
        Always conduct your own due diligence before making investment decisions.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;">Access Your Place - Real Estate Arbitrage Platform</p>
      <p style="color:#94a3b8;font-size:11px;margin:0;">Powered by Penny AI | 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ========================================
    // ACTION: analyze_portfolio_property
    // Main action: score + analyze + email
    // ========================================
    if (action === 'analyze_portfolio_property') {
      const { investor_id, investor_name, investor_email, property_data, portfolio_size } = body;

      console.log(`[penny-portfolio-analysis] Analyzing property for ${investor_name} (${investor_email})`);
      console.log(`[penny-portfolio-analysis] Property: ${property_data?.address}, ${property_data?.city}, ${property_data?.state}`);

      if (!property_data?.city) {
        return new Response(JSON.stringify({ success: false, error: 'Property city is required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Step 1: Score the property using penny-deal-scoring
      let scoreResult: any = null;
      try {
        scoreResult = await invokeFunction('penny-deal-scoring', {
          action: 'score_property',
          property_data: {
            city: property_data.city,
            state: property_data.state,
            bedrooms: property_data.bedrooms || 3,
            bathrooms: property_data.bathrooms || 2,
            monthly_rent: property_data.monthly_rent || 2000,
            property_type: property_data.property_type || 'single_family',
            is_furnished: true,
            operation_type: property_data.operation_type || 'str'
          }
        });
        console.log(`[penny-portfolio-analysis] Penny Score: ${scoreResult?.score || 'N/A'}`);
      } catch (e) {
        console.error('[penny-portfolio-analysis] Scoring failed:', e);
      }

      const pennyScore = scoreResult?.score || 50;
      const recommendation = scoreResult?.recommendation || 'hold';
      const projections = scoreResult?.projections || {};

      // Step 2: Get market OTA data
      const marketKey = getMarketKey(property_data.city);
      const marketData = marketKey ? MARKET_OTA_DATA[marketKey] : null;

      // Step 3: Save penny score to portfolio property
      if (investor_id && property_data.id) {
        try {
          await db('PATCH', 'investor_portfolio', `id=eq.${property_data.id}&investor_id=eq.${investor_id}`, {
            penny_score: pennyScore,
            penny_recommendation: recommendation,
            penny_scored_at: new Date().toISOString()
          });
          console.log(`[penny-portfolio-analysis] Score saved to portfolio property ${property_data.id}`);
        } catch (e) {
          console.warn('[penny-portfolio-analysis] Failed to save score:', e);
        }
      }

      // Step 4: Generate AI-powered personalized insights
      const aiInsights = await generateAIInsights({
        investorName: investor_name || 'Investor',
        propertyAddress: property_data.address || 'Property',
        city: property_data.city,
        state: property_data.state,
        pennyScore,
        recommendation,
        portfolioSize: portfolio_size || 1,
        operationType: property_data.operation_type || 'str',
        marketData,
        projections
      });

      // Step 5: Build and send the email
      let emailSent = false;
      let resendId = null;

      if (investor_email && investor_email.includes('@')) {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        if (RESEND_API_KEY) {
          const emailHtml = buildAnalysisEmail({
            investorName: investor_name || 'Investor',
            propertyAddress: property_data.address || 'Your Property',
            city: property_data.city,
            state: property_data.state,
            pennyScore,
            recommendation,
            marketData: marketData || {},
            projections,
            aiInsights,
            operationType: property_data.operation_type || 'str'
          });

          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Penny AI <penny@accessyourplace.com>',
                to: [investor_email],
                subject: `Penny AI Analysis: ${property_data.city}, ${property_data.state} â€” Score ${pennyScore}/100`,
                html: emailHtml
              })
            });

            const emailResult = await emailRes.json();
            emailSent = emailRes.ok;
            resendId = emailResult?.id || null;
            console.log(`[penny-portfolio-analysis] Email ${emailSent ? 'sent' : 'failed'} to ${investor_email}`);
          } catch (e) {
            console.error('[penny-portfolio-analysis] Email send failed:', e);
          }

          // Log the email
          try {
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
            const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
            await fetch(`${SUPABASE_URL}/rest/v1/email_delivery_logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                email_type: 'penny_portfolio_analysis',
                recipient_email: investor_email,
                recipient_name: investor_name || 'Investor',
                recipient_type: 'investor',
                sender_name: 'Penny AI',
                sender_type: 'system',
                subject: `Penny AI Analysis: ${property_data.city}, ${property_data.state} â€” Score ${pennyScore}/100`,
                resend_id: resendId,
                status: emailSent ? 'sent' : 'failed',
                metadata: { penny_score: pennyScore, recommendation, market: property_data.city }
              })
            });
          } catch (e) {
            console.warn('[penny-portfolio-analysis] Email log failed:', e);
          }
        } else {
          console.warn('[penny-portfolio-analysis] No RESEND_API_KEY configured');
        }
      }

      // Step 6: Create in-app notification
      if (investor_id) {
        try {
          await db('POST', 'investor_notifications', '', {
            investor_id,
            type: 'penny_analysis',
            title: `Penny Score: ${pennyScore}/100 â€” ${property_data.city}, ${property_data.state}`,
            message: `Your property at ${property_data.address || property_data.city} has been analyzed. ${recommendation === 'strong_buy' ? 'Excellent opportunity!' : recommendation === 'buy' ? 'Solid investment.' : 'Review the analysis for details.'}`,
            read: false,
            data: { penny_score: pennyScore, recommendation, property_id: property_data.id },
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('[penny-portfolio-analysis] Notification insert failed:', e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        penny_score: pennyScore,
        recommendation,
        projections,
        market_data: marketData ? {
          name: marketData.name,
          hotelOccupancy: marketData.hotelOccupancy,
          hotelADR: marketData.hotelADR,
          strADR: marketData.strADR,
          strOccupancy: marketData.strOccupancy,
          colivingRate: marketData.colivingRate,
          trend: marketData.trend,
          topOTAs: marketData.topOTAs
        } : null,
        email_sent: emailSent,
        resend_id: resendId
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ========================================
    // ACTION: get_portfolio_scores
    // Fetch scores for all portfolio properties
    // ========================================
    if (action === 'get_portfolio_scores') {
      const { investor_id } = body;
      
      const properties = await db('GET', 'investor_portfolio', 
        `investor_id=eq.${investor_id}&select=id,penny_score,penny_recommendation,penny_scored_at`
      );

      const scores: Record<string, { score: number; recommendation: string; scored_at: string }> = {};
      for (const p of properties) {
        if (p.penny_score !== null && p.penny_score !== undefined) {
          scores[p.id] = {
            score: p.penny_score,
            recommendation: p.penny_recommendation || 'hold',
            scored_at: p.penny_scored_at || ''
          };
        }
      }

      return new Response(JSON.stringify({ success: true, scores }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action',
      validActions: ['analyze_portfolio_property', 'get_portfolio_scores']
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('[penny-portfolio-analysis] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
