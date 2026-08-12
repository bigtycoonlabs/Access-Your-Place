// forge-outreach
//
// Sends the approach to a landlord on a Property Forge find, on behalf of ACCESS YOUR
// PLACE rather than as a personal note from the client, and records it.
//
// THE OWNER'S RULES, IMPLEMENTED HERE
//   - The client does NOT preview the email. If they want it sent, we send it. If they
//     want to do it themselves, they get the email and phone instead.
//   - It leads with the network: one of our operators is interested if the owner is open
//     to corporate leasing.
//   - It explains what working with us actually gets them.
//   - It carries a VERIFICATION CODE, so a landlord can confirm the approach is genuinely
//     from us and not somebody claiming to be us. Cold email claiming to represent a
//     company is exactly what a scam looks like, and a landlord has no way to tell unless
//     we give them one.
//   - It routes them to the Success Team or to the landlord portal, where an Acquisition
//     Manager follows up.
//
// It never sends without a released, owned lead behind it, and it never reports a send
// that did not happen.

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
const FROM = 'Access Your Place <partnerships@accessyourplace.com>';
const SUCCESS = 'success@accessyourplace.com';
const PORTAL = 'https://accessyourplace.com/landlord/signup';

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });

async function resolveInvestor(token: string) {
  if (!token) return null;
  const sr = await rest(`investor_sessions?session_token=eq.${encodeURIComponent(token)}&is_active=eq.true&select=investor_id,expires_at&limit=1`);
  if (!sr.ok) return null;
  const rows = await sr.json();
  const s = Array.isArray(rows) ? rows[0] : null;
  if (!s || (s.expires_at && new Date(s.expires_at) < new Date())) return null;
  const ir = await rest(`investors?id=eq.${encodeURIComponent(s.investor_id)}&select=id,full_name,email&limit=1`);
  if (!ir.ok) return null;
  const rows2 = await ir.json();
  return Array.isArray(rows2) ? rows2[0] : null;
}

function code() {
  return 'AYP-' + Math.random().toString(36).slice(2, 7).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function compose(address: string, city: string, state: string, contactName: string | null, vcode: string) {
  const greeting = contactName ? `Hello ${contactName},` : 'Hello,';
  return `${greeting}

I am writing from Access Your Place, a corporate housing and furnished rental network based in Miami. One of the operators in our network is interested in ${address}, ${city}, ${state}, if you are open to corporate leasing.

Briefly, what that means and why owners work with us:

- A company signs the lease, not an individual. Rent is paid by a business that treats the unit as an operating asset.
- The unit is professionally furnished and maintained to hospitality standards. Our own team handles the furnishing and installation.
- Corporate and extended-stay tenants: relocations, travelling professionals, insurance and medical stays.
- You are not paying us anything. We charge the operator, never the property owner. There is no listing fee and no commission taken from you.
- Every operator in our network is vetted before we introduce them, and we verify they can carry the rent regardless of how the unit performs.

If this is something you would consider, there are two ways to take it forward:

1. Reply to this email, or write to ${SUCCESS}, and our Success Team will put you in touch with an Acquisition Manager.
2. Create a landlord account at ${PORTAL}. You can set out your requirements and upload your details, and an Acquisition Manager will be in touch to confirm.

PLEASE VERIFY THIS MESSAGE IS GENUINELY FROM US.
Your verification code is: ${vcode}

We know an unexpected email claiming to represent a company is exactly what a scam looks like. Quote that code to ${SUCCESS} and we will confirm this approach came from Access Your Place. If anyone contacts you claiming to be us and cannot produce a matching code, it is not us, and we would be grateful if you told us.

If corporate leasing is not for you, simply say so and we will not contact you about this property again.

Access Your Place
Set Up Your Place LLC
1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126
${SUCCESS}
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'send');
    const investor = await resolveInvestor(String(body.session_token || '').trim());
    if (!investor) return json({ success: false, error: 'account_required', message: 'Please sign in.' }, 401);

    // The client's own leads and where each one stands.
    if (action === 'my_leads') {
      const r = await rest(`forge_leads?investor_id=eq.${encodeURIComponent(investor.id)}&select=*&order=created_at.desc&limit=100`);
      if (!r.ok) {
        return json({ success: false, error: 'unavailable',
          message: 'We could not load your leads just now. That is not the same as you having none.' }, 502);
      }
      return json({ success: true, leads: await r.json() });
    }

    if (action !== 'send') return json({ success: false, error: `Unknown action: ${action}` }, 400);

    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const to = String(body.contact_email || '').trim();
    const contactName = body.contact_name ? String(body.contact_name).trim() : null;
    if (!address || !city || !state) return json({ success: false, error: 'address, city and state are required.' }, 400);
    if (!to) {
      return json({ success: false, error: 'no_email',
        message: 'There is no email address for this property, so we cannot send outreach. Call them instead: the number was released with the property.' }, 400);
    }

    const ref = `${address}|${city}|${state}`.toLowerCase();

    // Outreach only on a property this client has actually released. Otherwise anybody
    // could have us email any landlord about any address without paying or being tracked.
    const lr = await rest(`credit_ledger?investor_id=eq.${encodeURIComponent(investor.id)}&kind=eq.address_release&property_ref=eq.${encodeURIComponent(ref)}&select=id&limit=1`);
    const rows = lr.ok ? await lr.json() : [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ success: false, error: 'not_released',
        message: 'Release this property first. Outreach only goes out on a property you have released.' }, 402);
    }

    const vcode = code();

    // Record the lead BEFORE sending, so an email can never exist with no record of who
    // it was for or which code it carried.
    const ins = await rest('forge_leads', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        investor_id: investor.id, property_ref: ref, address, city, state,
        contact_email: to, contact_phone: body.contact_phone || null, contact_name: contactName,
        status: 'pursuing', verification_code: vcode,
      }),
    });
    if (!ins.ok) {
      console.error('forge-outreach lead_insert_failed', await ins.text());
      return json({ success: false, error: 'not_recorded',
        message: 'We could not record this lead, so nothing was sent. Please try again.' }, 502);
    }
    const lead = (await ins.json())[0];

    if (!RESEND_KEY) {
      return json({ success: false, error: 'not_configured', sent: false,
        message: 'Email sending is not configured on this project, so nothing was sent. Nobody has been contacted.' }, 503);
    }

    const sr = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [to], reply_to: SUCCESS,
        subject: `Corporate leasing enquiry for ${address}, ${city} — ref ${vcode}`,
        text: compose(address, city, state, contactName, vcode),
      }),
    });
    const payload = await sr.json().catch(() => ({}));
    if (!sr.ok || !payload?.id) {
      console.error('forge-outreach send_failed', sr.status, JSON.stringify(payload).slice(0, 300));
      await rest(`forge_leads?id=eq.${lead.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ notes: `Outreach failed: HTTP ${sr.status}` }),
      });
      return json({ success: false, error: 'send_failed', sent: false,
        message: 'The outreach did not send. Nobody has been contacted. Please try again, or call them directly.' }, 502);
    }

    await rest(`forge_leads?id=eq.${lead.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ outreach_sent_at: new Date().toISOString(), outreach_provider_id: payload.id }),
    });

    return json({
      success: true, sent: true, verification_code: vcode, lead_id: lead.id,
      message: `Sent to ${to} on behalf of Access Your Place. It leads with the network, explains what working with us involves, and carries verification code ${vcode} so they can confirm with our Success Team that the approach is genuinely ours.`,
      what_happens_next:
        'If they reply, or contact the Success Team, you will be notified. This property stays yours while you are pursuing it: we will not list it or pass it to the network unless you tell us you no longer want it.',
    });
  } catch (e) {
    console.error('forge-outreach threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Unknown error', sent: false }, 500);
  }
});
