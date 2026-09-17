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
  staff_id?: string | null;
  user_type?: 'visitor' | 'investor' | 'staff' | 'landlord';
  landing_path?: string | null;
  first_referrer?: string | null;
  internal?: boolean;
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

// sendBeacon cannot carry the apikey header the functions gateway requires, so beacons were
// rejected. A keepalive fetch survives the page closing and can carry the headers.
function send(payload: EventPayload, leaving = false): void {
  if (typeof window === 'undefined') return;
  try {
    if (leaving) {
      const endpoint = getTrackEndpoint();
      const key = (supabase as any)?.supabaseKey;
      if (endpoint && key) {
        fetch(endpoint, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
          body: JSON.stringify(payload),
        }).catch(() => { /* silent */ });
        return;
      }
    }
  } catch { /* fall through */ }
  try {
    supabase.functions.invoke('track-event', { body: payload }).catch(() => { /* silent */ });
  } catch { /* silent */ }
}

const LANDING_KEY = 'ayp_analytics_landing';
const FIRST_REF_KEY = 'ayp_analytics_first_ref';
const INTERNAL_KEY = 'ayp_analytics_internal';

// Who is browsing. Staff are counted separately so their clicks never look like demand.
function whoIsBrowsing(): { user_type: EventPayload['user_type']; staff_id: string | null } {
  try {
    const st = JSON.parse(window.localStorage.getItem('staffSession') || 'null');
    if (st?.session_token) return { user_type: 'staff', staff_id: st.id || null };
    if (window.localStorage.getItem('landlord_session')) return { user_type: 'landlord', staff_id: null };
    if (window.localStorage.getItem('investorSessionToken')) return { user_type: 'investor', staff_id: null };
  } catch { /* ignore */ }
  return { user_type: 'visitor', staff_id: null };
}

// The page and referrer that started this visit, kept for the whole visit so a lead can be
// credited to where the person first came from.
function visitStart(path: string): { landing_path: string; first_referrer: string | null } {
  let landing = safeGet(LANDING_KEY, window.sessionStorage);
  if (!landing) { landing = path.split('?')[0] || '/'; safeSet(LANDING_KEY, landing, window.sessionStorage); }
  let ref = safeGet(FIRST_REF_KEY, window.sessionStorage);
  if (ref === null) {
    ref = (typeof document !== 'undefined' && document.referrer && !document.referrer.includes(window.location.host)) ? document.referrer : '';
    safeSet(FIRST_REF_KEY, ref, window.sessionStorage);
  }
  return { landing_path: landing, first_referrer: ref || null };
}

// Add ?internal=1 to any link once to mark this browser as ours (testing, demos).
function isInternal(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('internal');
    if (q === '1') window.localStorage.setItem(INTERNAL_KEY, '1');
    if (q === '0') window.localStorage.removeItem(INTERNAL_KEY);
    return window.localStorage.getItem(INTERNAL_KEY) === '1';
  } catch { return false; }
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
    ...whoIsBrowsing(),
    ...visitStart(path),
    internal: isInternal(),
    event_type: type,
    event_name: eventName ?? null,
    metadata: metadata ?? null,
  };
}

let lastPageviewPath: string | null = null;
let pageStartedAt = 0;

export function trackPageview(path: string): void {
  // De-dupe rapid duplicate pageviews for the same path within the same render cycle
  if (path === lastPageviewPath) return;
  if (lastPageviewPath && pageStartedAt) sendTimeOnPage(lastPageviewPath);
  lastPageviewPath = path;
  pageStartedAt = Date.now();
  send(buildPayload(path, 'pageview'));
}

function sendTimeOnPage(path: string, leaving = false): void {
  const seconds = Math.round((Date.now() - pageStartedAt) / 1000);
  if (seconds < 1 || seconds > 4 * 3600) return;
  send(buildPayload(path, 'event', 'page_time', { seconds, page: path.split('?')[0] }), leaving);
}

export function trackEvent(name: string, metadata?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '/';
  send(buildPayload(path, 'event', name, metadata));
}

// Track something only once per visit (for example, the first time a form is touched).
const onceSeen = new Set<string>();
export function trackOnce(name: string, metadata?: Record<string, unknown>): void {
  const k = name + JSON.stringify(metadata || {});
  if (onceSeen.has(k)) return;
  onceSeen.add(k);
  trackEvent(name, metadata);
}

// Initialise once: capture UTMs immediately so they're remembered even if the
// user lands on a page that doesn't fire a pageview right away.
if (typeof window !== 'undefined') {
  try { captureUtm(); getSessionId(); isInternal(); } catch { /* ignore */ }

  // Time on the last page when the tab is hidden or closed.
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && lastPageviewPath && pageStartedAt) {
        sendTimeOnPage(lastPageviewPath, true);
        pageStartedAt = Date.now();
      }
    });
  } catch { /* ignore */ }

  // Clicks, without wiring every button by hand:
  //   data-track="name"   on any element records that name (plus data-track-* extras)
  //   tel: and mailto:    record call_clicked / email_clicked
  //   links off the site  record outbound_clicked with the domain
  try {
    document.addEventListener('click', (ev) => {
      const el = (ev.target as Element | null)?.closest?.('[data-track], a[href], button') as HTMLElement | null;
      if (!el) return;
      // Main calls to action, recognised by their wording, so every "Get started" or
      // "Browse deals" on any page is counted without wiring each one.
      if (!el.getAttribute('data-track')) {
        const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (/\b(get started|start (your|now|here)|sign up|create (a |your )?(free )?account|book (a|your)? ?call|browse (the )?deals|view (all )?deals|see (the )?deals|list (my|your) (property|operation)|sell (my|your) operation|talk to penny|ask penny|start your acquisition)\b/i.test(label)) {
          const href = el.getAttribute('href') || '';
          trackEvent('cta_clicked', { label, to: href.startsWith('/') ? href.split('?')[0] : undefined });
        }
        if (el.tagName === 'BUTTON') return;
      }
      const named = el.getAttribute('data-track');
      if (named) {
        const extra: Record<string, unknown> = {};
        for (const a of Array.from(el.attributes)) {
          if (a.name.startsWith('data-track-')) extra[a.name.slice(11)] = a.value.slice(0, 120);
        }
        trackEvent(named, extra);
        return;
      }
      const href = el.getAttribute('href') || '';
      if (href.startsWith('tel:')) trackEvent('call_clicked');
      else if (href.startsWith('mailto:')) trackEvent('email_clicked');
      else if (/^https?:\/\//.test(href)) {
        try {
          const u = new URL(href);
          if (u.host !== window.location.host) trackEvent('outbound_clicked', { domain: u.hostname.replace(/^www\./, '') });
        } catch { /* ignore */ }
      }
    }, { capture: true });
  } catch { /* ignore */ }
}
