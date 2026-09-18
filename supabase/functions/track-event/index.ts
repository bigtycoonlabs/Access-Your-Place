const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const trim = (value: unknown, max = 500) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
};

// Page views and events from the site.
//
// The browser has always sent utm_source, utm_medium and the rest, and this function threw
// them away, so no visit was ever credited to an ad, a link or ChatGPT. They are stored now,
// along with the landing page and first referrer of the visit, the device, and whether the
// traffic is our own (staff pages, staff signed in) so reports can leave it out.
//
// Public on purpose: visitors are not signed in. It only ever inserts, caps what one call can
// write, and refuses rows that say nothing.
const EVENT_NAME = /^[a-z0-9_]{2,60}$/;
function domainOf(ref: string | null): string | null {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, '').toLowerCase().slice(0, 120); } catch { return null; }
}
// Scrapers probe for ecommerce and CMS endpoints that this site has never had, at machine
// speed, with an ordinary Chrome user agent. Ten such "visitors" hit eight /products/*.json
// paths in four seconds each and were counted as real people, which quietly inflates every
// number on the analytics screen. A real page view here never ends in a file extension and
// never sits under these prefixes, so the path alone is enough to refuse the row.
const PROBE_PATH =
  /^\/(products|collections|cart|checkout|wp-|wordpress|xmlrpc|admin\.php|phpmyadmin|\.env|\.git|\.well-known\/security|vendor\/|cgi-bin)/i;
const PROBE_EXTENSION = /\.(json|php|asp|aspx|jsp|cgi|env|sql|bak|old|yml|yaml|ini|log)$/i;
function isProbe(path: string): boolean {
  return PROBE_PATH.test(path) || PROBE_EXTENSION.test(path);
}
function deviceOf(ua: string | null): string {
  const u = (ua || '').toLowerCase();
  if (!u) return 'unknown';
  if (/bot|crawl|spider|slurp|preview|headless/.test(u)) return 'bot';
  if (/ipad|tablet/.test(u)) return 'tablet';
  if (/mobi|iphone|android/.test(u)) return 'mobile';
  return 'desktop';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ ok: false, error: 'Server configuration error' }, 500);
    const body = await req.json().catch(() => ({}));
    const events = (Array.isArray(body.events) ? body.events : [body]).slice(0, 25);
    const country = trim(req.headers.get('cf-ipcountry') || req.headers.get('x-country'), 8);
    const rows = [];
    for (const e of events) {
      if (!e || typeof e !== 'object') continue;
      const type = e.event_type === 'event' ? 'event' : e.event_type === 'pageview' ? 'pageview' : null;
      const path = trim(e.path || e.page, 500);
      const name = trim(e.event_name, 60);
      if (!type || !path) continue;
      if (isProbe(path)) continue;
      if (type === 'event' && (!name || !EVENT_NAME.test(name))) continue;
      const ua = trim(e.user_agent || req.headers.get('user-agent'), 1000);
      const device = deviceOf(ua);
      if (device === 'bot') continue;
      const ref = trim(e.referrer, 1000);
      const userType = trim(e.user_type, 20);
      const meta = e.metadata && typeof e.metadata === 'object' && !Array.isArray(e.metadata) ? e.metadata : {};
      if (JSON.stringify(meta).length > 4000) continue;
      rows.push({
        event_type: type,
        event_name: type === 'event' ? name : null,
        page: path,
        path,
        url: trim(e.url, 1000),
        referrer: ref,
        referrer_domain: domainOf(ref),
        first_referrer: trim(e.first_referrer, 1000),
        landing_path: trim(e.landing_path, 500),
        session_id: trim(e.session_id, 128),
        investor_id: trim(e.investor_id, 128),
        staff_id: trim(e.staff_id, 128),
        user_type: userType,
        utm_source: trim(e.utm_source, 120),
        utm_medium: trim(e.utm_medium, 120),
        utm_campaign: trim(e.utm_campaign, 160),
        utm_term: trim(e.utm_term, 160),
        utm_content: trim(e.utm_content, 160),
        device,
        country,
        is_internal: userType === 'staff' || path.startsWith('/staff') || path.startsWith('/admin') || e.internal === true,
        metadata: meta,
        user_agent: ua,
        ip: null,
        created_at: new Date().toISOString(),
      });
    }
    if (!rows.length) return json({ ok: true, inserted: 0 });
    const res = await fetch(`${url}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      console.error('track-event insert_failed', res.status, (await res.text()).slice(0, 200));
      return json({ ok: false, error: 'Could not record that.' }, 500);
    }
    return json({ ok: true, inserted: rows.length });
  } catch (error) {
    console.error('track-event threw', error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: 'Could not record that.' }, 500);
  }
});
