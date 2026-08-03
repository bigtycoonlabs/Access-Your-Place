const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ ok: false, error: 'Server configuration error' }, 500);
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days || 7), 1), 90);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const res = await fetch(`${url}/rest/v1/analytics_events?select=session_id,path,page,referrer,investor_id,event_type,event_name,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=50000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return json({ ok: false, error: await res.text() }, 500);
    const events = await res.json();
    const sessions = new Set<string>();
    const loggedIn = new Set<string>();
    const pageStats = new Map<string, { views: number; sessions: Set<string> }>();
    const daily = new Map<string, { views: number; sessions: Set<string> }>();
    let pageviews = 0;
    for (const ev of events || []) {
      const sid = ev.session_id || `anon-${ev.created_at}`;
      sessions.add(sid);
      if (ev.investor_id) loggedIn.add(sid);
      const path = ev.path || ev.page || '/';
      if (ev.event_type === 'pageview' || path) {
        pageviews++;
        if (!pageStats.has(path)) pageStats.set(path, { views: 0, sessions: new Set() });
        pageStats.get(path)!.views++;
        pageStats.get(path)!.sessions.add(sid);
        const day = String(ev.created_at || '').slice(0, 10);
        if (!daily.has(day)) daily.set(day, { views: 0, sessions: new Set() });
        daily.get(day)!.views++;
        daily.get(day)!.sessions.add(sid);
      }
    }
    const topPages = [...pageStats.entries()].map(([path, v]) => ({ path, views: v.views, unique_sessions: v.sessions.size })).sort((a,b) => b.views-a.views).slice(0,15);
    const dailySeries = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
      const value = daily.get(date);
      dailySeries.push({ date, sessions: value?.sessions.size || 0, views: value?.views || 0 });
    }
    return json({ ok: true, days, summary: { total_sessions: sessions.size, total_pageviews: pageviews, logged_in_sessions: loggedIn.size, avg_pages_per_session: sessions.size ? Math.round((pageviews / sessions.size) * 100) / 100 : 0 }, topPages, topSources: [], dailySeries, funnel: [] });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
