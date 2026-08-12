// property-forge
//
// Finds real rental listings in a market, then scores each one with the same engine that
// powers Penny's address scan.
//
// WHY THIS REPLACES leadforge
// The previous tool queried Google Custom Search and regex-parsed bedrooms, bathrooms and
// price out of the title and snippet of a search result. It needed GOOGLE_API_KEY and
// GOOGLE_CX, which have never been set on this project, so Property Forge has run zero
// searches in its entire life. Even with the keys it would have been guessing at numbers
// from a two-line search preview.
//
// This uses the OpenAI key that is already configured and already answering for Penny,
// with the web search tool. The model reads the actual listing pages rather than snippets,
// so bedrooms, rent and address come back as stated on the listing rather than inferred
// from a fragment. No Google Cloud project, no second billing account.
//
// WHAT IT WILL NOT DO
//   - It will not invent a listing. If search returns nothing, it says nothing was found.
//   - It will not present a scan as a verified deal. Everything here is penny_scan: a lead.
//     Nobody has spoken to the landlord.
//   - It will not report success when the search or the scoring failed. Empty and broken
//     are different, and the caller is told which.

const DATA_SCHEMA = 'public';
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';

interface Found {
  address?: string;
  city?: string;
  state?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthly_rent?: number;
  property_type?: string;
  source_url?: string;
  listing_name?: string;
  notes?: string;
}

/** Search the live web for real listings. Returns [] only when nothing was found. */
async function findListings(
  city: string, state: string, minBeds: number, maxRent: number | null, limit: number,
): Promise<{ listings: Found[]; status: 'ok' | 'not_configured' | 'failed'; detail?: string }> {
  if (!OPENAI_KEY) return { listings: [], status: 'not_configured', detail: 'OPENAI_API_KEY is not set on this project.' };

  const budget = maxRent ? ` Only include units renting at or below $${maxRent} a month.` : '';
  const prompt =
    `Search the web for real rental units currently available in ${city}, ${state}. ` +
    `Find apartments, condos, townhomes or single family homes with at least ${minBeds} bedroom(s) ` +
    `that a company could lease and operate as a furnished rental.${budget}\n\n` +
    `Return ONLY a JSON array, no prose and no markdown fences. Up to ${limit} objects, each with:\n` +
    `address, city, state, bedrooms (number), bathrooms (number), monthly_rent (number, no symbols), ` +
    `property_type, listing_name, source_url, notes.\n\n` +
    `Rules you must follow:\n` +
    `- Only include a listing you actually found on a page. Never invent one.\n` +
    `- Omit any field the page does not state. Do NOT guess a rent or a bedroom count.\n` +
    `- source_url must be the real page you read.\n` +
    `- If you find nothing, return [].`;

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_SEARCH_MODEL') || 'gpt-4o',
        tools: [{ type: 'web_search_preview' }],
        input: prompt,
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 400);
      console.error('property-forge search_http', r.status, detail);
      return { listings: [], status: 'failed', detail: `Search provider returned HTTP ${r.status}.` };
    }
    const data = await r.json();

    // The Responses API returns a mix of blocks. Pull the text out by type rather than
    // by position, because the search call inserts blocks of its own ahead of the answer.
    let text = '';
    for (const item of (data.output || [])) {
      for (const c of (item.content || [])) {
        if (typeof c?.text === 'string') text += c.text;
      }
    }
    if (!text) text = String(data.output_text || '');

    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) {
      console.error('property-forge no_json_in_reply', cleaned.slice(0, 300));
      return { listings: [], status: 'failed', detail: 'The search ran but did not return usable listing data.' };
    }
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return { listings: Array.isArray(parsed) ? parsed : [], status: 'ok' };
  } catch (e) {
    console.error('property-forge search_threw', e instanceof Error ? e.message : String(e));
    return { listings: [], status: 'failed', detail: 'The search did not complete.' };
  }
}

/** Score one find with the existing scan engine. Never fabricates on failure. */
async function scoreOne(city: string, state: string, l: Found) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/penny-market-scan`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: l.city || city,
        state: l.state || state,
        address: l.address || null,
        rooms: l.bedrooms || null,
        scan_type: 'str',
      }),
    });
    if (!r.ok) return { scan: null, scan_status: 'unavailable' as const };
    const scan = await r.json();
    return { scan: scan?.results ?? null, scan_status: 'ok' as const };
  } catch {
    return { scan: null, scan_status: 'unavailable' as const };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const minBeds = Number(body.min_bedrooms) || 1;
    const maxRent = body.max_rent ? Number(body.max_rent) : null;
    const limit = Math.min(Number(body.limit) || 6, 10);

    if (!city || !state) {
      return json({ success: false, error: 'A city and a two letter state are required.' }, 400);
    }

    const { listings, status, detail } = await findListings(city, state, minBeds, maxRent, limit);

    // Three different outcomes that must never look alike.
    if (status === 'not_configured') {
      return json({
        success: false, error: 'not_configured', searched: false,
        message: `Property Forge is not switched on: ${detail} No search was run, so this is not the same as finding nothing in ${city}.`,
      }, 503);
    }
    if (status === 'failed') {
      return json({
        success: false, error: 'search_failed', searched: false,
        message: `The search did not run: ${detail} This is not the same as there being no properties in ${city}.`,
      }, 502);
    }
    if (listings.length === 0) {
      return json({
        success: true, searched: true, count: 0, results: [],
        message: `The search ran and found no available units in ${city}, ${state} matching ${minBeds}+ bedrooms${maxRent ? ` under $${maxRent}` : ''}. That is a real empty result, not a failure. Try widening the bedroom count or the rent ceiling.`,
      });
    }

    const scored = [];
    for (const l of listings) {
      const { scan, scan_status } = await scoreOne(city, state, l);
      scored.push({ ...l, scan, scan_status });
    }
    const unscored = scored.filter((x) => x.scan_status !== 'ok').length;

    return json({
      success: true,
      searched: true,
      market: `${city}, ${state}`,
      count: scored.length,
      results: scored,
      // Said every time. A find is a lead, not a deal.
      verification_tier: 'penny_scan',
      disclosure:
        'These are properties found on the open web and scored from market data. Nobody has spoken to the landlord, ' +
        'the numbers have not been validated by our team, and none of these is an Access Your Place verified deal. ' +
        'They are leads. An acquisition manager verifies a property before it becomes a deal.',
      scoring_note: unscored > 0
        ? `${unscored} of ${scored.length} could not be scored. Those carry no projection at all rather than an estimated one.`
        : null,
      next_step: 'Ask an acquisition manager to verify any of these, or reserve one already on the marketplace.',
    });
  } catch (e) {
    console.error('property-forge threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error' }, 500);
  }
});
