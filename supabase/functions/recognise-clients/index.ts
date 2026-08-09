// recognise-clients — find people who signed up that we already had a file on, tell them
// we know who they are, and put the file in front of the Success Team.
//
// 461 people in the book have no account. When one of them finally signs up, being treated
// as a stranger is the worst possible first impression for somebody who has already been
// through a closing with us.
//
// THE SEND OUTCOME IS RECORDED HONESTLY. sendEmail-style helpers on this platform have a
// habit of resolving with a false flag rather than throwing, so a failed send looks
// identical to a successful one. Here the response is read, a failure is recorded as a
// failure, and a failed recognition raises an URGENT alert — because that person got
// silence and now needs a human to reach them.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

async function rpc(url: string, key: string, fn: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

function emailBody(name: string, knownSince: string) {
  const who = name || 'there';
  return `Hi ${who},

Thanks for creating your Access Your Place account — and welcome back.

We recognised you straight away: we've had a file on you since ${knownSince}, so you're not
starting from scratch here. Your acquisition manager is picking that file up now and making
sure everything on it is still accurate — the markets you're interested in, what you're
looking for, and where we left things.

You don't need to do anything. If anything has changed since we last spoke, just reply to
this email and we'll update it.

One thing worth knowing: Penny, our AI, is inside your account and can research any market
for you, run the numbers on a property and answer questions about how arbitrage actually
works. That's free, whether you ever buy a deal from us or not.

— The Success Team
Access Your Place`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const rkey = Deno.env.get('RESEND_API_KEY') || '';
  if (!url || !key) return json({ ok: false, error: 'Server not configured.' }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const pending = await rpc(url, key, 'ayp_pending_recognitions');
    if (!pending.ok) {
      console.error('recognise-clients pending_failed', pending.status);
      return json({ ok: false, error: `Could not read who needs recognising (${pending.status}).` }, 502);
    }
    const people = Array.isArray(pending.data) ? pending.data : [];

    if (dryRun) {
      return json({
        ok: true, dry_run: true, would_email: people.length,
        people: people.map((p: any) => ({ name: p.name, email: p.email, known_since: p.known_since })),
      });
    }

    let sent = 0;
    const failures: string[] = [];

    for (const p of people) {
      let ok = false;
      let err: string | null = null;
      try {
        // Resend directly, the same path Penny uses. My first version posted to a
        // `send-email` edge function THAT DOES NOT EXIST — every recognition email would
        // have failed, and because the failure is recorded honestly it would at least have
        // been visible, but nobody would have received anything. Caught by checking the
        // function list rather than assuming a conventional name.
        if (!rkey) throw new Error('RESEND_API_KEY is not set on the server');
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${rkey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'The Success Team <success@accessyourplace.com>',
            reply_to: 'success@accessyourplace.com',
            to: [p.email],
            subject: 'Welcome back — we already have your file',
            text: emailBody(p.name, p.known_since),
          }),
        });
        const out = await r.json().catch(() => null);
        ok = r.ok && !!out?.id;
        if (!ok) err = `resend returned ${r.status} ${JSON.stringify(out).slice(0, 120)}`;
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
      }

      if (ok) sent++;
      else failures.push(`${p.email}: ${err}`);

      // Recorded either way, so a failed send is visible rather than retried forever or
      // silently dropped.
      await rpc(url, key, 'ayp_record_recognition', {
        p_investor_id: p.investor_id, p_client_file_id: p.client_file_id,
        p_email_sent: ok, p_error: err,
      });
    }

    return json({
      ok: failures.length === 0,
      recognised: people.length,
      emailed: sent,
      failed: failures.length,
      failures: failures.slice(0, 10),
      note: failures.length
        ? `Recognised ${people.length}, emailed ${sent}. ${failures.length} did NOT receive anything and are flagged urgent for a human.`
        : `Recognised and emailed ${sent} returning client(s). Their files are flagged for the acquisition side.`,
    }, failures.length ? 207 : 200);
  } catch (e) {
    console.error('recognise-clients threw', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'The recognition run failed partway. Check the logs before rerunning.' }, 500);
  }
});
