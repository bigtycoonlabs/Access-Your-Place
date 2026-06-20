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

// Penny AI v9.0 - Database-first: pre-fetch real data, expanded intent detection, quality checks with retry
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function getDb() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return { url, key, ok: url.length > 10 && key.length > 20 };
}

async function dbGet(table: string, params = ''): Promise<any[]> {
  const { url, key, ok } = getDb();
  if (!ok) return [];
  try {
    const r = await fetch(`${url}/rest/v1/${table}${params ? '?' + params : ''}`, {
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }
    });
    return r.ok ? (await r.json()) || [] : [];
  } catch { return []; }
}

async function dbPatch(table: string, filter: string, data: any): Promise<boolean> {
  const { url, key, ok } = getDb();
  if (!ok) return false;
  try {
    const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify(data)
    });
    return r.ok;
  } catch { return false; }
}

async function dbPost(table: string, data: any): Promise<any> {
  const { url, key, ok } = getDb();
  if (!ok) return null;
  try {
    const r = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
      body: JSON.stringify(data)
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const MKT: Record<string, { n: string; adr: [number, number]; occ: number; revpar: number; reg: string; risk: string; trend: string; peak: number[]; slow: number[]; drivers: string[] }> = {
  austin: { n: 'Austin, TX', adr: [150, 320], occ: 62, revpar: 146, reg: 'Type 2 STR license required', risk: 'medium', trend: 'growing', peak: [3, 10], slow: [1, 8], drivers: ['SXSW', 'ACL', 'F1', 'Tech'] },
  nashville: { n: 'Nashville, TN', adr: [160, 280], occ: 58, revpar: 128, reg: 'Owner-occupied only in residential', risk: 'high', trend: 'stable', peak: [4, 5, 6, 9, 10], slow: [1, 2], drivers: ['Music tourism', 'Bachelorettes', 'CMA Fest'] },
  tampa: { n: 'Tampa, FL', adr: [120, 200], occ: 68, revpar: 109, reg: 'Registration required', risk: 'low', trend: 'growing', peak: [1, 2, 3], slow: [8, 9], drivers: ['Snowbirds', 'Busch Gardens', 'Cruise port'] },
  orlando: { n: 'Orlando, FL', adr: [130, 350], occ: 78, revpar: 187, reg: 'Designated zones only', risk: 'low', trend: 'booming', peak: [3, 6, 7, 12], slow: [9], drivers: ['Disney', 'Universal', 'Epic Universe'] },
  phoenix: { n: 'Phoenix, AZ', adr: [140, 240], occ: 60, revpar: 114, reg: 'State preemption protects operators', risk: 'low', trend: 'growing', peak: [2, 3], slow: [6, 7, 8], drivers: ['Spring Training', 'Golf', 'Snowbirds'] },
  denver: { n: 'Denver, CO', adr: [160, 280], occ: 64, revpar: 141, reg: 'Primary residence required in Denver', risk: 'high', trend: 'stable', peak: [1, 2, 6, 7, 12], slow: [4, 11], drivers: ['Ski tourism', 'Red Rocks', 'Outdoor rec'] },
  miami: { n: 'Miami, FL', adr: [180, 400], occ: 62, revpar: 180, reg: '30-day minimum in some areas', risk: 'high', trend: 'growing', peak: [12, 1, 2, 3], slow: [8, 9], drivers: ['International tourism', 'Art Basel', 'F1'] },
  dallas: { n: 'Dallas, TX', adr: [120, 220], occ: 60, revpar: 102, reg: 'TX HB 2797 protects STRs', risk: 'low', trend: 'growing', peak: [9, 10], slow: [7, 8], drivers: ['Corporate travel', 'Cowboys', 'State Fair'] },
  atlanta: { n: 'Atlanta, GA', adr: [130, 200], occ: 55, revpar: 91, reg: '2-property limit, must register', risk: 'medium', trend: 'stable', peak: [3, 4, 9, 10], slow: [7, 8, 12], drivers: ['Conventions', 'Film', 'Sports'] },
  jacksonville: { n: 'Jacksonville, FL', adr: [110, 180], occ: 64, revpar: 93, reg: 'Permissive, registration required', risk: 'low', trend: 'growing', peak: [3, 4, 5, 6, 7], slow: [11, 12, 1], drivers: ['Beach', 'Navy', 'Jaguars'] },
  charlotte: { n: 'Charlotte, NC', adr: [125, 200], occ: 58, revpar: 94, reg: 'HOA restrictions common', risk: 'medium', trend: 'growing', peak: [3, 4, 5, 9, 10], slow: [7, 8, 12], drivers: ['Banking', 'NASCAR', 'Panthers'] },
  sanantonio: { n: 'San Antonio, TX', adr: [100, 190], occ: 60, revpar: 87, reg: 'TX HB 2797 protections', risk: 'low', trend: 'growing', peak: [3, 4, 10], slow: [8, 1], drivers: ['Riverwalk', 'Military', 'Fiesta'] },
};

const TEMPLATES = {
  acquisition: { name: 'Rental Arbitrage Acquisition Agreement', clauses: ['1. SERVICE PROVIDER MODEL: AYP is a SERVICE PROVIDER, NOT a real estate brokerage.', '2. FEE STRUCTURE: Acquisition fee is earned upon commencement of services. NON-REFUNDABLE.', '3. LIFETIME CREDIT POLICY (Section 4.2): Fee converts to Lifetime Credit if deal falls through (no fault of investor). No expiration.', '4. $5,000 CAPITAL RULE: Minimum capital required before deal sourcing.', '5. TIMELINE: 30-60 days from fee payment to lease signing.', '6. INVESTOR OBLIGATIONS: Timely communication, capital readiness, adherence to playbook.'] },
  sublease: { name: 'Corporate Sublease Agreement', clauses: ['1. ASSET FORFEITURE: Default = forfeiture of furnishings, equipment, business assets.', '2. DIRECT-TO-LANDLORD PAYMENT: Rent paid directly from investor to landlord.', '3. OPERATIONAL STANDARDS: Must meet AYP standards.', '4. INSURANCE: Must maintain STR insurance and general liability.', '5. TERMINATION: 60-day written notice.'] },
  master_lease: { name: 'Corporate Master Lease', clauses: ['1. RIGHT TO SUBLEASE: Explicit right to sublease for STR, MTR, or co-living.', '2. COMMERCIAL INTENT: Acknowledges commercial/business use.', '3. RIGHT OF REVERSION: Improvements removable within 30 days.', '4. LANDLORD PROTECTIONS: Noise compliance, guest screening.', '5. INSURANCE: Tenant provides commercial general liability.'] }
};

// v9.0: Enhanced response quality check - catches more generic patterns
function isTemplatedResponse(text: string): boolean {
  if (!text || text.length < 30) return true;
  const genericPatterns = [
    /I('m| am) (just )?an AI/i,
    /I don't have (access|the ability)/i,
    /I('m| am) not able to/i,
    /I cannot (access|browse|search|look up)/i,
    /as an AI (language )?model/i,
    /I('m| am) sorry,? (but )?I (can't|cannot|don't)/i,
    /I('m| am) unable to/i,
    /I don't have real-time/i,
    /my training data/i,
    /I don't have access to.*database/i,
    /I can't actually.*look up/i,
    /I don't have the ability to.*search/i,
    /I('d| would) be happy to help/i,
    /I('d| would) love to help/i,
    /let me know if you('d| would) like/i,
    /feel free to ask/i,
    /is there anything else/i,
    /how can I assist you/i,
    /I('m| am) here to help/i,
  ];
  
  // Check if response is mostly generic filler without real data
  const hasGenericPattern = genericPatterns.some(p => p.test(text));
  if (!hasGenericPattern) return false;
  
  // If it has generic patterns BUT also has real data markers, it's OK
  const hasRealData = /\$[\d,]+/.test(text) || /\*\*[A-Z]/.test(text) || /\d+\s*(bed|bath|BR|BA)/i.test(text) || /Score:\s*\d+/i.test(text);
  if (hasRealData) return false;
  
  return true;
}

// v9.0: Enhanced intent detection with document, agreement, onboarding, AM intents
function detectIntent(msg: string, isStaff: boolean) {
  const m = msg.toLowerCase();
  let name = '';
  const nm = msg.match(/(?:client|investor|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const nm2 = msg.match(/"([^"]+)"/);
  const nm3 = msg.match(/(?:look\s*up|find|search|pull\s*up|check)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  name = nm?.[1] || nm2?.[1] || nm3?.[1] || '';
  const email = (msg.match(/[\w.-]+@[\w.-]+\.\w+/) || [])[0] || '';
  const adr = (m.match(/(?:adr|nightly rate)[\s:]*\$?(\d+)/) || [])[1];
  const occ = (m.match(/(?:occupancy|occ)[\s:]*(\d+)/) || [])[1];
  const rent = (m.match(/(?:rent|monthly rent)[\s:]*\$?(\d[\d,]*)/) || [])[1];
  const beds = (m.match(/(\d+)\s*(?:bed|br|bedroom)/) || [])[1];
  const cities = Object.keys(MKT).filter(c => m.includes(c) || m.includes(MKT[c].n.toLowerCase()));
  if (m.includes('san antonio')) cities.push('sanantonio');

  if (isStaff) {
    if (/(?:draft|prepare|create|generate|write)\s+(?:an?\s+)?(?:acquisition|acq)\s*(?:agreement|contract)/i.test(m)) return { act: 'draft_acquisition', name, cities };
    if (/(?:draft|prepare|create|generate)\s+(?:a\s+)?(?:corporate\s+)?sublease/i.test(m)) return { act: 'draft_sublease', name, cities };
    if (/(?:draft|prepare|create|generate)\s+(?:a\s+)?master\s*lease/i.test(m)) return { act: 'draft_master_lease', name, cities };
    if (/refund|wants?\s+(?:their\s+)?money\s*back|refund\s*request/i.test(m)) return { act: 'refund_rebuttal', name, cities };
    if (/(?:look\s*up|find|search|pull|check|details?\s*(?:for|on|about)|who\s*is)/i.test(m) && (name || email || /investor|client/.test(m))) return { act: 'lookup', name, email, cities };
    if (/(?:update|change|set|mark|move)\s+.*(?:status|funded)/i.test(m) || /(?:fully[\s_]*funded|half[\s_-]*funded)/i.test(m)) {
      let status = '';
      if (/fully[\s_]*funded/i.test(m)) status = 'fully_funded';
      else if (/half[\s_-]*funded/i.test(m)) status = 'half_funded';
      else if (/pending/i.test(m)) status = 'pending';
      else if (/active/i.test(m)) status = 'active';
      return { act: 'update_status', name, email, status, cities };
    }
    if (/(?:log|add|record|write)\s+(?:a\s+)?note/i.test(m)) return { act: 'log_note', name, email, note: msg, cities };
    if (/(?:pipeline|stats|how\s+many|funnel|dashboard|overview)/i.test(m)) return { act: 'pipeline_stats', cities };
    if (/(?:find|search|show|list|get)\s+(?:me\s+)?(?:all\s+)?(?:properties|deals)/i.test(m) || /properties\s+(?:in|for|near)/i.test(m)) return { act: 'search_props', cities, beds };
    if (/(?:score|rate|evaluate)\s+(?:this\s+)?(?:deal|property)/i.test(m) || /penny\s*score/i.test(m)) return { act: 'score', cities };
    if (/(?:write|generate|create|draft)\s+(?:a\s+)?(?:listing|airbnb|vrbo)/i.test(m)) return { act: 'listing', cities, beds };
    if (/landlord|outreach|talking\s*points|pitch/i.test(m)) return { act: 'outreach', cities };
  } else {
    // v9.0: Expanded investor intent detection
    if (/(?:my\s+)?document|(?:my\s+)?files?|(?:my\s+)?upload|(?:my\s+)?agreement|lease\s+doc|contract/i.test(m)) return { act: 'documents' };
    if (/(?:my\s+)?(?:acquisition\s+)?manager|(?:my\s+)?am\b|who\s+(?:is\s+)?(?:my|assigned)/i.test(m)) return { act: 'my_manager' };
    if (/onboard|get\s+started|how\s+(?:do\s+I|to)\s+(?:start|begin)|next\s+step|what\s+(?:do\s+I|should\s+I)\s+do/i.test(m)) return { act: 'onboarding' };
    if (/(?:my\s+)?(?:account|profile)\s+(?:status|info|details)/i.test(m) || /am\s+I\s+(?:funded|verified|approved)/i.test(m)) return { act: 'account_status' };
    if (/(?:analyze|score|rate|evaluate|is\s+this.*good|run\s+the\s+numbers|worth)/i.test(m)) return { act: 'analyze', adr, occ, rent, cities };
    if (/(?:calculate|project|estimate|how\s+much.*(?:make|earn)|revenue|income|cash\s*flow|profit)/i.test(m)) return { act: 'revenue', adr, occ, rent, cities };
    if (/(?:write|generate|create|help.*write)\s+(?:a\s+)?(?:listing|airbnb|vrbo|description)/i.test(m)) return { act: 'listing', cities, beds };
    if (/(?:what\s+deals|available|marketplace|show.*deals|browse\s+deals|any\s+deals)/i.test(m)) return { act: 'marketplace', cities };
    if (/(?:my\s+portfolio|my\s+properties|how\s+am\s+I\s+doing|portfolio\s+summary)/i.test(m)) return { act: 'portfolio' };
    if (/(?:credit|balance|account\s+credit)/i.test(m)) return { act: 'credits' };
    if (/(?:slow\s+season|off\s+season|strategy|strategies|maintain\s+occupancy)/i.test(m)) return { act: 'slow_season', cities };
    if (/(?:regulation|legal|permit|license|zoning)/i.test(m)) return { act: 'regulations', cities };
    if (/(?:market|outlook|forecast|trend)/i.test(m) && cities.length > 0) return { act: 'market_outlook', cities };
  }
  return { act: 'chat', cities, adr, occ, rent, name };
}

// v9.0: Pre-fetch investor context data from database
async function prefetchInvestorContext(userId: string): Promise<any> {
  if (!userId) return {};
  const ctx: any = {};
  try {
    // Fetch investor profile
    const inv = await dbGet('investors', `id=eq.${userId}&select=id,full_name,email,phone,status,funding_status,account_funded,assigned_am_name,assigned_acquisition_manager_id,assigned_setup_manager_id,assigned_setup_manager_name,investor_type,credit_balance,preferred_markets,onboarding_completed,discovery_call_completed,can_purchase_deals,created_at`);
    if (inv.length > 0) ctx.investor = inv[0];
    
    // Fetch portfolio summary
    const portfolio = await dbGet('investor_portfolio', `investor_id=eq.${userId}&select=id,address,city,state,bedrooms,bathrooms,monthly_rent,monthly_earnings,initial_investment,acquisition_fee,property_status,property_type,operation_type&order=created_at.desc`);
    ctx.portfolio = portfolio;
    ctx.portfolioCount = portfolio.length;
    ctx.activeCount = portfolio.filter((p: any) => p.property_status === 'active').length;
    ctx.pendingCount = portfolio.filter((p: any) => p.property_status === 'pending' || p.property_status === 'pending_approval').length;
    ctx.totalRent = portfolio.reduce((s: number, p: any) => s + (p.monthly_rent || 0), 0);
    ctx.totalEarnings = portfolio.reduce((s: number, p: any) => s + (p.monthly_earnings || 0), 0);
    ctx.totalFees = portfolio.reduce((s: number, p: any) => s + (p.acquisition_fee || 0), 0);
    
    // Fetch document count
    const docs = await dbGet('investor_documents', `investor_id=eq.${userId}&select=id,document_name,document_type,status,created_at&order=created_at.desc&limit=10`);
    ctx.documents = docs;
    ctx.documentCount = docs.length;
    
    // Fetch AM info if assigned
    if (ctx.investor?.assigned_acquisition_manager_id) {
      const am = await dbGet('staff_users', `id=eq.${ctx.investor.assigned_acquisition_manager_id}&select=id,first_name,last_name,email,phone`);
      if (am.length > 0) ctx.am = am[0];
    }
  } catch (e) {
    console.warn('[v9.0] Prefetch error:', e);
  }
  return ctx;
}

async function execute(intent: any, ctx: any): Promise<{ done: string; data?: any }> {
  const { act } = intent;
  const invCtx = ctx.investorContext || {};

  // v9.0: Documents intent - answer from prefetched data
  if (act === 'documents') {
    const docs = invCtx.documents || [];
    if (docs.length > 0) {
      let r = `**Your Documents (${docs.length})**\n\n`;
      docs.forEach((d: any, i: number) => {
        const date = new Date(d.created_at).toLocaleDateString();
        const status = d.status === 'approved' ? 'Ready' : d.status === 'pending_signature' ? 'Needs Signature' : (d.status || 'Available');
        r += `${i + 1}. **${d.document_name}** â€” ${(d.document_type || 'document').replace(/_/g, ' ')} â€” ${status} â€” ${date}\n`;
      });
      r += `\nView and download your documents in the **Documents** tab of your portal. Documents requiring signature will appear in the **Signatures** tab.`;
      return { done: r };
    }
    return { done: `You don't have any documents in your portal yet. When your Success Team uploads documents (agreements, leases, etc.), they'll appear in the **Documents** tab. You'll also receive an email notification when new documents are available.` };
  }

  // v9.0: My Manager intent
  if (act === 'my_manager') {
    const inv = invCtx.investor;
    const am = invCtx.am;
    if (am) {
      const amName = `${am.first_name || ''} ${am.last_name || ''}`.trim();
      let r = `**Your Acquisition Manager**\n\n`;
      r += `- **Name:** ${amName}\n`;
      if (am.email) r += `- **Email:** ${am.email}\n`;
      if (am.phone) r += `- **Phone:** ${am.phone}\n`;
      r += `\nYour AM handles deal sourcing, landlord negotiations, and guides you through the acquisition process. All property inquiries should go through them.\n`;
      if (inv?.assigned_setup_manager_name) {
        r += `\n**Your Setup Manager:** ${inv.assigned_setup_manager_name}\nThey handle property setup, furnishing, and getting your property guest-ready.`;
      }
      return { done: r };
    }
    if (inv?.assigned_am_name || inv?.acquisition_manager_name) {
      return { done: `**Your Acquisition Manager:** ${inv.assigned_am_name || inv.acquisition_manager_name}\n\nContact them through the Messages tab in your portal for any deal-related questions.` };
    }
    return { done: `You don't have an Acquisition Manager assigned yet. Once you complete your discovery call and fund your account, an AM will be assigned to help you find deals.\n\n**Next Steps:**\n1. Complete your profile\n2. Book a discovery call\n3. Fund your account ($5,000 minimum)\n\nWould you like to book a discovery call?` };
  }

  // v9.0: Account status intent
  if (act === 'account_status') {
    const inv = invCtx.investor;
    if (inv) {
      let r = `**Your Account Status**\n\n`;
      r += `- **Name:** ${inv.full_name || 'N/A'}\n`;
      r += `- **Account Funded:** ${inv.account_funded ? 'Yes' : 'No'}\n`;
      r += `- **Funding Status:** ${(inv.funding_status || 'Not yet funded').replace(/_/g, ' ')}\n`;
      r += `- **Discovery Call:** ${inv.discovery_call_completed ? 'Completed' : 'Not yet scheduled'}\n`;
      r += `- **Can Purchase Deals:** ${inv.can_purchase_deals ? 'Yes' : 'Not yet'}\n`;
      r += `- **Credit Balance:** $${(inv.credit_balance || 0).toLocaleString()}\n`;
      r += `- **AM Assigned:** ${inv.assigned_am_name || invCtx.am ? `${invCtx.am?.first_name || ''} ${invCtx.am?.last_name || ''}`.trim() : 'Not yet'}\n`;
      r += `- **Portfolio:** ${invCtx.portfolioCount || 0} properties\n`;
      if (inv.preferred_markets?.length > 0) r += `- **Preferred Markets:** ${inv.preferred_markets.join(', ')}\n`;
      r += `- **Member Since:** ${new Date(inv.created_at).toLocaleDateString()}\n`;
      
      if (!inv.account_funded) {
        r += `\n**To unlock deal access**, fund your account with a minimum of $5,000. Visit the Financial Hub in your portal.`;
      }
      return { done: r };
    }
    return { done: 'Unable to retrieve your account status. Please try refreshing the page.' };
  }

  // v9.0: Onboarding intent
  if (act === 'onboarding') {
    const inv = invCtx.investor;
    const steps: string[] = [];
    let completedCount = 0;
    const totalSteps = 5;
    
    if (inv?.onboarding_completed) { completedCount++; steps.push('- [x] Complete profile'); } else { steps.push('- [ ] **Complete your profile** â€” Add your investment preferences and budget'); }
    if (inv?.discovery_call_completed) { completedCount++; steps.push('- [x] Discovery call completed'); } else { steps.push('- [ ] **Book a discovery call** â€” Speak with our team about your goals'); }
    if (inv?.account_funded) { completedCount++; steps.push('- [x] Account funded'); } else { steps.push('- [ ] **Fund your account** â€” Minimum $5,000 to start deal sourcing'); }
    if (inv?.assigned_acquisition_manager_id || invCtx.am) { completedCount++; steps.push('- [x] Acquisition Manager assigned'); } else { steps.push('- [ ] **Get AM assigned** â€” Happens after funding'); }
    if (invCtx.portfolioCount > 0) { completedCount++; steps.push('- [x] First property in portfolio'); } else { steps.push('- [ ] **Get your first property** â€” Browse deals or work with your AM'); }

    let r = `**Your Onboarding Progress: ${completedCount}/${totalSteps} Complete**\n\n`;
    r += steps.join('\n');
    r += `\n\n`;
    
    if (completedCount === totalSteps) {
      r += `Congratulations! You've completed all onboarding steps. Focus on optimizing your portfolio and exploring new deals!`;
    } else if (!inv?.account_funded) {
      r += `**Your next step:** Fund your account to unlock deal sourcing. Visit the **Financial Hub** tab.`;
    } else if (!inv?.discovery_call_completed) {
      r += `**Your next step:** Book a discovery call to get matched with an Acquisition Manager.`;
    } else {
      r += `**Your next step:** Browse the Deal Marketplace or ask your AM about available properties.`;
    }
    return { done: r };
  }

  if (act === 'lookup') {
    let inv: any[] = [];
    if (intent.email) inv = await dbGet('investors', `email=ilike.*${encodeURIComponent(intent.email)}*&select=id,full_name,email,phone,status,funding_status,account_funded,assigned_am_name,investor_type,created_at,notes&limit=5`);
    if (!inv.length && intent.name) inv = await dbGet('investors', `full_name=ilike.*${encodeURIComponent(intent.name)}*&select=id,full_name,email,phone,status,funding_status,account_funded,assigned_am_name,investor_type,created_at,notes&limit=5`);
    if (!inv.length && intent.name) inv = await dbGet('investors', `full_name=ilike.*${encodeURIComponent(intent.name.split(' ')[0])}*&select=id,full_name,email,phone,status,funding_status,account_funded,assigned_am_name,investor_type,created_at,notes&limit=5`);
    if (inv.length) {
      const details = inv.map(i => `**${i.full_name}** (${i.email})\n- Status: ${i.status || 'N/A'}\n- Funding: ${i.funding_status || (i.account_funded ? 'Funded' : 'Not Funded')}\n- AM: ${i.assigned_am_name || 'Unassigned'}\n- Type: ${i.investor_type || 'N/A'}\n- Joined: ${new Date(i.created_at).toLocaleDateString()}`).join('\n\n');
      return { done: `Found ${inv.length} investor(s):\n\n${details}`, data: inv };
    }
    return { done: `No investors found matching "${intent.name || intent.email}". Try a different name or email.` };
  }

  if (act === 'update_status') {
    let inv: any[] = [];
    if (intent.email) inv = await dbGet('investors', `email=ilike.*${encodeURIComponent(intent.email)}*&select=id,full_name,funding_status&limit=1`);
    if (!inv.length && intent.name) inv = await dbGet('investors', `full_name=ilike.*${encodeURIComponent(intent.name)}*&select=id,full_name,funding_status&limit=1`);
    if (!inv.length) return { done: `Could not find investor "${intent.name || intent.email}".` };
    const upd: any = { updated_at: new Date().toISOString() };
    if (['fully_funded', 'half_funded', 'pending', 'not_funded'].includes(intent.status)) {
      upd.funding_status = intent.status;
      if (intent.status === 'fully_funded') upd.account_funded = true;
    } else upd.status = intent.status;
    const ok = await dbPatch('investors', `id=eq.${inv[0].id}`, upd);
    return ok ? { done: `**UPDATED:** ${inv[0].full_name} â†’ ${intent.status.replace(/_/g, ' ').toUpperCase()}\nPrevious: ${inv[0].funding_status || 'unknown'}` } : { done: `Failed to update ${inv[0].full_name}.` };
  }

  if (act === 'log_note') {
    let inv: any[] = [];
    if (intent.email) inv = await dbGet('investors', `email=ilike.*${encodeURIComponent(intent.email)}*&select=id,full_name,notes&limit=1`);
    if (!inv.length && intent.name) inv = await dbGet('investors', `full_name=ilike.*${encodeURIComponent(intent.name)}*&select=id,full_name,notes&limit=1`);
    if (!inv.length) return { done: `Could not find investor "${intent.name || intent.email}".` };
    const ts = new Date().toISOString();
    const notes = `[${ts}] ${intent.note}\n---\n${inv[0].notes || ''}`;
    const ok = await dbPatch('investors', `id=eq.${inv[0].id}`, { notes, updated_at: ts });
    return ok ? { done: `**NOTE LOGGED** for ${inv[0].full_name}. The note has been saved to their profile.` } : { done: `Failed to log note.` };
  }

  if (act === 'draft_acquisition') {
    const t = TEMPLATES.acquisition;
    const nm = intent.name || '[INVESTOR NAME]';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return { done: `**DRAFTED: ${t.name}**\nDate: ${today}\nParties: Cooper Family Inc. / Set Up Your Place LLC ("AYP") and ${nm} ("Client")\n\n**KEY TERMS:**\n${t.clauses.join('\n')}\n\n*Draft ready for Success Team review and customization.*` };
  }

  if (act === 'draft_sublease') {
    const t = TEMPLATES.sublease;
    return { done: `**DRAFTED: ${t.name}**\nClient: ${intent.name || '[INVESTOR NAME]'}\n\n**KEY TERMS:**\n${t.clauses.join('\n')}\n\n*Draft ready for review.*` };
  }

  if (act === 'draft_master_lease') {
    const t = TEMPLATES.master_lease;
    return { done: `**DRAFTED: ${t.name}**\nClient: ${intent.name || '[INVESTOR NAME]'}\n\n**KEY TERMS:**\n${t.clauses.join('\n')}\n\n*Draft ready for review.*` };
  }

  if (act === 'refund_rebuttal') {
    const nm = intent.name || 'the client';
    return { done: `**REFUND REBUTTAL for ${nm}:**\n\nPer Section 3.1, services are rendered upon commencement. The fee is earned and **non-refundable**.\n\nPer Section 4.2 (Lifetime Credit Policy), the fee is preserved as a **Lifetime Credit with NO expiration**.\n\n**Key points:**\n- AYP is a service provider, not a brokerage\n- Services rendered (market research, deal sourcing, landlord outreach)\n- Fee converts to Lifetime Credit â€” funds are safe\n- No expiration on credits\n\n*Ready to send to ${nm}.*` };
  }

  if (act === 'pipeline_stats') {
    const [all, funded, props, pub] = await Promise.all([
      dbGet('investors', 'select=id,status,created_at&limit=1000'),
      dbGet('investors', 'account_funded=eq.true&select=id&limit=1000'),
      dbGet('properties', 'select=id&limit=1000'),
      dbGet('properties', 'or=(is_published.eq.true,status.eq.published)&select=id&limit=1000')
    ]);
    const thisMonth = all.filter(i => new Date(i.created_at).getMonth() === new Date().getMonth()).length;
    return { done: `**PIPELINE STATS:**\n- Total Investors: **${all.length}**\n- Funded: **${funded.length}** (${all.length ? Math.round(funded.length / all.length * 100) : 0}%)\n- New This Month: **${thisMonth}**\n- Total Properties: **${props.length}**\n- Published Deals: **${pub.length}**` };
  }

  if (act === 'search_props') {
    let all: any[] = [];
    const sel = 'select=id,listing_title,title,address,city,state,bedrooms,bathrooms,monthly_rent,operation_type,penny_score,status';
    if (intent.cities?.length) {
      for (const c of intent.cities.slice(0, 3)) {
        const cn = MKT[c]?.n.split(',')[0] || c;
        all.push(...await dbGet('properties', `${sel}&city=ilike.*${encodeURIComponent(cn)}*&order=created_at.desc&limit=10`));
      }
    }
    if (all.length < 10) all.push(...await dbGet('properties', `${sel}&order=created_at.desc&limit=${15 - all.length}`));
    all = all.filter((p, i, a) => i === a.findIndex(x => x.id === p.id));
    if (intent.beds) all = all.filter(p => p.bedrooms === parseInt(intent.beds));
    if (all.length) {
      const list = all.map(p => `- **${p.listing_title || p.title || p.address}** | ${p.city}, ${p.state} | ${p.bedrooms}BR/${p.bathrooms}BA | $${p.monthly_rent?.toLocaleString()}/mo | ${p.operation_type || 'STR'}${p.penny_score ? ` | Score: ${p.penny_score}` : ''}`).join('\n');
      return { done: `**Found ${all.length} properties:**\n${list}`, data: all };
    }
    return { done: 'No properties found matching your criteria.' };
  }

  if (act === 'score') {
    let props: any[] = [];
    if (intent.cities?.length) {
      for (const c of intent.cities.slice(0, 2)) {
        const cn = MKT[c]?.n.split(',')[0] || c;
        props.push(...await dbGet('properties', `city=ilike.*${encodeURIComponent(cn)}*&order=created_at.desc&limit=3&select=id,listing_title,title,city,state,bedrooms,bathrooms,monthly_rent,operation_type`));
      }
    }
    if (!props.length) props = await dbGet('properties', 'order=created_at.desc&limit=3&select=id,listing_title,title,city,state,bedrooms,bathrooms,monthly_rent,operation_type');
    if (!props.length) return { done: 'No properties to score.' };
    const scored = props.map(p => {
      const ck = p.city?.toLowerCase().replace(/[^a-z]/g, '');
      const mk = MKT[ck];
      let s = 50;
      if (mk) { s += mk.risk === 'low' ? 15 : mk.risk === 'medium' ? 8 : -5; s += mk.trend === 'booming' ? 15 : mk.trend === 'growing' ? 10 : 5; const mo = new Date().getMonth() + 1; if (mk.peak.includes(mo)) s += 5; if (mk.slow.includes(mo)) s -= 5; }
      if (p.monthly_rent && p.monthly_rent < 2000) s += 5;
      s = Math.min(100, Math.max(0, s));
      dbPatch('properties', `id=eq.${p.id}`, { penny_score: s }).catch(() => {});
      const r = s >= 80 ? 'STRONG BUY' : s >= 65 ? 'BUY' : s >= 50 ? 'HOLD' : 'AVOID';
      return `**${p.listing_title || p.title || 'Property'}** (${p.city}, ${p.state}) â€” Score: **${s}/100** ${r}`;
    });
    return { done: `**DEAL SCORES:**\n${scored.join('\n')}` };
  }

  if (act === 'analyze' || act === 'revenue') {
    const adrVal = intent.adr ? parseInt(intent.adr) : null;
    const occVal = intent.occ ? parseInt(intent.occ) : null;
    const rentVal = intent.rent ? parseInt(String(intent.rent).replace(/,/g, '')) : null;
    const mk = intent.cities?.length ? MKT[intent.cities[0]] : null;
    if (adrVal && occVal) {
      const monthly = Math.round((occVal / 100) * 365 * adrVal / 12);
      const annual = monthly * 12;
      const expenses = rentVal ? rentVal + Math.round(rentVal * 0.3) : Math.round(monthly * 0.35);
      const net = monthly - expenses;
      let score = 50;
      if (adrVal >= 150 && adrVal <= 300) score += 15;
      if (occVal >= 65) score += 15;
      if (net > 2000) score += 10;
      if (net > 0) score += 10;
      score = Math.min(100, score);
      const rating = score >= 80 ? 'STRONG BUY' : score >= 65 ? 'BUY' : score >= 50 ? 'HOLD' : 'CAUTION';
      let r = `**DEAL ANALYSIS${mk ? ` â€” ${mk.n}` : ''}:**\n\n`;
      r += `**Inputs:** ADR $${adrVal} | Occupancy ${occVal}% ${rentVal ? `| Rent $${rentVal.toLocaleString()}/mo` : ''}\n\n`;
      r += `**Revenue Projections:**\n- Gross Monthly: **$${monthly.toLocaleString()}**\n- Gross Annual: **$${annual.toLocaleString()}**\n- Est. Expenses: **$${expenses.toLocaleString()}/mo**\n- **Net Monthly: $${net.toLocaleString()}**\n- **Net Annual: $${(net * 12).toLocaleString()}**\n\n`;
      r += `**Penny Score: ${score}/100 (${rating})**\n`;
      if (mk) r += `\n**Market (${mk.n}):** ADR $${mk.adr[0]}-$${mk.adr[1]} | Avg Occ ${mk.occ}% | Risk: ${mk.risk} | Trend: ${mk.trend}`;
      return { done: r };
    }
    if (mk) {
      const avg = Math.round((mk.adr[0] + mk.adr[1]) / 2);
      const monthly = Math.round((mk.occ / 100) * 365 * avg / 12);
      return { done: `**MARKET ESTIMATE (${mk.n}):**\n- Avg ADR: $${avg}\n- Avg Occupancy: ${mk.occ}%\n- RevPAR: $${mk.revpar}\n- Est. Monthly Revenue: **$${monthly.toLocaleString()}**\n- Risk Level: ${mk.risk}\n- Trend: ${mk.trend}\n- Peak Months: ${mk.peak.join(', ')}\n- Demand Drivers: ${mk.drivers.join(', ')}\n\nProvide your ADR and occupancy for a precise analysis!` };
    }
    return { done: 'Provide ADR and occupancy %. Example: "Analyze with ADR $200 and 65% occupancy in Austin"' };
  }

  if (act === 'marketplace') {
    let deals: any[] = [];
    const sel = 'select=id,listing_title,title,city,state,bedrooms,bathrooms,monthly_rent,operation_type,penny_score,acquisition_fee';
    if (intent.cities?.length) {
      for (const c of intent.cities.slice(0, 3)) {
        const cn = MKT[c]?.n.split(',')[0] || c;
        deals.push(...await dbGet('properties', `${sel}&or=(is_published.eq.true,status.eq.published)&city=ilike.*${encodeURIComponent(cn)}*&order=created_at.desc&limit=5`));
      }
    }
    if (deals.length < 5) deals.push(...await dbGet('properties', `${sel}&or=(is_published.eq.true,status.eq.published)&order=created_at.desc&limit=${10 - deals.length}`));
    deals = deals.filter((d, i, a) => i === a.findIndex(x => x.id === d.id));
    if (deals.length) {
      const list = deals.map(d => `- **${d.listing_title || d.title || 'Property'}** in ${d.city}, ${d.state} | ${d.bedrooms}BR/${d.bathrooms}BA | $${d.monthly_rent?.toLocaleString()}/mo | Fee: $${d.acquisition_fee?.toLocaleString() || 'TBD'}`).join('\n');
      return { done: `**${deals.length} MARKETPLACE DEALS:**\n${list}\n\nWant me to analyze any of these deals? Just tell me which one!`, data: deals };
    }
    return { done: 'No deals currently on the marketplace. Set up Deal Alerts to get notified when new deals are posted!' };
  }

  if (act === 'portfolio') {
    const port = invCtx.portfolio || [];
    if (port.length > 0) {
      const active = port.filter((p: any) => p.property_status === 'active');
      const pending = port.filter((p: any) => p.property_status === 'pending' || p.property_status === 'pending_approval');
      let r = `**YOUR PORTFOLIO (${port.length} properties):**\n`;
      r += `Active: ${active.length} | In Progress: ${pending.length}\n`;
      r += `Total Monthly Rent: **$${invCtx.totalRent?.toLocaleString()}**\n`;
      r += `Total Monthly Earnings: **$${invCtx.totalEarnings?.toLocaleString()}**\n`;
      r += `Total Acquisition Fees: **$${invCtx.totalFees?.toLocaleString()}**\n\n`;
      port.forEach((p: any) => {
        r += `- **${p.address || 'Property'}**, ${p.city}, ${p.state} | ${p.bedrooms}bd/${p.bathrooms}ba | $${(p.monthly_rent || 0).toLocaleString()}/mo | Status: ${p.property_status || 'active'}\n`;
      });
      const net = (invCtx.totalEarnings || 0) - (invCtx.totalRent || 0);
      if (net !== 0) r += `\n**Net Monthly: ${net >= 0 ? '+' : ''}$${net.toLocaleString()}**`;
      r += `\n\nView your full **Portfolio Dashboard** for charts and detailed metrics.`;
      return { done: r };
    }
    return { done: "No properties in your portfolio yet. Browse the Deal Marketplace or talk to your Acquisition Manager to get started!" };
  }

  if (act === 'credits') {
    const inv = invCtx.investor;
    const balance = inv?.credit_balance || 0;
    let r = `**YOUR CREDIT SUMMARY:**\n- Account Balance: **$${balance.toLocaleString()}**\n`;
    
    // Try to get detailed credits
    const credits = await dbGet('investor_credits', `investor_id=eq.${ctx.userId}&credit_status=eq.active&select=amount,credit_type,source_description,created_at`);
    if (credits.length > 0) {
      r += `- Active Credits: **${credits.length}**\n\n**Active Credits:**\n`;
      credits.forEach((c: any) => {
        r += `- $${c.amount?.toLocaleString()} (${c.credit_type || 'credit'}) â€” ${c.source_description || 'N/A'}\n`;
      });
    } else {
      r += `- Active Credits: **0**\n`;
    }
    r += '\n**Note:** Credits at Access Your Place do NOT expire. They can be applied toward future acquisition fees.';
    return { done: r };
  }

  if (act === 'slow_season') {
    return { done: `**SLOW SEASON STRATEGIES:**\n\n**1. Dynamic Pricing** â€” Drop rates 15-25%, use PriceLabs/Beyond Pricing, offer weekly (15-20% off) and monthly (30-40% off) discounts\n\n**2. Mid-Term Rental Pivot** â€” List on Furnished Finder, Zillow, Facebook Marketplace. Target traveling nurses, corporate relocations, insurance claims. 30-90 day stays.\n\n**3. Co-Living Strategy** â€” Rent individual rooms to long-term tenants. Can generate 1.5-2x traditional lease rent.\n\n**4. Listing Optimization** â€” Update photos seasonally, refresh title/description, add seasonal amenities\n\n**5. Guest Experience** â€” Welcome basket, local guidebook, early check-in/late checkout during slow periods, consider pet-friendly\n\n**6. Cross-Platform Marketing** â€” List on VRBO, Booking.com, direct booking sites. Run social media promotions.\n\n**7. Expense Reduction** â€” Negotiate utility rates, stock up on supplies during sales, reduce cleaning frequency for longer stays\n\n**Target:** 55%+ occupancy even in slow season.` };
  }

  if (act === 'regulations') {
    const mk = intent.cities?.length ? MKT[intent.cities[0]] : null;
    if (mk) {
      return { done: `**STR REGULATIONS â€” ${mk.n}:**\n\n- **Current Status:** ${mk.reg}\n- **Risk Level:** ${mk.risk}\n- **Market Trend:** ${mk.trend}\n\n**General Requirements:**\n- Business license or STR permit\n- Transient occupancy tax (TOT) registration\n- Safety inspections\n- Insurance ($1M+ liability recommended)\n- Max occupancy limits\n\n**Important:** Always verify current regulations before acquiring. Your Acquisition Manager can research specific market regulations.` };
    }
    return { done: `**STR REGULATIONS â€” General Guide:**\n\n**Favorable Markets:** Phoenix AZ (state preemption), Tampa FL, Dallas TX (HB 2797), Jacksonville FL\n\n**Strict Markets:** Nashville TN (owner-occupied only), Denver CO (primary residence), Miami FL (30-day min in some areas)\n\n**Typical Requirements:** Business license, TOT registration, safety inspections, $1M+ liability insurance\n\nWhich market would you like me to look into specifically?` };
  }

  // v9.0: Market outlook intent
  if (act === 'market_outlook') {
    const mk = intent.cities?.length ? MKT[intent.cities[0]] : null;
    if (mk) {
      const mo = new Date().getMonth() + 1;
      const season = mk.peak.includes(mo) ? 'PEAK SEASON' : mk.slow.includes(mo) ? 'SLOW SEASON' : 'MODERATE SEASON';
      const avg = Math.round((mk.adr[0] + mk.adr[1]) / 2);
      const estRevenue = Math.round((mk.occ / 100) * 365 * avg / 12);
      let r = `**MARKET OUTLOOK â€” ${mk.n}**\n\n`;
      r += `**Current Season:** ${season} (Month ${mo})\n`;
      r += `**ADR Range:** $${mk.adr[0]} - $${mk.adr[1]}\n`;
      r += `**Avg Occupancy:** ${mk.occ}%\n`;
      r += `**RevPAR:** $${mk.revpar}\n`;
      r += `**Est. Monthly Revenue:** $${estRevenue.toLocaleString()}\n`;
      r += `**Risk Level:** ${mk.risk}\n`;
      r += `**Market Trend:** ${mk.trend}\n`;
      r += `**Regulation:** ${mk.reg}\n\n`;
      r += `**Demand Drivers:** ${mk.drivers.join(', ')}\n`;
      r += `**Peak Months:** ${mk.peak.join(', ')}\n`;
      r += `**Slow Months:** ${mk.slow.join(', ')}\n\n`;
      if (mk.trend === 'booming') r += `This market is **booming** â€” strong demand and growing investor interest. Act quickly on good deals.`;
      else if (mk.trend === 'growing') r += `This market is **growing** â€” solid fundamentals with room for expansion. Good time to enter.`;
      else r += `This market is **stable** â€” consistent returns but watch for regulatory changes.`;
      return { done: r };
    }
    return { done: '' };
  }

  return { done: '' };
}

function cityCtx(cities: string[]): string {
  if (!cities?.length) return '';
  return cities.slice(0, 2).map(c => {
    const m = MKT[c];
    if (!m) return '';
    const mo = new Date().getMonth() + 1;
    const season = m.peak.includes(mo) ? 'PEAK' : m.slow.includes(mo) ? 'SLOW' : 'MODERATE';
    return `${m.n}: ADR $${m.adr[0]}-$${m.adr[1]}, Occ ${m.occ}%, Risk: ${m.risk}, Trend: ${m.trend}, Season: ${season}`;
  }).filter(Boolean).join('. ');
}

function buildPrompt(isStaff: boolean, name: string, actionDone: string, cities: string[], investorContext: any): string {
  const ctx = cityCtx(cities);
  let p = `You are Penny, the AI assistant for Access Your Place (AYP), a rental arbitrage platform. You EXECUTE real actions and return REAL data. You are NOT a generic chatbot.

Key policies: No Refunds (Lifetime Credit per Section 4.2), $5,000 Capital Rule, Credits do NOT expire.

CRITICAL RULES:
1. You have ALREADY executed database operations and retrieved REAL data. Present the results clearly.
2. NEVER say you "can't access" data or "don't have the ability" â€” you ALREADY HAVE the data below.
3. NEVER use filler phrases like "I'd be happy to help" or "feel free to ask" without providing actual data.
4. If you have action results, present them with specific numbers and details.
5. Be concise and data-driven. Lead with facts, not pleasantries.`;

  if (isStaff) {
    p += `\n\nMODE: STAFF (${name}). Be efficient and precise.`;
  } else {
    p += `\n\nMODE: INVESTOR (${name}). Be encouraging and expert.`;
    // v9.0: Include investor context in prompt
    if (investorContext?.investor) {
      const inv = investorContext.investor;
      p += `\n\nINVESTOR CONTEXT (use this real data):`;
      p += `\n- Name: ${inv.full_name || name}`;
      p += `\n- Funded: ${inv.account_funded ? 'Yes' : 'No'}`;
      p += `\n- Portfolio: ${investorContext.portfolioCount || 0} properties`;
      p += `\n- Total Rent: $${(investorContext.totalRent || 0).toLocaleString()}/mo`;
      p += `\n- Credit Balance: $${(inv.credit_balance || 0).toLocaleString()}`;
      if (inv.preferred_markets?.length) p += `\n- Markets: ${inv.preferred_markets.join(', ')}`;
    }
  }

  if (actionDone) p += `\n\nACTION RESULTS (present these REAL results â€” this is REAL data from the database):\n${actionDone}`;
  if (ctx) p += `\n\nMarket context: ${ctx}`;

  return p;
}

async function callAI(systemPrompt: string, userMessage: string, history?: any[]): Promise<string> {
  const key = Deno.env.get('GATEWAY_API_KEY');
  if (!key) return '';

  const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
  if (history?.length) {
    for (const m of history.slice(-6)) messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const resp = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, temperature: 0.7, max_tokens: 2000 })
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

async function saveSession(uid: string, userType: string, userName: string, sessionId: string, newMessages: any[], context: any): Promise<string> {
  const now = new Date().toISOString();
  const existing = await dbGet('penny_chat_history', `session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${uid}&limit=1`);
  if (existing.length > 0) {
    const allMessages = [...(existing[0].messages || []), ...newMessages];
    const prevActions = existing[0].context?.actions_log || [];
    const updatedContext = { ...existing[0].context, ...context, actions_log: [...prevActions, ...(context.action && context.action !== 'chat' ? [{ action: context.action, success: context.action_success, timestamp: now }] : [])], last_action: context.action, message_count: allMessages.length, v: '9.0' };
    await dbPatch('penny_chat_history', `id=eq.${existing[0].id}`, { messages: allMessages, context: updatedContext, updated_at: now, is_active: true });
    return existing[0].id;
  } else {
    const contextWithLog = { ...context, actions_log: context.action && context.action !== 'chat' ? [{ action: context.action, success: context.action_success, timestamp: now }] : [], last_action: context.action, message_count: newMessages.length, v: '9.0' };
    const result = await dbPost('penny_chat_history', { user_id: uid, user_type: userType, user_name: userName, session_id: sessionId, messages: newMessages, context: contextWithLog, created_at: now, updated_at: now, is_active: true });
    return result?.[0]?.id || '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, user_id, investor_id, user_type = 'investor', user_name = 'User', message, conversation_history, session_id, property_id, market } = body;
    const uid = user_id || investor_id;
    const isStaff = user_type === 'staff';

    if (action === 'get_suggested_questions') {
      const q = isStaff
        ? ['Look up investor [name]', 'Draft an Acquisition Agreement for [name]', 'Show me all properties in Austin', 'Score the latest deals', 'Client is asking for a refund', 'Write an Airbnb listing for a 3BR in Tampa', 'Pull pipeline stats', 'Generate landlord outreach talking points']
        : ['What deals are available on the marketplace?', 'Analyze a deal with ADR $200 and 65% occupancy in Austin', 'Show me my portfolio summary', 'Check my credit balance', 'Who is my acquisition manager?', 'What are my next onboarding steps?', 'Show me my documents', "What's the market outlook for Tampa?"];
      return new Response(JSON.stringify({ success: true, suggestions: q }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_market_data') {
      const k = market?.toLowerCase().replace(/[^a-z]/g, '');
      return new Response(JSON.stringify(MKT[k] ? { success: true, market: MKT[k] } : { success: false, error: 'Market not found' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_deal_score') {
      if (!property_id) return new Response(JSON.stringify({ success: false, error: 'property_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const s = await dbGet('penny_deal_scores', `property_id=eq.${property_id}&order=scored_at.desc&limit=1`);
      return new Response(JSON.stringify({ success: true, score: s[0] || null }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_market_alerts') {
      const alerts: any[] = [];
      Object.entries(MKT).forEach(([k, m]) => {
        if (m.risk !== 'low') alerts.push({ id: `reg_${k}`, type: 'regulation', severity: m.risk, market: m.n, title: `Regulation Alert: ${m.n}`, description: m.reg });
      });
      return new Response(JSON.stringify({ success: true, alerts: alerts.slice(0, 10) }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_all_markets') {
      const markets = Object.entries(MKT).map(([k, d]) => ({ id: k, name: d.n, adr: `$${d.adr[0]}-$${d.adr[1]}`, occ: `${d.occ}%`, risk: d.risk, trend: d.trend }));
      return new Response(JSON.stringify({ success: true, markets }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_history') {
      const h = await dbGet('penny_chat_history', `user_id=eq.${uid}&user_type=eq.${user_type}&order=updated_at.desc&limit=20`);
      const sessions = (h || []).map(s => ({ id: s.id, session_id: s.session_id, messages: s.messages || [], context: s.context || {}, created_at: s.created_at, updated_at: s.updated_at, is_active: s.is_active, preview: s.messages?.[0]?.content?.substring(0, 100) || 'New conversation', message_count: s.messages?.length || 0, last_action: s.context?.last_action || 'chat' }));
      return new Response(JSON.stringify({ success: true, history: sessions }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'get_audit_log') {
      const logs = await dbGet('penny_chat_history', `order=created_at.desc&limit=100&select=id,user_id,user_type,user_name,session_id,context,messages,created_at,updated_at`);
      return new Response(JSON.stringify({ success: true, logs: logs.map(l => ({ ...l, last_action: l.context?.last_action || 'chat', message_count: l.messages?.length || 0 })), stats: { total_conversations: logs.length } }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!message) return new Response(JSON.stringify({ success: false, error: 'Message required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // v9.0: STEP 1 - Pre-fetch investor context from database
    let investorContext: any = {};
    if (uid && !isStaff) {
      console.log('[v9.0] Pre-fetching investor context for:', uid);
      investorContext = await prefetchInvestorContext(uid);
      console.log('[v9.0] Context loaded: portfolio=%d, docs=%d', investorContext.portfolioCount || 0, investorContext.documentCount || 0);
    }

    // v9.0: STEP 2 - Detect intent with expanded detection
    const intent = detectIntent(message, isStaff);
    console.log('[v9.0] Intent:', intent.act, 'User:', user_name);

    // v9.0: STEP 3 - Execute action with pre-fetched context
    const result = await execute(intent, { userId: uid, isStaff, investorContext });
    const actSuccess = result.done.length > 0;

    // v9.0: STEP 4 - Determine if AI is needed
    // For data-answerable intents, skip AI entirely and use action results directly
    const dataIntents = ['documents', 'my_manager', 'account_status', 'onboarding', 'portfolio', 'credits', 'slow_season', 'regulations', 'market_outlook', 'pipeline_stats', 'lookup', 'update_status', 'log_note', 'draft_acquisition', 'draft_sublease', 'draft_master_lease', 'refund_rebuttal', 'search_props', 'score', 'marketplace'];
    
    let finalMsg = '';
    
    if (actSuccess && dataIntents.includes(intent.act)) {
      // v9.0: Data intent answered from DB â€” use result directly, optionally enhance with AI
      console.log('[v9.0] Data intent answered from DB, using direct result');
      finalMsg = result.done;
      
      // Try AI enhancement but don't block on it
      try {
        const prompt = buildPrompt(isStaff, user_name, result.done, intent.cities || [], investorContext);
        const aiResponse = await callAI(prompt, message, conversation_history);
        if (aiResponse && !isTemplatedResponse(aiResponse) && aiResponse.length > result.done.length * 0.5) {
          finalMsg = aiResponse;
        }
      } catch { /* Use direct result */ }
    } else if (actSuccess) {
      // Action succeeded but not a pure data intent â€” try AI enhancement
      const prompt = buildPrompt(isStaff, user_name, result.done, intent.cities || [], investorContext);
      const aiResponse = await callAI(prompt, message, conversation_history);
      if (aiResponse && !isTemplatedResponse(aiResponse)) {
        finalMsg = aiResponse;
      } else {
        finalMsg = result.done;
      }
    } else {
      // No action executed â€” try AI with investor context
      const prompt = buildPrompt(isStaff, user_name, '', intent.cities || [], investorContext);
      const aiResponse = await callAI(prompt, message, conversation_history);
      
      if (aiResponse && !isTemplatedResponse(aiResponse)) {
        finalMsg = aiResponse;
      } else if (aiResponse) {
        // v9.0: AI returned generic response â€” retry with more specific prompt
        console.log('[v9.0] Generic response detected, retrying with specific prompt');
        const retryPrompt = `${prompt}\n\nIMPORTANT: The user asked "${message}". You MUST provide a specific, actionable answer. Do NOT use filler phrases. If you can answer from the investor context data above, do so. If this is about deals, use the market data. If you truly cannot answer, suggest specific commands the user can try like "Show my portfolio" or "Analyze a deal with $200 ADR in Austin".`;
        const retryResponse = await callAI(retryPrompt, message, conversation_history);
        if (retryResponse && !isTemplatedResponse(retryResponse)) {
          finalMsg = retryResponse;
        }
      }
    }

    // v9.0: STEP 5 - Final fallback with context-aware help
    if (!finalMsg) {
      const fn = user_name.split(' ')[0];
      const hasPortfolio = (investorContext.portfolioCount || 0) > 0;
      const hasFunding = investorContext.investor?.account_funded;
      
      if (isStaff) {
        finalMsg = `Hi ${fn}! I can help you with:\n\n- **"Look up [investor name]"** â€” Search investor database\n- **"Update [name]'s status to fully funded"** â€” Change investor status\n- **"Draft an Acquisition Agreement for [name]"** â€” Generate agreement\n- **"Score deals in Austin"** â€” Run Penny Score analysis\n- **"Pipeline stats"** â€” View pipeline overview\n- **"Show properties in [city]"** â€” Search deal flow\n\nWhat do you need?`;
      } else {
        let suggestions = `Hi ${fn}! Here's what I can do for you:\n\n`;
        if (hasPortfolio) suggestions += `- **"Show my portfolio"** â€” View your ${investorContext.portfolioCount} properties and earnings\n`;
        suggestions += `- **"Check my credit balance"** â€” See your current credits ($${(investorContext.investor?.credit_balance || 0).toLocaleString()})\n`;
        suggestions += `- **"Who is my AM?"** â€” View your assigned Acquisition Manager\n`;
        suggestions += `- **"Show my documents"** â€” List your uploaded documents\n`;
        suggestions += `- **"What deals are available?"** â€” Browse marketplace deals\n`;
        suggestions += `- **"Analyze with $200 ADR and 70% occupancy in Austin"** â€” Full deal analysis\n`;
        if (!hasFunding) suggestions += `- **"What are my next steps?"** â€” See your onboarding progress\n`;
        suggestions += `\nJust ask me anything about your investments!`;
        finalMsg = suggestions;
      }
    }

    // v9.0: STEP 6 - Save session
    const activeSessionId = session_id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newMessages = [
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: finalMsg, timestamp: new Date().toISOString() }
    ];
    
    if (uid) {
      saveSession(uid, user_type, user_name, activeSessionId, newMessages, { is_staff: isStaff, action: intent.act, action_success: actSuccess, v: '9.0', had_context: !!investorContext.investor }).catch(err => console.error('Session save error:', err));
    }

    return new Response(JSON.stringify({
      success: true,
      message: finalMsg,
      session_id: activeSessionId,
      is_staff: isStaff,
      actions_executed: actSuccess ? [{ action: intent.act, success: true, summary: result.done.substring(0, 200) }] : [],
      markets_referenced: intent.cities || [],
      penny_version: '9.0'
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error: any) {
    console.error('Penny AI error:', error);
    return new Response(JSON.stringify({
      success: true,
      message: "I had a brief hiccup processing your request. Try a specific command like:\n- \"Show my portfolio\"\n- \"Check my credits\"\n- \"Analyze with $200 ADR and 70% occupancy in Austin\"\n- \"What deals are available?\"",
      actions_executed: [],
      penny_version: '9.0'
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});

