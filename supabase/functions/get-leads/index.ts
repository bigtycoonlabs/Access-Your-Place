const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Leads hold the name, email and phone of everyone who used /start. This function used to
// return all of them to any caller with the public key, because the staff id it checked was
// optional and came from the request body. Identity now comes only from the staff session
// token issued at sign-in.
async function staffFromSession(req: Request, url: string, key: string): Promise<any | null> {
  const tok = String(req.headers.get('x-staff-session') || '');
  if (tok.length < 20) return null;
  const r = await fetch(`${url}/rest/v1/staff_users?session_token=eq.${encodeURIComponent(tok)}&select=id,is_active,session_expires&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  const s = (await r.json().catch(() => []))[0];
  if (!s || s.is_active === false || !s.session_expires) return null;
  if (new Date(s.session_expires).getTime() < Date.now()) return null;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server configuration error' }, 500);

    const staff = await staffFromSession(req, url, key);
    if (!staff) return json({ success: false, error: 'Please sign in to the staff area to see leads.' }, 401);

    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const leadsRes = await fetch(`${url}/rest/v1/leads?select=*&order=created_at.desc`, { headers });
    if (!leadsRes.ok) return json({ success: false, error: 'Could not read leads.' }, 500);
    const leads = await leadsRes.json();

    // Photos from /start live in a private bucket. Staff get short-lived links; the upload
    // token is never sent back out.
    for (const l of leads) {
      const fd = l.form_data && typeof l.form_data === 'object' ? l.form_data : null;
      if (!fd) continue;
      delete fd.upload_token;
      const paths: string[] = Array.isArray(fd.photos) ? fd.photos : [];
      if (!paths.length) continue;
      const s = await fetch(`${url}/storage/v1/object/sign/lead-uploads`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600, paths }),
      });
      const signed = s.ok ? await s.json().catch(() => []) : [];
      fd.photo_urls = Array.isArray(signed)
        ? signed.filter((x: any) => x?.signedURL).map((x: any) => `${url}/storage/v1${x.signedURL}`)
        : [];
    }
    return json({ success: true, leads });
  } catch (error) {
    console.error('get-leads threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Could not read leads.' }, 500);
  }
});
