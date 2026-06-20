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

const MARKET_DATA: Record<string, {
  name: string; hotelAdrLow: number; hotelAdrHigh: number; hotelOcc: number;
  strAdrLow: number; strAdrHigh: number; strOcc: number;
  colivingLow: number; colivingHigh: number; colivingAvg: number;
  topPlatform: string; platformRanking: string[]; platformNotes: string;
  corporateHousing: string; nearbyAttractions: string[]; demandDrivers: string[];
  peakMonths: string; slowMonths: string; regulationRisk: string; regulationNotes: string;
  marketTrend: string; uniqueSelling: string;
}> = {
  austin: {
    name: 'Austin, TX', hotelAdrLow: 120, hotelAdrHigh: 280, hotelOcc: 68,
    strAdrLow: 150, strAdrHigh: 320, strOcc: 62,
    colivingLow: 800, colivingHigh: 1100, colivingAvg: 950,
    topPlatform: 'Furnished Finder',
    platformRanking: ['Furnished Finder', 'Airbnb', 'VRBO', 'Booking.com', 'Zillow Rentals'],
    platformNotes: 'Furnished Finder dominates mid-term rental due to healthcare and tech contractor demand. Airbnb faces regulatory pressure with Type 2 licensing. VRBO captures family travel during SXSW and ACL.',
    corporateHousing: 'Excellent. Major tech corridor with Dell, Apple, Tesla, Samsung, Oracle. Corporate housing demand year-round, 30-90 day stays averaging $3,200-$5,500/month.',
    nearbyAttractions: ['6th Street Entertainment', 'Barton Springs Pool', 'Zilker Park', 'South Congress', 'The Domain', 'Circuit of the Americas (F1)', 'ACL grounds', 'UT Austin', 'Lady Bird Lake'],
    demandDrivers: ['SXSW (March)', 'ACL Festival (Oct)', 'F1 US Grand Prix (Oct)', 'Tech conferences', 'UT Austin events', 'Corporate relocations'],
    peakMonths: 'March (SXSW), October (ACL + F1), June-August', slowMonths: 'January, August (extreme heat)',
    regulationRisk: 'Medium', regulationNotes: 'Type 2 STR license required for non-owner-occupied.',
    marketTrend: 'Growing â€” tech migration continues', uniqueSelling: 'Live music capital with year-round event-driven demand'
  },
  nashville: {
    name: 'Nashville, TN', hotelAdrLow: 130, hotelAdrHigh: 320, hotelOcc: 72,
    strAdrLow: 160, strAdrHigh: 280, strOcc: 58,
    colivingLow: 750, colivingHigh: 1050, colivingAvg: 900,
    topPlatform: 'VRBO',
    platformRanking: ['VRBO', 'Airbnb', 'Booking.com', 'Furnished Finder', 'Evolve'],
    platformNotes: 'VRBO outperforms Airbnb for group bookings â€” bachelorette parties and family reunions drive 40%+ of bookings.',
    corporateHousing: 'Good. Healthcare (Vanderbilt, HCA) and music industry create steady corporate demand.',
    nearbyAttractions: ['Broadway Honky Tonks', 'Grand Ole Opry', 'Ryman Auditorium', 'The Gulch', 'East Nashville', 'Centennial Park'],
    demandDrivers: ['Music tourism', 'Bachelorette parties', 'CMA Fest (June)', 'NFL Titans', 'Healthcare conferences'],
    peakMonths: 'April-June, September-October', slowMonths: 'January-February',
    regulationRisk: 'High', regulationNotes: 'Non-owner-occupied STRs banned in most residential zones.',
    marketTrend: 'Stable â€” strong tourism but regulatory headwinds', uniqueSelling: 'Music City with unmatched group travel demand'
  },
  tampa: {
    name: 'Tampa, FL', hotelAdrLow: 100, hotelAdrHigh: 220, hotelOcc: 70,
    strAdrLow: 120, strAdrHigh: 200, strOcc: 68,
    colivingLow: 700, colivingHigh: 1000, colivingAvg: 850,
    topPlatform: 'Airbnb',
    platformRanking: ['Airbnb', 'VRBO', 'Furnished Finder', 'Booking.com', 'Zillow Rentals'],
    platformNotes: 'Airbnb leads due to strong leisure travel. VRBO captures beach bookings. Furnished Finder growing with travel nurse demand.',
    corporateHousing: 'Strong. MacDill AFB, major hospitals, growing tech sector. $2,800-$4,200/month for furnished 2BR+.',
    nearbyAttractions: ['Busch Gardens', 'Tampa Riverwalk', 'Ybor City', 'Clearwater Beach', 'St. Pete Beach', 'Raymond James Stadium'],
    demandDrivers: ['Snowbirds (Nov-Apr)', 'Busch Gardens', 'Cruise port', 'Spring Training', 'Military (MacDill AFB)'],
    peakMonths: 'January-March (snowbird season)', slowMonths: 'August-September (hurricane season)',
    regulationRisk: 'Low', regulationNotes: 'Florida is STR-friendly. Registration required.',
    marketTrend: 'Growing â€” remote worker migration, affordable vs Miami', uniqueSelling: 'Affordable Florida with year-round warm weather'
  },
  orlando: {
    name: 'Orlando, FL', hotelAdrLow: 90, hotelAdrHigh: 250, hotelOcc: 75,
    strAdrLow: 130, strAdrHigh: 350, strOcc: 78,
    colivingLow: 650, colivingHigh: 950, colivingAvg: 800,
    topPlatform: 'VRBO',
    platformRanking: ['VRBO', 'Airbnb', 'Booking.com', 'Vacasa', 'Evolve'],
    platformNotes: 'VRBO dominates â€” families prefer whole-home bookings near theme parks.',
    corporateHousing: 'Moderate. Convention center drives corporate stays.',
    nearbyAttractions: ['Walt Disney World', 'Universal Studios', 'Epic Universe', 'SeaWorld', 'ICON Park', 'Convention Center'],
    demandDrivers: ['Disney year-round', 'Universal/Epic Universe', 'Conventions', 'Spring Break', 'Holiday season'],
    peakMonths: 'March, June-July, December', slowMonths: 'September',
    regulationRisk: 'Low', regulationNotes: 'Vacation rentals in designated zones. License required.',
    marketTrend: 'Booming â€” Epic Universe opening is a game-changer', uniqueSelling: 'Theme park capital with 75M+ annual visitors'
  },
  phoenix: {
    name: 'Phoenix, AZ', hotelAdrLow: 90, hotelAdrHigh: 280, hotelOcc: 65,
    strAdrLow: 140, strAdrHigh: 240, strOcc: 60,
    colivingLow: 650, colivingHigh: 950, colivingAvg: 800,
    topPlatform: 'Airbnb',
    platformRanking: ['Airbnb', 'VRBO', 'Furnished Finder', 'Booking.com', 'Zillow Rentals'],
    platformNotes: 'Airbnb leads for snowbird and golf tourism. Pool properties command 30-40% ADR premium.',
    corporateHousing: 'Good. Intel, Honeywell, healthcare systems.',
    nearbyAttractions: ['Camelback Mountain', 'Scottsdale Old Town', 'Desert Botanical Garden', 'Chase Field', 'Spring Training stadiums'],
    demandDrivers: ['Spring Training (Feb-Mar)', 'Golf tourism (Oct-Apr)', 'Snowbirds', 'Corporate events'],
    peakMonths: 'February-March', slowMonths: 'June-August (extreme heat)',
    regulationRisk: 'Low', regulationNotes: 'Arizona state law preempts local STR bans. Very operator-friendly.',
    marketTrend: 'Growing â€” affordable Sun Belt with strong protections', uniqueSelling: 'State-protected STR rights with massive seasonal demand'
  },
  dallas: {
    name: 'Dallas, TX', hotelAdrLow: 100, hotelAdrHigh: 250, hotelOcc: 65,
    strAdrLow: 120, strAdrHigh: 220, strOcc: 60,
    colivingLow: 750, colivingHigh: 1050, colivingAvg: 900,
    topPlatform: 'Furnished Finder',
    platformRanking: ['Furnished Finder', 'Airbnb', 'VRBO', 'Zillow Rentals', 'Booking.com'],
    platformNotes: 'Furnished Finder leads due to massive corporate relocation and healthcare demand.',
    corporateHousing: 'Excellent. Fortune 500 HQs (AT&T, ExxonMobil, Southwest Airlines).',
    nearbyAttractions: ['AT&T Stadium', 'Deep Ellum', 'Bishop Arts', 'Dallas Arboretum', 'State Fair grounds'],
    demandDrivers: ['Corporate travel', 'Cowboys games', 'State Fair (Oct)', 'Conventions', 'Corporate relocations'],
    peakMonths: 'September-October, March-April', slowMonths: 'July-August',
    regulationRisk: 'Low', regulationNotes: 'Texas HB 2797 protects STR rights statewide.',
    marketTrend: 'Growing â€” corporate relocations and population boom', uniqueSelling: 'Corporate powerhouse with Texas-level STR protections'
  },
  miami: {
    name: 'Miami, FL', hotelAdrLow: 150, hotelAdrHigh: 450, hotelOcc: 72,
    strAdrLow: 180, strAdrHigh: 400, strOcc: 62,
    colivingLow: 900, colivingHigh: 1300, colivingAvg: 1100,
    topPlatform: 'Booking.com',
    platformRanking: ['Booking.com', 'Airbnb', 'VRBO', 'Furnished Finder', 'Sonder'],
    platformNotes: 'Booking.com leads due to massive international tourism. Airbnb faces 30-day minimum rules in many areas.',
    corporateHousing: 'Strong. Finance, tech startups, international business. $3,500-$6,000/month.',
    nearbyAttractions: ['South Beach', 'Wynwood Walls', 'Brickell', 'Little Havana', 'Design District', 'Key Biscayne'],
    demandDrivers: ['International tourism', 'Art Basel (Dec)', 'Ultra Festival (Mar)', 'F1 Miami (May)', 'Digital nomads'],
    peakMonths: 'December-March', slowMonths: 'August-September',
    regulationRisk: 'High', regulationNotes: 'Miami Beach enforces 30-day minimum stays.',
    marketTrend: 'Growing â€” international capital and remote work migration', uniqueSelling: 'International gateway with premium ADR potential'
  },
  atlanta: {
    name: 'Atlanta, GA', hotelAdrLow: 100, hotelAdrHigh: 280, hotelOcc: 68,
    strAdrLow: 130, strAdrHigh: 200, strOcc: 55,
    colivingLow: 700, colivingHigh: 1000, colivingAvg: 850,
    topPlatform: 'Furnished Finder',
    platformRanking: ['Furnished Finder', 'Airbnb', 'VRBO', 'Zillow Rentals', 'Booking.com'],
    platformNotes: 'Furnished Finder excels due to film production crew demand and healthcare travel.',
    corporateHousing: 'Excellent. Film production (Tyler Perry Studios), Delta, Coca-Cola, Home Depot.',
    nearbyAttractions: ['Georgia Aquarium', 'Centennial Olympic Park', 'Ponce City Market', 'BeltLine', 'Mercedes-Benz Stadium'],
    demandDrivers: ['Film production', 'Conventions', 'Sports events', 'Airport layovers', 'Corporate travel'],
    peakMonths: 'March-April, September-October', slowMonths: 'July-August, December',
    regulationRisk: 'Medium', regulationNotes: '2-property limit per owner. Registration required.',
    marketTrend: 'Stable â€” film industry and corporate demand provide floor', uniqueSelling: 'Film production capital of the South'
  },
  jacksonville: {
    name: 'Jacksonville, FL', hotelAdrLow: 90, hotelAdrHigh: 180, hotelOcc: 62,
    strAdrLow: 110, strAdrHigh: 180, strOcc: 64,
    colivingLow: 600, colivingHigh: 900, colivingAvg: 750,
    topPlatform: 'Airbnb',
    platformRanking: ['Airbnb', 'Furnished Finder', 'VRBO', 'Zillow Rentals', 'Booking.com'],
    platformNotes: 'Airbnb leads for beach and leisure. Furnished Finder growing with Navy and Mayo Clinic demand.',
    corporateHousing: 'Good. Naval Station Mayport, Mayo Clinic, financial services.',
    nearbyAttractions: ['Jacksonville Beach', 'Atlantic Beach', 'St. Johns Town Center', 'TIAA Bank Field', 'Naval Station Mayport'],
    demandDrivers: ['Beach tourism', 'Navy rotations', 'Mayo Clinic', 'Jaguars games'],
    peakMonths: 'March-July', slowMonths: 'November-January',
    regulationRisk: 'Low', regulationNotes: 'Florida STR-friendly. Registration required.',
    marketTrend: 'Growing â€” affordable beach market with military stability', uniqueSelling: 'Affordable FL beach market with military demand floor'
  },
  charlotte: {
    name: 'Charlotte, NC', hotelAdrLow: 100, hotelAdrHigh: 220, hotelOcc: 65,
    strAdrLow: 125, strAdrHigh: 200, strOcc: 58,
    colivingLow: 725, colivingHigh: 1025, colivingAvg: 875,
    topPlatform: 'Furnished Finder',
    platformRanking: ['Furnished Finder', 'Airbnb', 'VRBO', 'Zillow Rentals', 'Booking.com'],
    platformNotes: 'Furnished Finder dominates due to banking sector corporate relocations.',
    corporateHousing: 'Excellent. Second-largest banking center (Bank of America, Wells Fargo, Truist).',
    nearbyAttractions: ['Bank of America Stadium', 'Spectrum Center', 'Charlotte Motor Speedway', 'NoDa Arts', 'South End'],
    demandDrivers: ['Banking/finance', 'NASCAR', 'Panthers/Hornets', 'Corporate relocations'],
    peakMonths: 'March-May, September-October', slowMonths: 'July-August, December',
    regulationRisk: 'Medium', regulationNotes: 'HOA restrictions common. City registration required.',
    marketTrend: 'Growing â€” tech migration from expensive markets', uniqueSelling: 'Banking capital of the South with steady corporate demand'
  },
  sanantonio: {
    name: 'San Antonio, TX', hotelAdrLow: 85, hotelAdrHigh: 200, hotelOcc: 62,
    strAdrLow: 100, strAdrHigh: 190, strOcc: 60,
    colivingLow: 600, colivingHigh: 900, colivingAvg: 750,
    topPlatform: 'Airbnb',
    platformRanking: ['Airbnb', 'VRBO', 'Furnished Finder', 'Booking.com', 'Zillow Rentals'],
    platformNotes: 'Airbnb leads for Riverwalk tourism. Furnished Finder growing with military demand.',
    corporateHousing: 'Good. Joint Base San Antonio, major hospitals.',
    nearbyAttractions: ['San Antonio Riverwalk', 'The Alamo', 'Pearl District', 'SeaWorld', 'Six Flags Fiesta Texas'],
    demandDrivers: ['Riverwalk tourism', 'Military families (JBSA)', 'Fiesta (Apr)', 'Conventions'],
    peakMonths: 'March-April, October', slowMonths: 'August, January',
    regulationRisk: 'Low', regulationNotes: 'Texas HB 2797 protections apply.',
    marketTrend: 'Growing â€” affordable alternative to Austin', uniqueSelling: 'Riverwalk tourism + military demand = year-round stability'
  },
  denver: {
    name: 'Denver, CO', hotelAdrLow: 110, hotelAdrHigh: 300, hotelOcc: 68,
    strAdrLow: 160, strAdrHigh: 280, strOcc: 64,
    colivingLow: 850, colivingHigh: 1200, colivingAvg: 1000,
    topPlatform: 'VRBO',
    platformRanking: ['VRBO', 'Airbnb', 'Furnished Finder', 'Booking.com', 'Evolve'],
    platformNotes: 'VRBO leads for ski and outdoor group bookings. Airbnb faces primary residence restrictions in Denver proper.',
    corporateHousing: 'Strong. Tech sector (Google, Amazon, Oracle), aerospace. $3,000-$5,000/month.',
    nearbyAttractions: ['Red Rocks Amphitheatre', 'Rocky Mountain National Park', 'Ski resorts', 'RiNo Art District', 'LoDo/Union Station'],
    demandDrivers: ['Ski tourism (Nov-Apr)', 'Red Rocks concerts (May-Oct)', 'Outdoor recreation', 'Tech conferences'],
    peakMonths: 'January-February, June-July', slowMonths: 'April, November',
    regulationRisk: 'High', regulationNotes: 'Denver requires primary residence. Suburbs more permissive.',
    marketTrend: 'Stable â€” strong demand but regulatory challenges', uniqueSelling: 'Gateway to the Rockies with dual-season tourism'
  }
};

function getMarketKey(city: string, state: string): string | null {
  const cl = (city || '').toLowerCase().replace(/[^a-z]/g, '');
  const sl = (state || '').toLowerCase().replace(/[^a-z]/g, '');
  if (MARKET_DATA[cl]) return cl;
  for (const [key, data] of Object.entries(MARKET_DATA)) {
    const mc = data.name.split(',')[0].toLowerCase().replace(/[^a-z]/g, '');
    if (cl.includes(mc) || mc.includes(cl)) return key;
  }
  if (cl.includes('san') && cl.includes('antonio')) return 'sanantonio';
  if (cl.includes('fort') || cl.includes('worth')) return 'dallas';
  if (sl === 'tx' || sl === 'texas') return 'dallas';
  if (sl === 'fl' || sl === 'florida') return 'tampa';
  if (sl === 'ga' || sl === 'georgia') return 'atlanta';
  if (sl === 'nc') return 'charlotte';
  if (sl === 'tn' || sl === 'tennessee') return 'nashville';
  if (sl === 'az' || sl === 'arizona') return 'phoenix';
  if (sl === 'co' || sl === 'colorado') return 'denver';
  return null;
}

// Generate a fallback description using market data without AI
function generateFallbackDescription(params: any, market: any): string {
  const { city, state, bedrooms, bathrooms, monthly_rent, operation_type, staff_name } = params;
  const opLabel = operation_type === 'coliving' ? 'Co-Living' : operation_type === 'mtr' ? 'Mid-Term Rental' : 'Short-Term Rental';
  
  let desc = `${city}, ${state} â€” ${opLabel} Opportunity\n\n`;
  desc += `This ${bedrooms || 3}-bedroom, ${bathrooms || 2}-bathroom property in ${city}, ${state} presents a compelling investment opportunity for rental arbitrage investors.\n\n`;
  
  if (market) {
    desc += `LOCATION & MARKET APPEAL\n`;
    desc += `${city} is a ${market.marketTrend.toLowerCase()} market with ${market.uniqueSelling.toLowerCase()}. `;
    desc += `Key demand drivers include ${market.demandDrivers.slice(0, 3).join(', ')}. `;
    desc += `Nearby attractions such as ${market.nearbyAttractions.slice(0, 4).join(', ')} keep visitor demand strong year-round.\n\n`;
    
    desc += `RATE COMPARISON â€” WHY THIS WORKS\n`;
    desc += `Hotels in ${city} charge $${market.hotelAdrLow}-$${market.hotelAdrHigh}/night at ${market.hotelOcc}% occupancy. `;
    desc += `A fully furnished apartment can command $${market.strAdrLow}-$${market.strAdrHigh}/night â€” offering guests more space, a full kitchen, and a home-like experience at competitive rates.\n\n`;
    
    desc += `PLATFORM STRATEGY\n`;
    desc += `The top-performing platform in ${city} is ${market.topPlatform}. ${market.platformNotes} `;
    desc += `We recommend listing on: ${market.platformRanking.slice(0, 3).join(', ')} to maximize exposure and bookings.\n\n`;
    
    if (operation_type === 'coliving') {
      desc += `CO-LIVING ANALYSIS\n`;
      desc += `Room rates in ${city} range from $${market.colivingLow}-$${market.colivingHigh}/month (avg $${market.colivingAvg}). `;
      desc += `With ${bedrooms || 3} bedrooms at average rates, projected monthly gross is $${(market.colivingAvg * (parseInt(bedrooms) || 3)).toLocaleString()}. `;
      desc += `Co-living works here because of steady demand from young professionals, travel nurses, and corporate contractors.\n\n`;
    }
    
    desc += `CORPORATE HOUSING\n`;
    desc += `${market.corporateHousing}\n\n`;
    
    desc += `SEASONALITY\n`;
    desc += `Peak: ${market.peakMonths}. Slow: ${market.slowMonths}. Regulation risk: ${market.regulationRisk}.\n\n`;
  }
  
  if (monthly_rent) {
    desc += `At $${parseFloat(monthly_rent).toLocaleString()}/month rent, this property offers strong margin potential for the right investor.\n\n`;
  }
  
  if (staff_name) {
    desc += `This deal was researched and sourced by ${staff_name}, who identified the unique value this location brings to our investor community.\n\n`;
  }
  
  desc += `Ready to secure this opportunity? Contact your Acquisition Manager to get started.`;
  return desc;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { address, city, state, zip_code, bedrooms, bathrooms, monthly_rent, property_type, operation_type, listing_title, acquisition_fee, is_furnished, internal_notes, penny_score, adr_peak_season, adr_slow_season, monthly_room_rate, avg_occupancy_rate, peak_season_description, staff_name, description } = body;

    const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY');
    const marketKey = getMarketKey(city, state);
    const market = marketKey ? MARKET_DATA[marketKey] : null;

    // If no API key, use fallback description generator
    if (!gatewayApiKey) {
      console.warn('[penny-desc] No GATEWAY_API_KEY, using fallback generator');
      const fallbackDesc = generateFallbackDescription(body, market);
      return new Response(JSON.stringify({
        success: true,
        description: fallbackDesc,
        market_data: market ? {
          name: market.name, top_platform: market.topPlatform,
          platform_ranking: market.platformRanking,
          hotel_adr: `$${market.hotelAdrLow}-$${market.hotelAdrHigh}`,
          str_adr: `$${market.strAdrLow}-$${market.strAdrHigh}`,
          coliving_avg: `$${market.colivingAvg}/room`,
          regulation_risk: market.regulationRisk,
          market_trend: market.marketTrend
        } : null,
        source: 'fallback'
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let marketContext = '';
    if (market) {
      marketContext = `
VERIFIED MARKET DATA FOR ${market.name}:
- Hotel ADR: $${market.hotelAdrLow}-$${market.hotelAdrHigh}/night (${market.hotelOcc}% occupancy)
- STR ADR: $${market.strAdrLow}-$${market.strAdrHigh}/night (${market.strOcc}% occupancy)
- Co-Living Room Rate: $${market.colivingLow}-$${market.colivingHigh}/month (avg $${market.colivingAvg})
- Top Platform: ${market.topPlatform}
- Platform Ranking: ${market.platformRanking.join(' > ')}
- Platform Notes: ${market.platformNotes}
- Corporate Housing: ${market.corporateHousing}
- Nearby Attractions: ${market.nearbyAttractions.join(', ')}
- Demand Drivers: ${market.demandDrivers.join(', ')}
- Peak: ${market.peakMonths} | Slow: ${market.slowMonths}
- Regulation: ${market.regulationRisk} â€” ${market.regulationNotes}
- Trend: ${market.marketTrend}
- Unique: ${market.uniqueSelling}`;
    } else {
      marketContext = `Market: ${city}, ${state} â€” Use general rental arbitrage knowledge.`;
    }

    const opType = operation_type === 'coliving' ? 'Co-Living' : operation_type === 'str' ? 'Short-Term Rental (STR)' : operation_type === 'mtr' ? 'Mid-Term Rental (MTR)' : operation_type === 'peerspace' ? 'Peer Space / Event Venue' : operation_type === 'both' ? 'Multiple Strategies' : 'Short-Term Rental';

    const propertyContext = `
PROPERTY:
- Location: ${address ? address + ', ' : ''}${city}, ${state} ${zip_code || ''}
- Type: ${(property_type || 'single_family').replace(/_/g, ' ')}
- Bedrooms: ${bedrooms || 3} | Bathrooms: ${bathrooms || 2}
- Rent: $${monthly_rent || 'TBD'}/mo | Operation: ${opType} | Furnished: ${is_furnished ? 'Yes' : 'No'}
- Acquisition Fee: $${acquisition_fee || 'TBD'}
${penny_score ? `- Penny Score: ${penny_score}/100` : ''}
${adr_peak_season ? `- Peak ADR: $${adr_peak_season}` : ''}${adr_slow_season ? ` | Slow ADR: $${adr_slow_season}` : ''}
${monthly_room_rate ? `- Room Rate: $${monthly_room_rate}/mo` : ''}${avg_occupancy_rate ? ` | Occupancy: ${avg_occupancy_rate}%` : ''}
${peak_season_description ? `- Peak Season: ${peak_season_description}` : ''}
${internal_notes ? `- Research Notes: ${internal_notes}` : ''}
${staff_name ? `- Listed by: ${staff_name} (Acquisition Manager)` : ''}
${description ? `- Current Description: ${description}` : ''}`;

    const systemPrompt = `You are Penny, AI Success Manager at Access Your Place (AYP), a rental arbitrage platform by Set Up Your Place LLC. Write an investor-focused property listing description.

RULES:
1. INVESTOR-FOCUSED tone â€” speak to someone maximizing ROI
2. Be COMPELLING and SPECIFIC with real market data
3. ALWAYS mention what makes this location a winning attraction
4. ALWAYS compare hotel rates vs furnished apartment rates â€” show the value gap
5. ALWAYS recommend specific platforms and WHY â€” top platform is NOT always Airbnb. Be transparent.
6. If Airbnb is NOT #1, explicitly say so and explain why the recommended platform outperforms
7. For co-living: include room rate ranges (low/high/avg) and explain why co-living works
8. For STR: mention highest performing platform and what drives bookings
9. ALWAYS discuss corporate month-to-month housing potential
10. Mention nearby attractions driving demand
11. Compliment the acquisition manager's research
12. Include regulation risk level
13. End with clear investor call-to-action
14. 300-500 words, professional formatting with clear sections
15. NO emoji, NO markdown headers (##), use plain text with line breaks
16. Confident, knowledgeable, trust-building tone`;

    const userPrompt = `Write a compelling investor-focused listing description:

${propertyContext}
${marketContext}

Include: location appeal, hotel vs apartment rate comparison, best platforms (not just Airbnb), ${operation_type === 'coliving' ? 'co-living room rate analysis' : 'top OTA platform analysis'}, corporate housing potential, nearby attractions, AM acknowledgment, regulation context, investor CTA.`;

    // Attempt AI generation with timeout and retry
    let generatedDescription = '';
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts && !generatedDescription) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        console.log(`[penny-desc] AI attempt ${attempts}/${maxAttempts}...`);
        const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': gatewayApiKey },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            temperature: 0.75,
            max_tokens: 2000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown error');
          console.error(`[penny-desc] AI Gateway ${response.status}:`, errText.substring(0, 200));
          if (attempts >= maxAttempts) break;
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          continue;
        }

        const data = await response.json();
        generatedDescription = data?.choices?.[0]?.message?.content || '';
        if (generatedDescription) {
          console.log(`[penny-desc] AI success on attempt ${attempts}, ${generatedDescription.length} chars`);
        }
      } catch (fetchErr: any) {
        console.error(`[penny-desc] Fetch attempt ${attempts} failed:`, fetchErr.name, fetchErr.message);
        if (fetchErr.name === 'AbortError') {
          console.error('[penny-desc] Request timed out');
        }
        if (attempts >= maxAttempts) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // If AI failed, use fallback
    if (!generatedDescription) {
      console.warn('[penny-desc] AI failed after retries, using fallback generator');
      generatedDescription = generateFallbackDescription(body, market);
    }

    return new Response(JSON.stringify({
      success: true,
      description: generatedDescription,
      market_data: market ? {
        name: market.name, top_platform: market.topPlatform,
        platform_ranking: market.platformRanking,
        hotel_adr: `$${market.hotelAdrLow}-$${market.hotelAdrHigh}`,
        str_adr: `$${market.strAdrLow}-$${market.strAdrHigh}`,
        coliving_avg: `$${market.colivingAvg}/room`,
        regulation_risk: market.regulationRisk,
        market_trend: market.marketTrend
      } : null
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('[penny-desc] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Description generation failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

