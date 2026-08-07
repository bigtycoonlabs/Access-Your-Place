// staff-confirm-research — the only way a drafted figure becomes a confirmed one.
//
// confirm_research_field is SECURITY DEFINER and takes a staff id, so letting the browser
// call it directly would mean anyone with the publishable key could confirm research in
// any staff member's name. It is now revoked from PUBLIC and anon, and granted only to
// service_role, which is why this function exists.
//
// It verifies the staff member SERVER-SIDE against staff_users before confirming
// anything. A confirmed figure is one a client acts on, so the identity attached to it
// has to be real.
//
// NO Accept-Profile header: PostgREST here serves only the public schema. staff_users is
// a view over the real table and exposes is_owner (added earlier today when Penny could
// not identify anyone because that column was missing from the view).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('staff-confirm-research missing_config');
      return json({ ok: false, error: 'Server configuration error.' }, 500);
    }
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    const body = await req.json().catch(() => ({}));
    const staffId = String(body.staff_id || '').trim();
    const researchId = String(body.research_id || '').trim();
    const field = String(body.field || '').trim();

    if (!staffId) {
      // Said plainly, because an id-less session is a real and recurring fault on this
      // platform and the person needs to know what to do about it.
      return json({ ok: false, error: 'Your session is not sending an account id, so this cannot be recorded against you. Sign out and back in.' }, 401);
    }
    if (!researchId || !field) {
      return json({ ok: false, error: 'A research record and a field are both needed.' }, 400);
    }

    // Verify the staff member exists and is active. Never trust the client for identity.
    const who = await fetch(
      `${url}/rest/v1/staff_users?id=eq.${encodeURIComponent(staffId)}&select=id,name,is_active&limit=1`,
      { headers },
    );
    if (!who.ok) {
      console.error('staff-confirm-research staff_lookup_failed', who.status);
      return json({ ok: false, error: 'Could not verify your account just now. Please try again.' }, 502);
    }
    const staffRows = await who.json().catch(() => []);
    const staff = Array.isArray(staffRows) ? staffRows[0] : null;
    if (!staff || staff.is_active === false) {
      return json({ ok: false, error: 'Staff access required.' }, 403);
    }

    const res = await fetch(`${url}/rest/v1/rpc/confirm_research_field`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_research_id: researchId, p_field: field, p_staff_id: staffId }),
    });
    if (!res.ok) {
      console.error('staff-confirm-research rpc_failed', res.status, (await res.text()).slice(0, 200));
      return json({ ok: false, error: 'Could not confirm that field. Please try again.' }, 502);
    }
    const out = await res.json().catch(() => null);

    // Pass the server's own reason straight through - "Penny has not drafted X" is far
    // more useful than a generic failure.
    if (!out?.ok) {
      return json({ ok: false, error: out?.error || 'Could not confirm that field.' }, 400);
    }

    console.log('staff-confirm-research confirmed', JSON.stringify({
      research_id: researchId, field, staff_id: staffId,
    }));

    return json({ ok: true, field, confirmed_by_name: staff.name || null });
  } catch (e) {
    console.error('staff-confirm-research threw', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Something went wrong confirming that figure.' }, 500);
  }
});
