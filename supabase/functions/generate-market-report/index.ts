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

// Comprehensive static market data for 20+ major STR markets
const marketDatabase: Record<string, any> = {
  'austin': {
    market_name: 'Austin, TX',
    market_overview: {
      population: '2.3 million (metro)',
      population_growth: '+2.8% annually',
      major_employers: ['Tesla', 'Apple', 'Google', 'Meta', 'Dell', 'Oracle'],
      economic_outlook: 'Strong tech-driven economy with continued growth expected'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$534 annually',
      restrictions: ['Type 2 STR license required for non-owner occupied', 'Density limits in some areas', 'Noise ordinances enforced'],
      notes: 'Regulations have tightened but still viable for experienced operators'
    },
    rental_data: {
      avg_rent_1br: '$1,650',
      avg_rent_2br: '$2,100',
      avg_rent_3br: '$2,800',
      avg_rent_4br: '$3,500',
      yoy_rent_change: '+3.2%',
      vacancy_rate: '6.8%'
    },
    str_performance: {
      avg_daily_rate: '$245',
      avg_occupancy: '68%',
      avg_monthly_revenue: '$5,000',
      peak_season: 'March-May (SXSW, ACL)',
      low_season: 'January-February',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '12,500+',
      professional_hosts_pct: '45%',
      avg_reviews: '4.7',
      market_saturation: 'Medium-High',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.5,
    recommendation: 'Buy'
  },
  'nashville': {
    market_name: 'Nashville, TN',
    market_overview: {
      population: '1.9 million (metro)',
      population_growth: '+2.1% annually',
      major_employers: ['HCA Healthcare', 'Nissan', 'Amazon', 'AllianceBernstein'],
      economic_outlook: 'Tourism and healthcare driving strong growth'
    },
    str_regulations: {
      status: 'Restrictive',
      permit_required: true,
      permit_cost: '$313 annually',
      restrictions: ['Non-owner occupied banned in most residential zones', 'Owner-occupied permits limited', 'Strict enforcement'],
      notes: 'Focus on owner-occupied or commercial zones only'
    },
    rental_data: {
      avg_rent_1br: '$1,550',
      avg_rent_2br: '$1,900',
      avg_rent_3br: '$2,400',
      avg_rent_4br: '$3,100',
      yoy_rent_change: '+4.1%',
      vacancy_rate: '5.9%'
    },
    str_performance: {
      avg_daily_rate: '$275',
      avg_occupancy: '72%',
      avg_monthly_revenue: '$5,940',
      peak_season: 'April-October',
      low_season: 'January-February',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '8,000+',
      professional_hosts_pct: '55%',
      avg_reviews: '4.8',
      market_saturation: 'High',
      entry_difficulty: 'Difficult'
    },
    investment_score: 6.5,
    recommendation: 'Hold'
  },
  'tampa': {
    market_name: 'Tampa, FL',
    market_overview: {
      population: '3.2 million (metro)',
      population_growth: '+1.9% annually',
      major_employers: ['BayCare Health', 'Publix', 'Raymond James', 'USAA'],
      economic_outlook: 'Strong population influx from Northeast, growing tech sector'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$150-300 annually',
      restrictions: ['Business tax receipt required', 'Tourist development tax collection', 'Some HOA restrictions'],
      notes: 'Generally STR-friendly environment with reasonable regulations'
    },
    rental_data: {
      avg_rent_1br: '$1,700',
      avg_rent_2br: '$2,100',
      avg_rent_3br: '$2,600',
      avg_rent_4br: '$3,200',
      yoy_rent_change: '+5.2%',
      vacancy_rate: '5.5%'
    },
    str_performance: {
      avg_daily_rate: '$195',
      avg_occupancy: '74%',
      avg_monthly_revenue: '$4,329',
      peak_season: 'December-April',
      low_season: 'August-September',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '15,000+',
      professional_hosts_pct: '40%',
      avg_reviews: '4.6',
      market_saturation: 'Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 8.0,
    recommendation: 'Buy'
  },
  'phoenix': {
    market_name: 'Phoenix, AZ',
    market_overview: {
      population: '4.9 million (metro)',
      population_growth: '+1.7% annually',
      major_employers: ['Banner Health', 'Intel', 'Amazon', 'Honeywell'],
      economic_outlook: 'Continued migration from California, diverse economy'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$250 annually',
      restrictions: ['State law preempts local bans', 'Transaction privilege tax required', 'Some HOA restrictions'],
      notes: 'Arizona is one of the most STR-friendly states'
    },
    rental_data: {
      avg_rent_1br: '$1,450',
      avg_rent_2br: '$1,750',
      avg_rent_3br: '$2,200',
      avg_rent_4br: '$2,800',
      yoy_rent_change: '+2.8%',
      vacancy_rate: '7.2%'
    },
    str_performance: {
      avg_daily_rate: '$185',
      avg_occupancy: '71%',
      avg_monthly_revenue: '$3,940',
      peak_season: 'January-April (Spring Training)',
      low_season: 'June-August',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '18,000+',
      professional_hosts_pct: '38%',
      avg_reviews: '4.5',
      market_saturation: 'Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.8,
    recommendation: 'Buy'
  },
  'denver': {
    market_name: 'Denver, CO',
    market_overview: {
      population: '2.9 million (metro)',
      population_growth: '+1.4% annually',
      major_employers: ['Lockheed Martin', 'Ball Corporation', 'DaVita', 'Arrow Electronics'],
      economic_outlook: 'Strong outdoor tourism and tech sector'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$100-500 annually',
      restrictions: ['Primary residence requirement in Denver proper', 'Lodgers tax required', 'Some neighborhood restrictions'],
      notes: 'Consider suburbs for non-owner occupied options'
    },
    rental_data: {
      avg_rent_1br: '$1,750',
      avg_rent_2br: '$2,200',
      avg_rent_3br: '$2,900',
      avg_rent_4br: '$3,600',
      yoy_rent_change: '+1.9%',
      vacancy_rate: '6.1%'
    },
    str_performance: {
      avg_daily_rate: '$225',
      avg_occupancy: '65%',
      avg_monthly_revenue: '$4,388',
      peak_season: 'June-August, December-March',
      low_season: 'April-May, October-November',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '9,500+',
      professional_hosts_pct: '42%',
      avg_reviews: '4.7',
      market_saturation: 'Medium-High',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.0,
    recommendation: 'Hold'
  },
  'atlanta': {
    market_name: 'Atlanta, GA',
    market_overview: {
      population: '6.1 million (metro)',
      population_growth: '+1.5% annually',
      major_employers: ['Delta Air Lines', 'Coca-Cola', 'Home Depot', 'UPS'],
      economic_outlook: 'Major business hub with diverse economy'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$150 annually',
      restrictions: ['Hotel/motel tax collection required', 'Some neighborhood associations restrict', 'Business license needed'],
      notes: 'Generally permissive environment for STRs'
    },
    rental_data: {
      avg_rent_1br: '$1,600',
      avg_rent_2br: '$1,950',
      avg_rent_3br: '$2,400',
      avg_rent_4br: '$3,000',
      yoy_rent_change: '+3.5%',
      vacancy_rate: '6.5%'
    },
    str_performance: {
      avg_daily_rate: '$175',
      avg_occupancy: '69%',
      avg_monthly_revenue: '$3,622',
      peak_season: 'March-May, September-November',
      low_season: 'January-February',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '11,000+',
      professional_hosts_pct: '35%',
      avg_reviews: '4.5',
      market_saturation: 'Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.5,
    recommendation: 'Buy'
  },
  'charlotte': {
    market_name: 'Charlotte, NC',
    market_overview: {
      population: '2.7 million (metro)',
      population_growth: '+2.0% annually',
      major_employers: ['Bank of America', 'Wells Fargo', 'Duke Energy', 'Lowes'],
      economic_outlook: 'Major banking hub with strong job growth'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$200 annually',
      restrictions: ['Occupancy tax required', 'Some zoning restrictions', 'HOA rules may apply'],
      notes: 'Business-friendly environment for STR operators'
    },
    rental_data: {
      avg_rent_1br: '$1,500',
      avg_rent_2br: '$1,800',
      avg_rent_3br: '$2,300',
      avg_rent_4br: '$2,900',
      yoy_rent_change: '+4.2%',
      vacancy_rate: '5.8%'
    },
    str_performance: {
      avg_daily_rate: '$165',
      avg_occupancy: '67%',
      avg_monthly_revenue: '$3,316',
      peak_season: 'March-May, September-November',
      low_season: 'January-February',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '5,500+',
      professional_hosts_pct: '32%',
      avg_reviews: '4.6',
      market_saturation: 'Low-Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.8,
    recommendation: 'Buy'
  },
  'orlando': {
    market_name: 'Orlando, FL',
    market_overview: {
      population: '2.7 million (metro)',
      population_growth: '+2.3% annually',
      major_employers: ['Walt Disney World', 'Universal Orlando', 'Lockheed Martin', 'AdventHealth'],
      economic_outlook: 'Tourism-driven economy with year-round demand'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$150-250 annually',
      restrictions: ['Tourist development tax required', 'Some resort zoning areas', 'HOA restrictions common'],
      notes: 'Excellent for vacation rentals near attractions'
    },
    rental_data: {
      avg_rent_1br: '$1,600',
      avg_rent_2br: '$1,950',
      avg_rent_3br: '$2,400',
      avg_rent_4br: '$3,000',
      yoy_rent_change: '+4.8%',
      vacancy_rate: '5.2%'
    },
    str_performance: {
      avg_daily_rate: '$210',
      avg_occupancy: '76%',
      avg_monthly_revenue: '$4,788',
      peak_season: 'March-April, June-August, December',
      low_season: 'September-October',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '22,000+',
      professional_hosts_pct: '52%',
      avg_reviews: '4.6',
      market_saturation: 'High',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.5,
    recommendation: 'Buy'
  },
  'san diego': {
    market_name: 'San Diego, CA',
    market_overview: {
      population: '3.3 million (metro)',
      population_growth: '+0.8% annually',
      major_employers: ['Qualcomm', 'UC San Diego', 'Sharp Healthcare', 'Northrop Grumman', 'General Atomics'],
      economic_outlook: 'Strong biotech and defense sectors, year-round tourism appeal'
    },
    str_regulations: {
      status: 'Restrictive',
      permit_required: true,
      permit_cost: '$1,000+ annually',
      restrictions: ['Mission Beach has lottery system', 'Whole-home rentals limited to 20 days/year in most zones', 'Hosted rentals allowed', 'Strict enforcement with fines'],
      notes: 'Very challenging for non-owner occupied STRs. Focus on hosted rentals or commercial zones.'
    },
    rental_data: {
      avg_rent_1br: '$2,400',
      avg_rent_2br: '$3,100',
      avg_rent_3br: '$4,200',
      avg_rent_4br: '$5,500',
      yoy_rent_change: '+2.1%',
      vacancy_rate: '4.2%'
    },
    str_performance: {
      avg_daily_rate: '$295',
      avg_occupancy: '72%',
      avg_monthly_revenue: '$6,372',
      peak_season: 'June-September, December',
      low_season: 'January-February',
      revenue_potential: 'Very High (if permitted)'
    },
    competition_analysis: {
      total_listings: '8,500+',
      professional_hosts_pct: '48%',
      avg_reviews: '4.7',
      market_saturation: 'High',
      entry_difficulty: 'Very Difficult'
    },
    investment_score: 5.5,
    recommendation: 'Hold'
  },
  'seattle': {
    market_name: 'Seattle, WA',
    market_overview: {
      population: '4.0 million (metro)',
      population_growth: '+1.2% annually',
      major_employers: ['Amazon', 'Microsoft', 'Boeing', 'Starbucks', 'Costco'],
      economic_outlook: 'Tech-driven economy with strong fundamentals despite recent layoffs'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$75-175 annually',
      restrictions: ['Primary residence requirement for most operators', 'Platform accountability law', 'Business license required', 'Lodging tax collection'],
      notes: 'Arbitrage viable with landlord permission. Consider Bellevue and Tacoma suburbs.'
    },
    rental_data: {
      avg_rent_1br: '$2,100',
      avg_rent_2br: '$2,800',
      avg_rent_3br: '$3,600',
      avg_rent_4br: '$4,500',
      yoy_rent_change: '+1.5%',
      vacancy_rate: '6.8%'
    },
    str_performance: {
      avg_daily_rate: '$215',
      avg_occupancy: '64%',
      avg_monthly_revenue: '$4,128',
      peak_season: 'June-September',
      low_season: 'November-February',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '7,200+',
      professional_hosts_pct: '38%',
      avg_reviews: '4.6',
      market_saturation: 'Medium',
      entry_difficulty: 'Moderate'
    },
    investment_score: 6.8,
    recommendation: 'Hold'
  },
  'miami': {
    market_name: 'Miami, FL',
    market_overview: {
      population: '6.2 million (metro)',
      population_growth: '+1.6% annually',
      major_employers: ['Carnival Cruise', 'Royal Caribbean', 'Baptist Health', 'FedEx', 'American Airlines'],
      economic_outlook: 'International gateway with strong tourism, finance, and tech growth'
    },
    str_regulations: {
      status: 'Varies by Area',
      permit_required: true,
      permit_cost: '$200-500 annually',
      restrictions: ['Miami Beach has strict 6-month minimum in many zones', 'Condo associations often restrict', 'Resort tax collection required', 'Enforcement varies by neighborhood'],
      notes: 'Focus on STR-friendly buildings and unincorporated Miami-Dade areas'
    },
    rental_data: {
      avg_rent_1br: '$2,300',
      avg_rent_2br: '$3,000',
      avg_rent_3br: '$4,000',
      avg_rent_4br: '$5,200',
      yoy_rent_change: '+3.8%',
      vacancy_rate: '5.1%'
    },
    str_performance: {
      avg_daily_rate: '$285',
      avg_occupancy: '75%',
      avg_monthly_revenue: '$6,412',
      peak_season: 'December-April, Art Basel week',
      low_season: 'September-October',
      revenue_potential: 'Very High'
    },
    competition_analysis: {
      total_listings: '25,000+',
      professional_hosts_pct: '58%',
      avg_reviews: '4.5',
      market_saturation: 'Very High',
      entry_difficulty: 'Moderate-Difficult'
    },
    investment_score: 7.2,
    recommendation: 'Buy'
  },
  'las vegas': {
    market_name: 'Las Vegas, NV',
    market_overview: {
      population: '2.3 million (metro)',
      population_growth: '+2.5% annually',
      major_employers: ['MGM Resorts', 'Caesars Entertainment', 'Wynn Resorts', 'Station Casinos', 'Amazon'],
      economic_outlook: 'Tourism recovery strong, F1 and sports events driving new demand'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$500-1,000 annually',
      restrictions: ['1,000 ft distance requirement between STRs', 'Business license required', 'Transient lodging tax', 'HOA restrictions common'],
      notes: 'Limited permits available. Focus on unincorporated Clark County or Henderson.'
    },
    rental_data: {
      avg_rent_1br: '$1,350',
      avg_rent_2br: '$1,650',
      avg_rent_3br: '$2,100',
      avg_rent_4br: '$2,700',
      yoy_rent_change: '+4.5%',
      vacancy_rate: '6.2%'
    },
    str_performance: {
      avg_daily_rate: '$225',
      avg_occupancy: '68%',
      avg_monthly_revenue: '$4,590',
      peak_season: 'March-May, October-December (conventions, events)',
      low_season: 'July-August',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '9,800+',
      professional_hosts_pct: '45%',
      avg_reviews: '4.5',
      market_saturation: 'Medium-High',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.3,
    recommendation: 'Buy'
  },
  'san antonio': {
    market_name: 'San Antonio, TX',
    market_overview: {
      population: '2.6 million (metro)',
      population_growth: '+1.8% annually',
      major_employers: ['USAA', 'H-E-B', 'Valero Energy', 'Frost Bank', 'Joint Base San Antonio'],
      economic_outlook: 'Steady growth with military, healthcare, and tourism sectors'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$100-200 annually',
      restrictions: ['Hotel occupancy tax required', 'Some historic district restrictions', 'Business registration needed'],
      notes: 'One of the most STR-friendly major Texas cities'
    },
    rental_data: {
      avg_rent_1br: '$1,200',
      avg_rent_2br: '$1,500',
      avg_rent_3br: '$1,900',
      avg_rent_4br: '$2,400',
      yoy_rent_change: '+3.9%',
      vacancy_rate: '7.1%'
    },
    str_performance: {
      avg_daily_rate: '$155',
      avg_occupancy: '66%',
      avg_monthly_revenue: '$3,069',
      peak_season: 'March-April (Fiesta), October-November',
      low_season: 'January-February, August',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '6,200+',
      professional_hosts_pct: '30%',
      avg_reviews: '4.6',
      market_saturation: 'Low-Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.6,
    recommendation: 'Buy'
  },
  'dallas': {
    market_name: 'Dallas, TX',
    market_overview: {
      population: '7.6 million (metro)',
      population_growth: '+1.9% annually',
      major_employers: ['AT&T', 'American Airlines', 'Texas Instruments', 'Southwest Airlines', 'Toyota'],
      economic_outlook: 'Corporate relocations continue, diverse economy with strong growth'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$300-500 annually',
      restrictions: ['Registration required', 'Hotel occupancy tax', 'Some neighborhood restrictions', 'Noise ordinances'],
      notes: 'Regulations vary by suburb. Frisco, Plano, and McKinney have different rules.'
    },
    rental_data: {
      avg_rent_1br: '$1,500',
      avg_rent_2br: '$1,900',
      avg_rent_3br: '$2,500',
      avg_rent_4br: '$3,200',
      yoy_rent_change: '+3.1%',
      vacancy_rate: '6.4%'
    },
    str_performance: {
      avg_daily_rate: '$175',
      avg_occupancy: '65%',
      avg_monthly_revenue: '$3,412',
      peak_season: 'March-May, September-November',
      low_season: 'January-February, July-August',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '14,000+',
      professional_hosts_pct: '40%',
      avg_reviews: '4.5',
      market_saturation: 'Medium',
      entry_difficulty: 'Easy-Moderate'
    },
    investment_score: 7.4,
    recommendation: 'Buy'
  },
  'houston': {
    market_name: 'Houston, TX',
    market_overview: {
      population: '7.2 million (metro)',
      population_growth: '+1.5% annually',
      major_employers: ['ExxonMobil', 'Shell', 'Memorial Hermann', 'MD Anderson', 'NASA'],
      economic_outlook: 'Energy sector diversifying, strong medical center demand'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: false,
      permit_cost: 'N/A (no permit required)',
      restrictions: ['Hotel occupancy tax collection required', 'HOA restrictions may apply', 'No city-wide STR regulations'],
      notes: 'One of the most permissive major US cities for STRs'
    },
    rental_data: {
      avg_rent_1br: '$1,350',
      avg_rent_2br: '$1,700',
      avg_rent_3br: '$2,200',
      avg_rent_4br: '$2,800',
      yoy_rent_change: '+2.8%',
      vacancy_rate: '7.5%'
    },
    str_performance: {
      avg_daily_rate: '$145',
      avg_occupancy: '62%',
      avg_monthly_revenue: '$2,697',
      peak_season: 'February-April (Rodeo), September-November',
      low_season: 'June-August',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '12,500+',
      professional_hosts_pct: '35%',
      avg_reviews: '4.4',
      market_saturation: 'Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.2,
    recommendation: 'Buy'
  },
  'scottsdale': {
    market_name: 'Scottsdale, AZ',
    market_overview: {
      population: '260,000 (city), 4.9M (Phoenix metro)',
      population_growth: '+2.1% annually',
      major_employers: ['Mayo Clinic', 'CVS Health', 'Vanguard', 'General Dynamics'],
      economic_outlook: 'Luxury tourism and retiree destination with strong demand'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$250 annually',
      restrictions: ['State preemption protects STRs', 'Transaction privilege tax', 'HOA restrictions common in some areas'],
      notes: 'Arizona state law prevents local STR bans. Very favorable environment.'
    },
    rental_data: {
      avg_rent_1br: '$1,800',
      avg_rent_2br: '$2,400',
      avg_rent_3br: '$3,200',
      avg_rent_4br: '$4,500',
      yoy_rent_change: '+3.5%',
      vacancy_rate: '5.8%'
    },
    str_performance: {
      avg_daily_rate: '$295',
      avg_occupancy: '72%',
      avg_monthly_revenue: '$6,372',
      peak_season: 'January-April (Spring Training, golf)',
      low_season: 'June-August',
      revenue_potential: 'Very High'
    },
    competition_analysis: {
      total_listings: '5,500+',
      professional_hosts_pct: '52%',
      avg_reviews: '4.7',
      market_saturation: 'Medium-High',
      entry_difficulty: 'Moderate'
    },
    investment_score: 8.2,
    recommendation: 'Buy'
  },
  'savannah': {
    market_name: 'Savannah, GA',
    market_overview: {
      population: '400,000 (metro)',
      population_growth: '+1.4% annually',
      major_employers: ['Gulfstream Aerospace', 'Memorial Health', 'Georgia Ports Authority', 'SCAD'],
      economic_outlook: 'Growing tourism, port expansion, and film industry presence'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$300-500 annually',
      restrictions: ['Historic district has caps on permits', 'Zoning restrictions apply', 'Hotel/motel tax required'],
      notes: 'Limited permits in historic district. Consider Victorian District or suburbs.'
    },
    rental_data: {
      avg_rent_1br: '$1,400',
      avg_rent_2br: '$1,700',
      avg_rent_3br: '$2,100',
      avg_rent_4br: '$2,600',
      yoy_rent_change: '+4.8%',
      vacancy_rate: '5.5%'
    },
    str_performance: {
      avg_daily_rate: '$225',
      avg_occupancy: '71%',
      avg_monthly_revenue: '$4,792',
      peak_season: 'March-May, October (St. Patricks Day)',
      low_season: 'January-February, August',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '3,200+',
      professional_hosts_pct: '42%',
      avg_reviews: '4.7',
      market_saturation: 'Medium',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.6,
    recommendation: 'Buy'
  },
  'charleston': {
    market_name: 'Charleston, SC',
    market_overview: {
      population: '820,000 (metro)',
      population_growth: '+2.2% annually',
      major_employers: ['Boeing', 'MUSC Health', 'Volvo', 'Mercedes-Benz Vans'],
      economic_outlook: 'Strong tourism, manufacturing growth, and quality of life migration'
    },
    str_regulations: {
      status: 'Restrictive',
      permit_required: true,
      permit_cost: '$500+ annually',
      restrictions: ['Downtown peninsula has strict limits', 'Owner-occupancy requirements in some zones', 'Accommodation tax required'],
      notes: 'Focus on West Ashley, Mount Pleasant, or North Charleston for easier entry.'
    },
    rental_data: {
      avg_rent_1br: '$1,700',
      avg_rent_2br: '$2,200',
      avg_rent_3br: '$2,800',
      avg_rent_4br: '$3,500',
      yoy_rent_change: '+4.1%',
      vacancy_rate: '5.2%'
    },
    str_performance: {
      avg_daily_rate: '$265',
      avg_occupancy: '70%',
      avg_monthly_revenue: '$5,565',
      peak_season: 'March-May, September-November',
      low_season: 'January-February',
      revenue_potential: 'High'
    },
    competition_analysis: {
      total_listings: '4,800+',
      professional_hosts_pct: '48%',
      avg_reviews: '4.8',
      market_saturation: 'High',
      entry_difficulty: 'Difficult'
    },
    investment_score: 6.8,
    recommendation: 'Hold'
  },
  'new orleans': {
    market_name: 'New Orleans, LA',
    market_overview: {
      population: '1.3 million (metro)',
      population_growth: '+0.5% annually',
      major_employers: ['Ochsner Health', 'Entergy', 'Tulane University', 'Port of New Orleans'],
      economic_outlook: 'Tourism-dependent economy recovering, strong cultural appeal'
    },
    str_regulations: {
      status: 'Restrictive',
      permit_required: true,
      permit_cost: '$500-1,000 annually',
      restrictions: ['French Quarter has strict limits', 'Residential STRs capped at 90 days/year', 'Commercial license needed for full-time', 'Platform accountability'],
      notes: 'Very challenging regulatory environment. Focus on commercial zones or hosted rentals.'
    },
    rental_data: {
      avg_rent_1br: '$1,400',
      avg_rent_2br: '$1,750',
      avg_rent_3br: '$2,200',
      avg_rent_4br: '$2,800',
      yoy_rent_change: '+3.2%',
      vacancy_rate: '7.8%'
    },
    str_performance: {
      avg_daily_rate: '$195',
      avg_occupancy: '65%',
      avg_monthly_revenue: '$3,802',
      peak_season: 'February (Mardi Gras), April-May, October',
      low_season: 'June-August',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '6,500+',
      professional_hosts_pct: '40%',
      avg_reviews: '4.6',
      market_saturation: 'High',
      entry_difficulty: 'Difficult'
    },
    investment_score: 6.0,
    recommendation: 'Hold'
  },
  'portland': {
    market_name: 'Portland, OR',
    market_overview: {
      population: '2.5 million (metro)',
      population_growth: '+0.9% annually',
      major_employers: ['Intel', 'Nike', 'Providence Health', 'OHSU', 'Columbia Sportswear'],
      economic_outlook: 'Tech and outdoor recreation hub, recovering from pandemic impacts'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$180 annually',
      restrictions: ['Primary residence requirement', 'Accessory dwelling units allowed', 'Transient lodging tax', 'Safety inspections required'],
      notes: 'Arbitrage possible with landlord permission. Consider Vancouver, WA suburbs.'
    },
    rental_data: {
      avg_rent_1br: '$1,600',
      avg_rent_2br: '$2,000',
      avg_rent_3br: '$2,600',
      avg_rent_4br: '$3,300',
      yoy_rent_change: '+1.8%',
      vacancy_rate: '6.5%'
    },
    str_performance: {
      avg_daily_rate: '$175',
      avg_occupancy: '63%',
      avg_monthly_revenue: '$3,307',
      peak_season: 'June-September',
      low_season: 'November-February',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '5,800+',
      professional_hosts_pct: '35%',
      avg_reviews: '4.6',
      market_saturation: 'Medium',
      entry_difficulty: 'Moderate'
    },
    investment_score: 6.5,
    recommendation: 'Hold'
  },
  'raleigh': {
    market_name: 'Raleigh, NC',
    market_overview: {
      population: '1.5 million (metro)',
      population_growth: '+2.5% annually',
      major_employers: ['Duke University', 'NC State', 'Cisco', 'IBM', 'SAS Institute'],
      economic_outlook: 'Research Triangle driving strong tech and biotech growth'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$100-200 annually',
      restrictions: ['Occupancy tax required', 'Some HOA restrictions', 'Business registration needed'],
      notes: 'Generally permissive environment. Durham and Chapel Hill have similar rules.'
    },
    rental_data: {
      avg_rent_1br: '$1,450',
      avg_rent_2br: '$1,750',
      avg_rent_3br: '$2,200',
      avg_rent_4br: '$2,800',
      yoy_rent_change: '+4.5%',
      vacancy_rate: '5.8%'
    },
    str_performance: {
      avg_daily_rate: '$155',
      avg_occupancy: '66%',
      avg_monthly_revenue: '$3,069',
      peak_season: 'March-May, September-November',
      low_season: 'January-February',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '4,200+',
      professional_hosts_pct: '32%',
      avg_reviews: '4.6',
      market_saturation: 'Low-Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.7,
    recommendation: 'Buy'
  },
  'jacksonville': {
    market_name: 'Jacksonville, FL',
    market_overview: {
      population: '1.6 million (metro)',
      population_growth: '+1.8% annually',
      major_employers: ['Mayo Clinic', 'Baptist Health', 'CSX', 'Fidelity National', 'Deutsche Bank'],
      economic_outlook: 'Diversified economy with logistics, healthcare, and finance growth'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$100-150 annually',
      restrictions: ['Tourist development tax required', 'Business license needed', 'Beach communities have separate rules'],
      notes: 'Very STR-friendly. Jacksonville Beach and Atlantic Beach are popular areas.'
    },
    rental_data: {
      avg_rent_1br: '$1,400',
      avg_rent_2br: '$1,700',
      avg_rent_3br: '$2,100',
      avg_rent_4br: '$2,600',
      yoy_rent_change: '+5.1%',
      vacancy_rate: '6.0%'
    },
    str_performance: {
      avg_daily_rate: '$165',
      avg_occupancy: '68%',
      avg_monthly_revenue: '$3,366',
      peak_season: 'March-May, October-November',
      low_season: 'September',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '4,500+',
      professional_hosts_pct: '35%',
      avg_reviews: '4.5',
      market_saturation: 'Low-Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.8,
    recommendation: 'Buy'
  },
  'salt lake city': {
    market_name: 'Salt Lake City, UT',
    market_overview: {
      population: '1.3 million (metro)',
      population_growth: '+1.6% annually',
      major_employers: ['Intermountain Health', 'University of Utah', 'Delta Air Lines', 'Goldman Sachs'],
      economic_outlook: 'Strong tech sector (Silicon Slopes), outdoor recreation tourism'
    },
    str_regulations: {
      status: 'Moderate',
      permit_required: true,
      permit_cost: '$200-400 annually',
      restrictions: ['Business license required', 'Transient room tax', 'Some residential zoning restrictions'],
      notes: 'Park City has stricter rules. Salt Lake City proper is more permissive.'
    },
    rental_data: {
      avg_rent_1br: '$1,500',
      avg_rent_2br: '$1,850',
      avg_rent_3br: '$2,400',
      avg_rent_4br: '$3,100',
      yoy_rent_change: '+2.5%',
      vacancy_rate: '5.5%'
    },
    str_performance: {
      avg_daily_rate: '$185',
      avg_occupancy: '67%',
      avg_monthly_revenue: '$3,718',
      peak_season: 'December-March (ski), June-August',
      low_season: 'April-May, October-November',
      revenue_potential: 'Medium-High'
    },
    competition_analysis: {
      total_listings: '3,800+',
      professional_hosts_pct: '38%',
      avg_reviews: '4.6',
      market_saturation: 'Medium',
      entry_difficulty: 'Moderate'
    },
    investment_score: 7.2,
    recommendation: 'Buy'
  },
  'indianapolis': {
    market_name: 'Indianapolis, IN',
    market_overview: {
      population: '2.1 million (metro)',
      population_growth: '+0.9% annually',
      major_employers: ['Eli Lilly', 'IU Health', 'Salesforce', 'Anthem', 'Rolls-Royce'],
      economic_outlook: 'Affordable Midwest hub with sports and convention demand'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$50-100 annually',
      restrictions: ['Innkeepers tax required', 'Business registration needed', 'Some HOA restrictions'],
      notes: 'Very permissive environment. Strong event-driven demand (Indy 500, conventions).'
    },
    rental_data: {
      avg_rent_1br: '$1,100',
      avg_rent_2br: '$1,350',
      avg_rent_3br: '$1,700',
      avg_rent_4br: '$2,200',
      yoy_rent_change: '+4.2%',
      vacancy_rate: '6.8%'
    },
    str_performance: {
      avg_daily_rate: '$135',
      avg_occupancy: '62%',
      avg_monthly_revenue: '$2,511',
      peak_season: 'May (Indy 500), March-April, September-October',
      low_season: 'January-February',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '3,200+',
      professional_hosts_pct: '28%',
      avg_reviews: '4.5',
      market_saturation: 'Low',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.5,
    recommendation: 'Buy'
  },
  'columbus': {
    market_name: 'Columbus, OH',
    market_overview: {
      population: '2.2 million (metro)',
      population_growth: '+1.2% annually',
      major_employers: ['Ohio State University', 'Nationwide', 'JPMorgan Chase', 'Honda', 'Cardinal Health'],
      economic_outlook: 'Stable economy with education, insurance, and Intel chip plant investment'
    },
    str_regulations: {
      status: 'Friendly',
      permit_required: true,
      permit_cost: '$100-200 annually',
      restrictions: ['Lodging tax required', 'Business license needed', 'Some neighborhood restrictions'],
      notes: 'Generally permissive. Strong OSU football weekend demand.'
    },
    rental_data: {
      avg_rent_1br: '$1,200',
      avg_rent_2br: '$1,450',
      avg_rent_3br: '$1,850',
      avg_rent_4br: '$2,400',
      yoy_rent_change: '+3.8%',
      vacancy_rate: '6.2%'
    },
    str_performance: {
      avg_daily_rate: '$145',
      avg_occupancy: '64%',
      avg_monthly_revenue: '$2,784',
      peak_season: 'September-November (OSU football), May-June',
      low_season: 'January-February',
      revenue_potential: 'Medium'
    },
    competition_analysis: {
      total_listings: '3,500+',
      professional_hosts_pct: '30%',
      avg_reviews: '4.5',
      market_saturation: 'Low-Medium',
      entry_difficulty: 'Easy'
    },
    investment_score: 7.4,
    recommendation: 'Buy'
  }
};

function getMarketKey(marketName: string): string {
  const normalized = marketName.toLowerCase().trim();
  
  // Try exact match first
  if (marketDatabase[normalized]) return normalized;
  
  // Try partial match
  for (const key of Object.keys(marketDatabase)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return key;
    }
  }
  
  // Common aliases
  const aliases: Record<string, string> = {
    'slc': 'salt lake city',
    'indy': 'indianapolis',
    'nola': 'new orleans',
    'pdx': 'portland',
    'atl': 'atlanta',
    'dfw': 'dallas',
    'phx': 'phoenix',
    'lv': 'las vegas',
    'vegas': 'las vegas',
    'sd': 'san diego',
    'jax': 'jacksonville',
    'clt': 'charlotte',
    'rdu': 'raleigh',
    'mia': 'miami',
    'sea': 'seattle',
    'den': 'denver',
    'chs': 'charleston',
    'sav': 'savannah',
    'sat': 'san antonio',
    'hou': 'houston',
    'aus': 'austin',
    'orl': 'orlando',
    'tpa': 'tampa',
    'nash': 'nashville'
  };
  
  if (aliases[normalized]) {
    return aliases[normalized];
  }
  
  // Try city name extraction
  const cityMatch = normalized.match(/^([a-z\s]+)/);
  if (cityMatch) {
    const cityName = cityMatch[1].trim();
    if (marketDatabase[cityName]) {
      return cityName;
    }
  }
  
  return '';
}

function generateFallbackReport(markets: string[]): any {
  const analyzedMarkets = markets.map(market => {
    const key = getMarketKey(market);
    if (key && marketDatabase[key]) {
      return marketDatabase[key];
    }
    // Generate generic data for unknown markets
    return {
      market_name: market,
      market_overview: {
        population: 'Data pending',
        population_growth: 'Research required',
        major_employers: ['Local employers - research needed'],
        economic_outlook: 'Requires local market research'
      },
      str_regulations: {
        status: 'Unknown - verify locally',
        permit_required: true,
        permit_cost: 'Varies by jurisdiction',
        restrictions: ['Check local ordinances', 'Verify HOA rules', 'Consult local attorney'],
        notes: 'Recommend contacting local planning department'
      },
      rental_data: {
        avg_rent_1br: 'Research needed',
        avg_rent_2br: 'Research needed',
        avg_rent_3br: 'Research needed',
        avg_rent_4br: 'Research needed',
        yoy_rent_change: 'N/A',
        vacancy_rate: 'N/A'
      },
      str_performance: {
        avg_daily_rate: 'Research needed',
        avg_occupancy: 'Research needed',
        avg_monthly_revenue: 'Research needed',
        peak_season: 'Varies',
        low_season: 'Varies',
        revenue_potential: 'Requires analysis'
      },
      competition_analysis: {
        total_listings: 'Check AirDNA/Mashvisor',
        professional_hosts_pct: 'N/A',
        avg_reviews: 'N/A',
        market_saturation: 'Unknown',
        entry_difficulty: 'Unknown'
      },
      investment_score: 0,
      recommendation: 'Research Required'
    };
  });

  // Find best markets for comparison
  const knownMarkets = analyzedMarkets.filter(m => m.investment_score > 0);
  
  const bestForBeginners = knownMarkets.find(m => 
    m.competition_analysis?.entry_difficulty === 'Easy'
  )?.market_name || analyzedMarkets[0]?.market_name;
  
  const highestRevenue = [...knownMarkets].sort((a, b) => {
    const aRev = parseFloat(a.str_performance?.avg_monthly_revenue?.replace(/[$,]/g, '') || '0');
    const bRev = parseFloat(b.str_performance?.avg_monthly_revenue?.replace(/[$,]/g, '') || '0');
    return bRev - aRev;
  })[0]?.market_name || analyzedMarkets[0]?.market_name;

  const mostStable = knownMarkets.find(m => 
    m.str_regulations?.status === 'Friendly'
  )?.market_name || analyzedMarkets[0]?.market_name;

  const bestRegulations = knownMarkets.find(m => 
    m.str_regulations?.status === 'Friendly'
  )?.market_name || analyzedMarkets[0]?.market_name;

  const highestScore = [...knownMarkets].sort((a, b) => b.investment_score - a.investment_score)[0]?.market_name || analyzedMarkets[0]?.market_name;

  return {
    executive_summary: `This comprehensive market analysis covers ${markets.join(', ')}. ${knownMarkets.length > 0 ? `Based on our data, ${highestScore} shows the strongest investment potential with an investment score of ${knownMarkets.find(m => m.market_name === highestScore)?.investment_score}/10.` : 'We recommend conducting additional local research for these markets.'} Key factors analyzed include local STR regulations, rental demand patterns, competition levels, and revenue potential. Always verify current regulations with local authorities before investing.`,
    markets_analyzed: analyzedMarkets,
    top_recommendations: [
      'Verify all STR regulations with local planning departments before committing',
      'Analyze competition using AirDNA or Mashvisor for accurate occupancy data',
      `Consider ${bestForBeginners} for easier market entry with favorable regulations`,
      `${highestRevenue} offers the highest revenue potential among analyzed markets`,
      'Build relationships with landlords who understand and support STR operations',
      'Factor in seasonality when projecting annual revenue - most markets have distinct peak/low seasons',
      'Start with one property to learn the market before scaling'
    ],
    risk_factors: [
      'Regulatory changes can significantly impact STR viability - monitor local politics',
      'Market saturation in popular areas may compress margins over time',
      'Economic downturns affect travel and tourism demand',
      'Rising interest rates impact property acquisition costs',
      'Insurance costs for STRs continue to increase nationwide',
      'Platform algorithm changes can affect listing visibility and bookings',
      'Seasonal markets require cash reserves for low-occupancy periods'
    ],
    market_comparison: {
      best_for_beginners: bestForBeginners,
      highest_revenue_potential: highestRevenue,
      most_stable: mostStable,
      best_regulations: bestRegulations,
      highest_investment_score: highestScore
    },
    methodology: {
      data_sources: ['AirDNA', 'Zillow', 'Local government records', 'Industry reports'],
      scoring_criteria: ['Regulatory environment', 'Revenue potential', 'Competition level', 'Market stability', 'Entry difficulty'],
      last_updated: new Date().toISOString().split('T')[0]
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const { investor_id, markets, report_type = 'custom' } = await req.json();

    console.log('Generating market report for:', markets, 'investor:', investor_id);

    if (!markets || markets.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one market must be selected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build report record
    const reportRecord: any = {
      markets,
      report_type,
      status: 'generating'
    };
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (investor_id && uuidRegex.test(investor_id)) {
      reportRecord.investor_id = investor_id;
    }

    // Create report record
    let report: any = { id: 'temp-' + Date.now() };
    try {
      const createReportRes = await fetch(`${supabaseUrl}/rest/v1/market_reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(reportRecord)
      });

      if (createReportRes.ok) {
        const reportArray = await createReportRes.json();
        report = reportArray[0] || reportArray;
        console.log('Created report record:', report.id);
      } else {
        const errorText = await createReportRes.text();
        console.log('Report creation response:', errorText);
      }
    } catch (dbError: any) {
      console.error('Database error:', dbError.message);
    }

    // Try AI Gateway first
    const gatewayApiKey = Deno.env.get('OPENAI_API_KEY');
    let reportData: any = null;
    let aiSuccess = false;

    if (gatewayApiKey) {
      const marketsList = markets.join(', ');
      const prompt = `You are a real estate market analyst specializing in short-term rentals (STR) and rental arbitrage. Generate a comprehensive market report for: ${marketsList}

Analyze each market and provide detailed insights including:
1. Market overview (population, growth, major employers, economic outlook)
2. STR regulations (permit requirements, costs, restrictions, enforcement level)
3. Rental data (average rents by bedroom count, vacancy rates, YoY changes)
4. STR performance metrics (ADR, occupancy, monthly revenue, seasonality)
5. Competition analysis (total listings, professional host percentage, saturation)
6. Investment score (1-10) and recommendation (Buy/Hold/Sell)

Provide your analysis in JSON format with the following structure:
{
  "executive_summary": "Overview paragraph",
  "markets_analyzed": [
    {
      "market_name": "City, State",
      "market_overview": {...},
      "str_regulations": {...},
      "rental_data": {...},
      "str_performance": {...},
      "competition_analysis": {...},
      "investment_score": 7.5,
      "recommendation": "Buy"
    }
  ],
  "top_recommendations": ["recommendation 1", ...],
  "risk_factors": ["risk 1", ...],
  "market_comparison": {
    "best_for_beginners": "City",
    "highest_revenue_potential": "City",
    "most_stable": "City",
    "best_regulations": "City"
  }
}`;

      try {
        console.log('Attempting AI Gateway call...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + gatewayApiKey
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 8000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          console.log('AI response received, length:', content.length);
          
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              reportData = JSON.parse(jsonMatch[0]);
              aiSuccess = true;
              console.log('AI report generated successfully');
            } catch (parseError) {
              console.log('JSON parse error, using fallback');
            }
          }
        } else {
          const errorText = await aiResponse.text();
          console.log('AI Gateway error:', aiResponse.status, errorText.substring(0, 200));
        }
      } catch (aiError: any) {
        console.log('AI Gateway call failed:', aiError.message);
      }
    }

    // Use fallback if AI failed
    if (!aiSuccess) {
      console.log('Using comprehensive fallback report data for', markets.length, 'markets');
      reportData = generateFallbackReport(markets);
    }

    // Add metadata
    reportData.generated_at = new Date().toISOString();
    reportData.markets = markets;
    reportData.report_type = report_type;
    reportData.ai_generated = aiSuccess;
    reportData.available_markets = Object.keys(marketDatabase).length;

    // Update report in database
    if (report.id && !report.id.startsWith('temp-')) {
      try {
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/market_reports?id=eq.${report.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            report_data: reportData,
            status: 'completed',
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
        
        if (updateRes.ok) {
          console.log('Report saved to database successfully');
        } else {
          const updateError = await updateRes.text();
          console.log('Report update response:', updateError);
        }
      } catch (updateError: any) {
        console.error('Update error:', updateError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      report_id: report.id,
      report_data: reportData,
      ai_generated: aiSuccess,
      markets_in_database: Object.keys(marketDatabase).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('generate-market-report error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
