// get-portfolio — one investor's holdings, and only theirs.
//
// investor_portfolio was readable by anon, which meant every client's addresses, rent and
// earnings were available to anyone who opened the website. The browser read the table
// directly in several places, so revoking the grant outright would have broken the
// portfolio screen for everyone.
//
// This is the replacement path: the browser asks for a portfolio, this runs as service_role
// and returns exactly one investor's. There is no shape of request that returns somebody
// else's, because the function takes one id and the RPC filters on it.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return json({ success: false, error: 'Server is not configured.' }, 500);

  try {
    const body = await req.json().catch(() => ({}));

    // STAFF READ. Staff legitimately view portfolios they do not own, and one screen reads
    // ACROSS investors. That cannot go through the client path — which is scoped to one id
    // on purpose — so it is a separate function that verifies an active staff member.
    if (body.staff_id) {
      const sres = await fetch(`${url}/rest/v1/rpc/ayp_staff_portfolio`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_staff_id: String(body.staff_id), p_investor_id: body.investor_id || null }),
      });
      if (!sres.ok) {
        console.error('get-portfolio staff read failed', sres.status);
        return json({ success: false, error: 'Could not load the portfolio.' }, 502);
      }
      const out = await sres.json();
      if (out?.ok === false) return json({ success: false, error: out.error }, 403);
      return json({ success: true, units: out?.units ?? [] });
    }

    const investorId = String(body.investor_id || '').trim();

    // A missing id is refused rather than defaulted. Defaulting to "all" is precisely how
    // a scoped endpoint quietly becomes an unscoped one.
    if (!/^[0-9a-f-]{36}$/i.test(investorId)) {
      return json({ success: false, error: 'A valid investor id is required.' }, 400);
    }

    const res = await fetch(`${url}/rest/v1/rpc/ayp_investor_portfolio`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_investor_id: investorId }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('get-portfolio rpc_failed', res.status, t.slice(0, 200));
      // Honest failure. An empty portfolio and a portfolio that could not be read are
      // different things, and a client seeing "no units" when they have three is worse
      // than seeing an error.
      return json({ success: false, error: 'Could not read the portfolio just now. This is a server problem, not your account.' }, 502);
    }

    const data = await res.json();
    return json({ success: true, ...data });
  } catch (e) {
    console.error('get-portfolio threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Could not read the portfolio just now.' }, 500);
  }
});
