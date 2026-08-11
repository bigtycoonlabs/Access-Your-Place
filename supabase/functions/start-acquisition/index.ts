// start-acquisition
//
// One deal, one buyer, one path off the market.
//
// OWNER RULES 11 Aug 2026:
//   - Every operation takes at least $2,500 to come off the market, whatever the deal
//     costs and whatever package it is listed at.
//   - An account is required. Identity comes from the session, never from a form field.
//   - The client reviews and accepts the terms of service before any payment step.
//   - The client chooses a rail, copies the destination, sends the payment themselves,
//     and sends photo proof back. The platform never touches the money.
//   - On proof, the deal goes ON RESERVE and the team is alerted. It is NOT sold.
//   - An acquisition manager is required to finalise every purchase on the platform.
//   - Any client may ask to speak to an acquisition manager BEFORE paying anything.
//
// WHAT THIS FUNCTION WILL NOT DO:
//   - It never reads a payment destination back to the caller in a way that could be
//     mistaken for a spoken instruction, and it never invents one. Destinations come
//     from company_payment_methods and nowhere else.
//   - It never reports a step complete without the row to prove it. Every write is read
//     back or its error is returned. This platform's dominant defect is reporting
//     success while doing nothing, and both owners are blind and cannot catch a lying
//     green checkmark by glancing at a screen.
//   - It never marks a deal sold. Only a human acquisition manager closes a purchase.

const DATA_SCHEMA = 'public';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';
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
const TEAM_EMAIL = 'success@accessyourplace.com';

function restHeaders(prefer?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...restHeaders(String((init as any).prefer || '')), ...(init.headers || {}) },
  });
}

// A failed send is never logged as sent.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>',
        to: [to],
        reply_to: TEAM_EMAIL,
        subject,
        html,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** The account behind a session token. No session, no acquisition. */
async function resolveInvestor(sessionToken: string) {
  if (!sessionToken) return null;
  const sr = await rest(
    `investor_sessions?session_token=eq.${encodeURIComponent(sessionToken)}&is_active=eq.true&select=investor_id,expires_at&limit=1`,
  );
  if (!sr.ok) return null;
  const srows = await sr.json();
  const session = Array.isArray(srows) ? srows[0] : null;
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at) < new Date()) return null;

  const ir = await rest(
    `investors?id=eq.${encodeURIComponent(session.investor_id)}&select=id,full_name,email,phone&limit=1`,
  );
  if (!ir.ok) return null;
  const irows = await ir.json();
  return Array.isArray(irows) ? irows[0] : null;
}

/** The listing as the public sees it, including the deposit and whether it is still available. */
async function getDeal(propertyId: string) {
  const r = await rest(
    `marketplace_public?id=eq.${encodeURIComponent(propertyId)}&select=id,listing_title,city,state,acquisition_fee,acquisition_fee_deposit,reservation_state,turnkey_label,setup_package_summary,setup_package_cost,property_deposit_required,property_deposit_amount,property_deposit_notes,deposit_summary&limit=1`,
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const sessionToken = String(body.session_token || '').trim();

    const needsAccount = () =>
      json(
        {
          success: false,
          error: 'account_required',
          message: 'Please create a free account or sign in to start an acquisition.',
        },
        401,
      );

    /* ------------------------------------------------------------------ *
     * 1. START. What this costs, what the deposit is, what happens next.
     *    Reads only. Nothing is reserved and nothing is charged here.
     * ------------------------------------------------------------------ */
    if (action === 'start') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      const deal = await getDeal(String(body.property_id || ''));
      if (!deal) {
        return json(
          { success: false, error: 'not_available', message: 'That operation is no longer on the market.' },
          404,
        );
      }
      if (deal.reservation_state !== 'available') {
        return json({
          success: false,
          error: 'already_held',
          message:
            deal.reservation_state === 'reserved'
              ? 'That operation is already reserved.'
              : 'Another buyer has a hold on that operation while we verify their payment. Ask us to tell you if it becomes available again.',
        }, 409);
      }

      return json({
        success: true,
        step: 'review_terms',
        deal: {
          id: deal.id,
          title: deal.listing_title,
          location: `${deal.city}, ${deal.state}`,
          acquisition_fee: deal.acquisition_fee,
          what_you_get: deal.turnkey_label,
          setup_package: deal.setup_package_summary,
          setup_package_cost: deal.setup_package_cost,
        },
        // TWO DEPOSITS, AND THEY ARE NOT THE SAME MONEY.
        // The first is ours and comes off our fee. The second is the property's, is
        // additional, and does not come off our fee. Presenting only the first lets a
        // buyer think $2,500 is everything due at the start.
        acquisition_fee_deposit: {
          amount: deal.acquisition_fee_deposit,
          paid_to: 'Access Your Place',
          what_it_does:
            `A deposit of $${Number(deal.acquisition_fee_deposit).toLocaleString()} takes this operation off the market and holds it for you. ` +
            `It comes off the $${Number(deal.acquisition_fee).toLocaleString()} acquisition fee, it does not add to it.`,
        },
        property_deposit: {
          required: deal.property_deposit_required,
          amount: deal.property_deposit_amount,
          paid_to: 'the landlord or the property, not Access Your Place',
          note:
            deal.property_deposit_required === true
              ? (deal.property_deposit_amount
                  ? `This property also requires a $${Number(deal.property_deposit_amount).toLocaleString()} deposit paid to the property. That is additional money and does not come off our acquisition fee.`
                  : 'This property also requires a deposit paid to the property. The amount is being confirmed. It is additional and does not come off our acquisition fee.')
              : deal.property_deposit_required === false
                ? 'This property requires no separate deposit to the landlord.'
                : 'Whether this property requires a separate landlord deposit has not been confirmed yet. Ask your acquisition manager before you budget.',
        },
        // One sentence covering both, for reading aloud.
        what_you_need_up_front: deal.deposit_summary,
        // Said plainly and early, because it is the client's right and it is easy to
        // miss when a payment screen is the next thing in front of you.
        before_you_pay:
          'You can speak to an acquisition manager before sending any money. Ask for a call and we will arrange one. Nothing is owed for that conversation.',
        how_it_finishes:
          'Sending the deposit does not complete the purchase. It puts the operation on reserve. An acquisition manager verifies your payment, speaks with you, and finalises the acquisition. Every purchase on this platform is finalised by a person.',
        next: 'Review and accept the terms of service, then choose how you want to pay.',
      });
    }

    /* ------------------------------------------------------------------ *
     * 2. ACCEPT TERMS. Recorded against the account, with the time.
     * ------------------------------------------------------------------ */
    if (action === 'accept_terms') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      if (body.accepted !== true) {
        return json({
          success: false,
          error: 'not_accepted',
          message: 'The terms have to be accepted before the acquisition can go further.',
        }, 400);
      }

      const now = new Date().toISOString();
      const r = await rest('legal_acceptances', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          email: investor.email,
          role: 'investor',
          tos_accepted_at: now,
          privacy_policy_accepted_at: now,
          community_standards_accepted_at: now,
          ip_address: req.headers.get('x-forwarded-for') || null,
          user_agent: req.headers.get('user-agent') || null,
        }),
      });

      if (!r.ok) {
        const detail = await r.text();
        console.error('start-acquisition accept_terms_failed', detail);
        // Never say "recorded" when nothing was written.
        return json({
          success: false,
          error: 'not_recorded',
          message:
            'We could not record your acceptance just now, so we have not moved you on. Please try again, or email ' +
            TEAM_EMAIL + ' and we will handle it with you directly.',
        }, 502);
      }

      const rows = await r.json();
      return json({
        success: true,
        step: 'choose_payment_method',
        accepted_at: now,
        acceptance_id: Array.isArray(rows) && rows[0] ? rows[0].id : null,
        next: 'Choose how you want to send the deposit.',
      });
    }

    /* ------------------------------------------------------------------ *
     * 3. PAYMENT METHODS. Names the rails and points at the Payments tab.
     *    The destination strings are NOT returned here. Penny must never
     *    recite a payment destination: one wrong character sends money
     *    somewhere unrecoverable.
     * ------------------------------------------------------------------ */
    if (action === 'payment_methods') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      const r = await rest('payment_rails?select=id,method_type,label,display_order&order=display_order.asc');
      if (!r.ok) {
        console.error('start-acquisition payment_methods_failed', await r.text());
        return json({
          success: false,
          error: 'unavailable',
          message: 'We could not load the payment options just now. Please try again in a moment.',
        }, 502);
      }
      const methods = await r.json();

      return json({
        success: true,
        step: 'send_payment',
        methods,
        // The rule, stated to whoever is presenting this.
        destination_policy:
          'Open the Payments tab to see and copy the destination for the method you choose. It is shown there so you can copy it exactly. It is never read aloud or typed out in chat.',
        after_you_send:
          'Send the payment yourself from your own bank or app, then upload a photo of the confirmation. We put the operation on reserve the moment your proof arrives.',
      });
    }

    /* ------------------------------------------------------------------ *
     * 4. PROOF SUBMITTED. This is the step that takes the deal off the
     *    market. It writes the proof, opens the reservation, alerts the
     *    team, and reports honestly on each part.
     * ------------------------------------------------------------------ */
    if (action === 'submit_proof') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      const propertyId = String(body.property_id || '').trim();
      const methodType = String(body.method_type || '').trim().toLowerCase();
      const proofUrl = String(body.proof_url || '').trim();

      if (!propertyId) return json({ success: false, error: 'Property is required.' }, 400);
      if (!['zelle', 'wire', 'cashapp', 'bitcoin'].includes(methodType)) {
        return json({ success: false, error: 'Choose one of: Zelle, wire, Cash App, Bitcoin.' }, 400);
      }
      if (!proofUrl) {
        return json({
          success: false,
          error: 'proof_required',
          message: 'Attach a photo of the completed payment so the team can confirm it.',
        }, 400);
      }

      const deal = await getDeal(propertyId);
      if (!deal) return json({ success: false, error: 'That operation is no longer on the market.' }, 404);
      if (deal.reservation_state !== 'available') {
        return json({
          success: false,
          error: 'already_held',
          message: 'Another buyer got a hold on that operation first. Nothing has been recorded against your account. Contact us and we will look at what else fits.',
        }, 409);
      }

      const deposit = Number(deal.acquisition_fee_deposit);
      const amountRaw = body.amount_reported;
      const amount = amountRaw === undefined || amountRaw === null || amountRaw === '' ? null : Number(amountRaw);
      // The deposit floor is the rule. Say the number rather than failing vaguely.
      if (amount !== null && Number.isFinite(amount) && amount < deposit) {
        return json({
          success: false,
          error: 'below_minimum',
          message:
            `It takes at least $${deposit.toLocaleString()} toward the acquisition fee to take an operation off the market. ` +
            `You entered $${amount.toLocaleString()}. If you have already sent the full amount, tell us and we will check.`,
        }, 400);
      }

      // (a) the proof
      const pr = await rest('payment_submissions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          investor_id: investor.id,
          investor_name: investor.full_name || null,
          investor_email: investor.email,
          property_id: propertyId,
          method_type: methodType,
          amount_reported: amount,
          proof_url: proofUrl,
          client_note: body.client_note ? String(body.client_note) : null,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        }),
      });
      if (!pr.ok) {
        const detail = await pr.text();
        console.error('start-acquisition proof_write_failed', detail);
        return json({
          success: false,
          error: 'proof_not_saved',
          message:
            'Your proof did not save, so the operation has NOT been reserved and we have not told the team. ' +
            'Nothing is lost on your side. Please try again, or email ' + TEAM_EMAIL + ' with the screenshot.',
        }, 502);
      }
      const proofRows = await pr.json();
      const proof = Array.isArray(proofRows) ? proofRows[0] : null;

      // (b) the hold
      const rr = await rest('deal_reservations', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          investor_id: investor.id,
          investor_name: investor.full_name || null,
          investor_email: investor.email,
          property_id: propertyId,
          property_title: deal.listing_title,
          property_city: deal.city,
          property_state: deal.state,
          // proof_submitted, not confirmed. A person confirms it.
          status: 'proof_submitted',
          am_permission_granted: false,
          payment_id: proof?.id || null,
          created_at: new Date().toISOString(),
        }),
      });
      if (!rr.ok) {
        const detail = await rr.text();
        console.error('start-acquisition reservation_write_failed', detail);
        return json({
          success: false,
          error: 'reservation_not_created',
          message:
            'Your payment proof was saved, but we could not put the operation on reserve. ' +
            'Please contact ' + TEAM_EMAIL + ' now so the team can hold it for you by hand. ' +
            'Do not send a second payment.',
          proof_id: proof?.id || null,
        }, 502);
      }
      const resRows = await rr.json();
      const reservation = Array.isArray(resRows) ? resRows[0] : null;

      // (c) tell the team. An alert nobody receives is not an alert, so both the
      //     in-app row and the email are attempted and both are reported truthfully.
      let staff_notified = false;
      const nr = await rest('staff_notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'acquisition_proof_submitted',
          notification_type: 'acquisition_proof_submitted',
          target_role: 'acquisition_manager',
          priority: 'high',
          title: `Payment proof sent: ${deal.listing_title}`,
          message:
            `${investor.full_name || investor.email} sent proof of a ${methodType} payment` +
            `${amount ? ` of $${amount.toLocaleString()}` : ''} for ${deal.listing_title} in ${deal.city}, ${deal.state}. ` +
            `The operation is on reserve pending verification. An acquisition manager must verify the payment, speak with the client and finalise.`,
          investor_id: investor.id,
          investor_name: investor.full_name || null,
          investor_email: investor.email,
          property_id: propertyId,
          metadata: { reservation_id: reservation?.id, payment_submission_id: proof?.id, method_type: methodType },
        }),
      });
      staff_notified = nr.ok;
      if (!nr.ok) console.error('start-acquisition staff_notify_failed', await nr.text());

      const team_emailed = await sendEmail(
        TEAM_EMAIL,
        `ON RESERVE: ${deal.listing_title} — payment proof submitted`,
        `<p><strong>${investor.full_name || investor.email}</strong> has sent payment proof for <strong>${deal.listing_title}</strong>, ${deal.city}, ${deal.state}.</p>
         <p>Method: ${methodType}${amount ? `<br/>Amount reported: $${amount.toLocaleString()}` : ''}<br/>
         Email: ${investor.email}${investor.phone ? `<br/>Phone: ${investor.phone}` : ''}</p>
         <p>The operation is now <strong>on reserve</strong> and off the marketplace. It is not sold.</p>
         <p>An acquisition manager must verify the payment, speak with the client, and finalise the purchase.</p>`,
      );

      await sendEmail(
        investor.email,
        `We have your payment proof — ${deal.listing_title} is on reserve`,
        `<p>Thank you. We have your payment proof for <strong>${deal.listing_title}</strong>.</p>
         <p>The operation is now on reserve and has come off the marketplace, so nobody else can take it while we verify.</p>
         <p>This is not the end of the purchase. An acquisition manager will verify the payment and speak with you to finalise the acquisition. If you have not heard from us within one business day, reply to this email.</p>`,
      );

      return json({
        success: true,
        step: 'on_reserve',
        reservation_id: reservation?.id || null,
        payment_submission_id: proof?.id || null,
        staff_notified,
        team_emailed,
        message:
          `Your proof is in and ${deal.listing_title} is on reserve. It has come off the marketplace so nobody else can take it. ` +
          `An acquisition manager will verify the payment and speak with you to finalise the acquisition. Every purchase here is finalised by a person.`,
      });
    }

    /* ------------------------------------------------------------------ *
     * 5. ASK FOR AN ACQUISITION MANAGER. Available at any point, and
     *    specifically BEFORE any money moves.
     * ------------------------------------------------------------------ */
    if (action === 'request_manager_call') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      const propertyId = String(body.property_id || '').trim();
      const deal = propertyId ? await getDeal(propertyId) : null;
      const note = body.note ? String(body.note) : null;

      const nr = await rest('staff_notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'acquisition_manager_call_requested',
          notification_type: 'acquisition_manager_call_requested',
          target_role: 'acquisition_manager',
          priority: 'high',
          title: `Call requested before payment: ${deal?.listing_title || 'general'}`,
          message:
            `${investor.full_name || investor.email} has asked to speak to an acquisition manager` +
            `${deal ? ` about ${deal.listing_title} in ${deal.city}, ${deal.state}` : ''} before sending any payment.` +
            `${note ? ` They said: ${note}` : ''}`,
          investor_id: investor.id,
          investor_name: investor.full_name || null,
          investor_email: investor.email,
          property_id: propertyId || null,
          metadata: { requested_before_payment: true },
        }),
      });
      if (!nr.ok) {
        const detail = await nr.text();
        console.error('start-acquisition call_request_failed', detail);
        return json({
          success: false,
          error: 'not_recorded',
          message:
            'We could not log that request, so please email ' + TEAM_EMAIL +
            ' and an acquisition manager will come back to you. Do not send any payment until you have spoken to them.',
        }, 502);
      }

      const team_emailed = await sendEmail(
        TEAM_EMAIL,
        `Call requested before payment${deal ? `: ${deal.listing_title}` : ''}`,
        `<p><strong>${investor.full_name || investor.email}</strong> wants to speak to an acquisition manager before sending any payment.</p>
         ${deal ? `<p>Deal: ${deal.listing_title}, ${deal.city}, ${deal.state}</p>` : ''}
         <p>Email: ${investor.email}${investor.phone ? `<br/>Phone: ${investor.phone}` : ''}</p>
         ${note ? `<p>They said: ${note}</p>` : ''}`,
      );

      return json({
        success: true,
        step: 'manager_call_requested',
        team_emailed,
        message:
          'An acquisition manager has been asked to call you. Nothing is owed and nothing is held until you decide to go ahead.',
      });
    }

    /* ------------------------------------------------------------------ *
     * 6. WHERE AM I. So a returning client is never guessing.
     * ------------------------------------------------------------------ */
    if (action === 'status') {
      const investor = await resolveInvestor(sessionToken);
      if (!investor) return needsAccount();

      const r = await rest(
        `deal_reservations?investor_id=eq.${encodeURIComponent(investor.id)}&select=id,property_id,property_title,property_city,property_state,status,created_at&order=created_at.desc`,
      );
      if (!r.ok) {
        console.error('start-acquisition status_failed', await r.text());
        return json({
          success: false,
          error: 'unavailable',
          message: 'We could not read your acquisitions just now. This is not the same as you having none.',
        }, 502);
      }
      const reservations = await r.json();
      return json({ success: true, reservations, count: Array.isArray(reservations) ? reservations.length : 0 });
    }

    return json({ success: false, error: `Unknown action: ${action || '(none)'}` }, 400);
  } catch (e) {
    console.error('start-acquisition threw', e instanceof Error ? e.message : String(e));
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
