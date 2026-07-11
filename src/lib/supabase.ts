import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Project: accessyourplace | Ref: prjynolwltwsmsamocyt
// Dashboard: https://supabase.com/dashboard/project/prjynolwltwsmsamocyt
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://prjynolwltwsmsamocyt.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByanlub2x3bHR3c21zYW1vY3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MzY1MjYsImV4cCI6MjA5OTIxMjUyNn0.t0ftUGh0HSAZpSo9ACmgKL8vQGuVvZxcPqF6Vx-ZG3c';

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
