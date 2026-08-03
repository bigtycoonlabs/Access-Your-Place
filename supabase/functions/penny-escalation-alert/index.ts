// penny-escalation-alert — emails the success team + the founder whenever Penny
// escalates a client ("Where I need you"). Called by an AFTER INSERT trigger on
// public.penny_escalations, so it fires for every escalation from any surface.

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

    const who = String(b.user_name || 'A client');
    const utype = String(b.user_type || '').trim();
    const summary = String(b.summary || 'needs a hand');
    const when = b.created_at ? String(b.created_at) : new Date().toISOString();

    const subject = `Penny escalation — ${who} needs a hand`;
    const text = [
      `Penny has escalated a ${utype || 'client'} to the success team.`,
      ``,
      `Who: ${who}`,
      `What: ${summary}`,
      `When: ${when}`,
      ``,
      `Open the staff console to pick it up: https://accessyourplace.com/staff`,
      ``,
      `— Penny, Access Your Place`,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: 'Penny <penny@accessyourplace.com>', to: ALERT_TO, subject, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ ok: false, status: res.status, error: data?.message || 'send_failed' }, 200);
    return json({ ok: true, id: data?.id || null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
