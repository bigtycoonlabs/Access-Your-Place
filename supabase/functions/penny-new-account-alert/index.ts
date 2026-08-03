// penny-new-account-alert — emails the founder + success team the moment a new
// client (investor) account is created, so Vission knows Penny is already on it.
// Called by an AFTER INSERT trigger on the investors table (best-effort: the
// trigger swallows errors so a failed alert can never block a signup).

const ALERT_TO = ['teamvissionworks@gmail.com', 'success@accessyourplace.com'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const b = await req.json().catch(() => ({}));
    if (b?.health === true) {
      return json({ ok: true, resend_key_present: !!Deno.env.get('RESEND_API_KEY'), alert_to: ALERT_TO });
    }
    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return json({ ok: false, error: 'no_resend_key' }, 500);

    const name = String(b.full_name || 'A new client').trim() || 'A new client';
    const email = String(b.email || '').trim();
    const when = b.created_at ? String(b.created_at) : new Date().toISOString();

    const subject = `New client joined — ${name}`;
    const text = `${name} just created an account on Access Your Place.
Email: ${email || '(not provided)'}
When: ${when}

Penny is already engaging them — she greets every new client in the platform and helps them get moving.

Open the staff console to see them: https://accessyourplace.com/staff

— Penny, Access Your Place`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: 'Access Your Place <noreply@accessyourplace.com>', to: ALERT_TO, subject, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ ok: false, status: res.status, error: (data as any)?.message || 'send_failed' }, 200);
    return json({ ok: true, id: (data as any)?.id || null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
