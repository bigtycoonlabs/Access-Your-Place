// forge-landlord-response
//
// Closes the loop. A landlord we approached on a client's behalf replies, or contacts the
// Success Team, or opens a landlord portal account. This matches them back to the lead and
// tells the client who found them.
//
// WHY IT MATTERS
// A client paid $62 to release a property and asked us to reach out on their behalf. If
// the landlord answers and nobody tells them, the money bought nothing and the lead dies
// in an inbox. The verification code exists partly for this: it is how an inbound landlord
// is matched back to the person who found them.
//
// Called by staff when a landlord makes contact, and by the landlord portal on signup.

const DATA_SCHEMA = 'public';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string' ? input : input?.url?.toString?.() || input?.toString?.() || '';
  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }
  return originalFetch(input, init);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUCCESS = 'success@accessyourplace.com';

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'record');

    // VERIFY. A landlord quotes the code from our email to check the approach was real.
    // Deliberately says only whether it is ours and which property: it must NOT leak the
    // finder's name or contact details to somebody who has just been cold-emailed.
    if (action === 'verify') {
      const vcode = String(body.verification_code || '').trim().toUpperCase();
      if (!vcode) return json({ success: false, error: 'A verification code is required.' }, 400);
      const r = await rest(`forge_leads?verification_code=eq.${encodeURIComponent(vcode)}&select=address,city,state,outreach_sent_at&limit=1`);
      if (!r.ok) {
        return json({ success: false, error: 'unavailable',
          message: 'We could not check that code just now. Please email ' + SUCCESS + ' and we will confirm by hand.' }, 502);
      }
      const rows = await r.json();
      const lead = Array.isArray(rows) ? rows[0] : null;
      if (!lead) {
        // Say this clearly. Somebody may be being impersonated.
        return json({
          success: true, genuine: false,
          message: 'That code does not match anything we sent. If you received a message quoting it and claiming to be Access Your Place, it did NOT come from us. Please forward it to ' + SUCCESS + ' so we can look into it.',
        });
      }
      return json({
        success: true, genuine: true,
        property: `${lead.address}, ${lead.city}, ${lead.state}`,
        sent_at: lead.outreach_sent_at,
        message: `Yes, that approach came from Access Your Place, about ${lead.address}, ${lead.city}, ${lead.state}. An Acquisition Manager can pick it up from here.`,
      });
    }

    if (action !== 'record') return json({ success: false, error: `Unknown action: ${action}` }, 400);

    // RECORD a landlord making contact, then tell the finder.
    const vcode = String(body.verification_code || '').trim().toUpperCase();
    const email = String(body.landlord_email || '').trim().toLowerCase();
    const how = String(body.channel || 'replied').trim(); // replied | success_team | portal_signup
    if (!vcode && !email) {
      return json({ success: false, error: 'Either a verification code or the landlord email is required to match the lead.' }, 400);
    }

    const filter = vcode
      ? `verification_code=eq.${encodeURIComponent(vcode)}`
      : `contact_email=eq.${encodeURIComponent(email)}`;
    const lr = await rest(`forge_leads?${filter}&select=*&order=created_at.desc&limit=1`);
    if (!lr.ok) {
      console.error('forge-landlord-response lead_read_failed', await lr.text());
      return json({ success: false, error: 'unavailable', message: 'We could not look up that lead.' }, 502);
    }
    const leads = await lr.json();
    const lead = Array.isArray(leads) ? leads[0] : null;
    if (!lead) {
      return json({ success: false, error: 'no_match',
        message: 'No Property Forge lead matches that code or email. This landlord may have come to us another way, in which case they are not attached to a finder.' }, 404);
    }

    const now = new Date().toISOString();
    await rest(`forge_leads?id=eq.${lead.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'landlord_engaged',
        landlord_responded_at: now,
        notes: [lead.notes, `Landlord made contact via ${how} on ${now}.`].filter(Boolean).join(' '),
      }),
    });

    // Who found them?
    let finder: Record<string, unknown> | null = null;
    if (lead.investor_id) {
      const ir = await rest(`investors?id=eq.${encodeURIComponent(lead.investor_id)}&select=id,full_name,email&limit=1`);
      if (ir.ok) { const rows = await ir.json(); finder = Array.isArray(rows) ? rows[0] : null; }
    }
    if (!finder) {
      return json({ success: true, matched: true, finder_notified: false,
        message: 'Lead updated, but it has no finder attached, so nobody was notified.' });
    }

    const where = `${lead.address}, ${lead.city}, ${lead.state}`;
    const headline = how === 'portal_signup'
      ? `The landlord at ${where} has created a landlord account with us.`
      : how === 'success_team'
      ? `The landlord at ${where} has contacted our Success Team.`
      : `The landlord at ${where} has replied to our outreach.`;

    const spoken =
      `${headline}\n\n` +
      `You found this property through Property Forge, so this is your lead and it stays yours.\n\n` +
      `Two ways to take it forward, your choice:\n\n` +
      `1. Ask an Acquisition Manager to handle it. They negotiate and secure the lease for you, and the Success Team can mediate between you and the landlord at any point.\n` +
      `2. Contact the landlord yourself. Their number is ${lead.contact_phone || 'on your released property details'}${lead.contact_email ? ` and their email is ${lead.contact_email}` : ''}.\n\n` +
      `When you are ready to finalise, the closing fee is $2,500 and any credit you hold applies to it.\n\n` +
      `Reply here or email ${SUCCESS} and we will pick it up.`;

    // In-app first: it lands whether or not email is working.
    let notified = false;
    const nr = await rest('investor_notifications', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        investor_id: finder.id,
        title: headline,
        message: spoken,
        type: 'forge_landlord_response',
        is_read: false,
        created_at: now,
      }),
    });
    if (nr.ok) notified = true;
    else console.error('forge-landlord-response notification_failed', await nr.text());

    let emailed = false;
    if (RESEND_KEY && finder.email) {
      const sr = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Access Your Place <success@accessyourplace.com>',
          to: [finder.email], reply_to: SUCCESS,
          subject: `Your Property Forge lead replied — ${where}`,
          text: spoken,
        }),
      });
      emailed = sr.ok;
      if (!sr.ok) console.error('forge-landlord-response email_failed', await sr.text());
    }

    if (notified || emailed) {
      await rest(`forge_leads?id=eq.${lead.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ finder_notified_at: now }),
      });
    }

    return json({
      success: true, matched: true, property: where,
      finder: { name: finder.full_name, email: finder.email },
      finder_notified: notified || emailed,
      in_app: notified, emailed,
      // Never claim the client was told when they were not.
      message: (notified || emailed)
        ? `Matched to ${finder.full_name} and they have been notified.`
        : `Matched to ${finder.full_name}, but WE COULD NOT NOTIFY THEM. Contact them by hand: ${finder.email}`,
    });
  } catch (e) {
    console.error('forge-landlord-response threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error' }, 500);
  }
});
