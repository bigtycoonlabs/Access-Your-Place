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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface Event {
  session_id: string;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  investor_id: string | null;
  event_type: string;
  event_name: string | null;
  created_at: string;
}

function classifySource(ev: Event): string {
  if (ev.utm_source) {
    return `${ev.utm_source}${ev.utm_medium ? ` / ${ev.utm_medium}` : ''}`;
  }
  const ref = ev.referrer;
  if (!ref || ref === '') return 'Direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    if (!host) return 'Direct';
    if (host.includes('google.')) return 'Google';
    if (host.includes('bing.')) return 'Bing';
    if (host.includes('duckduckgo')) return 'DuckDuckGo';
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('twitter') || host.includes('t.co') || host.includes('x.com')) return 'Twitter/X';
    if (host.includes('youtube')) return 'YouTube';
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('tiktok')) return 'TikTok';
    return host;
  } catch {
    return 'Direct';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(parseInt(String(body.days || 7), 10), 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Pull events in window. Limit to a reasonable cap to keep response fast.
    const { data, error } = await supabase
      .from('page_events')
      .select('session_id, path, referrer, utm_source, utm_medium, utm_campaign, investor_id, event_type, event_name, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50000);

    if (error) {
      console.error('[get-site-analytics] query error', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const events: Event[] = (data || []) as Event[];

    // Totals
    const sessions = new Set<string>();
    const pageviewSessions = new Set<string>();
    let pageviews = 0;
    const sessionsWithInvestor = new Set<string>();

    // Top pages: pageviews count + unique sessions
    const pageStats = new Map<string, { views: number; sessions: Set<string> }>();
    // Sources: sessions per source
    const sourceSessions = new Map<string, Set<string>>();
    // Daily traffic
    const daily = new Map<string, { sessions: Set<string>; views: number }>();

    // Funnel stage tracking â€” by session
    const stages = {
      visited: new Set<string>(),       // any pageview
      viewedDeals: new Set<string>(),   // path startsWith /deals
      viewedDealDetail: new Set<string>(), // /deals/:id
      submittedInquiry: new Set<string>(), // event_name = 'deal_inquiry_submitted'
      registered: new Set<string>(),    // event_name = 'investor_registered'
      loggedIn: new Set<string>(),      // event_name = 'investor_logged_in' OR investor_id present
    };

    for (const ev of events) {
      sessions.add(ev.session_id);
      if (ev.investor_id) sessionsWithInvestor.add(ev.session_id);

      if (ev.event_type === 'pageview') {
        pageviews++;
        pageviewSessions.add(ev.session_id);
        const p = ev.path || '/';
        if (!pageStats.has(p)) pageStats.set(p, { views: 0, sessions: new Set() });
        const ps = pageStats.get(p)!;
        ps.views++;
        ps.sessions.add(ev.session_id);

        const src = classifySource(ev);
        if (!sourceSessions.has(src)) sourceSessions.set(src, new Set());
        sourceSessions.get(src)!.add(ev.session_id);

        const day = ev.created_at.slice(0, 10);
        if (!daily.has(day)) daily.set(day, { sessions: new Set(), views: 0 });
        const d = daily.get(day)!;
        d.sessions.add(ev.session_id);
        d.views++;

        // Funnel
        stages.visited.add(ev.session_id);
        if (p === '/deals' || p.startsWith('/deals?')) stages.viewedDeals.add(ev.session_id);
        if (p.startsWith('/deals/') && p.length > '/deals/'.length) stages.viewedDealDetail.add(ev.session_id);
        if (ev.investor_id) stages.loggedIn.add(ev.session_id);
      }

      if (ev.event_type === 'event' || ev.event_name) {
        const name = ev.event_name || '';
        if (name === 'deal_inquiry_submitted') stages.submittedInquiry.add(ev.session_id);
        if (name === 'investor_registered') stages.registered.add(ev.session_id);
        if (name === 'investor_logged_in') stages.loggedIn.add(ev.session_id);
      }
    }

    const topPages = Array.from(pageStats.entries())
      .map(([path, s]) => ({ path, views: s.views, unique_sessions: s.sessions.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    const topSources = Array.from(sourceSessions.entries())
      .map(([source, sset]) => ({ source, sessions: sset.size }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 12);

    // Build full daily series (fill gaps with zeros)
    const dailySeries: { date: string; sessions: number; views: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const v = daily.get(key);
      dailySeries.push({
        date: key,
        sessions: v ? v.sessions.size : 0,
        views: v ? v.views : 0,
      });
    }

    const funnel = [
      { stage: 'Visited Site', sessions: stages.visited.size },
      { stage: 'Viewed Deals Page', sessions: stages.viewedDeals.size },
      { stage: 'Viewed Deal Detail', sessions: stages.viewedDealDetail.size },
      { stage: 'Submitted Inquiry', sessions: stages.submittedInquiry.size },
      { stage: 'Registered', sessions: stages.registered.size },
      { stage: 'Logged In', sessions: stages.loggedIn.size },
    ];

    const summary = {
      total_sessions: sessions.size,
      total_pageviews: pageviews,
      logged_in_sessions: sessionsWithInvestor.size,
      avg_pages_per_session: pageviewSessions.size > 0
        ? Math.round((pageviews / pageviewSessions.size) * 100) / 100
        : 0,
    };

    return new Response(JSON.stringify({
      ok: true,
      days,
      summary,
      topPages,
      topSources,
      dailySeries,
      funnel,
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[get-site-analytics] error', err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

