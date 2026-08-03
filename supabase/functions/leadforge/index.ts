// LeadForge engine: real property lead sourcing with credit-gated release.
// Search is FREE and returns opportunities with specifics HIDDEN (no address, photos, or source
// link). Releasing one real property costs one $62.50 LeadForge credit (staff unlimited), and
// only then reveals its address, photos, and direct source link. Truth-guard: only REAL
// Google-sourced listings are ever cached or released — never a fabricated one. Market analysis
// is an AI estimate and is labeled as such; a failed analysis is reported as unavailable, never
// replaced with invented numbers.

const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_KEY = Deno.env.get('GOOGLE_API_KEY');
const GOOGLE_CX = Deno.env.get('GOOGLE_CX');
const GATEWAY_KEY = Deno.env.get('GATEWAY_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function fetchTimeout(url: string, options: RequestInit, ms = 15000): Promise<Response> {
  const t = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  return Promise.race([fetch(url, options), t]);
}

// Data-schema REST (cache + releases live in the data schema).
function dataRest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', SERVICE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_KEY}`);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept-Profile', DATA_SCHEMA);
  headers.set('Content-Profile', DATA_SCHEMA);
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

// Public-schema RPC (leadforge_* money functions).
async function rpc(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc ${name} ${res.status}: ${text}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// Staff detection is robust across schema location of staff_users.
async function staffLookup(profile: string | null, staffId: string): Promise<boolean> {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  if (profile) headers['Accept-Profile'] = profile;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staffId}&select=id&limit=1`, { headers });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}
async function isStaff(staffId: string | null): Promise<boolean> {
  if (!staffId) return false;
  try { if (await staffLookup(DATA_SCHEMA, staffId)) return true; } catch (_e) { /* ignore */ }
  try { if (await staffLookup(null, staffId)) return true; } catch (_e) { /* ignore */ }
  return false;
}

// --- SEARCH: real listings (Google CSE) + market analysis (gateway). Specifics HIDDEN. ---
async function doSearch(body: any) {
  const { zip_code, city = '', state = '', min_beds = 2, operation_type = 'all', investor_id = null } = body;
  if (!zip_code) return json({ success: false, error: 'zip_code is required' }, 400);

  // Market analysis — an AI ESTIMATE, labeled as such. Never fabricated on failure.
  let analysis: any = null;
  let analysisSource = 'unavailable';
  if (GATEWAY_KEY) {
    try {
      const aiRes = await fetchTimeout('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': GATEWAY_KEY },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: `Analyze ZIP ${zip_code}${city ? ` (${city}, ${state})` : ''} for short-term rental and co-living investment. Return ONLY valid JSON (no markdown): { "str_score": number 1-10, "coliving_score": number 1-10, "avg_rent_2br": number, "avg_rent_3br": number, "str_avg_adr": number, "str_avg_occupancy": number 0-1, "coliving_room_rate": number, "regulations": "friendly|moderate|strict", "competition_level": "low|medium|high", "recommended_strategy": "str|coliving|hybrid", "risk_factors": ["string"], "opportunity_notes": "string", "demand_drivers": ["string"], "peak_months": [number], "slow_months": [number] }` }],
          temperature: 0.3, max_tokens: 800,
        }),
      }, 15000);
      if (aiRes.ok) {
        const d = await aiRes.json();
        const content = d.choices?.[0]?.message?.content || '';
        const m = content.match(/\{[\s\S]*\}/);
        if (m) { analysis = JSON.parse(m[0]); analysisSource = 'ai_estimate'; }
      }
    } catch (_e) { /* leave analysis null; never invent numbers */ }
  }

  // Real listings via Google Custom Search — real source links, honestly unverified.
  let found: any[] = [];
  if (GOOGLE_KEY && GOOGLE_CX) {
    try {
      const q = `rental property ${zip_code} ${city} ${state} for rent ${min_beds}+ bedrooms`;
      const sr = await fetchTimeout(
        `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(q)}&num=10`,
        { method: 'GET' }, 10000);
      if (sr.ok) {
        const sd = await sr.json();
        if (Array.isArray(sd.items)) {
          found = sd.items.map((item: any) => {
            const text = `${item.title} ${item.snippet}`;
            const bed = text.match(/(\d+)\s*(bed|br|bedroom)/i);
            const bath = text.match(/(\d+\.?\d*)\s*(bath|ba|bathroom)/i);
            const price = text.match(/\$(\d{1,3}(?:,\d{3})*|\d+)/);
            return {
              title: item.title || 'Rental property',
              source_url: item.link,
              snippet: item.snippet || '',
              bedrooms: bed ? parseInt(bed[1]) : null,
              bathrooms: bath ? parseFloat(bath[1]) : null,
              monthly_rent: price ? parseInt(price[1].replace(/,/g, '')) : null,
              city, state, zip_code, is_verified: false, requires_verification: true,
            };
          }).filter((l: any) => l.source_url && (!l.bedrooms || l.bedrooms >= min_beds));
        }
      }
    } catch (_e) { /* no listings found */ }
  }

  // Truth-guard: only cache + offer REAL sourced listings. Teasers hide address/source/photos.
  const opportunities: any[] = [];
  for (const l of found) {
    const token = crypto.randomUUID();
    try {
      const ins = await dataRest('leadforge_search_cache', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ token, investor_id, listing: l, zip_code }),
      });
      if (!ins.ok) continue;
    } catch (_e) { continue; }
    opportunities.push({
      token,
      area: `${city || 'Area'}${state ? ', ' + state : ''} ${zip_code}`.trim(),
      bedrooms: l.bedrooms, bathrooms: l.bathrooms,
      est_monthly_rent: l.monthly_rent,
      operation_fit: operation_type === 'all' ? (analysis?.recommended_strategy || null) : operation_type,
      unverified: true,
      teaser: 'Full address, photos, and direct source link unlock on release (1 credit, $62.50).',
    });
  }

  let balance: any = null;
  if (investor_id) { try { balance = await rpc('leadforge_balance', { p_investor_id: investor_id }); } catch (_e) { /* ignore */ } }

  return json({
    success: true, zip_code,
    market_analysis: analysis,
    analysis_source: analysisSource, // 'ai_estimate' or 'unavailable' — never a fabricated default
    opportunities, opportunities_found: opportunities.length,
    balance,
    note: opportunities.length === 0
      ? 'No real listings were found for this search right now. Nothing was charged. Try a different ZIP or filters.'
      : 'Search is free. Releasing a property spends one $62.50 credit and reveals its address, photos, and direct source link.',
  });
}

// --- RELEASE: reveal ONE real property; spend one credit (staff unlimited, idempotent). ---
async function doRelease(body: any) {
  const { investor_id, token, staff_id = null } = body;
  if (!investor_id || !token) return json({ success: false, error: 'investor_id and token are required' }, 400);

  // Look up the cached real listing server-side (never exposed before release).
  let listing: any = null;
  try {
    const res = await dataRest(`leadforge_search_cache?token=eq.${token}&select=listing,expires_at&limit=1`, { method: 'GET' });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length) {
        if (new Date(rows[0].expires_at) < new Date()) {
          return json({ success: false, error: 'search_expired', message: 'That search expired. Run the search again, then release.' }, 410);
        }
        listing = rows[0].listing;
      }
    }
  } catch (_e) { /* fallthrough to not_found */ }
  if (!listing || !listing.source_url) {
    return json({ success: false, error: 'not_found', message: 'That opportunity was not found. Run the search again, then release.' }, 404);
  }

  const staff = await isStaff(staff_id);
  // idempotency_key = token: releasing the same opportunity twice never double-charges.
  let result: any;
  try {
    result = await rpc('leadforge_release', {
      p_investor_id: investor_id, p_idempotency_key: token, p_listing: listing, p_is_staff: staff,
    });
  } catch (e: any) {
    return json({ success: false, error: 'release_failed', message: e.message }, 500);
  }
  if (result && result.success === false && result.error === 'insufficient_credits') {
    return json({
      success: false, error: 'insufficient_credits',
      message: 'You are out of LeadForge release credits. 20 releases are $1,250 ($62.50 each). Unused credit rolls into your platform purchase.',
      unit_cost: 62.50,
    }, 402);
  }
  return json(result);
}

async function doBalance(body: any) {
  const { investor_id } = body;
  if (!investor_id) return json({ success: false, error: 'investor_id is required' }, 400);
  const balance = await rpc('leadforge_balance', { p_investor_id: investor_id });
  return json({ success: true, balance });
}

async function doReleases(body: any) {
  const { investor_id } = body;
  if (!investor_id) return json({ success: false, error: 'investor_id is required' }, 400);
  const res = await dataRest(
    `leadforge_releases?investor_id=eq.${investor_id}&select=id,zip_code,city,state,title,source_url,monthly_rent,bedrooms,bathrooms,operation_fit,analysis,credit_amount,status,released_by,created_at&order=created_at.desc`,
    { method: 'GET' });
  const rows = res.ok ? await res.json() : [];
  return json({ success: true, releases: rows });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'search';
    switch (action) {
      case 'search': return await doSearch(body);
      case 'release': return await doRelease(body);
      case 'get_balance': return await doBalance(body);
      case 'get_releases': return await doReleases(body);
      default: return json({ success: false, error: `unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    return json({ success: false, error: e.message }, 500);
  }
});
