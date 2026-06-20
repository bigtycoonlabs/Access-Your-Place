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

// Truncate strings to keep records small
function truncate(value: unknown, max = 500): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

async function hashIp(ip: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(ip + "|ayp-analytics-salt");
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Support single event or batch
    const events = Array.isArray(body.events) ? body.events : [body];
    if (!events.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Best-effort IP hash for rough geo / dedup (privacy-friendly)
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip = xff.split(",")[0]?.trim() || "";
    const ipHash = ip ? await hashIp(ip) : null;

    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || null;

    const rows = events
      .filter((e: any) => e && typeof e === 'object' && e.session_id && e.path)
      .map((e: any) => ({
        session_id: truncate(e.session_id, 64),
        path: truncate(e.path, 500),
        referrer: truncate(e.referrer, 500),
        user_agent: truncate(e.user_agent, 500),
        utm_source: truncate(e.utm_source, 100),
        utm_medium: truncate(e.utm_medium, 100),
        utm_campaign: truncate(e.utm_campaign, 200),
        utm_term: truncate(e.utm_term, 200),
        utm_content: truncate(e.utm_content, 200),
        investor_id: e.investor_id || null,
        event_type: truncate(e.event_type || 'pageview', 50),
        event_name: truncate(e.event_name, 100),
        metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : null,
        ip_hash: ipHash,
        country: country ? truncate(country, 8) : null,
      }));

    if (!rows.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { error } = await supabase.from('page_events').insert(rows);
    if (error) {
      console.error('[track-event] insert error', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[track-event] error', err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

