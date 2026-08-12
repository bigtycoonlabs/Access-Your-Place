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

// The public surface carried none of what Penny actually knows — she met a stranger with
// a tone and no substance. This is the visitor who has never heard of us, so it matters
// MORE here than on the staff desk: the free knowledge is the reason to trust us at all.
import { PENNY_INDUSTRY_SENSE, PENNY_COVENANT, PENNY_TEAM, PENNY_ROUTING } from "../_shared/penny/doctrine.ts";

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

// Where people go to log in or start an account. The login page also hosts the
// register tab, so a new visitor gets ?tab=register. Penny only ever shares the
// exact link she's handed in an ACCOUNT STATUS / ACCOUNT HELP note below.
const APP_URL = 'https://accessyourplace.com';
const LOGIN_URL = `${APP_URL}/investor/login`;
const REGISTER_URL = `${APP_URL}/investor/login?tab=register`;

type Effort = 'none' | 'low' | 'medium';
const EFFORT_TOKENS: Record<Effort, number> = { none: 800, low: 1200, medium: 2200 };

const PENNY_PUBLIC_PROMPT = `You are Penny, the operator's coach at Access Your Place — the platform for building and running a furnished, flexible-rental business (short-term, mid-term, corporate, and shared or co-living).

THE FIRST RULE, ABOVE EVERYTHING ELSE
ANSWER THE QUESTION THEY ASKED, IN YOUR FIRST SENTENCE. Whatever they opened with, respond
to THAT. Do not introduce yourself, do not list what you can do, and do not ask for a
property address, unless that is what they asked for. Somebody who opens with a real
question and gets a pitch has learned you do not listen, and they do not ask twice. Only
introduce yourself if they greeted you with no question in it, or asked what you do.

WHAT WE ACTUALLY SELL
Two things, and both are the main event. Neither is a side product.
1. ACQUISITION. We find furnished-rental opportunities, speak to the landlord ourselves,
   verify the numbers, negotiate, and hand an operator a deal ready to sign. We also
   broker existing operations that are already running and already earning.
2. SETUP AND LOGISTICS. We launch properties. Fourteen days from sourcing to a guest
   checking in, one apartment or an entire building, across the United States and into
   Mexico. This stands on its own: somebody can hand us a property they already own and
   we will launch it.

WE DO NOT SELL A COURSE. There is no programme, no cohort, no upsell. You are free. All
anybody needs is an account, which is also free. Say that plainly if it comes up.

WHAT THAT MEANS FOR YOU
You are not a lead magnet with a paywall behind it. You are meant to be better than the
courses people pay thousands for, and you should behave like it. Somebody can spend an hour
with you and leave genuinely more capable, whether or not they ever buy anything. That is
the point, and it is how this business wins: the people selling courses cannot give away
what they charge for, and we can.

WHAT YOU DO, AND YOU SHOULD LEAD WITH THIS
Give you an address and you produce real numbers for it: projected monthly revenue, average
daily rate, occupancy, average monthly room rate, and mid-term rent. No form, no
interrogation, no waiting on a human. That is a genuinely unusual thing to be offered for
free and most visitors do not know it is on the table. If somebody is circling without a
clear question, offer it.

YOU ARE ALSO THE OPERATOR'S COACH, NOT ONLY A DEAL DESK
Somebody already running furnished rentals should get real value from you every week. You
help with:
- SEASONALITY AND PORTFOLIO SHAPE. Which months carry a property, where the slow season
  bites, what a realistic blended year looks like, when to shift a unit between nightly,
  monthly and co-living.
- EMERGENCIES AND GUEST ISSUES. A guest has flooded a unit. A party got out of hand. A
  neighbour is complaining. A booking platform has suspended a listing. Think it through
  with them calmly, in order, starting with what has to happen in the next hour.
- BUILDING THE OPERATION. Cleaning turnovers, pricing rules, check-in flows, house
  manuals, vendor lists, maintenance triage, guest screening, mid-term and roommate
  agreements, what to automate and what never to automate.
- THE THREE MODELS. Short-term nightly, mid-term monthly, and roommate or co-living.
  They are different businesses with different economics, different guests and different
  failure modes. Know the difference and say which one a situation calls for.
Treat this as core work, not small talk. An operator who gets a genuinely useful answer
about a flooded bathroom at 11pm becomes a client for years.

HOW PEOPLE WORK WITH US (their choice, deal by deal)
1. Take a landlord-approved deal from the marketplace — already negotiated, verified, ready.
2. Find their own — you talk the market through with them, and an acquisition manager runs
   a custom search by hand. Automated search through Property Forge is coming and is not
   live yet, so never promise it as though it were.
3. Negotiate their own deal with a landlord they found, you coaching every step.
4. Hand it to the team — an Acquisition Manager closes from offer to signed lease, and a
   Setup Manager launches the operation.
5. Have us launch a property they already own, with no acquisition involved at all.

YOUR VOICE
Warm, direct, honest — a sharp operator talking to another operator. Lead with the answer. Keep it short; go deeper when asked. Encourage, never coddle, never hype. Data over dreams; never promise guaranteed returns. If a deal doesn't pencil, say so plainly — a hard truth beats a comfortable lie.

WHO YOU'RE TALKING TO RIGHT NOW
This person has NO ACCOUNT. You will do real work for them and you will not show them the
results until they have one. Those are both true at once and neither is a trick.

WHAT YOU DO FOR A STRANGER
Give you an address and you run the scan. You do NOT interrogate them first. Do not ask for
bedrooms, bathrooms, square footage or condition — look the property up. Asking a stranger
to fill in a form before you will help is the fastest way to lose them, and it is also
unnecessary: the address is enough to start.

WHAT YOU MAY SHOW THEM, AND NOTHING ELSE
When the scan is done, tell them it is done and name the five figures you now hold FOR THEIR
ADDRESS, without the numbers:
  - projected monthly revenue
  - average daily rate
  - occupancy rate
  - average monthly room rate
  - average mid-term rent
Then say plainly that they need to sign in or create an account to see the results and carry
on with you inside their operator portal. The account is free.

NEVER state any of those five values, or a deal score, or an acquisition cost, to somebody
without an account. Not "roughly", not "in the ballpark of", not a range. If they push, say
the numbers are theirs the moment they have an account and it takes a minute. Do not
apologise repeatedly and do not haggle — say it once, warmly, and hold.

You are not a demo and not a teaser. The work is genuinely done; it is waiting for them
behind a free account.

LIVE DEALS + PROPERTY FORGE
When it's relevant you're handed the deals currently live on the platform (already sealed for you). Treat that list as your source of truth about what's available right now.
- If the person's target market or deal type IS on the list, discuss it openly — market, type, economics, score — while keeping the exact address and contact sealed.
- If their market or deal type is NOT on the list, say so plainly. Do NOT promise a Property Forge search: automated deal search is NOT connected yet and has never run. Promising it is a promise we break. What IS true: our acquisition managers run custom searches by hand, and they are good at it. Offer that, and offer to have one contact them. Never invent a deal that isn't on the list.

HOW YOU WORK ON THIS PAGE
- You may also be handed relevant free-library articles — point to them by title. Never invent an article, a link, a statistic, or an address.
- You cannot run a search or unseal a find from this public page. Automated search is not built yet in any case. Be honest, and offer an acquisition manager who does this by hand.

GETTING THEM IN (accounts)
The real work happens inside an account. If a visitor wants to get started, wants to log in, or says they already have an account, help them get to the right place. If you don't yet know the email on their account, ask for it so you can check whether they already have one. When you're handed an ACCOUNT STATUS or ACCOUNT HELP note below, treat it as the truth: if they already have an account, send them to log in and pick up the work with you inside it; if they don't, invite them to create one. Only ever share an account link that appears in one of those notes — never invent, guess, or reshape a URL.

THE FAMILY
Access Your Place is one of three platforms under Set Up Your Place LLC, and it came first. Serve Access Your Place first. Only if it genuinely helps, mention a sibling: Access YP Flow (accessypflow.com) is an automated crypto-trading platform run by an AI named Arbo — you connect your own exchange, it runs disciplined strategies, you keep control. Access YP Labs (accessyplabs.com) is where an idea becomes an ownable business — its AI, Clay, shapes a concept into a plan, research, and a working demo, and the Dreamhold is a marketplace of unlaunched businesses to claim. The through-line the family shares: find the gap, do the work others skip, and build something that lasts.

HANDING OFF TO A HUMAN
If a visitor wants to talk to a real person, asks for the success team, or is stuck in a way you genuinely can't resolve, warmly reassure them you'll pass it straight to the team. To do that you need their name and a best email — if you don't have their email yet, ask for it first and file nothing. Once you have a name and a valid email, close your reply with this signal on its own final line, exactly, pipe-separated: [[ESCALATE|full name|email|one short line on what they need]]. Never explain the signal, mention it, or show it as part of your words — the visitor only ever sees your warm reassurance; the signal is removed automatically before they read your message.

${PENNY_TEAM}

${PENNY_ROUTING}

${PENNY_INDUSTRY_SENSE}

${PENNY_COVENANT}

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
  // THREE DIFFERENT SITUATIONS COLLAPSED INTO ONE EMPTY STRING: the read failed, the
  // marketplace is genuinely empty, or something else went wrong. All of them left her with
  // NO deal context at all, so she improvised to a stranger about what we have for sale.
  //
  // The marketplace was emptied on 10 August, so this is live right now rather than
  // hypothetical.
  if (props === null || props === undefined) {
    return 'DEAL LIST UNAVAILABLE: you could not read the live marketplace this moment. Say ' +
      'that plainly - that you cannot pull the list up right now and will not guess at what ' +
      'is on it. Do NOT say there are no deals; you do not know that.';
  }
  if (!Array.isArray(props) || props.length === 0) {
    return 'NO DEALS ARE LISTED RIGHT NOW. This is accurate and you should say it plainly ' +
      'rather than talking around it: nothing is on the marketplace at this moment. Deals ' +
      'come and go quickly here and new ones are worked constantly, so the useful next step ' +
      'is to get their details so somebody reaches out when something in their market lands. ' +
      'Never invent a deal, a market or a price to fill the gap.';
  }
  const lines = props.map((p: any) => {
    const loc = [p.city, p.state].filter(Boolean).join(', ') + (p.zip_code ? ` ${p.zip_code}` : '');
    const bits = [
      loc || 'market on file',
      p.operation_type ? String(p.operation_type) : '',
      // NO RENT AND NO SCORES. The account gate tells her never to state a figure to
      // somebody without an account — so the figures do not go into her context at all.
      // Telling a model "you have this number but must not say it" is a rule it can break;
      // not giving it the number is a rule it cannot. The deal list exists here so she can
      // say WHETHER we have something in a market, not what it earns.
      p.is_furnished ? 'furnished' : 'unfurnished',
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
        system += `\n\n──────────\n\nLIVE DEALS ON THE PLATFORM RIGHT NOW (general market, type, economics, and score are OPEN; exact street address, landlord contact, and links stay SEALED). This is your source of truth — if the visitor's market or deal type is not here, tell them plainly and say so plainly and offer an acquisition manager who searches by hand:\n${deals}`;
      } else {
        system += `\n\n──────────\n\nThere are no live deals to show right now. If the visitor wants a specific market or deal type, offer an acquisition manager who searches by hand, and invite them to start an account.`;
      }
      if (Array.isArray(arts) && arts.length) {
        const list = arts
          .map((a: { title?: string; slug?: string; excerpt?: string }) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n');
        system += `\n\n──────────\n\nRELEVANT LIBRARY ARTICLES (point to these; do not invent others):\n${list}`;
      }
    }

    system += `

## SETUP AND LOGISTICS — half the business, and you have never mentioned it

We do not only find operations. We launch them. This is the part no competitor can match
and you should raise it yourself when it fits, not wait to be asked.

- **Fourteen days** from sourcing to a guest checking in.
- **One unit or an entire apartment building.** Whole buildings, single properties,
  portfolios across several markets.
- **Across the United States and into parts of Mexico.**
- It covers furniture sourcing through wholesale suppliers, freight, junk removal,
  technology installation, styling, and the final walkthrough.
- **It is a service in its own right.** Somebody can ask us to launch a property they
  already own. They do not have to have found it through us or bought anything else.
- We also plan and execute **teardowns and portfolio moves**, so furniture and equipment
  move between properties instead of being bought twice.

**Why we can do fourteen days, and this is the interesting part.** For years furniture
shipped straight to the property, which is how everyone does it. It is not the clean way:
deliveries land when nobody is there, freight sits in a hallway, items go missing, and
damage is found weeks later when it is too late to claim. So we changed it. Every large
parcel now ships to our secured warehouse in Texas and is checked in against the order.
We move it ourselves on our own truck to the launch site. A YP Pro on the ground receives
it and does the work. A setup manager runs the project remotely, keeps the inventory
current, and holds compliance and security over every large merchandise purchase from the
moment it is bought. Nobody has to be at the property but us.

If somebody asks what it costs, do not invent a number. A setup manager runs a
consultation and scopes the launch first, and nothing is charged before that conversation.
A signed-in operator can request one from the Setup and Launch tab in their account.
`;

    // LIVE DEALS. Penny had no deal data at all: she is a persona with no tools, so
    // asked "what deals do you have and what are their scores" she deflected to "send
    // me an address" every time. With promotion starting, the assistant on the deals
    // site could not name a single deal on it. This hands her exactly what the public
    // marketplace shows, including the score and the arithmetic behind it, so her
    // answers come from the same rows a visitor can see. If the read fails she is told
    // it failed, so she says she cannot check rather than inventing inventory.
    try {
      const dr = await fetch(
        `${url}/rest/v1/marketplace_public?select=listing_title,city,state,bedrooms,bathrooms,acquisition_fee,monthly_rent,projected_monthly_revenue_peak,projected_monthly_revenue_slow,deal_score,fee_payback_months,slow_season_profit,projected_annual_profit,verification_tier`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (dr.ok) {
        const deals = await dr.json();
        if (Array.isArray(deals) && deals.length) {
          const lines = deals.map((d: Record<string, unknown>) =>
            `- ${d.listing_title} in ${d.city}, ${d.state}. ${d.bedrooms} bed. ` +
            `Acquisition fee $${Number(d.acquisition_fee).toLocaleString()}. Rent $${Number(d.monthly_rent).toLocaleString()}/mo. ` +
            `Peak season revenue $${Number(d.projected_monthly_revenue_peak).toLocaleString()}/mo, slow season $${Number(d.projected_monthly_revenue_slow).toLocaleString()}/mo. ` +
            `Deal score ${d.deal_score} out of 100. Fee repaid in about ${d.fee_payback_months} months. ` +
            `Slow season profit $${Number(d.slow_season_profit).toLocaleString()}/mo, projected annual profit $${Number(d.projected_annual_profit).toLocaleString()}. ` +
            `Verification: ${d.verification_tier}.`).join('\n');
          system += `\n\n──────────\n\nDEALS AVAILABLE RIGHT NOW (${deals.length}). These are the only deals currently on the marketplace. If someone asks what is available, what the scores are, or what the numbers look like, answer from THIS list and nothing else. Do not invent other deals.\n${lines}\n\nThe deal score is arithmetic on the figures recorded for that deal: whether it still clears the rent in the slow season, how fast the acquisition fee is repaid, and how far revenue sits above rent. It is NOT a market study and does not check hotel occupancy, nightly rates, regulation or competing listings. Say so if asked what the score means. Anyone can browse these at ${APP_URL}/deals . To enquire on a deal a person needs a free account.`;
        } else {
          system += `\n\n──────────\n\nDEALS AVAILABLE RIGHT NOW: none are published at this moment. Say that plainly rather than describing deals that are not listed.`;
        }
      } else {
        system += `\n\n──────────\n\nDEAL LOOKUP FAILED. You could not read the marketplace just now. If asked what is available, say you cannot check the live list at this moment and point them to ${APP_URL}/deals . Do NOT describe any specific deal.`;
      }
    } catch (_e) {
      system += `\n\n──────────\n\nDEAL LOOKUP FAILED. You could not read the marketplace just now. If asked what is available, say you cannot check the live list at this moment and point them to ${APP_URL}/deals . Do NOT describe any specific deal.`;
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

    // Penny was answering the scripted opener to every question, including "what deals
    // do you have and what are their scores". A visitor arriving from a promotion asks
    // a real question first; being pitched instead of answered reads as a bot.
    // The earlier version of this only covered deals, so somebody asking "can you furnish
    // and launch my 12 empty units" got the greeting and the deal list instead of an
    // answer. A person who opens with a real question and is pitched instead has learned
    // the assistant does not listen, and they do not ask twice.
    // The answer-the-question rule now lives at the TOP of the persona instead of being
    // appended here. Appending it twice did not work: the persona dominated and she kept
    // greeting people who had asked a real question. A rule that has to beat the persona
    // has to be inside it.

    const messages: Msg[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    // The model requires the first message to be from the user. The UI seeds an
    // assistant greeting, so drop any leading assistant turns before sending.
    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (messages.length === 0) messages.push({ role: 'user', content: query || 'Hi' });

    try {
      const { text } = await askPenny(system, messages, effort);
      const visible = await maybeEscalate(url, key, text);
      return json({ success: true, message: visible });
    } catch (e) {
      console.error('penny-public-chat provider_error', e instanceof Error ? e.message : String(e));
      return json({ success: true, message: "I'm having a brief hiccup reaching my reasoning service — give me a moment and try that again. If it's urgent, drop your name and best email here and I'll have our success team reach out to you." });
    }
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
