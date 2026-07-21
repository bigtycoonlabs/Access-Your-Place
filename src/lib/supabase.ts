import { createClient } from '@supabase/supabase-js';

// AccessYourPlace production Supabase configuration.
// Railway/Vite variables are accepted only when they target the verified
// production project. This prevents stale build variables from silently
// routing the live app to another project and causing cascading 401 errors.
const PROD_PROJECT_REF = 'adcbrclppmnguzkzwiys';
const PROD_SUPABASE_URL = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY2JyY2xwcG1uZ3V6a3p3aXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjgyOTAsImV4cCI6MjA5NzUwNDI5MH0.wBv4AZYvndsvnj8XrkT5VNGBuT3GE6j1w-LI5k1Jr-U';

const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const configuredKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configuredProjectRef = configuredUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
const useConfiguredCredentials =
  configuredProjectRef === PROD_PROJECT_REF && configuredKey.length > 0;

if (configuredUrl && !useConfiguredCredentials && typeof console !== 'undefined') {
  console.error(
    `[Supabase] Ignoring invalid or mismatched VITE_SUPABASE configuration. Expected project ${PROD_PROJECT_REF}.`
  );
}

const supabaseUrl = useConfiguredCredentials ? configuredUrl.replace(/\/$/, '') : PROD_SUPABASE_URL;
const supabaseKey = useConfiguredCredentials ? configuredKey : PROD_SUPABASE_KEY;

/**
 * Defensive Supabase Realtime decoder.
 * Prevents malformed/non-Phoenix messages from crashing the app with
 * "is not iterable" during realtime heartbeat or migration edge cases.
 */
function safeRealtimeDecode(
  rawMessage: unknown,
  callback: (decoded: Record<string, unknown>) => void
): void {
  try {
    if (rawMessage instanceof ArrayBuffer) {
      const view = new DataView(rawMessage);
      const decoder = new TextDecoder();
      const HEADER_LENGTH = 5;
      if (rawMessage.byteLength < HEADER_LENGTH) return callback({});

      let offset = 0;
      view.getUint8(offset++); // kind
      const joinRefLen = view.getUint8(offset++);
      const refLen = view.getUint8(offset++);
      const topicLen = view.getUint8(offset++);
      const eventLen = view.getUint8(offset++);

      const join_ref = decoder.decode(new Uint8Array(rawMessage, offset, joinRefLen));
      offset += joinRefLen;
      const ref = decoder.decode(new Uint8Array(rawMessage, offset, refLen));
      offset += refLen;
      const topic = decoder.decode(new Uint8Array(rawMessage, offset, topicLen));
      offset += topicLen;
      const event = decoder.decode(new Uint8Array(rawMessage, offset, eventLen));
      offset += eventLen;

      let payload: unknown = {};
      if (offset < rawMessage.byteLength) {
        const payloadStr = decoder.decode(new Uint8Array(rawMessage, offset));
        try { payload = JSON.parse(payloadStr); } catch { payload = { raw: payloadStr }; }
      }

      return callback({ join_ref, ref, topic, event, payload });
    }

    if (typeof rawMessage === 'string') {
      let parsed: unknown;
      try { parsed = JSON.parse(rawMessage); } catch { return callback({}); }

      if (Array.isArray(parsed)) {
        const [join_ref, ref, topic, event, payload] = parsed;
        return callback({ join_ref, ref, topic, event, payload });
      }

      if (parsed !== null && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        return callback({
          join_ref: obj.join_ref ?? null,
          ref: obj.ref ?? null,
          topic: obj.topic ?? null,
          event: obj.event ?? null,
          payload: obj.payload ?? obj,
        });
      }
    }

    return callback({});
  } catch (err) {
    console.warn('[Supabase Realtime] Decode error suppressed:', (err as Error)?.message);
    return callback({});
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  realtime: {
    params: { eventsPerSecond: 2 },
    decode: safeRealtimeDecode,
  },
});

if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (
      error instanceof TypeError &&
      (error.message === '{} is not iterable' || error.message?.includes('is not iterable'))
    ) {
      console.warn('[Supabase Realtime] Global handler suppressed decode error:', error.message);
      return true;
    }
    if (typeof originalOnError === 'function') {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason instanceof TypeError &&
      (event.reason.message === '{} is not iterable' || event.reason.message?.includes('is not iterable'))
    ) {
      console.warn('[Supabase Realtime] Global handler suppressed unhandled rejection:', event.reason.message);
      event.preventDefault();
    }
  });
}

/**
 * Safe DELETE helper that avoids Fastify rejecting empty JSON DELETE bodies.
 */
export async function safeDeleteRows(
  table: string,
  column: string,
  value: string
): Promise<{ error: any | null }> {
  try {
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
      return { error: parsed };
    }
    return { error: null };
  } catch (err: any) {
    return { error: { message: err?.message || 'Network error during delete' } };
  }
}

/**
 * Batch-safe DELETE using PostgREST in.(...) syntax.
 */
export async function safeDeleteRowsBatch(
  table: string,
  column: string,
  values: string[]
): Promise<{ error: any | null; deletedCount: number }> {
  if (values.length === 0) return { error: null, deletedCount: 0 };
  try {
    const inList = values.map(v => `"${v}"`).join(',');
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(column)}=in.(${inList})`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
      return { error: parsed, deletedCount: 0 };
    }
    const data = await res.json().catch(() => []);
    return { error: null, deletedCount: Array.isArray(data) ? data.length : 0 };
  } catch (err: any) {
    return { error: { message: err?.message || 'Network error during batch delete' }, deletedCount: 0 };
  }
}

export { supabase };
