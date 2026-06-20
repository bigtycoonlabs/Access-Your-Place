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

async function db(method: string, table: string, params?: string, body?: any): Promise<any[]> {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return [];
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : 'return=minimal' }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${url}/rest/v1/${table}${params ? '?' + params : ''}`, opts);
    if (!res.ok) { console.error(`DB ${method} ${table} failed:`, res.status); return []; }
    const text = await res.text();
    if (!text || text === 'null') return [];
    try { const data = JSON.parse(text); return Array.isArray(data) ? data.filter(i => i != null) : data != null ? [data] : []; } catch { return []; }
  } catch (e) { console.error('DB error:', e); return []; }
}

const MARKETS: Record<string, {
  name: string; state: string; strAdr: number; strOcc: number; colivingRate: number; colivingOcc: number;
  hotelAdr: number; hotelOcc: number; regRisk: string; trend: string; competition: string;
  peakMonths: number[]; slowMonths: number[]; peakLabel: string; slowLabel: string;
  topOTAs: string[]; mtrRate: number; corpHousingViable: boolean; demandDrivers: string[];
  avgListingCount: number; yoyGrowth: number;
}> = {
  austin: { name: 'Austin', state: 'TX', strAdr: 235, strOcc: 62, colivingRate: 950, colivingOcc: 92, hotelAdr: 185, hotelOcc: 68, regRisk: 'medium', trend: 'growing', competition: 'high', peakMonths: [3,4,5,10], slowMonths: [1,2,8], peakLabel: 'Mar-May (SXSW, ACL), Oct', slowLabel: 'Jan-Feb, Aug', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2800, corpHousingViable: true, demandDrivers: ['Tech industry','SXSW','ACL','F1 Grand Prix','UT Austin'], avgListingCount: 12500, yoyGrowth: 8.2 },
  nashville: { name: 'Nashville', state: 'TN', strAdr: 220, strOcc: 58, colivingRate: 900, colivingOcc: 88, hotelAdr: 195, hotelOcc: 72, regRisk: 'high', trend: 'stable', competition: 'high', peakMonths: [4,5,6,9,10], slowMonths: [1,2], peakLabel: 'Apr-Jun, Sep-Oct', slowLabel: 'Jan-Feb', topOTAs: ['Airbnb','VRBO','Booking.com','Expedia'], mtrRate: 2600, corpHousingViable: true, demandDrivers: ['Music tourism','Bachelorette parties','NFL Titans','Healthcare'], avgListingCount: 8200, yoyGrowth: 3.1 },
  tampa: { name: 'Tampa', state: 'FL', strAdr: 160, strOcc: 68, colivingRate: 850, colivingOcc: 90, hotelAdr: 165, hotelOcc: 74, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [1,2,3], slowMonths: [8,9], peakLabel: 'Jan-Mar (Snowbirds)', slowLabel: 'Aug-Sep', topOTAs: ['Airbnb','VRBO','Booking.com','TripAdvisor'], mtrRate: 2200, corpHousingViable: true, demandDrivers: ['Snowbirds','MacDill AFB','Healthcare','Busch Gardens'], avgListingCount: 6800, yoyGrowth: 11.4 },
  orlando: { name: 'Orlando', state: 'FL', strAdr: 240, strOcc: 78, colivingRate: 800, colivingOcc: 85, hotelAdr: 175, hotelOcc: 78, regRisk: 'low', trend: 'booming', competition: 'high', peakMonths: [3,6,7,12], slowMonths: [9], peakLabel: 'Mar, Jun-Jul, Dec', slowLabel: 'Sep', topOTAs: ['Airbnb','VRBO','Booking.com','Expedia','Hotels.com'], mtrRate: 2400, corpHousingViable: true, demandDrivers: ['Disney','Universal','Convention center'], avgListingCount: 15000, yoyGrowth: 6.8 },
  phoenix: { name: 'Phoenix', state: 'AZ', strAdr: 190, strOcc: 60, colivingRate: 800, colivingOcc: 88, hotelAdr: 155, hotelOcc: 66, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [1,2,3,11], slowMonths: [6,7,8], peakLabel: 'Jan-Mar, Nov', slowLabel: 'Jun-Aug', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2300, corpHousingViable: true, demandDrivers: ['Spring training','Snowbirds','Tech','Healthcare'], avgListingCount: 9500, yoyGrowth: 9.5 },
  denver: { name: 'Denver', state: 'CO', strAdr: 220, strOcc: 64, colivingRate: 1000, colivingOcc: 90, hotelAdr: 180, hotelOcc: 70, regRisk: 'high', trend: 'stable', competition: 'medium', peakMonths: [1,2,6,7,12], slowMonths: [4,11], peakLabel: 'Jan-Feb (Ski), Jun-Jul, Dec', slowLabel: 'Apr, Nov', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2700, corpHousingViable: true, demandDrivers: ['Ski tourism','Outdoor rec','Tech'], avgListingCount: 7200, yoyGrowth: 2.8 },
  miami: { name: 'Miami', state: 'FL', strAdr: 290, strOcc: 62, colivingRate: 1100, colivingOcc: 88, hotelAdr: 245, hotelOcc: 76, regRisk: 'high', trend: 'growing', competition: 'high', peakMonths: [12,1,2,3], slowMonths: [8,9], peakLabel: 'Dec-Mar', slowLabel: 'Aug-Sep', topOTAs: ['Airbnb','VRBO','Booking.com','Expedia','Hotels.com'], mtrRate: 3500, corpHousingViable: true, demandDrivers: ['International tourism','Art Basel','Cruise port'], avgListingCount: 18000, yoyGrowth: 5.3 },
  dallas: { name: 'Dallas', state: 'TX', strAdr: 170, strOcc: 60, colivingRate: 900, colivingOcc: 92, hotelAdr: 145, hotelOcc: 65, regRisk: 'low', trend: 'growing', competition: 'medium', peakMonths: [9,10,11], slowMonths: [7,8], peakLabel: 'Sep-Nov', slowLabel: 'Jul-Aug', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2400, corpHousingViable: true, demandDrivers: ['Corporate relocations','State Fair','Cowboys'], avgListingCount: 8000, yoyGrowth: 7.6 },
  atlanta: { name: 'Atlanta', state: 'GA', strAdr: 165, strOcc: 55, colivingRate: 850, colivingOcc: 90, hotelAdr: 140, hotelOcc: 64, regRisk: 'medium', trend: 'stable', competition: 'medium', peakMonths: [3,4,9,10], slowMonths: [7,8,12], peakLabel: 'Mar-Apr, Sep-Oct', slowLabel: 'Jul-Aug, Dec', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2200, corpHousingViable: true, demandDrivers: ['Film industry','Airport hub','Convention center'], avgListingCount: 9000, yoyGrowth: 4.1 },
  jacksonville: { name: 'Jacksonville', state: 'FL', strAdr: 145, strOcc: 64, colivingRate: 750, colivingOcc: 88, hotelAdr: 130, hotelOcc: 62, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3,4,5,6,7], slowMonths: [11,12,1], peakLabel: 'Mar-Jul', slowLabel: 'Nov-Jan', topOTAs: ['Airbnb','VRBO','Booking.com'], mtrRate: 1800, corpHousingViable: true, demandDrivers: ['Naval Station','Beach tourism','Jaguars NFL'], avgListingCount: 3500, yoyGrowth: 12.3 },
  charlotte: { name: 'Charlotte', state: 'NC', strAdr: 162, strOcc: 58, colivingRate: 875, colivingOcc: 90, hotelAdr: 138, hotelOcc: 66, regRisk: 'medium', trend: 'growing', competition: 'medium', peakMonths: [3,4,5,9,10], slowMonths: [7,8,12], peakLabel: 'Mar-May, Sep-Oct', slowLabel: 'Jul-Aug, Dec', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2100, corpHousingViable: true, demandDrivers: ['Banking hub','NASCAR','Panthers NFL'], avgListingCount: 4800, yoyGrowth: 8.9 },
  sanantonio: { name: 'San Antonio', state: 'TX', strAdr: 145, strOcc: 60, colivingRate: 750, colivingOcc: 88, hotelAdr: 125, hotelOcc: 63, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3,4,10], slowMonths: [8,1], peakLabel: 'Mar-Apr, Oct', slowLabel: 'Aug, Jan', topOTAs: ['Airbnb','VRBO','Booking.com'], mtrRate: 1900, corpHousingViable: true, demandDrivers: ['River Walk','Military bases','Fiesta'], avgListingCount: 5200, yoyGrowth: 6.5 },
  houston: { name: 'Houston', state: 'TX', strAdr: 150, strOcc: 58, colivingRate: 850, colivingOcc: 90, hotelAdr: 135, hotelOcc: 62, regRisk: 'low', trend: 'stable', competition: 'medium', peakMonths: [2,3,10], slowMonths: [7,8], peakLabel: 'Feb-Mar, Oct', slowLabel: 'Jul-Aug', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2200, corpHousingViable: true, demandDrivers: ['Energy sector','Medical Center','NASA'], avgListingCount: 7500, yoyGrowth: 3.4 },
  westpalmbeach: { name: 'West Palm Beach', state: 'FL', strAdr: 250, strOcc: 65, colivingRate: 1000, colivingOcc: 87, hotelAdr: 210, hotelOcc: 72, regRisk: 'medium', trend: 'growing', competition: 'medium', peakMonths: [12,1,2,3], slowMonths: [8,9], peakLabel: 'Dec-Mar', slowLabel: 'Aug-Sep', topOTAs: ['Airbnb','VRBO','Booking.com','Expedia'], mtrRate: 3000, corpHousingViable: true, demandDrivers: ['Snowbirds','Polo season','Luxury tourism'], avgListingCount: 4200, yoyGrowth: 7.2 },
  raleighdurham: { name: 'Raleigh-Durham', state: 'NC', strAdr: 155, strOcc: 62, colivingRate: 900, colivingOcc: 91, hotelAdr: 142, hotelOcc: 67, regRisk: 'low', trend: 'growing', competition: 'low', peakMonths: [3,4,5,10], slowMonths: [1,2,12], peakLabel: 'Mar-May, Oct', slowLabel: 'Jan-Feb, Dec', topOTAs: ['Airbnb','VRBO','Booking.com','Furnished Finder'], mtrRate: 2300, corpHousingViable: true, demandDrivers: ['Research Triangle','Duke/UNC','Tech industry'], avgListingCount: 3200, yoyGrowth: 11.8 }
};

function getMarketKey(city: string): string | null {
  if (!city) return null;
  const n = city.toLowerCase().replace(/[^a-z]/g, '');
  if (MARKETS[n]) return n;
  const aliases: Record<string, string> = { 'raleigh': 'raleighdurham', 'durham': 'raleighdurham', 'westpalm': 'westpalmbeach' };
  for (const [a, k] of Object.entries(aliases)) { if (n.includes(a)) return k; }
  for (const k of Object.keys(MARKETS)) { if (n.includes(k) || k.includes(n)) return k; }
  return null;
}

function getSeasonalAlerts(marketKeys: string[]): any[] {
  const cm = new Date().getMonth() + 1;
  const nm = cm === 12 ? 1 : cm + 1;
  const alerts: any[] = [];
  for (const k of marketKeys) {
    const m = MARKETS[k];
    if (!m) continue;
    if (m.peakMonths.includes(cm)) alerts.push({ market: `${m.name}, ${m.state}`, alert: `Peak season NOW! ${m.peakLabel}. Push ADR to $${Math.round(m.strAdr * 1.15)}+.`, type: 'peak', urgency: 'high' });
    else if (m.peakMonths.includes(nm)) alerts.push({ market: `${m.name}, ${m.state}`, alert: `Peak approaching! ${m.peakLabel}. Update listings, refresh photos.`, type: 'approaching_peak', urgency: 'medium' });
    else if (m.slowMonths.includes(cm)) alerts.push({ market: `${m.name}, ${m.state}`, alert: `Slow season. ${m.slowLabel}. Consider weekly discounts, MTR pivots.`, type: 'slow', urgency: 'medium' });
    else if (m.slowMonths.includes(nm)) alerts.push({ market: `${m.name}, ${m.state}`, alert: `Slow season approaching. List on Furnished Finder, lower minimum stays.`, type: 'approaching_slow', urgency: 'low' });
  }
  return alerts;
}

async function generateAIInsights(params: any): Promise<string> {
  const gk = Deno.env.get('GATEWAY_API_KEY');
  if (!gk) return generateFallbackInsights(params);
  const level = params.portfolioSize <= 0 ? 'pre-investor' : params.portfolioSize <= 1 ? 'beginner' : params.portfolioSize <= 3 ? 'growing' : params.portfolioSize <= 7 ? 'experienced' : 'seasoned';
  
  let prompt = '';
  if (level === 'pre-investor') {
    // NO PORTFOLIO - special prompt for aspiring investors
    prompt = `You are Penny, the witty, professional, and exciting AI analyst for Access Your Place (rental arbitrage platform). Write 3 personalized weekly tips for a PRE-INVESTOR who hasn't added properties yet.

INVESTOR: ${params.investorName}
INTERESTED MARKETS: ${params.markets.join(', ') || 'Not specified yet'}
BUDGET RANGE: ${params.budgetRange || 'Not specified'}
OPERATION INTERESTS: ${params.operationTypes.join(', ') || 'Exploring options'}

PENNY'S PERSONALITY: Witty, professional, full of excitement about rental arbitrage. Encouraging and motivating. Remind them that rental arbitrage margins are slim â€” rent is due the 1st, so marketing needs to be AGGRESSIVE, listings need to go up FAST on MULTIPLE platforms. This isn't owning property with wide margins. Speed to revenue matters. But the ROI comes quick when done right, and scaling to multiple units is where the real cash flow magic happens.

TIPS SHOULD COVER:
1. Market-specific insight for their interested cities (what makes it great for arbitrage, top platform there, demand drivers)
2. Budget optimization tip (how to maximize their investment range, what to look for in a lease, negotiation strategies with landlords)
3. Building a REAL furnished rental operation (not just an Airbnb business) â€” multi-platform strategy, corporate housing, co-living potential, sponsorship strategies, leveraging local markets

Each tip: actionable, data-driven, 2-3 sentences. HTML with inline styles for email. Be encouraging! Sign off "â€” Penny". No markdown.`;
  } else {
    prompt = `You are Penny, AI analyst for Access Your Place (real estate arbitrage). Write 3 personalized weekly tips for:
- ${params.investorName}, ${level} investor with ${params.portfolioSize} properties
- Markets: ${params.markets.join(', ') || 'various'}
- Avg Penny Score: ${params.pennyScoreAvg}/100, Est Revenue: $${params.totalEstimatedRevenue.toLocaleString()}/mo
- ${params.weekHighlights || 'Standard week'}
Each tip: actionable, data-driven, 2 sentences max. HTML with inline styles for email. Sign off "â€” Penny". No markdown.`;
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 20000);
    const res = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': gk },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1000 }),
      signal: controller.signal
    });
    clearTimeout(tid);
    if (!res.ok) return level === 'pre-investor' ? generateNoPortfolioFallback(params) : generateFallbackInsights(params);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || (level === 'pre-investor' ? generateNoPortfolioFallback(params) : generateFallbackInsights(params));
  } catch { return level === 'pre-investor' ? generateNoPortfolioFallback(params) : generateFallbackInsights(params); }
}

function generateNoPortfolioFallback(params: any): string {
  const markets = params.markets || [];
  const marketTips = markets.length > 0 ? markets.map((m: string) => {
    const mk = getMarketKey(m);
    const md = mk ? MARKETS[mk] : null;
    if (md) return `<strong>${md.name}, ${md.state}</strong> â€” STR ADR $${md.strAdr}/night, ${md.strOcc}% occ, top platform: ${md.topOTAs[0]}. ${md.demandDrivers.slice(0,2).join(' and ')} drive demand here.`;
    return `<strong>${m}</strong> â€” Great market to explore!`;
  }).join('<br/>') : 'Start by selecting your target markets in your investor profile â€” this helps us match you with the best deals!';

  return `<div style="margin:16px 0;">
<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;"><div style="min-width:28px;height:28px;background:linear-gradient(135deg,#d4a574,#c49464);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;">1</div><div><p style="margin:0;color:#1a365d;font-size:14px;font-weight:600;">Your Market Intel This Week</p><p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.6;">${marketTips}</p></div></div>
<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;"><div style="min-width:28px;height:28px;background:linear-gradient(135deg,#d4a574,#c49464);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;">2</div><div><p style="margin:0;color:#1a365d;font-size:14px;font-weight:600;">Speed Is Everything in Arbitrage</p><p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.6;">Remember: rent is due the 1st. Your marketing needs to be aggressive from day one â€” list on Airbnb, VRBO, Furnished Finder, AND Booking.com simultaneously. Don't rely on just one platform. The faster you fill nights, the faster you see ROI. This isn't owning property with wide margins â€” arbitrage margins are slim, so speed to revenue is your best friend.</p></div></div>
<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;"><div style="min-width:28px;height:28px;background:linear-gradient(135deg,#d4a574,#c49464);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;">3</div><div><p style="margin:0;color:#1a365d;font-size:14px;font-weight:600;">Think Operation, Not Just Airbnb</p><p style="margin:4px 0 0;color:#475569;font-size:13px;line-height:1.6;">Build a real furnished rental operation: explore corporate housing (30-90 day stays at premium rates), co-living (rent rooms individually for 1.5-2x total rent), and mid-term rentals on Furnished Finder. Sponsor local events, partner with relocation companies, and leverage your local market. The investors who scale fastest are the ones who diversify their revenue streams from day one.</p></div></div>
<p style="margin:16px 0 0;color:#94a3b8;font-size:13px;font-style:italic;">Keep building, keep learning â€” your first deal is closer than you think! â€” Penny</p></div>`;
}

function generateFallbackInsights(params: any): string {
  const tips = params.portfolioSize <= 2
    ? ['Focus on guest experience â€” 4.8+ stars boosts bookings 20%.','Set up automated messaging and smart pricing to save 5+ hours/property/month.','Refresh listing photos â€” professional photos earn 24% more revenue.']
    : params.portfolioSize <= 5
    ? ['Standardize SOPs across properties â€” consistent processes reduce complaints 35%.','Explore Furnished Finder for MTR demand â€” 90%+ occupancy, zero OTA fees.',`With ${params.portfolioSize} properties, negotiate bulk cleaning rates.`]
    : [`Your ${params.portfolioSize}-property portfolio is ready for dynamic pricing â€” 15-30% revenue increase.`,'Consider a VA for guest comms â€” ROI pays for itself month one.','Diversify across 3+ markets to reduce seasonal dips by 40%.'];
  return `<div style="margin:16px 0;">${tips.map((t,i) => `<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;"><div style="min-width:28px;height:28px;background:linear-gradient(135deg,#d4a574,#c49464);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;">${i+1}</div><p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">${t}</p></div>`).join('')}<p style="margin:16px 0 0;color:#94a3b8;font-size:13px;font-style:italic;">â€” Penny</p></div>`;
}

function buildDigestEmail(p: any): string {
  const { investorName, portfolioSummary: ps, pennyScoreChanges, newDeals, marketTrends, seasonalAlerts, aiInsights, weekDate, isNoPortfolio, noPortfolioData } = p;
  const firstName = (investorName || 'Investor').split(' ')[0];
  const sc = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';
  const ti = (t: string) => t === 'booming' ? '&#9650;&#9650;' : t === 'growing' ? '&#9650;' : t === 'stable' ? '&#8212;' : '&#9660;';
  const tc = (t: string) => t === 'booming' ? '#10b981' : t === 'growing' ? '#22c55e' : t === 'stable' ? '#f59e0b' : '#ef4444';
  const ab = (t: string) => t === 'peak' ? '#f0fdf4' : t === 'approaching_peak' ? '#eff6ff' : t === 'slow' ? '#fef3c7' : '#f8fafc';
  const abr = (t: string) => t === 'peak' ? '#22c55e' : t === 'approaching_peak' ? '#3b82f6' : t === 'slow' ? '#f59e0b' : '#94a3b8';
  const al = (t: string) => t === 'peak' ? 'PEAK SEASON' : t === 'approaching_peak' ? 'PEAK APPROACHING' : t === 'slow' ? 'SLOW SEASON' : 'HEADS UP';

  // Special greeting for no-portfolio investors
  const greeting = isNoPortfolio
    ? `<p style="color:#334155;font-size:16px;margin:0 0 4px;">Hey ${firstName}!</p><p style="color:#64748b;font-size:14px;margin:0 0 28px;">You haven't added any properties to your portfolio yet â€” but that's okay! Every empire starts with a single unit. Here's your personalized market intelligence and tips to help you land your first deal.</p>`
    : `<p style="color:#334155;font-size:16px;margin:0 0 4px;">Good morning, ${firstName}!</p><p style="color:#64748b;font-size:14px;margin:0 0 28px;">Here's your personalized weekly investment summary.</p>`;

  // Portfolio section - different for no-portfolio
  let portfolioSection = '';
  if (isNoPortfolio) {
    const npd = noPortfolioData || {};
    portfolioSection = `<div style="margin-bottom:32px;">
<h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Your Investment Profile</h2>
<div style="background:linear-gradient(135deg,#faf5ff,#ede9fe);border-radius:12px;padding:20px;border:1px solid #ddd6fe;">
<table style="width:100%;border-collapse:collapse;"><tr>
<td style="padding:14px;text-align:center;width:33%;"><p style="margin:0;color:#7c3aed;font-size:24px;font-weight:800;">${npd.interestedMarkets || 0}</p><p style="margin:4px 0 0;color:#6d28d9;font-size:11px;text-transform:uppercase;">Target Markets</p></td>
<td style="padding:14px;text-align:center;width:33%;"><p style="margin:0;color:#7c3aed;font-size:24px;font-weight:800;">0</p><p style="margin:4px 0 0;color:#6d28d9;font-size:11px;text-transform:uppercase;">Properties</p></td>
<td style="padding:14px;text-align:center;width:33%;"><p style="margin:0;color:#7c3aed;font-size:24px;font-weight:800;">Ready</p><p style="margin:4px 0 0;color:#6d28d9;font-size:11px;text-transform:uppercase;">Status</p></td>
</tr></table>
<p style="margin:16px 0 0;color:#6d28d9;font-size:13px;text-align:center;font-style:italic;">Your Acquisition Manager is ready to help you find your first winning deal!</p>
</div></div>`;
  } else {
    portfolioSection = `<div style="margin-bottom:32px;">
<h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Portfolio Performance</h2>
<table style="width:100%;border-collapse:collapse;"><tr>
<td style="padding:14px;background:linear-gradient(135deg,#1a365d,#2d5a87);border-radius:10px 0 0 0;text-align:center;width:25%;"><p style="margin:0;color:white;font-size:28px;font-weight:800;">${ps.totalProperties}</p><p style="margin:4px 0 0;color:#94a3b8;font-size:11px;text-transform:uppercase;">Properties</p></td>
<td style="padding:14px;background:linear-gradient(135deg,#10b981,#059669);text-align:center;width:25%;"><p style="margin:0;color:white;font-size:28px;font-weight:800;">$${ps.totalEstimatedRevenue > 0 ? (ps.totalEstimatedRevenue/1000).toFixed(1)+'k' : 'â€”'}</p><p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;">Est. Monthly Rev</p></td>
<td style="padding:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);text-align:center;width:25%;"><p style="margin:0;color:white;font-size:28px;font-weight:800;">${ps.avgPennyScore > 0 ? ps.avgPennyScore : 'â€”'}</p><p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;">Avg Penny Score</p></td>
<td style="padding:14px;background:linear-gradient(135deg,#d4a574,#c49464);border-radius:0 10px 0 0;text-align:center;width:25%;"><p style="margin:0;color:white;font-size:28px;font-weight:800;">${Object.keys(ps.operationBreakdown).length}</p><p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:11px;text-transform:uppercase;">Op Types</p></td>
</tr></table>
${ps.topPerformer ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0 0 10px 10px;padding:12px 16px;"><p style="margin:0;color:#166534;font-size:13px;"><strong>Top Performer:</strong> ${ps.topPerformer}</p></div>` : ''}</div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:660px;margin:0 auto;background:#fff;">
<div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:36px 28px;text-align:center;">
<h1 style="color:#f59e0b;margin:0;font-size:26px;font-weight:800;">Your Weekly Digest</h1>
<p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">Week of ${weekDate} &bull; Powered by Penny AI</p></div>
<div style="padding:32px 28px;">
${greeting}
${portfolioSection}
${!isNoPortfolio && pennyScoreChanges.length > 0 ? `<div style="margin-bottom:32px;"><h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Penny Score Updates</h2>${pennyScoreChanges.map((s: any) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f8fafc;border-radius:8px;margin-bottom:8px;border-left:4px solid ${sc(s.newScore)};"><div><p style="margin:0;color:#1a365d;font-size:14px;font-weight:600;">${s.property}</p></div><div style="text-align:right;"><span style="background:${sc(s.newScore)};color:white;padding:4px 12px;border-radius:16px;font-size:16px;font-weight:800;">${s.newScore}</span>${s.change !== 0 ? `<p style="margin:4px 0 0;color:${s.change > 0 ? '#10b981' : '#ef4444'};font-size:12px;font-weight:700;">${s.change > 0 ? '+' : ''}${s.change} pts</p>` : ''}</div></div>`).join('')}</div>` : ''}
${seasonalAlerts.length > 0 ? `<div style="margin-bottom:32px;"><h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Season Alerts</h2>${seasonalAlerts.map((sa: any) => `<div style="background:${ab(sa.type)};border-left:4px solid ${abr(sa.type)};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-weight:700;color:#1a365d;font-size:14px;">${sa.market}</span><span style="background:${abr(sa.type)};color:white;padding:2px 10px;border-radius:10px;font-size:10px;font-weight:700;">${al(sa.type)}</span></div><p style="margin:0;color:#475569;font-size:13px;line-height:1.5;">${sa.alert}</p></div>`).join('')}</div>` : ''}
${marketTrends.length > 0 ? `<div style="margin-bottom:32px;"><h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Your Market Trends</h2><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Market</th><th style="padding:10px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Trend</th><th style="padding:10px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">STR ADR</th><th style="padding:10px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">YoY</th><th style="padding:10px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Top Platform</th></tr></thead><tbody>${marketTrends.map((mt: any) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#1a365d;">${mt.market}</td><td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center;color:${tc(mt.trend)};font-weight:700;">${ti(mt.trend)} ${mt.trend}</td><td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;">$${mt.strAdr}</td><td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:center;color:${mt.yoyGrowth >= 0 ? '#10b981' : '#ef4444'};font-weight:600;">${mt.yoyGrowth >= 0 ? '+' : ''}${mt.yoyGrowth}%</td><td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;">${mt.topOTA}</td></tr>`).join('')}</tbody></table></div>` : ''}
${newDeals.length > 0 ? `<div style="margin-bottom:32px;"><h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">New Deals Matching Your Preferences</h2>${newDeals.slice(0,6).map((d: any) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:10px;"><div><p style="margin:0;color:#1a365d;font-size:14px;font-weight:700;">${d.city}, ${d.state}</p><p style="margin:3px 0 0;color:#64748b;font-size:12px;">${d.bedrooms}BR/${d.bathrooms}BA &bull; $${d.rent?.toLocaleString()||'?'}/mo</p></div><div style="text-align:center;"><div style="width:44px;height:44px;border-radius:50%;background:${sc(d.pennyScore)};display:inline-flex;align-items:center;justify-content:center;"><span style="color:white;font-size:16px;font-weight:800;">${d.pennyScore}</span></div></div></div>`).join('')}</div>` : ''}
<div style="margin-bottom:32px;"><h2 style="color:#1a365d;font-size:18px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #d4a574;">Penny's Tips for This Week</h2><div style="background:linear-gradient(135deg,#faf5ff,#ede9fe);border-radius:12px;padding:20px;border:1px solid #ddd6fe;">${aiInsights}</div></div>
<div style="text-align:center;margin:36px 0 24px;">
<a href="https://accessyourplace.com/investor-login" style="display:inline-block;background:linear-gradient(135deg,#d4a574,#c49464);color:#1a365d;padding:16px 44px;text-decoration:none;border-radius:10px;font-weight:800;font-size:16px;">Open Your Dashboard</a><br/>
<a href="https://accessyourplace.com/deals" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#1a365d,#2d5a87);color:white;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Browse New Deals</a></div>
</div>
<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 28px;text-align:center;">
<p style="color:#64748b;font-size:13px;margin:0 0 4px;">Access Your Place &mdash; Real Estate Arbitrage Platform</p>
<p style="color:#94a3b8;font-size:11px;margin:0 0 8px;">1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126</p>
<p style="color:#94a3b8;font-size:11px;margin:0;"><a href="https://accessyourplace.com/investor/unsubscribe?type=weekly_summary" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> &bull; <a href="https://accessyourplace.com/investor?tab=email" style="color:#94a3b8;text-decoration:underline;">Manage preferences</a></p></div></div></body></html>`;
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ========== send_weekly_digests (Batch) ==========
    if (action === 'send_weekly_digests') {
      console.log('[weekly-digest] Starting batch...');
      const investors = await db('GET', 'investors', 'status=eq.active&select=id,full_name,email&order=created_at.asc&limit=500');
      if (!investors.length) return new Response(JSON.stringify({ success: true, message: 'No active investors', processed: 0 }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const prefs = await db('GET', 'investor_notification_preferences', 'select=investor_id,email_weekly_summary,unsubscribed_all');
      const pm: Record<string, any> = {};
      for (const p of prefs) { if (p?.investor_id) pm[p.investor_id] = p; }
      const eligible = investors.filter((inv: any) => {
        if (!inv?.email?.includes('@')) return false;
        const pref = pm[inv.id];
        if (!pref) return true;
        if (pref.unsubscribed_all || pref.email_weekly_summary === false) return false;
        return true;
      });
      console.log(`[weekly-digest] ${eligible.length} eligible of ${investors.length}`);
      let sent = 0, failed = 0;
      const url = Deno.env.get('SUPABASE_URL') || '';
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      for (const inv of eligible) {
        try {
          const res = await fetch(`${url}/functions/v1/investor-weekly-digest`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'apikey': key },
            body: JSON.stringify({ action: 'send_single_digest', investor_id: inv.id })
          });
          const r = await res.json();
          if (r.success) sent++; else failed++;
          await new Promise(r => setTimeout(r, 100));
        } catch { failed++; }
        if (Date.now() - startTime > 14 * 60 * 1000) break;
      }
      await db('POST', 'email_delivery_logs', '', { email_type: 'weekly_digest_batch', recipient_email: 'batch@system', recipient_name: 'Batch', recipient_type: 'system', sender_name: 'Penny AI', sender_type: 'system', subject: `Batch: ${sent} sent, ${failed} failed`, status: failed === 0 ? 'sent' : 'partial', metadata: { sent, failed, total: eligible.length, ms: Date.now() - startTime } });
      return new Response(JSON.stringify({ success: true, sent, failed, total_eligible: eligible.length, execution_time_ms: Date.now() - startTime }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ========== send_single_digest ==========
    if (action === 'send_single_digest') {
      const { investor_id, custom_html } = body;
      if (!investor_id) return new Response(JSON.stringify({ success: false, error: 'investor_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const investors = await db('GET', 'investors', `id=eq.${investor_id}&select=id,full_name,email,preferred_markets,operation_type,budget_range,investment_goals`);
      const investor = investors[0];
      if (!investor?.email) return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      const portfolio = await db('GET', 'investor_portfolio', `investor_id=eq.${investor_id}&select=id,address,city,state,bedrooms,bathrooms,monthly_rent,status,operation_type,penny_score,estimated_revenue`);
      const active = portfolio.filter((p: any) => p && (p.status === 'active' || p.status === 'in_acquisition'));
      const isNoPortfolio = active.length === 0;

      // Gather market keys from portfolio + preferences
      const mktKeys = new Set<string>();
      const mktNames = new Set<string>();
      for (const p of active) { const k = getMarketKey(p.city); if (k) { mktKeys.add(k); mktNames.add(`${MARKETS[k].name}, ${MARKETS[k].state}`); } }
      if (investor.preferred_markets && Array.isArray(investor.preferred_markets)) {
        for (const pm of investor.preferred_markets) { const k = getMarketKey(pm); if (k) { mktKeys.add(k); mktNames.add(`${MARKETS[k].name}, ${MARKETS[k].state}`); } }
      }

      // Penny score changes
      const scoreChanges = active.filter((p: any) => p.penny_score).map((p: any) => ({
        property: `${p.address || p.city}, ${p.state}`, oldScore: null, newScore: p.penny_score, change: 0
      }));

      const marketTrends = Array.from(mktKeys).map(k => { const m = MARKETS[k]; return { market: `${m.name}, ${m.state}`, trend: m.trend, strAdr: m.strAdr, strOcc: m.strOcc, yoyGrowth: m.yoyGrowth, topOTA: m.topOTAs[0] }; }).slice(0, 8);
      const seasonalAlerts = getSeasonalAlerts(Array.from(mktKeys));

      // New deals
      const newDeals: any[] = [];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recent = await db('GET', 'properties', `status=eq.available&created_at=gte.${weekAgo}&select=id,city,state,bedrooms,bathrooms,monthly_rent,penny_score,operation_type&order=penny_score.desc.nullslast&limit=20`);
      for (const p of recent) {
        if (!p) continue;
        const mk = getMarketKey(p.city);
        if (mk && (mktKeys.has(mk) || (p.penny_score && p.penny_score >= 65))) {
          newDeals.push({ city: p.city, state: p.state, bedrooms: p.bedrooms || 3, bathrooms: p.bathrooms || 2, rent: p.monthly_rent || 0, pennyScore: p.penny_score || 50 });
        }
      }

      // Portfolio summary
      const totalRev = active.reduce((s: number, p: any) => s + (p.estimated_revenue || 0), 0);
      const scores = active.filter((p: any) => p.penny_score).map((p: any) => p.penny_score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const opBreakdown: Record<string, number> = {};
      for (const p of active) { const t = p.operation_type || 'str'; opBreakdown[t] = (opBreakdown[t] || 0) + 1; }

      const aiInsights = await generateAIInsights({
        investorName: investor.full_name,
        portfolioSize: active.length,
        operationTypes: Object.keys(opBreakdown),
        totalEstimatedRevenue: totalRev,
        markets: Array.from(mktNames),
        pennyScoreAvg: avgScore,
        budgetRange: investor.budget_range || '',
        seasonalAlerts, newDealsCount: newDeals.length
      });

      const weekDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      
      // Use custom HTML if provided (staff edited), otherwise generate
      const emailHtml = custom_html || buildDigestEmail({
        investorName: investor.full_name,
        portfolioSummary: { totalProperties: active.length, totalEstimatedRevenue: totalRev, avgPennyScore: avgScore, topPerformer: null, operationBreakdown: opBreakdown },
        pennyScoreChanges: scoreChanges.slice(0, 5),
        newDeals: newDeals.slice(0, 6),
        marketTrends, seasonalAlerts: seasonalAlerts.slice(0, 4), aiInsights, weekDate,
        isNoPortfolio,
        noPortfolioData: isNoPortfolio ? { interestedMarkets: mktKeys.size } : null
      });

      let emailSent = false, resendId: string | null = null;
      const RESEND = Deno.env.get('RESEND_API_KEY');
      if (RESEND) {
        try {
          const subj = isNoPortfolio
            ? `${investor.full_name?.split(' ')[0] || 'Investor'}, Your Market Intel This Week | ${weekDate}`
            : `Your Weekly Digest â€” ${active.length} Properties, ${newDeals.length} New Deals | ${weekDate}`;
          const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${RESEND}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Penny AI <penny@accessyourplace.com>', to: [investor.email], subject: subj, html: emailHtml }) });
          const rr = await r.json();
          emailSent = r.ok; resendId = rr?.id || null;
        } catch (e: any) { console.error('[weekly-digest] Send failed:', e.message); }
      }

      await db('POST', 'email_delivery_logs', '', { email_type: 'weekly_digest', recipient_email: investor.email, recipient_name: investor.full_name, recipient_type: 'investor', sender_name: 'Penny AI', sender_type: 'system', subject: `Weekly Digest â€” ${weekDate}`, resend_id: resendId, status: emailSent ? 'sent' : 'failed', metadata: { portfolio: active.length, avg_score: avgScore, deals: newDeals.length, is_no_portfolio: isNoPortfolio } });

      return new Response(JSON.stringify({ success: true, email_sent: emailSent, resend_id: resendId, investor_name: investor.full_name, portfolio_count: active.length, is_no_portfolio: isNoPortfolio, execution_time_ms: Date.now() - startTime }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ========== preview_digest ==========
    if (action === 'preview_digest') {
      const { investor_id } = body;
      if (!investor_id) return new Response(JSON.stringify({ success: false, error: 'investor_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const investors = await db('GET', 'investors', `id=eq.${investor_id}&select=id,full_name,email,preferred_markets,operation_type,budget_range`);
      const inv = investors[0];
      if (!inv) return new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      const portfolio = await db('GET', 'investor_portfolio', `investor_id=eq.${investor_id}&select=id,address,city,state,bedrooms,bathrooms,monthly_rent,status,operation_type,penny_score,estimated_revenue`);
      const active = portfolio.filter((p: any) => p && (p.status === 'active' || p.status === 'in_acquisition'));
      const isNoPortfolio = active.length === 0;

      const mktKeys = new Set<string>();
      const mktNames = new Set<string>();
      for (const p of active) { const k = getMarketKey(p.city); if (k) { mktKeys.add(k); mktNames.add(`${MARKETS[k].name}, ${MARKETS[k].state}`); } }
      if (inv.preferred_markets && Array.isArray(inv.preferred_markets)) {
        for (const pm of inv.preferred_markets) { const k = getMarketKey(pm); if (k) { mktKeys.add(k); mktNames.add(`${MARKETS[k].name}, ${MARKETS[k].state}`); } }
      }

      const scores = active.filter((p: any) => p.penny_score).map((p: any) => p.penny_score);
      const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const totalRev = active.reduce((s: number, p: any) => s + (p.estimated_revenue || 0), 0);
      const opBreakdown: Record<string, number> = {};
      for (const p of active) { const t = p.operation_type || 'str'; opBreakdown[t] = (opBreakdown[t] || 0) + 1; }
      const scoreChanges = active.filter((p: any) => p.penny_score).map((p: any) => ({
        property: `${p.address || p.city}, ${p.state}`, oldScore: null, newScore: p.penny_score, change: 0
      }));
      const marketTrends = Array.from(mktKeys).map(k => { const m = MARKETS[k]; return { market: `${m.name}, ${m.state}`, trend: m.trend, strAdr: m.strAdr, strOcc: m.strOcc, yoyGrowth: m.yoyGrowth, topOTA: m.topOTAs[0] }; }).slice(0, 8);
      const seasonalAlerts = getSeasonalAlerts(Array.from(mktKeys));

      // New deals
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recent = await db('GET', 'properties', `status=eq.available&created_at=gte.${weekAgo}&select=city,state,bedrooms,bathrooms,monthly_rent,penny_score&order=penny_score.desc.nullslast&limit=10`);
      const newDeals = recent.filter(p => p && (getMarketKey(p.city) && mktKeys.has(getMarketKey(p.city)!) || (p.penny_score >= 65))).map(p => ({ city: p.city, state: p.state, bedrooms: p.bedrooms || 3, bathrooms: p.bathrooms || 2, rent: p.monthly_rent || 0, pennyScore: p.penny_score || 50 })).slice(0, 6);

      const aiInsights = await generateAIInsights({
        investorName: inv.full_name, portfolioSize: active.length, operationTypes: Object.keys(opBreakdown),
        totalEstimatedRevenue: totalRev, markets: Array.from(mktNames), pennyScoreAvg: avg,
        budgetRange: inv.budget_range || '', seasonalAlerts, newDealsCount: newDeals.length
      });

      const weekDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const emailHtml = buildDigestEmail({
        investorName: inv.full_name,
        portfolioSummary: { totalProperties: active.length, totalEstimatedRevenue: totalRev, avgPennyScore: avg, topPerformer: null, operationBreakdown: opBreakdown },
        pennyScoreChanges: scoreChanges.slice(0, 5), newDeals, marketTrends, seasonalAlerts: seasonalAlerts.slice(0, 4), aiInsights, weekDate,
        isNoPortfolio, noPortfolioData: isNoPortfolio ? { interestedMarkets: mktKeys.size } : null
      });

      return new Response(JSON.stringify({
        success: true,
        html: emailHtml,
        preview: { name: inv.full_name, email: inv.email, portfolio: active.length, avg_score: avg, markets: Array.from(mktNames), alerts: seasonalAlerts, is_no_portfolio: isNoPortfolio, new_deals: newDeals.length }
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ========== get_digest_stats ==========
    if (action === 'get_digest_stats') {
      let logs: any[] = [];
      try { logs = await db('GET', 'email_delivery_logs', 'email_type=eq.weekly_digest&order=created_at.desc&limit=50'); } catch { logs = []; }
      let batchLogs: any[] = [];
      try { batchLogs = await db('GET', 'email_delivery_logs', 'email_type=eq.weekly_digest_batch&order=created_at.desc&limit=10'); } catch { batchLogs = []; }
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sentThisWeek = logs.filter(l => l?.created_at && new Date(l.created_at) > weekAgo && l.status === 'sent').length;
      const failedThisWeek = logs.filter(l => l?.created_at && new Date(l.created_at) > weekAgo && l.status === 'failed').length;
      return new Response(JSON.stringify({ success: true, recent_batches: batchLogs, recent_sends: logs, total_sent_this_week: sentThisWeek, total_failed_this_week: failedThisWeek }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action', validActions: ['send_weekly_digests', 'send_single_digest', 'preview_digest', 'get_digest_stats'] }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('[weekly-digest] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});

