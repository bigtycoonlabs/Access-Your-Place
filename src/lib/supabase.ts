import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://zhobqrmkbtsqugtiahyn.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjE5NzdmNTg3LWRiYzAtNDMwNi05YTIwLTEwNDg1OGU5NGUxMyJ9.eyJwcm9qZWN0SWQiOiJ6aG9icXJta2J0c3F1Z3RpYWh5biIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzYyODI4OTQ4LCJleHAiOjIwNzgxODg5NDgsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.2U5bzJ9__u_Ae4PPUPQzI8wEpdIXbr_IqQy2UhOzqAI';

/**
 * Custom Realtime WebSocket message decoder.
 *
 * The default Supabase Realtime decoder assumes every JSON string message is a
 * Phoenix-protocol array: [join_ref, ref, topic, event, payload].  When the
 * server sends a non-array JSON value (e.g. an empty heartbeat `{}`, an error
 * object, or a keep-alive), the destructuring `const [a,b,c,d,e] = parsed`
 * throws "TypeError: {} is not iterable" because plain objects don't implement
 * the iterable protocol.
 *
 * This replacement:
 *  1. Parses string messages and checks `Array.isArray` before destructuring.
 *  2. Falls back gracefully for object-shaped messages (extracts known Phoenix
 *     fields if present, otherwise wraps the whole thing as payload).
 *  3. Handles ArrayBuffer (binary) messages using the standard Phoenix binary
 *     wire format (kind + 4 length-prefix header + concatenated fields).
 *  4. Wraps everything in try/catch so a malformed message can never crash the
 *     application.
 */
function safeRealtimeDecode(
  rawMessage: unknown,
  callback: (decoded: Record<string, unknown>) => void
): void {
  try {
    // ── Binary (ArrayBuffer) messages ─────────────────────────────────
    if (rawMessage instanceof ArrayBuffer) {
      try {
        const view = new DataView(rawMessage);
        const decoder = new TextDecoder();
        // Phoenix binary header: kind(1) joinRefLen(1) refLen(1) topicLen(1) eventLen(1)
        const HEADER_LENGTH = 5;
        if (rawMessage.byteLength < HEADER_LENGTH) {
          return callback({});
        }
        let offset = 0;
        /* const kind = */ view.getUint8(offset++);
        const joinRefLen = view.getUint8(offset++);
        const refLen = view.getUint8(offset++);
        const topicLen = view.getUint8(offset++);
        const eventLen = view.getUint8(offset++);

        const joinRef = decoder.decode(new Uint8Array(rawMessage, offset, joinRefLen));
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
          try {
            payload = JSON.parse(payloadStr);
          } catch {
            payload = { raw: payloadStr };
          }
        }

        return callback({ join_ref: joinRef, ref, topic, event, payload });
      } catch (binErr) {
        console.warn('[Supabase Realtime] Binary decode error suppressed:', (binErr as Error)?.message);
        return callback({});
      }
    }

    // ── String (JSON) messages ────────────────────────────────────────
    if (typeof rawMessage === 'string') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMessage);
      } catch {
        // Not valid JSON – nothing we can do
        console.warn('[Supabase Realtime] Non-JSON message received');
        return callback({});
      }

      // Standard Phoenix array format: [join_ref, ref, topic, event, payload]
      if (Array.isArray(parsed)) {
        const [join_ref, ref, topic, event, payload] = parsed;
        return callback({ join_ref, ref, topic, event, payload });
      }

      // Object-shaped message (heartbeat response, error, etc.)
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

      // Primitive value (number, boolean, null) – shouldn't happen but be safe
      return callback({});
    }

    // ── Anything else (Blob, null, undefined) ─────────────────────────
    return callback({});
  } catch (err) {
    console.warn('[Supabase Realtime] Decode error suppressed:', (err as Error)?.message);
    return callback({});
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
    decode: safeRealtimeDecode,
  },
});

// ── Safety-net global error handlers ──────────────────────────────────────────
// These catch any residual "is not iterable" errors that might slip through
// (e.g. from a stale cached bundle still using the old default decoder).
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (
      error instanceof TypeError &&
      (error.message === '{} is not iterable' ||
        error.message?.includes('is not iterable'))
    ) {
      console.warn(
        '[Supabase Realtime] Global handler suppressed decode error:',
        error.message
      );
      return true; // Prevent propagation
    }
    if (typeof originalOnError === 'function') {
      return originalOnError.call(window, message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason instanceof TypeError &&
      (event.reason.message === '{} is not iterable' ||
        event.reason.message?.includes('is not iterable'))
    ) {
      console.warn(
        '[Supabase Realtime] Global handler suppressed unhandled rejection:',
        event.reason.message
      );
      event.preventDefault();
    }
  });
}


/**
 * Safe DELETE helper that avoids the Fastify "Body cannot be empty when
 * content-type is set to 'application/json'" error.
 *
 * The Supabase JS client sends `content-type: application/json` on DELETE
 * requests with an empty body.  Fastify (sitting in front of PostgREST)
 * rejects this combination.  This helper uses `fetch` directly and omits
 * the content-type header so the server doesn't try to parse a body.
 *
 * Usage:
 *   import { safeDeleteRows } from '@/lib/supabase';
 *   await safeDeleteRows('archived_properties', 'id', someUuid);
 *   await safeDeleteRows('properties', 'property_id', someUuid);
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
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        // Intentionally NO content-type header — this avoids the Fastify error
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
 * Batch-safe DELETE: deletes multiple rows by an array of IDs.
 * Uses the PostgREST `in` filter syntax.
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
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
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

