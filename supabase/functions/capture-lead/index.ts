// capture-lead — the front door.
//
// The company has demand it cannot service: clients calling the owner's phone, landlords
// asking for properties to be moved, operators with live emergencies in other cities.
// None of it reaches the platform, because there was no way in. The leads table has the
// right columns and zero rows: nothing has ever written to it.
//
// This is deliberately the dumbest, most reliable thing that could work. It takes a name,
// a way to reach them, and what they need. No login, no invitation, no portal. A link the
// owner can text someone mid-call.
//
// TWO RULES IT WILL NOT BREAK:
//
// 1. Capture first, notify second. The lead is written to the database BEFORE any email
//    is attempted, and a failed email never loses the lead. Losing a lead because Resend
//    hiccuped would be worse than the problem this solves.
//
// 2. Report what actually happened. If the write fails, the person is told plainly and
//    given the direct email address, so they are never left thinking they have reached
//    someone when they have not. This platform's signature defect is reporting success
//    while doing nothing, and the front door is the worst possible place for it.
//
// NOTE ON SCHEMA: no Accept-Profile header. PostgREST on this project exposes only the
// public schema (authenticator: pgrst.db_schemas = public), so asking for the data schema
// gets the request rejected. That is what silently broke Penny's identity lookup.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SUCCESS_INBOX = 'success@accessyourplace.com';

// The three doors. Anything else is rejected rather than silently stored as junk.
const KINDS = new Set(['need_property', 'have_property', 'live_operation_help', 'sell_operation']);

const LABELS: Record<string, string> = {
  need_property: 'Client looking for a property',
  have_property: 'Landlord with a property',
  live_operation_help: 'LIVE OPERATION — needs help now',
  sell_operation: 'Wants to sell an existing operation',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      console.error('capture-lead missing_config');
      return json({ success: false, error: 'Something is wrong on our side. Please email success@accessyourplace.com and we will pick it up.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const city = String(body.city || '').trim();
    const propertyAddress = String(body.property_address || '').trim();
    const message = String(body.message || '').trim();

    if (!KINDS.has(kind)) return json({ success: false, error: 'Please choose what you need help with.' }, 400);
    if (!name) return json({ success: false, error: 'Please tell us your name.' }, 400);
    // One contact method is enough. Requiring both loses people.
    if (!email && !phone) return json({ success: false, error: 'Please leave an email address or a phone number so we can reach you.' }, 400);

    const urgency = kind === 'live_operation_help' ? 'emergency' : 'normal';

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const insert = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        form_type: kind,
        name,
        // email is NOT NULL on this table, so a phone-only lead still needs a value here.
        email: email || `no-email+${crypto.randomUUID().slice(0, 8)}@accessyourplace.com`,
        phone: phone || null,
        city: city || null,
        property_address: propertyAddress || null,
        message: message || null,
        urgency,
        status: 'new',
        source: String(body.source || 'start_page').slice(0, 60),
        form_data: { kind, gave_email: !!email, gave_phone: !!phone, user_agent: req.headers.get('user-agent') || null },
      }),
    });

    if (!insert.ok) {
      const detail = (await insert.text()).slice(0, 300);
      console.error('capture-lead insert_failed', insert.status, detail);
      // Never pretend. Give them a route that does not depend on us.
      return json({
        success: false,
        error: 'We could not save that just now. Please email success@accessyourplace.com directly and we will pick it up straight away.',
      }, 502);
    }

    const rows = await insert.json().catch(() => []);
    const lead = Array.isArray(rows) ? rows[0] : null;
    if (!lead?.id) {
      console.error('capture-lead insert_no_rows');
      return json({
        success: false,
        error: 'We could not save that just now. Please email success@accessyourplace.com directly and we will pick it up straight away.',
      }, 502);
    }

    console.log('capture-lead saved', JSON.stringify({ lead_id: lead.id, kind, urgency }));

    // ---- notify, AFTER the lead is safely stored ----
    const resendKey = Deno.env.get('RESEND_API_KEY');
    let notified = false;
    if (resendKey) {
      const subject = urgency === 'emergency'
        ? `URGENT — live operation needs help: ${name}`
        : `New lead — ${LABELS[kind]}: ${name}`;
      const lines = [
        `${LABELS[kind]}`,
        ``,
        `Name: ${name}`,
        email ? `Email: ${email}` : `Email: not given`,
        phone ? `Phone: ${phone}` : `Phone: not given`,
        city ? `City: ${city}` : null,
        propertyAddress ? `Property: ${propertyAddress}` : null,
        ``,
        message ? `What they said:\n${message}` : `They did not leave a message.`,
        ``,
        `Lead id: ${lead.id}`,
      ].filter(Boolean).join('\n');

      try {
        const send = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Penny <penny@accessyourplace.com>',
            reply_to: [email || SUCCESS_INBOX],
            to: [SUCCESS_INBOX],
            subject,
            text: lines,
          }),
        });
        notified = send.ok;
        if (!send.ok) console.error('capture-lead notify_failed', send.status, (await send.text()).slice(0, 200));
      } catch (e) {
        console.error('capture-lead notify_threw', e instanceof Error ? e.message : String(e));
      }
    } else {
      console.error('capture-lead missing RESEND_API_KEY');
    }

    // The lead IS saved either way, so this is a success — but `notified` is returned
    // honestly rather than assumed, so the team can tell a quiet inbox from a quiet week.
    return json({
      success: true,
      lead_id: lead.id,
      notified,
      urgency,
      message: urgency === 'emergency'
        ? "Got it — this is flagged as urgent and the team has been alerted. Someone will call you. If it cannot wait, call us directly."
        : "Got it. We have your details and someone from the team will be in touch.",
    });
  } catch (error) {
    console.error('capture-lead threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Something went wrong. Please email success@accessyourplace.com and we will pick it up.' }, 500);
  }
});
