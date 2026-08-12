// forge-release
//
// Releases the full details on a Property Forge find, and takes the $62 of credit that
// costs. Searching is free and stays free; this is the only paid step.
//
// RULES THIS ENFORCES
//   - Signed in, always. Identity comes from the session, never from the request body.
//   - $62 per release. The $186 welcome credit covers three.
//   - Nobody pays twice for the same property. A second request for an address already
//     released returns the details again and charges nothing.
//   - The credit is only spent if the details are actually handed over, and the details
//     are only handed over if the credit was actually spent. One or the other failing
//     must never leave a client charged for nothing or holding something they did not
//     pay for.
//
// It also records the release as a lead the client owns, so that the no-poaching promise
// in the terms is backed by a row rather than by good intentions: a property somebody has
// paid to release is not distributed to the network while they are pursuing it.

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
const RELEASE_COST = 62;

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', 'Accept-Profile': DATA_SCHEMA, 'Content-Profile': DATA_SCHEMA,
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

async function resolveInvestor(token: string) {
  if (!token) return null;
  const sr = await rest(`investor_sessions?session_token=eq.${encodeURIComponent(token)}&is_active=eq.true&select=investor_id,expires_at&limit=1`);
  if (!sr.ok) return null;
  const rows = await sr.json();
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s || (s.expires_at && new Date(s.expires_at) < new Date())) return null;
  const ir = await rest(`investors?id=eq.${encodeURIComponent(s.investor_id)}&select=id,full_name,email&limit=1`);
  if (!ir.ok) return null;
  const irows = await ir.json();
  return Array.isArray(irows) ? irows[0] : null;
}

/** Find the landlord's contact details for a specific listing. Never invents them. */
async function lookupContact(address: string, city: string, state: string, sourceUrl?: string) {
  if (!OPENAI_KEY) return { contact: null, status: 'not_configured' as const };
  const prompt =
    `Find the leasing contact for this specific rental listing:\n` +
    `${address}, ${city}, ${state}\n` +
    (sourceUrl ? `Listing page: ${sourceUrl}\n` : '') +
    `\nSearch the web and return ONLY a JSON object, no prose or fences, with:\n` +
    `contact_name, company, email, phone, listing_url, full_address.\n\n` +
    `Rules:\n` +
    `- Only report a detail you actually found on a page. Never guess an email or a phone.\n` +
    `- Omit any field you could not find. An absent field is fine; an invented one is not.\n` +
    `- Prefer the leasing office or property manager for the specific unit.`;
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
    if (!r.ok) return { contact: null, status: 'failed' as const };
    const data = await r.json();
    let text = '';
    for (const item of (data.output || [])) {
      for (const c of (item.content || [])) if (typeof c?.text === 'string') text += c.text;
    }
    if (!text) text = String(data.output_text || '');
    const cleaned = text.replace(/```json|```/g, '').trim();
    const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}');
    if (a === -1 || b === -1) return { contact: null, status: 'failed' as const };
    return { contact: JSON.parse(cleaned.slice(a, b + 1)), status: 'ok' as const };
  } catch {
    return { contact: null, status: 'failed' as const };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'release');
    const investor = await resolveInvestor(String(body.session_token || '').trim());
    if (!investor) {
      return json({ success: false, error: 'account_required', message: 'Please sign in. Searching is free, but releasing a property needs an account.' }, 401);
    }

    if (action === 'status') {
      return json({ success: true, ...(await rpc('ayp_forge_entitlement', { p_investor: investor.id })) });
    }

    if (action !== 'release') return json({ success: false, error: `Unknown action: ${action}` }, 400);

    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    if (!address || !city || !state) {
      return json({ success: false, error: 'address, city and state are required.' }, 400);
    }
    const ref = `${address}|${city}|${state}`.toLowerCase();

    // Already paid for? Hand it back, charge nothing.
    const already = await rpc('ayp_forge_already_released', { p_investor: investor.id, p_ref: ref });
    if (already === true) {
      const { contact, status } = await lookupContact(address, city, state, body.source_url);
      return json({
        success: true, charged: 0, already_released: true,
        contact, contact_status: status,
        message: 'You already released this property, so there is no further charge.',
      });
    }

    // Enough credit?
    const ent = await rpc('ayp_forge_entitlement', { p_investor: investor.id });
    if (!ent?.can_release) {
      return json({ success: false, error: 'insufficient_credit', ...ent, charged: 0,
        message: ent?.reason || 'You do not have enough credit to release this property.' }, 402);
    }

    // Get the details BEFORE charging. If the lookup fails, nobody pays for nothing.
    const { contact, status } = await lookupContact(address, city, state, body.source_url);
    if (status !== 'ok' || !contact) {
      return json({
        success: false, error: 'lookup_failed', charged: 0,
        message: 'We could not find verified contact details for that property, so you have NOT been charged. Ask an acquisition manager to look into it.',
      }, 502);
    }

    // Charge, then confirm the charge landed before returning the details.
    const cr = await rest('credit_ledger', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        investor_id: investor.id,
        amount: -RELEASE_COST,
        reason: `Released full details on ${address}, ${city}, ${state}`,
        kind: 'address_release',
        property_ref: ref,
        created_by: investor.email,
      }),
    });
    if (!cr.ok) {
      console.error('forge-release charge_failed', await cr.text());
      return json({ success: false, error: 'charge_failed', charged: 0,
        message: 'We could not process the credit, so nothing was released and you have not been charged. Please try again.' }, 502);
    }

    const balance = await rpc('ayp_credit_balance', { p_investor: investor.id });

    return json({
      success: true,
      charged: RELEASE_COST,
      balance_remaining: balance,
      contact,
      // The no-poaching promise, restated at the moment it matters.
      lead_protection:
        'This property is yours while you are pursuing it. We will not list it publicly or distribute it to the network unless you tell us you no longer want it.',
      your_options:
        'Ask Penny to reach out on behalf of Access Your Place, which has a higher success rate, or contact the landlord yourself using the details above. Either is fine.',
      message: `Released. $${RELEASE_COST} came off your credit and you have $${Number(balance).toLocaleString()} left.`,
    });
  } catch (e) {
    console.error('forge-release threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error', charged: 0 }, 500);
  }
});
