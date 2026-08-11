// investor-notifications
//
// The notification bell read public.investor_notifications straight from the browser and
// filtered by investor_id in the query. That returned the right rows to the right person
// and did nothing to stop anyone else asking for ALL of them with the anon key that ships
// in the site bundle. The rows carry a named client's property address, their Penny score
// and the private buy recommendation they were given. A filter is not a permission.
//
// The table grant is now closed. This serves the same data, scoped on the server to
// whoever holds the session, so a caller can only ever see their own.

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

function headers(prefer?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });

/** The account behind a session token, or null. Identity never comes from the caller. */
async function resolveInvestorId(token: string): Promise<string | null> {
  if (!token) return null;
  const r = await rest(
    `investor_sessions?session_token=eq.${encodeURIComponent(token)}&is_active=eq.true&select=investor_id,expires_at&limit=1`,
  );
  if (!r.ok) return null;
  const rows = await r.json();
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s) return null;
  if (s.expires_at && new Date(s.expires_at) < new Date()) return null;
  return s.investor_id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');
    const investorId = await resolveInvestorId(String(body.session_token || '').trim());

    if (!investorId) {
      return json({ success: false, error: 'account_required', message: 'Please sign in.' }, 401);
    }

    if (action === 'list') {
      const r = await rest(
        `investor_notifications?investor_id=eq.${encodeURIComponent(investorId)}&select=*&order=created_at.desc&limit=100`,
      );
      if (!r.ok) {
        const detail = await r.text();
        console.error('investor-notifications list failed', detail);
        // A failed read is not an empty inbox. Say which, so nobody is told they have no
        // messages when the truth is that we could not look.
        return json({
          success: false,
          error: 'unavailable',
          message: 'We could not load your notifications just now. This is not the same as you having none.',
        }, 502);
      }
      const notifications = await r.json();
      return json({
        success: true,
        notifications,
        unread: Array.isArray(notifications)
          ? notifications.filter((n: Record<string, unknown>) => !n.is_read && !n.read).length
          : 0,
      });
    }

    // Marking read is scoped to the caller's own rows: the investor_id filter is applied
    // here, not taken from the request, so nobody can mark somebody else's mail read.
    if (action === 'mark_read' || action === 'mark_all_read') {
      const target = action === 'mark_read'
        ? `investor_notifications?id=eq.${encodeURIComponent(String(body.notification_id || ''))}&investor_id=eq.${encodeURIComponent(investorId)}`
        : `investor_notifications?investor_id=eq.${encodeURIComponent(investorId)}`;

      if (action === 'mark_read' && !body.notification_id) {
        return json({ success: false, error: 'notification_id is required' }, 400);
      }

      const r = await rest(target, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal, count=exact' },
        body: JSON.stringify({ is_read: true, read: true, read_at: new Date().toISOString() }),
      });
      if (!r.ok) {
        console.error('investor-notifications mark_read failed', await r.text());
        return json({ success: false, error: 'unavailable', message: 'We could not update that just now.' }, 502);
      }
      return json({ success: true, updated: r.headers.get('content-range') });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('investor-notifications threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error' }, 500);
  }
});
