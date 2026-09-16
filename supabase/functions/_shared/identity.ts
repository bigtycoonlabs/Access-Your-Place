// Who is asking, proven by a sign-in token, never by an id in the request body.
//
// Staff screens send x-staff-session (issued by staff-login). Client screens send
// x-investor-session (issued by investor-login). An id in the body is only a claim.

export type Caller = { kind: 'staff'; id: string } | { kind: 'investor'; id: string } | { kind: 'none' };

export async function whoIsAsking(req: Request): Promise<Caller> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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
      if (s && (!s.expires_at || new Date(s.expires_at).getTime() > now)) return { kind: 'investor', id: String(s.investor_id) };
    }
  } catch { /* treated as signed out */ }
  return { kind: 'none' };
}

// Checks one table row belongs to the signed-in client.
export async function rowBelongsTo(table: string, id: unknown, investorId: string, column = 'investor_id'): Promise<boolean> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const r = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=${column}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const row = r.ok ? (await r.json())[0] : null;
  return !!row && String(row[column]) === investorId;
}

// Standard gate for a function that serves both staff and clients.
//   publicActions  need no sign-in (e.g. a support form on the sign-in page)
//   clientActions  need the client's own sign-in; body.investor_id must be theirs, and is
//                  filled in from the session when missing
//   everything else needs a staff sign-in
// Returns null to proceed, or a Response to send back.
export async function gate(
  req: Request, body: any, action: string, cors: Record<string, string>,
  opts: { publicActions?: string[]; clientActions?: string[]; ownRow?: Record<string, { table: string; field: string }> },
): Promise<Response | null> {
  const deny = (msg: string, status = 401) =>
    new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (opts.publicActions?.includes(action)) return null;
  const who = await whoIsAsking(req);
  if (who.kind === 'staff') return null;
  if (opts.clientActions?.includes(action)) {
    if (who.kind !== 'investor') return deny('Your sign-in has expired. Please sign in again.');
    if (body.investor_id && String(body.investor_id) !== who.id) return deny('You can only see your own account.', 403);
    body.investor_id = who.id;
    const own = opts.ownRow?.[action];
    if (own && body[own.field] && !(await rowBelongsTo(own.table, body[own.field], who.id))) return deny('You can only see your own account.', 403);
    return null;
  }
  return deny('Please sign in to the staff area to do that.');
}
