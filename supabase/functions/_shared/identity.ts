// Who is asking, proven by a sign-in token or the server key, never by an id in the body.
//
// Staff screens send x-staff-session (staff-login). Client screens send x-investor-session
// (investor-login). Landlord screens send x-landlord-session (landlord-auth). Our own
// functions calling each other send the service key. An id in the body is only a claim.

export type Caller =
  | { kind: 'system' }
  | { kind: 'staff'; id: string }
  | { kind: 'investor'; id: string; email: string }
  | { kind: 'landlord'; id: string }
  | { kind: 'none' };

const env = (k: string) => Deno.env.get(k) ?? '';

export function isSystem(req: Request): boolean {
  const svc = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!svc) return false;
  const auth = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const api = String(req.headers.get('apikey') || '');
  return auth === svc || api === svc;
}

export async function whoIsAsking(req: Request): Promise<Caller> {
  if (isSystem(req)) return { kind: 'system' };
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const now = Date.now();
  try {
    const st = String(req.headers.get('x-staff-session') || '');
    if (st.length >= 20) {
      const r = await fetch(`${url}/rest/v1/staff_users?session_token=eq.${encodeURIComponent(st)}&select=id,is_active,session_expires&limit=1`, { headers: h });
      const s = r.ok ? (await r.json())[0] : null;
      if (s && s.is_active !== false && s.session_expires && new Date(s.session_expires).getTime() > now) return { kind: 'staff', id: String(s.id) };
    }
    const it = String(req.headers.get('x-investor-session') || '');
    if (it.length >= 20) {
      const r = await fetch(`${url}/rest/v1/investor_sessions?session_token=eq.${encodeURIComponent(it)}&is_active=eq.true&select=investor_id,expires_at&limit=1`, { headers: h });
      const s = r.ok ? (await r.json())[0] : null;
      if (s && (!s.expires_at || new Date(s.expires_at).getTime() > now)) {
        const ir = await fetch(`${url}/rest/v1/investors?id=eq.${s.investor_id}&select=email&limit=1`, { headers: h });
        const inv = ir.ok ? (await ir.json())[0] : null;
        return { kind: 'investor', id: String(s.investor_id), email: String(inv?.email || '').toLowerCase() };
      }
    }
    const lt = String(req.headers.get('x-landlord-session') || '');
    if (lt.length >= 20) {
      const r = await fetch(`${url}/rest/v1/landlord_contacts?session_token=eq.${encodeURIComponent(lt)}&select=id,session_expires_at&limit=1`, { headers: h });
      const s = r.ok ? (await r.json())[0] : null;
      if (s && (!s.session_expires_at || new Date(s.session_expires_at).getTime() > now)) return { kind: 'landlord', id: String(s.id) };
    }
  } catch { /* treated as signed out */ }
  return { kind: 'none' };
}

export async function rowBelongsTo(table: string, id: unknown, ownerId: string, column = 'investor_id'): Promise<boolean> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=${column}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const row = r.ok ? (await r.json())[0] : null;
  return !!row && String(row[column]) === ownerId;
}

export type GateOpts = {
  publicActions?: string[];      // no sign-in (sign-up, sign-in, public forms, token links)
  clientActions?: string[];      // the client's own sign-in; investor_id is theirs
  landlordActions?: string[];    // the landlord's own sign-in; landlord_id is theirs
  ownRow?: Record<string, { table: string; field: string; column?: string }>;
  otherwise?: 'staff' | 'public'; // what an unlisted action needs (default: staff)
};

// Returns null to proceed, or a Response to send back.
export async function gate(req: Request, body: any, action: string, cors: Record<string, string>, opts: GateOpts): Promise<Response | null> {
  const deny = (msg: string, status = 401) =>
    new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (opts.publicActions?.includes(action)) return null;
  const who = await whoIsAsking(req);
  if (who.kind === 'system' || who.kind === 'staff') return null;
  const own = opts.ownRow?.[action];
  if (opts.clientActions?.includes(action)) {
    if (who.kind !== 'investor') return deny('Your sign-in has expired. Please sign in again.');
    if (body.investor_id && String(body.investor_id) !== who.id) return deny('You can only see your own account.', 403);
    body.investor_id = who.id;
    if (own && body[own.field] && !(await rowBelongsTo(own.table, body[own.field], who.id, own.column))) return deny('You can only see your own account.', 403);
    return null;
  }
  if (opts.landlordActions?.includes(action)) {
    if (who.kind !== 'landlord') return deny('Your sign-in has expired. Please sign in again.');
    if (body.landlord_id && String(body.landlord_id) !== who.id) return deny('You can only see your own account.', 403);
    body.landlord_id = who.id;
    if (own && body[own.field] && !(await rowBelongsTo(own.table, body[own.field], who.id, own.column || 'landlord_id'))) return deny('You can only see your own account.', 403);
    return null;
  }
  if (opts.otherwise === 'public') return null;
  return deny('Please sign in to the staff area to do that.');
}
