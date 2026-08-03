const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server configuration error' }, 500);

    const body = await req.json().catch(() => ({}));
    const staffId = body.staff_session_id || body.staffId || body.staff_id;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    if (staffId) {
      const staffRes = await fetch(`${url}/rest/v1/staff_users?id=eq.${encodeURIComponent(staffId)}&select=id,is_active,department&limit=1`, { headers });
      if (!staffRes.ok) return json({ success: false, error: await staffRes.text() }, 500);
      const staff = (await staffRes.json())[0];
      if (staff && staff.is_active === false) return json({ success: false, error: 'Staff account is deactivated' }, 403);
    }

    const leadsRes = await fetch(`${url}/rest/v1/leads?select=*&order=created_at.desc`, { headers });
    if (!leadsRes.ok) return json({ success: false, error: await leadsRes.text() }, 500);
    return json({ success: true, leads: await leadsRes.json() });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
