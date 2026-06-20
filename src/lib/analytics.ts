/**
 * Lightweight self-hosted analytics client.
 *
 * - Generates / persists a per-browser session_id in sessionStorage
 *   (resets when the tab is closed, so we count visit-based sessions).
 * - Sends pageviews on route change and custom events via trackEvent().
 * - Uses navigator.sendBeacon on unload for reliability, otherwise fetch.
 * - Captures UTM params from the URL and remembers them for the session.
 * - Auto-attaches investor_id from localStorage.investorSession if present.
 *
 * Designed to be fire-and-forget — never throws into the app.
 */

import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'ayp_analytics_session_id';
const UTM_KEY = 'ayp_analytics_utm';

interface UtmData {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
}

interface EventPayload {
  session_id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  investor_id?: string | null;
  event_type: 'pageview' | 'event';
  event_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

function safeGet(key: string, storage: Storage | null): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string, storage: Storage | null): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'sid-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = safeGet(SESSION_KEY, window.sessionStorage);
  if (!id) {
    id = uuid();
    safeSet(SESSION_KEY, id, window.sessionStorage);
  }
  return id;
}

function captureUtm(): UtmData {
  if (typeof window === 'undefined') return {};
  try {
    const stored = safeGet(UTM_KEY, window.sessionStorage);
    const params = new URLSearchParams(window.location.search);
    const fresh: UtmData = {};
    let hasFresh = false;
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
      const v = params.get(k);
      if (v) { (fresh as any)[k] = v; hasFresh = true; }
    }
    if (hasFresh) {
      safeSet(UTM_KEY, JSON.stringify(fresh), window.sessionStorage);
      return fresh;
    }
    if (stored) {
      try { return JSON.parse(stored) as UtmData; } catch { return {}; }
    }
  } catch { /* ignore */ }
  return {};
}

function getInvestorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('investorSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.investor_id || parsed?.id || null;
  } catch {
    return null;
  }
}

// Build the absolute URL to the track-event edge function so we can use
// sendBeacon directly when the page is unloading.
function getTrackEndpoint(): string | null {
  try {
    // @ts-ignore - functionsUrl is internal but stable
    const url = (supabase as any)?.functions?.url || (supabase as any)?.functionsUrl;
    if (url) return `${url}/track-event`;
  } catch { /* ignore */ }
  return null;
}

function send(payload: EventPayload, viaBeacon = false): void {
  if (typeof window === 'undefined') return;
  try {
    if (viaBeacon && 'sendBeacon' in navigator) {
      const endpoint = getTrackEndpoint();
      if (endpoint) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
    }
  } catch { /* fall through to fetch */ }

  // Default: fire-and-forget supabase invocation
  try {
    supabase.functions.invoke('track-event', { body: payload }).catch(() => { /* silent */ });
  } catch { /* silent */ }
}

function buildPayload(
  path: string,
  type: 'pageview' | 'event',
  eventName?: string,
  metadata?: Record<string, unknown>
): EventPayload {
  const utm = captureUtm();
  return {
    session_id: getSessionId(),
    path,
    referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
    user_agent: typeof navigator !== 'undefined' ? (navigator.userAgent || null) : null,
    utm_source: utm.utm_source ?? null,
    utm_medium: utm.utm_medium ?? null,
    utm_campaign: utm.utm_campaign ?? null,
    utm_term: utm.utm_term ?? null,
    utm_content: utm.utm_content ?? null,
    investor_id: getInvestorId(),
    event_type: type,
    event_name: eventName ?? null,
    metadata: metadata ?? null,
  };
}

let lastPageviewPath: string | null = null;

export function trackPageview(path: string): void {
  // De-dupe rapid duplicate pageviews for the same path within the same render cycle
  if (path === lastPageviewPath) return;
  lastPageviewPath = path;
  send(buildPayload(path, 'pageview'));
}

export function trackEvent(name: string, metadata?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '/';
  send(buildPayload(path, 'event', name, metadata));
}

// Initialise once: capture UTMs immediately so they're remembered even if the
// user lands on a page that doesn't fire a pageview right away.
if (typeof window !== 'undefined') {
  try { captureUtm(); getSessionId(); } catch { /* ignore */ }
}
