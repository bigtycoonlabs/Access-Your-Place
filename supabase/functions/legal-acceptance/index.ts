// legal-acceptance
//
// Whether this person has agreed to the CURRENT terms, and recording it when they do.
//
// A new account could previously use the entire platform without ever accepting the terms.
// Acceptance was only written at the point of reserving a deal, which is far too late: by
// then somebody has browsed, enquired and is about to send money.
//
// Versioned on purpose. The terms changed materially on 12 August 2026 — the $2,500
// reservation deposit, the 72 hour hold and address release, full fee before finalising,
// third-party funds withheld, and the entire setup and logistics section. An acceptance of
// the older terms is not agreement to these, so the check asks which version.

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

// Bump this when the terms change materially. Everybody is asked again.
const CURRENT_TOS_VERSION = '2026-08-12';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

/** The account behind a session token. Identity never comes from the caller. */
async function resolveInvestor(token: string) {
  if (!token) return null;
  const sr = await rest(
    `investor_sessions?session_token=eq.${encodeURIComponent(token)}&is_active=eq.true&select=investor_id,expires_at&limit=1`,
  );
  if (!sr.ok) return null;
  const rows = await sr.json();
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s) return null;
  if (s.expires_at && new Date(s.expires_at) < new Date()) return null;

  const ir = await rest(`investors?id=eq.${encodeURIComponent(s.investor_id)}&select=id,email,full_name&limit=1`);
  if (!ir.ok) return null;
  const irows = await ir.json();
  return Array.isArray(irows) ? irows[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    const investor = await resolveInvestor(String(body.session_token || '').trim());

    if (!investor?.email) {
      return json({ success: false, error: 'account_required', message: 'Please sign in.' }, 401);
    }

    if (action === 'status') {
      const r = await rest(
        `legal_acceptances?email=eq.${encodeURIComponent(investor.email)}&tos_version=eq.${encodeURIComponent(CURRENT_TOS_VERSION)}&select=tos_accepted_at&limit=1`,
      );
      if (!r.ok) {
        console.error('legal-acceptance status_failed', await r.text());
        // FAIL CLOSED. If we cannot confirm somebody accepted, we do not wave them through:
        // an unverifiable read is not consent. But say plainly that the check failed, so
        // nobody reads this as "you have not accepted".
        return json({
          success: false,
          error: 'unavailable',
          accepted: false,
          version: CURRENT_TOS_VERSION,
          message: 'We could not check your terms acceptance just now. This is not the same as you not having accepted.',
        }, 502);
      }
      const rows = await r.json();
      const accepted = Array.isArray(rows) && rows.length > 0 && Boolean(rows[0].tos_accepted_at);
      return json({ success: true, accepted, version: CURRENT_TOS_VERSION });
    }

    if (action === 'accept') {
      // Consent is an affirmative act. No default, no pre-tick, no inferring it from use.
      if (body.accepted !== true) {
        return json({
          success: false,
          error: 'not_accepted',
          message: 'The terms have to be accepted before you can continue.',
        }, 400);
      }

      const now = new Date().toISOString();
      const r = await rest('legal_acceptances', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          email: investor.email,
          role: 'investor',
          tos_version: CURRENT_TOS_VERSION,
          tos_accepted_at: now,
          privacy_policy_accepted_at: now,
          community_standards_accepted_at: now,
          ip_address: req.headers.get('x-forwarded-for') || null,
          user_agent: req.headers.get('user-agent') || null,
        }),
      });

      if (!r.ok) {
        const detail = await r.text();
        console.error('legal-acceptance accept_failed', detail);
        // Never tell somebody their acceptance was recorded when it was not. This row is
        // the evidence that they agreed; a false confirmation is worse than a retry.
        return json({
          success: false,
          error: 'not_recorded',
          message: 'We could not record your acceptance, so we have not let you through. Please try again, or email success@accessyourplace.com.',
        }, 502);
      }

      const rows = await r.json();
      return json({
        success: true,
        accepted: true,
        version: CURRENT_TOS_VERSION,
        accepted_at: now,
        acceptance_id: Array.isArray(rows) && rows[0] ? rows[0].id : null,
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('legal-acceptance threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error' }, 500);
  }
});
