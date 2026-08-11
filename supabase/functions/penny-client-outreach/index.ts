// penny-client-outreach — staff brief Penny about a client; Penny composes a personal
// re-engagement email in her own voice and (optionally) sends it, then logs everything.
//
// Reuses the platform's rails: the app schema, the Resend sender (notifications@accessyourplace.com),
// email_delivery_logs, investor_communications. Staff-only: validated by session_token on staff_users.
// Never invents facts — Penny writes only from the staff briefing.

// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
const PLATFORM_URL = 'https://accessyourplace.com';

// Route every /rest/v1 call through the app schema (same pattern as send-notification-email).
const _fetch = globalThis.fetch;
// deno-lint-ignore no-explicit-any
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string' ? input : (input?.url?.toString?.() || input?.toString?.() || '');
  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }
  return _fetch(input, init);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const OUTREACH_PROMPT = `You are Penny, the AI guide for Access Your Place. You are writing a PERSONAL email to one specific client, on behalf of the whole team, to re-establish the relationship and bring them onto the platform where you can help them directly.

You are given a STAFF BRIEFING about this client — their history with Access Your Place, the properties they worked on, wins and setbacks, any credits, and their current situation. Use ONLY what the briefing tells you. NEVER invent a property, a number, an outcome, a launch, or a credit amount that is not in the briefing. If a detail isn't given, don't imply it.

Write the email to do these things, in a warm, direct, human voice — a sharp operator who genuinely has their back; never salesy, never corporate, no hype, no guarantees:
1. Open with "Hi <FirstName>," and show immediately that we know exactly who they are and where things stand.
2. Recap their journey accurately and specifically from the briefing — the properties, the wins, and honestly acknowledge any setbacks without blame.
3. Make clear we are aware of their current situation and we are on it.
4. Invite them to come talk to you (Penny) directly on the Access Your Place site — you can pick up their situation and help move it forward. (Do NOT paste any URL; a button is added separately.)
5. If they don't already have an account, tell them to create one using this same email address, so you'll have their full history the moment they log in.
6. Close with quiet confidence and warmth, then "Penny" on its own final line. Do not sign as a human or invent a human name.

Keep it tight: 4 to 6 short paragraphs. Sound like a real person who remembers them.

Respond with ONLY a JSON object and nothing else: {"subject": "<short, personal subject line>", "body": "<email body, paragraphs separated by \\n\\n, starting with 'Hi <FirstName>,' and ending with 'Penny'>"}`;

function buildBriefingText(b: Record<string, unknown>): string {
  const line = (label: string, v: unknown) => (v && String(v).trim() ? `${label}: ${String(v).trim()}` : '');
  return [
    line('First name', b.first_name),
    line('Last name', b.last_name),
    line('Company', b.company_name),
    line('City / market', b.city),
    line('Has a portal account already', b.investor_id ? 'yes' : 'no'),
    line('Experience with Access Your Place so far', b.experience_summary),
    line('Properties they went through', b.properties_summary),
    line('Successful launches', b.successful_launches),
    line('Setbacks / failed situations', b.failed_situations),
    line('Credits they may have', b.credits_note),
    line('Current situation', b.current_situation),
    line('Extra context from staff', b.staff_context),
  ].filter(Boolean).join('\n');
}

async function callOpenAIModel(key: string, model: string, reasoning: boolean, userContent: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: OUTREACH_PROMPT }, { role: 'user', content: userContent }],
  };
  if (reasoning) { body.reasoning_effort = 'medium'; body.max_completion_tokens = 1800; }
  else { body.max_tokens = 1800; }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `http ${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('no text returned');
  return text;
}

async function compose(openaiKey: string, userContent: string): Promise<{ subject: string; body: string }> {
  const models = [{ id: 'gpt-5.5', reasoning: true }, { id: 'gpt-4o', reasoning: false }];
  let lastErr = '';
  for (const m of models) {
    try {
      const raw = await callOpenAIModel(openaiKey, m.id, m.reasoning, userContent);
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed?.subject && parsed?.body) return { subject: String(parsed.subject), body: String(parsed.body) };
      throw new Error('missing subject/body');
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'failed';
    }
  }
  throw new Error(`compose failed: ${lastErr}`);
}

function renderHtml(bodyText: string, ctaUrl: string, ctaLabel: string): string {
  const paras = esc(bodyText)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px;white-space:pre-wrap;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#1a365d 0%,#2d5a87 50%,#1a365d 100%);padding:32px 24px;text-align:center;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">Access Your Place</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:13px;">A note from Penny</p>
    </div>
    <div style="padding:32px 24px;">
      ${paras}
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#d4a574 0%,#c49464 100%);color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;box-shadow:0 2px 8px rgba(212,165,116,0.3);">
          ${esc(ctaLabel)}
        </a>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Access Your Place — flexible-rental operations, done with you.</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_KEY) return json({ success: false, error: 'Server not configured' }, 500);
    if (!OPENAI_API_KEY) return json({ success: false, error: 'Reasoning engine not configured' }, 500);

    const sb = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const body = await req.json().catch(() => ({}));
    const { briefing_id, mode = 'draft', staff_session_token, cta_url } = body as Record<string, string>;

    // ---- Staff auth: a live session_token on an active staff user ----
    if (!staff_session_token) return json({ success: false, error: 'Staff authentication required' }, 401);
    const staffRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_users?session_token=eq.${encodeURIComponent(staff_session_token)}&is_active=eq.true&select=id,name,first_name,last_name,email,role,session_expires`,
      { headers: sb },
    );
    const staff = (await staffRes.json())?.[0];
    if (!staff) return json({ success: false, error: 'Invalid or inactive staff session' }, 401);
    if (staff.session_expires && new Date(staff.session_expires).getTime() < Date.now()) {
      return json({ success: false, error: 'Staff session expired' }, 401);
    }
    const staffName = staff.name || [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'AYP Team';

    if (!briefing_id) return json({ success: false, error: 'briefing_id is required' }, 400);

    // ---- Load the briefing ----
    const briefRes = await fetch(
      `${SUPABASE_URL}/rest/v1/penny_client_briefings?id=eq.${briefing_id}&select=*`,
      { headers: sb },
    );
    const brief = (await briefRes.json())?.[0];
    if (!brief) return json({ success: false, error: 'Briefing not found' }, 404);
    if (!brief.email || !String(brief.email).includes('@')) {
      return json({ success: false, error: 'Briefing has no valid email' }, 400);
    }

    // ---- Compose in Penny's voice ----
    const { subject, body: emailBody } = await compose(OPENAI_API_KEY, buildBriefingText(brief));

    const hasAccount = !!brief.investor_id;
    const ctaUrl = cta_url
      || (hasAccount ? `${PLATFORM_URL}/investor-login` : `${PLATFORM_URL}/?email=${encodeURIComponent(brief.email)}`);
    const ctaLabel = hasAccount ? 'Log in & talk to Penny' : 'Talk to Penny & set up your account';
    const html = renderHtml(emailBody, ctaUrl, ctaLabel);

    // ---- Draft mode: return the composed email for staff review, send nothing ----
    if (mode !== 'send') {
      return json({ success: true, mode: 'draft', subject, body: emailBody, html, to: brief.email });
    }

    // ---- Send mode ----
    if (!RESEND_API_KEY) return json({ success: false, error: 'Email service not configured' }, 500);

    // Respect unsubscribe only when they are a known investor.
    if (hasAccount) {
      try {
        const invRes = await fetch(
          `${SUPABASE_URL}/rest/v1/investors?id=eq.${brief.investor_id}&select=messaging_email_unsubscribed,email_opt_in`,
          { headers: sb },
        );
        const inv = (await invRes.json())?.[0];
        if (inv?.messaging_email_unsubscribed || inv?.email_opt_in === false) {
          return json({ success: true, email_sent: false, reason: 'unsubscribed', subject, body: emailBody });
        }
      } catch (_) { /* non-fatal */ }
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>',
        to: [brief.email],
        reply_to: 'success@accessyourplace.com',
        subject,
        html,
      }),
    });
    const emailResult = await emailRes.json().catch(() => ({}));
    const emailSent = emailRes.ok;
    const resendId = emailResult?.id || null;

    // Log delivery (truthfully — status reflects the real Resend result).
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/email_delivery_logs`, {
        method: 'POST',
        headers: sb,
        body: JSON.stringify({
          email_type: 'penny_client_outreach',
          recipient_email: brief.email,
          recipient_name: [brief.first_name, brief.last_name].filter(Boolean).join(' ') || 'Client',
          recipient_type: 'investor',
          sender_name: `Penny (via ${staffName})`,
          sender_type: 'staff',
          subject,
          resend_id: resendId,
          status: emailSent ? 'sent' : 'failed',
          error_message: emailSent ? null : (emailResult?.message || 'Send failed'),
          metadata: { briefing_id, investor_id: brief.investor_id || null, staff_id: staff.id },
        }),
      });
    } catch (_) { /* non-fatal */ }

    // Thread it into the client's communication history.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/investor_communications`, {
        method: 'POST',
        headers: sb,
        body: JSON.stringify({
          investor_id: brief.investor_id || null,
          type: 'email',
          direction: 'outbound',
          subject,
          content: emailBody,
          status: emailSent ? 'sent' : 'failed',
          staff_name: `Penny (via ${staffName})`,
        }),
      });
    } catch (_) { /* non-fatal */ }

    // Update the briefing outreach state (never touches credits).
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/penny_client_briefings?id=eq.${briefing_id}`, {
        method: 'PATCH',
        headers: sb,
        body: JSON.stringify({
          outreach_status: emailSent ? 'sent' : 'send_failed',
          last_outreach_at: new Date().toISOString(),
          last_email_subject: subject,
          last_email_body: emailBody,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (_) { /* non-fatal */ }

    // In-portal notification if they already have an account.
    if (brief.investor_id && emailSent) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications`, {
          method: 'POST',
          headers: sb,
          body: JSON.stringify({
            investor_id: brief.investor_id,
            type: 'new_message',
            title: 'A note from Penny',
            message: subject,
            read: false,
            data: { source: 'penny_client_outreach', staff_name: staffName },
            created_at: new Date().toISOString(),
          }),
        });
      } catch (_) { /* non-fatal */ }
    }

    return json({ success: true, email_sent: emailSent, resend_id: resendId, subject, body: emailBody, to: brief.email });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
