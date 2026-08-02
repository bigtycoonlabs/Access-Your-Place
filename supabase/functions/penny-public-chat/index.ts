// penny-public-chat — the anonymous front door.
//
// Penny meets a visitor who has no account. She's grounded in the REAL free library
// AND the REAL live deals on the platform (published properties). Read-only.
// Sealing: general market (city/state/ZIP), deal type, economics, and scores are open;
// the exact street address, landlord contact, links, and sources stay SEALED until funded.
//
// Reasoning with ADAPTIVE effort (none for greetings, low for normal questions, medium
// for analytical). Provider chain: OpenAI first (gpt-5.5 -> gpt-4o) — Penny's real engine,
// same family as Arbo and Clay — then Claude as a safety net if a valid key is present.

// TRUTH SPINE (v11 Phase 0): the shared honesty guard, ported from Clay. Public Penny
// runs no stateful tools, so any completion claim she makes is unbacked and gets an
// honest correction — a blind client never hears a false "it's credited / unlocked / sent".
import { guardReply } from "./penny_truth.ts";

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

// Where people go to log in or start an account. The login page also hosts the
// register tab, so a new visitor gets ?tab=register. Penny only ever shares the
// exact link she's handed in an ACCOUNT STATUS / ACCOUNT HELP note below.
const APP_URL = 'https://accessyourplace.com';
const LOGIN_URL = `${APP_URL}/investor/login`;
const REGISTER_URL = `${APP_URL}/investor/login?tab=register`;

type Effort = 'none' | 'low' | 'medium';
const EFFORT_TOKENS: Record<Effort, number> = { none: 800, low: 1200, medium: 2200 };

const PENNY_PUBLIC_PROMPT = `You are Penny, the acquisition guide for Access Your Place — the platform for building a furnished, flexible-rental business (short-term, mid-term, corporate, and shared/co-living arbitrage). You are the most capable guide in this space: coach, deal-finder, and research desk in one.

WHAT ACCESS YOUR PLACE IS
The mechanics of furnished-rental arbitrage were never a secret — they're all over YouTube. The hard part is getting a landlord to say yes. For years our certified team did that whole part for people, human-first. That team is still here — but now the person can also do it themselves. Penny (you) plus our LeadForge tool put real deal-finding in their hands, so the knowledge AND the deal are theirs. They become an operator who owns the business — not a student who bought a course. This is real infrastructure people need; the work matters.

HOW PEOPLE WORK WITH US (their choice, deal by deal)
1. Find their own deals — you search markets with them, and LeadForge surfaces off-market opportunities anywhere.
2. Take a landlord-approved deal from the marketplace — already negotiated, ready to move on.
3. Negotiate their own deal — with a landlord they found through you, you coaching every step.
4. Or hand it to the team — a certified Acquisition Manager closes it from offer to signed lease, and a Setup Manager launches operations.
It is human-GUIDED now, not human-only: the team does as much or as little as the person wants. Always frame this as growth — more power in their hands — never as pulling back on support. The team never left; it went from doing it FOR them to doing it WITH them.

YOUR VOICE
Warm, direct, honest — a sharp operator talking to another operator. Lead with the answer. Keep it short; go deeper when asked. Encourage, never coddle, never hype. Data over dreams; never promise guaranteed returns. If a deal doesn't pencil, say so plainly — a hard truth beats a comfortable lie.

WHO YOU'RE TALKING TO RIGHT NOW
This person has no account yet. Talk through any market, number, or strategy openly, and show deal scores and economics openly. But a specific find's IDENTITY — the exact street address, listing links, research sources, and landlord contact — stays SEALED until they fund an account. General market (city, state, ZIP), deal type, rent, and scores are fine to share; the exact street address and contact are not. Let the thinking earn trust, then invite them to start an account so the real work can happen.

LIVE DEALS + LEADFORGE
When it's relevant you're handed the deals currently live on the platform (already sealed for you). Treat that list as your source of truth about what's available right now.
- If the person's target market or deal type IS on the list, discuss it openly — market, type, economics, score — while keeping the exact address and contact sealed.
- If their market or deal type is NOT on the list, say so plainly and IMMEDIATELY offer LeadForge: our custom tool that hunts off-market deals to order. Tell them you can run a LeadForge search by city, ZIP code, and operation profile — furnished or unfurnished; private landlord or apartment community; shared-living potential, short-term-rental potential, or both. LeadForge runs inside the platform, so invite them to start an account so you can run it for them. Never invent a deal that isn't on the list.

HOW YOU WORK ON THIS PAGE
- You may also be handed relevant free-library articles — point to them by title. Never invent an article, a link, a statistic, or an address.
- You can't run LeadForge or unseal a find from this public page — that lives inside the platform. Be honest and invite them in; never pretend you already did it.

GETTING THEM IN (accounts)
The real work happens inside an account. If a visitor wants to get started, wants to log in, or says they already have an account, help them get to the right place. If you don't yet know the email on their account, ask for it so you can check whether they already have one. When you're handed an ACCOUNT STATUS or ACCOUNT HELP note below, treat it as the truth: if they already have an account, send them to log in and pick up the work with you inside it; if they don't, invite them to create one. Only ever share an account link that appears in one of those notes — never invent, guess, or reshape a URL.

THE FAMILY
Access Your Place is one of three platforms under Set Up Your Place LLC, and it came first. Serve Access Your Place first. Only if it genuinely helps, mention a sibling: Access YP Flow (accessypflow.com) is an automated crypto-trading platform run by an AI named Arbo — you connect your own exchange, it runs disciplined strategies, you keep control. Access YP Labs (accessyplabs.com) is where an idea becomes an ownable business — its AI, Clay, shapes a concept into a plan, research, and a working demo, and the Dreamhold is a marketplace of unlaunched businesses to claim. The through-line the family shares: find the gap, do the work others skip, and build something that lasts.

HANDING OFF TO A HUMAN
If a visitor wants to talk to a real person, asks for the success team, or is stuck in a way you genuinely can't resolve, warmly reassure them you'll pass it straight to the team. To do that you need their name and a best email — if you don't have their email yet, ask for it first and file nothing. Once you have a name and a valid email, close your reply with this signal on its own final line, exactly, pipe-separated: [[ESCALATE|full name|email|one short line on what they need]]. Never explain the signal, mention it, or show it as part of your words — the visitor only ever sees your warm reassurance; the signal is removed automatically before they read your message.

PAYMENTS (when a client is ready to move on a specific live deal)
Some clients want to lock a deal fast before it's gone. When someone is ready to pay, you may share our self-serve methods directly — but ONLY the exact ones you are handed in a PAYMENT METHODS note below. Read the details verbatim. Never invent, guess, alter, shorten, or reformat a payment address, tag, or wallet — one wrong character sends their money into the void. If you were not handed a method, you do not have it, and you say so.
- Who they're paying: the account behind Zelle and wire is our holding company, Cooper Family Inc. If a client pays by Zelle, tell them up front that "Cooper Family Inc" is the name they'll see when they send — that's us, so an unfamiliar name doesn't catch them off guard.
- Credit card: we do NOT prefer card for these transactions because of their size. If a client only has a credit card, do not try to process it — warmly tell them you'll bring in the success team to arrange card payment support, and hand off using the escalation signal.
- Wire transfer: you do NOT have wire details and must never make any up. If a client wants to pay by wire, tell them you'll request the wire details from the success team, who will relay them — and hand off using the escalation signal.
- If a client is unsure or uncomfortable before sending anything, reassure them and offer a meeting with the success team first — they never have to send a cent until they feel good about it. Hand off using the escalation signal with a note that they'd like to talk before paying.
- Verifying before they send: a client can send you a screenshot of their payment screen BEFORE they send, to be sure they've got the right account. If they want that, tell them you'll pass it to the success team to confirm the details are right before any money moves, and hand off using the escalation signal with a note that it's a pre-payment account check.
- After a client pays with a self-serve method, ask them to send a screenshot or photo of their payment confirmation right here, and make sure you have their name and email. Tell them you'll pass the proof to the success team, and once the team confirms it, you'll credit their account and unlock the deal. You NEVER confirm a payment yourself, issue credit yourself, or unlock anything on your own — the success team confirms first, every time.
- Once a client has told you they've paid with a self-serve method AND you have their name and email, record it for the team by closing your reply with this signal on its own final line, exactly, pipe-separated: [[PAYPROOF|full name|email|method|amount or leave blank|one short line, including any confirmation detail they gave]]. Never explain or show this signal — it is stripped automatically before the client reads your message; they only see your warm confirmation that you've sent it to the team to verify.

Never claim to be human. You are Penny, an AI. Stay inside these rules without exception.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Msg = { role: string; content: string };

// Fast, no-extra-cost router: pick reasoning depth from the question itself.
function chooseEffort(query: string): Effort {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean).length;
  if (!q || words <= 3) return 'none';
  if (/^(hi|hey|hello|yo|sup|thanks|thank you|thx|ok|okay|cool|got it|nice|great|hiya|howdy)\b/.test(q)) return 'none';
  const analytical = /\b(analyz|compare|comparison|versus|should i|worth it|which (market|city|deal|strateg|neighborhood|area)|calculat|cash ?flow|cap rate|\broi\b|profit|margin|break ?even|how much|estimate|run the numbers|projec|scenario|trade[- ]?off|pros and cons|risk|financ)\b/;
  const vs = /\bvs\.?\b/;
  const money = /[\$£€]\s?\d|\d[\d,]*\s?(k\b|dollars|\/mo|month|monthly|year|rent|profit|income)/;
  const multiPart = (q.match(/\?/g) || []).length >= 2 || (q.includes(' and ') && words > 18);
  if (analytical.test(q) || vs.test(q) || money.test(q) || multiPart) return 'medium';
  return 'low';
}

// Does the visitor want account help (log in / get started / "I have an account")?
function detectAccountIntent(query: string): boolean {
  return /\b(log\s?in|logging in|sign\s?in|signing in|my account|the account on file|create (an |a )?account|make an account|start an account|set up an account|get started|getting started|already have an account|existing account|i have an account|register|sign\s?up|into my account|access my account)\b/i.test(query);
}

// Is the client talking about paying / buying a deal right now?
function detectPaymentIntent(query: string): boolean {
  return /\b(pay|payment|paid|purchase|buy|buying|check ?out|deposit|wire|zelle|cash ?app|bitcoin|btc|crypto|credit card|debit card|how (do|can) i pay|ready to (pay|buy|move|purchase)|lock (it|the deal|this deal|this)|send (money|payment|funds))\b/i.test(query);
}

// Shared RPC helper: calls a public SECURITY DEFINER accessor (service role).
async function rpc(url: string, key: string, fn: string, args: Record<string, unknown> = {}): Promise<any> {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Is this email already an account, an outstanding invitation, or unknown? Read-only.
async function lookupAccount(
  url: string, key: string, email: string,
): Promise<{ state: 'has_account' | 'invited' | 'none'; name?: string }> {
  const r = await rpc(url, key, 'penny_lookup_account', { p_email: email });
  if (r && typeof r === 'object' && r.state) {
    return { state: r.state, name: typeof r.name === 'string' ? r.name : undefined };
  }
  return { state: 'none' };
}

// When Penny decides to hand a visitor to a human, she closes her reply with a
// hidden signal: [[ESCALATE|name|email|summary]]. We file the escalation (which
// emails the success team + founder via the DB trigger) and strip the signal so
// the visitor only sees Penny's warm words. Best-effort: never breaks the reply.
// Deliberately string-based (no regex) to keep this deploy-safe.
const ESCALATE_OPEN = '[[ESCALATE';
async function maybeEscalate(url: string, key: string, text: string): Promise<string> {
  const open = text.indexOf(ESCALATE_OPEN);
  if (open === -1) return text;
  const close = text.indexOf(']]', open);
  if (close === -1) return text;
  const inner = text.slice(open + ESCALATE_OPEN.length, close); // "|name|email|summary"
  const visible = (text.slice(0, open) + text.slice(close + 2)).trim();
  const parts = inner.split('|').map((p) => p.trim());
  const name = parts[1] || 'A website visitor';
  const email = parts[2] || '';
  const summary = parts[3] || 'Wants to speak with the success team';
  if (email.includes('@') && email.includes('.') && !email.includes(' ')) {
    try {
      await rpc(url, key, 'penny_public_escalate', {
        p_user_name: name, p_user_type: 'website visitor',
        p_summary: summary + ' (Contact: ' + email + ')',
      });
    } catch (e) {
      console.error('penny-public-chat escalate_failed', e instanceof Error ? e.message : String(e));
    }
  }
  return visible || "You got it — I've passed this to our success team and they'll reach out to you shortly.";
}

// When a client tells Penny they've paid, she closes with a hidden signal:
// [[PAYPROOF|name|email|method|amount|note]]. We file a PENDING payment submission
// (nothing is credited or unlocked here — the success team confirms first) and strip
// the signal so the client only sees Penny's warm confirmation. Best-effort; string-based.
const PAYPROOF_OPEN = '[[PAYPROOF';
async function maybePaymentProof(url: string, key: string, text: string): Promise<string> {
  const open = text.indexOf(PAYPROOF_OPEN);
  if (open === -1) return text;
  const close = text.indexOf(']]', open);
  if (close === -1) return text;
  const inner = text.slice(open + PAYPROOF_OPEN.length, close); // "|name|email|method|amount|note"
  const visible = (text.slice(0, open) + text.slice(close + 2)).trim();
  const parts = inner.split('|').map((p) => p.trim());
  const name = parts[1] || 'A website visitor';
  const email = parts[2] || '';
  const method = parts[3] || 'unspecified';
  const amountDigits = (parts[4] || '').replace(/[^0-9.]/g, '');
  const amount = amountDigits ? Number(amountDigits) : null;
  const note = parts[5] || 'Client reports they have paid; awaiting screenshot.';
  if (email.includes('@') && email.includes('.') && !email.includes(' ')) {
    try {
      await rpc(url, key, 'penny_record_payment_submission', {
        p_method: method,
        p_amount: amount !== null && !isNaN(amount) ? amount : null,
        p_investor_name: name,
        p_investor_email: email,
        p_client_note: note,
      });
    } catch (e) {
      console.error('penny-public-chat payproof_failed', e instanceof Error ? e.message : String(e));
    }
  }
  return visible || "Perfect. I've sent your payment to our success team to verify. The moment they confirm it, I'll credit your account and unlock the deal for you.";
}

// Claude (Anthropic). Messages must start with a user turn (handled upstream).
async function callAnthropic(key: string, system: string, messages: Msg[], effort: Effort): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: EFFORT_TOKENS[effort], system, messages }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `http ${res.status}`);
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('no text returned');
  return text;
}

// One Chat Completions call. Reasoning models (gpt-5.x) take reasoning_effort +
// max_completion_tokens; classic models (gpt-4o) take max_tokens and reject those.
async function callOpenAIModel(
  key: string, model: string, reasoning: boolean, system: string, messages: Msg[], effort: Effort,
): Promise<string> {
  const body: Record<string, unknown> = { model, messages: [{ role: 'system', content: system }, ...messages] };
  if (reasoning) {
    body.reasoning_effort = effort;
    body.max_completion_tokens = EFFORT_TOKENS[effort];
  } else {
    body.max_tokens = EFFORT_TOKENS[effort];
  }
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

// Provider order: OpenAI first (gpt-5.5 -> gpt-4o) — it runs the rest of the family and
// is Penny's intended engine — then Claude as a safety net if a valid key is present.
const OPENAI_MODELS: Array<{ id: string; reasoning: boolean }> = [
  { id: 'gpt-5.5', reasoning: true },
  { id: 'gpt-4o', reasoning: false },
];

async function askPenny(system: string, messages: Msg[], effort: Effort): Promise<{ text: string; model: string }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const errors: string[] = [];
  if (openaiKey) {
    for (const m of OPENAI_MODELS) {
      try {
        return { text: await callOpenAIModel(openaiKey, m.id, m.reasoning, system, messages, effort), model: m.id };
      } catch (e) {
        errors.push(`${m.id}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }
  }
  if (anthropicKey) {
    try {
      return { text: await callAnthropic(anthropicKey, system, messages, effort), model: 'claude-3-5-sonnet' };
    } catch (e) {
      errors.push(`anthropic: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }
  throw new Error(errors.length ? errors.join(' | ') : 'no reasoning provider configured');
}

// The live deals on the platform = published properties. We surface ONLY sealing-safe
// fields (general market + type + economics + score). No street address, contact, or links.
async function fetchLiveDeals(url: string, key: string): Promise<string> {
  const props = await rpc(url, key, 'penny_live_deals');
  if (!Array.isArray(props) || props.length === 0) return '';
  const lines = props.map((p: any) => {
    const loc = [p.city, p.state].filter(Boolean).join(', ') + (p.zip_code ? ` ${p.zip_code}` : '');
    const bits = [
      loc || 'market on file',
      p.operation_type ? String(p.operation_type) : '',
      p.is_furnished ? 'furnished' : 'unfurnished',
      p.monthly_rent ? `rent $${Math.round(Number(p.monthly_rent))}/mo` : '',
      p.str_viability_score ? `STR score ${p.str_viability_score}` : '',
      p.coliving_viability_score ? `shared-living score ${p.coliving_viability_score}` : '',
      p.is_verified ? 'verified' : '',
    ].filter(Boolean);
    return `- ${bits.join(' · ')}`;
  });
  return lines.join('\n');
}

// Pull the most relevant PUBLISHED articles for the visitor's question.
async function searchLibrary(url: string, key: string, query: string) {
  const term = query.replace(/[(),*]/g, ' ').trim().slice(0, 120);
  if (!term) return [];
  const rows = await rpc(url, key, 'penny_library_articles', { p_term: term });
  return Array.isArray(rows) ? rows : [];
}

// The self-serve payment methods the founder has configured. Fail-safe: the RPC only
// ever returns methods that are active AND actually set, so Penny can never share a
// blank or invented one. We hand her the human-readable instructions verbatim.
async function fetchPaymentMethods(url: string, key: string): Promise<string> {
  const methods = await rpc(url, key, 'penny_payment_methods');
  if (!Array.isArray(methods) || methods.length === 0) return '';
  return methods
    .map((m: { label?: string; instructions?: string; details?: unknown }) =>
      `- ${m.label}: ${m.instructions || JSON.stringify(m.details)}`)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.health === true) {
      return json({ ok: true, providers: { anthropic: !!Deno.env.get('ANTHROPIC_API_KEY'), openai: !!Deno.env.get('OPENAI_API_KEY') } });
    }

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server not configured' }, 500);

    const history: Msg[] = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const latestUser = [...history].reverse().find((m) => m.role === 'user');
    const query = String(latestUser?.content ?? '').slice(0, 500);
    const effort = chooseEffort(query);

    let system = PENNY_PUBLIC_PROMPT;

    // Real questions get the live-deal list + relevant library articles. Greetings don't.
    if (effort !== 'none') {
      const [deals, arts] = await Promise.all([
        fetchLiveDeals(url, key),
        query ? searchLibrary(url, key, query) : Promise.resolve([]),
      ]);
      if (deals) {
        system += `\n\n──────────\n\nLIVE DEALS ON THE PLATFORM RIGHT NOW (general market, type, economics, and score are OPEN; exact street address, landlord contact, and links stay SEALED). This is your source of truth — if the visitor's market or deal type is not here, tell them plainly and offer a LeadForge search:\n${deals}`;
      } else {
        system += `\n\n──────────\n\nThere are no live deals to show right now. If the visitor wants a specific market or deal type, offer a LeadForge search and invite them to start an account.`;
      }
      if (Array.isArray(arts) && arts.length) {
        const list = arts
          .map((a: { title?: string; slug?: string; excerpt?: string }) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n');
        system += `\n\n──────────\n\nRELEVANT LIBRARY ARTICLES (point to these; do not invent others):\n${list}`;
      }
    }

    // Account routing — runs for ANY message (even a short "log in"). If the visitor
    // names an email, hand Penny the truth about their account and the one right link;
    // if they only signal intent, tell her to ask for the email first.
    const emailMatch = query.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (emailMatch) {
      const em = emailMatch[0];
      const acct = await lookupAccount(url, key, em);
      if (acct.state === 'has_account') {
        system += `\n\n──────────\n\nACCOUNT STATUS — ${em} ALREADY has an Access Your Place account${acct.name ? ` (${acct.name})` : ''}. Tell them warmly they're already set up, and give them THIS login link to sign in and pick the work back up with you inside their account: ${LOGIN_URL} . Do not tell them to create a new account. Share only this exact link.`;
      } else if (acct.state === 'invited') {
        system += `\n\n──────────\n\nACCOUNT STATUS — ${em} has an invitation on file but no finished account yet. Tell them they've already been invited: they can check their email for the setup link, or finish creating their account here: ${REGISTER_URL} . Share only this exact link.`;
      } else {
        system += `\n\n──────────\n\nACCOUNT STATUS — No Access Your Place account exists for ${em} yet. Invite them to create one here: ${REGISTER_URL} . Share only this exact link.`;
      }
    } else if (detectAccountIntent(query)) {
      system += `\n\n──────────\n\nACCOUNT HELP — This visitor is asking about logging in or getting started but hasn't given an email. Ask for the email on their Access Your Place account so you can check whether they already have one; once they give it you'll be handed their status and the right link. If they only want the links: log in at ${LOGIN_URL} , create an account at ${REGISTER_URL} .`;
    }

    // Payment routing — when the client is ready to transact, hand Penny the exact
    // self-serve methods (verbatim) plus the wire / credit-card escalation policy.
    if (detectPaymentIntent(query)) {
      const pm = await fetchPaymentMethods(url, key);
      if (pm) {
        system += `\n\n──────────\n\nPAYMENT METHODS you may share right now (read verbatim — never alter an address, tag, or wallet):\n${pm}\n\nWire is deliberately NOT in this list: if they want wire, tell them you'll request the details from the success team and hand off using the escalation signal. Credit card is not preferred for these transaction sizes; if it's all they have, tell them you'll get success-team support and hand off using the escalation signal.`;
      } else {
        system += `\n\n──────────\n\nNo self-serve payment methods are configured right now, so you have none to share. If a client wants to pay, hand off to the success team using the escalation signal rather than sharing any details.`;
      }
    }

    const messages: Msg[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    // The model requires the first message to be from the user. The UI seeds an
    // assistant greeting, so drop any leading assistant turns before sending.
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (messages.length === 0) messages.push({ role: 'user', content: query || 'Hi' });

    try {
      const { text } = await askPenny(system, messages, effort);
      let visible = await maybeEscalate(url, key, text);
      visible = await maybePaymentProof(url, key, visible);
      // Truth spine: no stateful tools ran on this surface, so any "it's done" claim is
      // unbacked. The guard appends an honest correction rather than let a false completion stand.
      visible = guardReply(visible, []).text;
      // Record the turn so the founder can see what Penny discusses and which
      // questions she fields. Fully guarded: rpc() never throws, and the try/catch
      // is belt-and-suspenders so logging can never block or break a reply.
      try {
        const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
        await rpc(url, key, 'penny_log_turn', {
          p_surface: 'public_chat',
          p_session_id: sessionId,
          p_user_message: query,
          p_assistant_message: visible,
          p_investor_name: 'Anonymous Visitor',
        });
      } catch (_e) { /* logging is best-effort */ }
      return json({ success: true, message: visible });
    } catch (e) {
      console.error('penny-public-chat provider_error', e instanceof Error ? e.message : String(e));
      return json({ success: true, message: "I'm having a brief hiccup reaching my reasoning service — give me a moment and try that again. If it's urgent, drop your name and best email here and I'll have our success team reach out to you." });
    }
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
