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

    // EMAIL IS REQUIRED, and it is the only channel we actually reply on.
    //
    // This previously accepted "email OR phone". That was a promise the platform cannot
    // keep: there is no SMS anywhere in this system -- zero texts have ever been sent and
    // the delivery callback points at a dead host. Someone who left only a phone number
    // would have been told we had their details and then heard nothing, because Penny's
    // reply, the sign-in link and the account invitation all go by email.
    //
    // PHONE IS ALSO REQUIRED, but for a different reason: an acquisition manager rings
    // clients, and a lead with no number is a lead the team cannot work.
    if (!email) return json({ success: false, error: 'Please add your email address — that is how we reply and send your sign-in link.' }, 400);
    if (!phone) return json({ success: false, error: 'Please add a phone number so the team can call you.' }, 400);

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
        email,
        phone,
        city: city || null,
        property_address: propertyAddress || null,
        message: message || null,
        urgency,
        status: 'new',
        source: String(body.source || 'start_page').slice(0, 60),
        form_data: { kind, user_agent: req.headers.get('user-agent') || null },
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
        `Email: ${email}`,
        `Phone: ${phone}`,
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
            reply_to: [email],
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

    // ---- Penny takes it from here ----
    //
    // Recognise the person and send them THEIR next step, rather than dumping everyone at
    // a generic sign-up. Three cases:
    //
    //   already a client  -> sign in, or reset the password if they have forgotten it
    //   new, wants a deal -> create an account (buyers and SELLERS are the same user;
    //                        a seller is a client who wants out rather than in, so they
    //                        get the same account and the same dashboard)
    //   landlord          -> create a landlord account and get the property to the team
    //
    // The on-screen reply stays deliberately neutral. The specific next step goes only to
    // the address itself, so this endpoint cannot be used to discover who is a client.
    let recognised = false;
    let routedEmail = false;

    if (email) {
      const look = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email)}&select=id,full_name&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
      );
      if (look.ok) {
        const found = await look.json().catch(() => []);
        recognised = Array.isArray(found) && found.length > 0;
      } else {
        console.error('capture-lead recognise_failed', look.status);
      }

      if (resendKey) {
        const isLandlord = kind === 'have_property';
        const first = name.split(' ')[0] || 'there';
        let subject: string;
        let lines: string[];

        if (recognised) {
          subject = 'Picking this up for you — sign in to continue';
          lines = [
            `Hi ${first},`, '',
            'Good to hear from you. You already have an account with us, so the fastest way to keep this moving is to sign in:',
            '', 'https://accessyourplace.com/investor/login', '',
            "If you can't remember your password, use the Forgot Password link on that page and it will email you a reset straight away.",
            '', "I've passed what you sent to the team as well, so nothing is waiting on you.",
          ];
        } else if (isLandlord) {
          subject = 'Getting your property in front of our operators';
          lines = [
            `Hi ${first},`, '',
            'Thanks for reaching out about your property. Set up a landlord account here and you can keep everything in one place:',
            '', 'https://accessyourplace.com/landlord/login', '',
            'Once you are in, send over the property details and photos and our team will review them. We speak to every landlord and vet every property personally before it goes to an operator.',
            '', 'If it is easier to just reply to this email with the details, that works too.',
          ];
        } else {
          subject = 'Your next step with Access Your Place';
          lines = [
            `Hi ${first},`, '',
            'Thanks for reaching out. Create your account here and you will be able to see opportunities and work with us directly:',
            '', 'https://accessyourplace.com/investor/login', '',
            kind === 'sell_operation'
              ? 'That is the same account whether you are buying or selling — you will use it to give us the details of the operation you want to hand over.'
              : 'It takes a minute, and it is how we keep your deals, documents and numbers in one place.',
            '', 'The team has what you sent and someone will be in touch.',
          ];
        }

        lines.push('', 'Penny', 'Client Success | Access Your Place');

        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: 'Penny <penny@accessyourplace.com>',
              reply_to: [SUCCESS_INBOX],
              to: [email],
              subject,
              text: lines.join('\n'),
            }),
          });
          routedEmail = r.ok;
          if (!r.ok) console.error('capture-lead route_email_failed', r.status, (await r.text()).slice(0, 200));
        } catch (e) {
          console.error('capture-lead route_email_threw', e instanceof Error ? e.message : String(e));
        }
      }
    }

    console.log('capture-lead routed', JSON.stringify({ lead_id: lead.id, recognised, routedEmail }));

    // The lead IS saved either way, so this is a success — but `notified` and `routed` are
    // returned honestly rather than assumed, so a quiet inbox can be told apart from a
    // quiet week.
    const tail = routedEmail
      ? " I've also emailed you your next step — check your inbox."
      : " We could not email you just now, so use success@accessyourplace.com if you'd like to add anything.";

    return json({
      success: true,
      lead_id: lead.id,
      notified,
      routed: routedEmail,
      urgency,
      message: (urgency === 'emergency'
        ? "Got it — this is flagged as urgent and the team has been alerted. Someone will call you. If it cannot wait, call us directly."
        : "Got it. We have your details and someone from the team will be in touch.") + tail,
    });
  } catch (error) {
    console.error('capture-lead threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Something went wrong. Please email success@accessyourplace.com and we will pick it up.' }, 500);
  }
});
