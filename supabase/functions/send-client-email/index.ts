// send-client-email
//
// THE ONE PATH for email that goes to a client. It sends, then it records what happened
// against that client, and it tells the caller the truth about both.
//
// WHY THIS EXISTS
// Three emails were sent to a client about her property and not one of them was recorded
// anywhere on the platform. Anyone opening her file saw an empty history. Acting on that
// empty history, a fourth email went out saying "we have not heard from you" without
// knowing what she had already been told. Two more were then sent straight through the
// Resend API, which delivers the message but writes nothing here and leaves no copy in the
// company mailbox, so the record got worse rather than better.
//
// A client's correspondence has to live where the next person will look for it.
//
// WHAT THIS WILL NOT DO
//   - It will not report an email as sent when the provider refused it.
//   - It will not silently skip the log if the send worked. A delivered email with no
//     record is the exact failure this was built to end, so a log failure is returned to
//     the caller as a warning they have to deal with, not swallowed.
//   - It does not decide who to email. The caller passes the recipient.

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

// Only verified sending domains. A From on an unverified domain silently lands in spam.
const ALLOWED_FROM: Record<string, string> = {
  success: 'Access Your Place Success Team <success@accessyourplace.com>',
  penny: 'Penny at Access Your Place <penny@accessyourplace.com>',
  vission: 'Vission Cooper <vission@accessyourplace.com>',
};

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'send');

    // Read a client's correspondence history. This is the half that would have prevented
    // the whole problem: before writing to somebody, look at what they were already told.
    if (action === 'history') {
      const email = String(body.recipient_email || '').trim().toLowerCase();
      const investorId = String(body.investor_id || '').trim();
      if (!email && !investorId) return json({ success: false, error: 'recipient_email or investor_id is required' }, 400);

      const filter = investorId
        ? `investor_id=eq.${encodeURIComponent(investorId)}`
        : `recipient_email=eq.${encodeURIComponent(email)}`;
      const r = await rest(`investor_communications?${filter}&select=*&order=created_at.desc&limit=50`);
      if (!r.ok) {
        console.error('send-client-email history_failed', await r.text());
        return json({
          success: false,
          error: 'unavailable',
          message: 'We could not read the correspondence history. This is NOT the same as there being none, so do not treat it as an empty history.',
        }, 502);
      }
      const rows = await r.json();
      return json({ success: true, count: Array.isArray(rows) ? rows.length : 0, communications: rows });
    }

    if (action !== 'send') return json({ success: false, error: `Unknown action: ${action}` }, 400);

    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const text = String(body.text || '').trim();
    const fromKey = String(body.from || 'success').trim().toLowerCase();
    const sentBy = String(body.sent_by || 'Access Your Place').trim();

    if (!to || !subject || !text) {
      return json({ success: false, error: 'to, subject and text are all required' }, 400);
    }
    const from = ALLOWED_FROM[fromKey];
    if (!from) {
      return json({
        success: false,
        error: 'bad_sender',
        message: `from must be one of: ${Object.keys(ALLOWED_FROM).join(', ')}. Those are the verified addresses.`,
      }, 400);
    }

    // Match the recipient to a client so the row lands on their file rather than floating.
    let investorId: string | null = body.investor_id ? String(body.investor_id) : null;
    if (!investorId) {
      const ir = await rest(`investors?email=eq.${encodeURIComponent(to.toLowerCase())}&select=id&limit=1`);
      if (ir.ok) {
        const rows = await ir.json();
        if (Array.isArray(rows) && rows[0]) investorId = rows[0].id;
      }
    }

    // 1. Send.
    let providerId: string | null = null;
    let deliveryStatus = 'failed';
    let deliveryError: string | null = null;

    if (!RESEND_KEY) {
      deliveryError = 'RESEND_API_KEY is not set on this project, so nothing was sent.';
    } else {
      try {
        const sr = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [to],
            reply_to: body.reply_to || 'success@accessyourplace.com',
            subject,
            text,
          }),
        });
        const payload = await sr.json().catch(() => ({}));
        if (sr.ok && payload?.id) {
          providerId = payload.id;
          deliveryStatus = 'sent';
        } else {
          deliveryError = `Provider refused: HTTP ${sr.status} ${JSON.stringify(payload).slice(0, 300)}`;
        }
      } catch (e) {
        deliveryError = `Provider threw: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // 2. Record it EITHER WAY. A refused send is part of the history too: the next person
    //    needs to know we tried and it did not land.
    let logged = false;
    let logError: string | null = null;
    const lr = await rest('investor_communications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        investor_id: investorId,
        type: 'email',
        direction: 'outbound',
        subject,
        content: text,
        status: deliveryStatus,
        staff_name: sentBy,
        sent_by: sentBy,
        recipient_email: to,
        from_email: from,
        provider_id: providerId,
        delivery_status: deliveryStatus,
        delivery_error: deliveryError,
        created_at: new Date().toISOString(),
      }),
    });
    if (lr.ok) {
      logged = true;
    } else {
      logError = await lr.text();
      console.error('send-client-email log_failed', logError);
    }

    if (deliveryStatus !== 'sent') {
      return json({
        success: false,
        error: 'not_sent',
        message: `The email was NOT sent. ${deliveryError}`,
        logged,
      }, 502);
    }

    return json({
      success: true,
      provider_id: providerId,
      logged,
      // Surfaced, never swallowed: a delivered email with no record is the fault this
      // function exists to prevent, so the caller is told and can put it right by hand.
      warning: logged ? null : `The email was sent but it was NOT recorded against the client. Add a note by hand. Reason: ${logError}`,
      message: `Sent to ${to} from ${from}${logged ? ' and recorded on their file.' : '.'}`,
    });
  } catch (e) {
    console.error('send-client-email threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
