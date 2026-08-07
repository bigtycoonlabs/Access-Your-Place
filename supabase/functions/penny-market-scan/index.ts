// penny-market-scan — Penny ASKS before she answers.
//
// Owner's design, and it is right: when someone puts in an address, Penny should not
// return a wall of numbers. She should ask which scan they want -- STR, shared living,
// MTR, or all three.
//
// That is not interface polish. These are three different businesses in the same
// building. They use different data, different periods, and sometimes different tax
// treatment, and blending them into one answer produces a number that describes nothing.
//
// It matters twice over for output read aloud. A screen reader turns a wall of figures
// into a wall of speech, and the owners of this company are blind.
//
// WHAT IT WILL NOT DO:
//   - invent a figure. Each projection refuses independently and names what is missing.
//   - present a scan as a verified deal. A scan is Penny's research; nobody has spoken to
//     the landlord. The disclosure says so and offers a free call.
//
// NO Accept-Profile header: PostgREST here serves only the public schema.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Scan = 'str' | 'shared_living' | 'mtr' | 'all';
const SCANS = new Set(['str', 'shared_living', 'mtr', 'all']);

const CHOICES = [
  { value: 'str', label: 'Short-term rental',
    blurb: 'Nightly. What the place earns on Airbnb and the like, built from hotel occupancy and rates in that market.' },
  { value: 'shared_living', label: 'Shared living',
    blurb: 'Room by room, in a house you control. Monthly or weekly rent per room, at budget, median and luxury.' },
  { value: 'mtr', label: 'Mid-term rental',
    blurb: 'Furnished stays of a month or more. In some states these fall outside the lodging tax entirely.' },
  { value: 'all', label: 'All three',
    blurb: 'Run every strategy so you can compare them side by side.' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('penny-market-scan missing_config');
      return json({ success: false, error: 'Server configuration error.' }, 500);
    }
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const rpc = async (fn: string, args: unknown) => {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
      if (!r.ok) {
        console.error('penny-market-scan rpc_failed', fn, r.status, (await r.text()).slice(0, 200));
        return null;
      }
      return await r.json().catch(() => null);
    };

    const body = await req.json().catch(() => ({}));
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const address = String(body.address || '').trim() || null;
    const rooms = body.rooms ? Number(body.rooms) : null;
    const scanType = String(body.scan_type || '').trim().toLowerCase();

    if (!city || !state) {
      return json({ success: false, error: 'I need a city and state to look at a market.' }, 400);
    }

    // ---- THE ASK ----
    // No scan chosen yet, so Penny asks rather than answering everything at once.
    if (!scanType) {
      return json({
        success: true,
        needs_choice: true,
        market: `${city}, ${state}`,
        question: `I can look at ${city} a few different ways, and they are genuinely different businesses. Which would you like?`,
        options: CHOICES,
        note: 'Pick one, or all three to compare them side by side.',
      });
    }

    if (!SCANS.has(scanType)) {
      return json({ success: false, error: 'Choose short-term rental, shared living, mid-term, or all three.' }, 400);
    }

    // ---- find the research for this market ----
    const findUrl = `${url}/rest/v1/deal_research?city=eq.${encodeURIComponent(city)}&state=eq.${encodeURIComponent(state)}&select=id,confirmed_by,confirmed_fields&limit=1`;
    const findRes = await fetch(findUrl, { headers });
    if (!findRes.ok) {
      console.error('penny-market-scan lookup_failed', findRes.status);
      return json({ success: false, error: 'Could not load research for that market.' }, 502);
    }
    const rows = await findRes.json().catch(() => []);
    const research = Array.isArray(rows) ? rows[0] : null;

    // No research at all is a real answer, not an empty result.
    if (!research?.id) {
      return json({
        success: true,
        market: `${city}, ${state}`,
        scan_type: scanType,
        scored: false,
        reason: `I have not researched ${city} yet, so I have nothing honest to show you. I would rather say that than put a number on screen I cannot stand behind.`,
        next_step: 'An acquisition manager can research this market properly and walk it through with you. There is no charge for that.',
        offer_call: true,
      }, 200);
    }

    const want = (s: Scan) => scanType === 'all' || scanType === s;
    const results: Record<string, unknown> = {};

    if (want('str')) results.str = await rpc('ayp_deal_score', { p_research_id: research.id });
    if (want('shared_living')) {
      results.shared_living = await rpc('ayp_shared_living_projection', { p_research_id: research.id, p_rooms: rooms });
    }
    if (want('mtr')) results.mtr = await rpc('ayp_mtr_projection', { p_research_id: research.id });

    // A scan is never an AYP verified deal. Nobody has spoken to the landlord.
    const disclosure = await rpc('ayp_scan_disclosure', { p_tier: 'penny_scan' });

    // Report honestly which strategies could actually be scored.
    const scoredList: string[] = [];
    const unscoredList: string[] = [];
    for (const [k, v] of Object.entries(results)) {
      ((v as any)?.scored ? scoredList : unscoredList).push(k);
    }

    console.log('penny-market-scan ran', JSON.stringify({
      city, state, scan_type: scanType, scored: scoredList, unscored: unscoredList,
    }));

    return json({
      success: true,
      market: `${city}, ${state}`,
      address,
      scan_type: scanType,
      results,
      scored_strategies: scoredList,
      unscored_strategies: unscoredList,
      // Stated plainly so no screen can dress a scan up as a verified deal.
      verification_tier: 'penny_scan',
      disclosure,
      offer_call: true,
      call_cta: 'Book a free call with an acquisition manager',
      call_lead_kind: 'verify_scan',
    });
  } catch (e) {
    console.error('penny-market-scan threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Something went wrong running that scan.' }, 500);
  }
});
