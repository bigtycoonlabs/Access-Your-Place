import { createClient } from '@supabase/supabase-js';

const PROD_PROJECT_REF = 'adcbrclppmnguzkzwiys';
const PROD_SUPABASE_URL = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY2JyY2xwcG1uZ3V6a3p3aXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjgyOTAsImV4cCI6MjA5NzUwNDI5MH0.wBv4AZYvndsvnj8XrkT5VNGBuT3GE6j1w-LI5k1Jr-U';
export const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';

const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const configuredKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configuredProjectRef = configuredUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
const useConfiguredCredentials = configuredProjectRef === PROD_PROJECT_REF && configuredKey.length > 0;

if (configuredUrl && !useConfiguredCredentials && typeof console !== 'undefined') {
  console.error(`[Supabase] Ignoring mismatched configuration. Expected ${PROD_PROJECT_REF}.`);
}

const supabaseUrl = useConfiguredCredentials ? configuredUrl.replace(/\/$/, '') : PROD_SUPABASE_URL;
const supabaseKey = useConfiguredCredentials ? configuredKey : PROD_SUPABASE_KEY;

function safeRealtimeDecode(
  rawMessage: unknown,
  callback: (decoded: Record<string, unknown>) => void,
): void {
  try {
    if (typeof rawMessage === 'string') {
      const parsed = JSON.parse(rawMessage) as unknown;
      if (Array.isArray(parsed)) {
        const [join_ref, ref, topic, event, payload] = parsed;
        callback({ join_ref, ref, topic, event, payload });
        return;
      }
      if (parsed && typeof parsed === 'object') {
        const value = parsed as Record<string, unknown>;
        callback({
          join_ref: value.join_ref ?? null,
          ref: value.ref ?? null,
          topic: value.topic ?? null,
          event: value.event ?? null,
          payload: value.payload ?? value,
        });
        return;
      }
    }
    callback({});
  } catch {
    callback({});
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: DATA_SCHEMA },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 2 },
    decode: safeRealtimeDecode,
  },
});

function restHeaders(prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Accept-Profile': DATA_SCHEMA,
    'Content-Profile': DATA_SCHEMA,
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

export async function safeDeleteRows(
  table: string,
  column: string,
  value: string,
): Promise<{ error: unknown | null }> {
  try {
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`;
    const response = await fetch(url, { method: 'DELETE', headers: restHeaders() });
    if (response.ok) return { error: null };
    const text = await response.text();
    try {
      return { error: JSON.parse(text) };
    } catch {
      return { error: { message: text } };
    }
  } catch (error) {
    return { error };
  }
}

export async function safeDeleteRowsBatch(
  table: string,
  column: string,
  values: string[],
): Promise<{ error: unknown | null; deletedCount: number }> {
  if (values.length === 0) return { error: null, deletedCount: 0 };
  try {
    const list = values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(',');
    const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${encodeURIComponent(column)}=in.(${list})`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: restHeaders('return=representation'),
    });
    if (!response.ok) {
      const text = await response.text();
      try {
        return { error: JSON.parse(text), deletedCount: 0 };
      } catch {
        return { error: { message: text }, deletedCount: 0 };
      }
    }
    const rows = await response.json().catch(() => []);
    return { error: null, deletedCount: Array.isArray(rows) ? rows.length : 0 };
  } catch (error) {
    return { error, deletedCount: 0 };
  }
}

export { supabase };
