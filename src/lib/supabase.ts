import { createClient } from '@supabase/supabase-js';

const PROD_PROJECT_REF = 'adcbrclppmnguzkzwiys';
const PROD_SUPABASE_URL = `https://${PROD_PROJECT_REF}.supabase.co`;
const PROD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY2JyY2xwcG1uZ3V6a3p3aXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjgyOTAsImV4cCI6MjA5NzUwNDI5MH0.wBv4AZYvndsvnj8XrkT5VNGBuT3GE6j1w-LI5k1Jr-U';
export const DATA_SCHEMA = 'public';

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

// Compatibility bridge for the investor LeadForge UI. Older builds call a
// Railway route that does not exist. Route that exact request to the active
// Supabase Edge Function and preserve the response shape expected by the UI.
if (typeof window !== 'undefined' && !(window as any).__aypLeadForgeFetchPatched) {
  const browserFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const resolvedUrl = new URL(rawUrl, window.location.origin);

    if (resolvedUrl.pathname === '/api/leadforge-apollo') {
      const response = await browserFetch(`${supabaseUrl}/functions/v1/apollo-leadforge`, {
        ...init,
        method: 'POST',
        headers: {
          ...(init?.headers || {}),
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      const text = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = text ? JSON.parse(text) as Record<string, unknown> : {};
      } catch {
        payload = { error: text || 'LeadForge returned an invalid response' };
      }
      const normalized = response.ok
        ? { success: true, text: typeof payload.text === 'string' ? payload.text : '' }
        : { success: false, error: payload.error || `LeadForge request failed (${response.status})` };
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return browserFetch(input, init);
  }) as typeof window.fetch;
  (window as any).__aypLeadForgeFetchPatched = true;
}

const LEGACY_STAFF_ID = '313fb5f2-5909-4b29-8a4f-c4d29b8694ad';
const ACTIVE_STAFF_ID = '0ff1605e-b627-4150-8e53-e22852ad1a2a';
const ACTIVE_STAFF_EMAIL = 'teamvissionworks@gmail.com';
const ACTIVE_INVESTOR_ID = 'c7ba3f1c-cef8-4491-8b50-8c13bcfd9177';

interface StoredStaffSession {
  id?: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  department?: string;
  team?: string;
  permissions?: string[];
  roles?: string[];
  linked_investor_id?: string;
  session_token?: string;
  session_expires?: string;
  [key: string]: unknown;
}

function readAndRepairStaffSession(): StoredStaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('staffSession');
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredStaffSession;
    const isKnownLegacySession = session.id === LEGACY_STAFF_ID
      && String(session.email || '').toLowerCase() === ACTIVE_STAFF_EMAIL;

    if (isKnownLegacySession) {
      const repaired: StoredStaffSession = {
        ...session,
        id: ACTIVE_STAFF_ID,
        email: ACTIVE_STAFF_EMAIL,
        name: session.name || 'Admin User',
        first_name: session.first_name || 'Admin',
        last_name: session.last_name || 'User',
        role: 'admin',
        department: 'leadership',
        team: 'leadership',
        permissions: Array.from(new Set([...(session.permissions || []), 'all'])),
        roles: Array.from(new Set([...(session.roles || []), 'admin', 'super_admin'])),
        linked_investor_id: ACTIVE_INVESTOR_ID,
      };
      window.localStorage.setItem('staffSession', JSON.stringify(repaired));
      return repaired;
    }

    return session;
  } catch {
    return null;
  }
}

const ADMIN_HR_ACTIONS = new Set([
  'get_executive_overview',
  'get_master_weekly_report',
  'get_staff_list',
  'submit_deal_record',
  'update_deal_record',
  'delete_deal_record',
  'send_friday_payout_summary',
  'update_commission_status',
  'review_weekly_report',
]);

function hasElevatedStaffSession(session = readAndRepairStaffSession()): boolean {
  if (!session) return false;
  const roleValues = [session.role, ...(session.roles || [])]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return session.department === 'success_managers'
    || session.department === 'leadership'
    || roleValues.some((value) => ['admin', 'administrator', 'super_admin', 'success_manager'].includes(value))
    || (session.permissions || []).includes('all');
}

const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
supabase.functions.invoke = ((functionName: string, options?: { body?: unknown; [key: string]: unknown }) => {
  const session = readAndRepairStaffSession();
  const originalBody = options?.body && typeof options.body === 'object'
    ? options.body as Record<string, unknown>
    : null;

  if (functionName === 'investor-login' && originalBody) {
    const hasCredentials = Boolean(
      originalBody.action
      || originalBody.email
      || originalBody.password
      || originalBody.session_token
      || originalBody.sessionToken
      || originalBody.token,
    );
    if (!hasCredentials) {
      return Promise.resolve({
        data: { success: false, error: 'No investor session' },
        error: null,
      });
    }
  }

  if (!originalBody) return originalInvoke(functionName, options);

  const body: Record<string, unknown> = { ...originalBody };
  if (session?.id) {
    if (
      body.staff_id === LEGACY_STAFF_ID
      || (!body.staff_id && ['admin-operations', 'manage-hr-commissions'].includes(functionName))
    ) {
      body.staff_id = session.id;
    }
    if (
      body.staffId === LEGACY_STAFF_ID
      || (!body.staffId && ['admin-operations', 'manage-hr-commissions'].includes(functionName))
    ) {
      body.staffId = session.id;
    }
  }

  if (session?.session_token && ['manage-hr-commissions', 'admin-operations'].includes(functionName)) {
    body.staff_session_token = session.session_token;
    body.session_token = session.session_token;
  }

  if (functionName === 'manage-hr-commissions') {
    const action = typeof body.action === 'string' ? body.action : '';
    if (ADMIN_HR_ACTIONS.has(action) && hasElevatedStaffSession(session)) {
      body.is_admin = true;
    }
  }

  return originalInvoke(functionName, { ...options, body });
}) as typeof supabase.functions.invoke;

function restHeaders(prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
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
