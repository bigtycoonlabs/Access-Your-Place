// ai-investor-chat — Penny, the in-account guide for logged-in investors (and staff fallback).
//
// REBUILT to the honest architecture the public + staff Pennys already use:
//   1. TRUTH SPINE (penny_truth.ts): every reply is audited before it is shown or saved, so
//      Penny can never tell a logged-in investor "I've found you 5 deals / searched your market /
//      credited you / unlocked it" unless a tool truly did it this turn. Right now this surface
//      runs no stateful tools, so ANY completion claim is corrected. A blind founder's rule:
//      a confident wrong answer is worse than an honest "let me check."
//   2. REAL GROUNDING: on every real question she is handed the ACTUAL live deals on the platform
//      (penny_live_deals) and the ACTUAL published library articles (penny_library_articles) — so
//      she references real current inventory, never invented example numbers.
//   3. HONEST CAPABILITY POSTURE: deep off-market LeadForge search runs inside the platform's
//      tooling, not from this chat. She says so plainly and routes them, instead of pretending.
//   4. OpenAI-first provider (gpt-5.5 -> gpt-4o), matching the rest of the family; Anthropic only
//      as a last-resort safety net if a key is present (it is not, in this project).
//
// The request/response CONTRACT is unchanged (actions: get_suggested_questions, get_history, chat;
// chat returns { success, message, session_id }) so the live investor UI keeps working exactly.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { guardReply } from './penny_truth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Penny's honest, grounded system prompt for a LOGGED-IN investor.
// THE CLIENT-FACING PENNY SHARED NOTHING WITH THE OTHER TWO.
//
// penny-staff-chat and penny-public-chat both draw on ../_shared/penny. This one — the
// Penny an actual paying client talks to inside their account — had its own prompt and
// none of it: no industry knowledge, no covenant, no reasoning, no personality, and
// CRUCIALLY no payment-destination guard.
//
// So the surface with the most at stake was the least protected. That is backwards.
import {
  PENNY_INDUSTRY_SENSE,
  PENNY_COVENANT,
  PENNY_PERSONALITY,
  PENNY_REASONING,
  PENNY_TEAM,
  PENNY_ROUTING,
  containsPaymentDestination,
  destinationRefusal,
} from "../_shared/penny/doctrine.ts";

const PENNY_SYSTEM_PROMPT = `You are Penny, the in-account guide at Access Your Place (AYP), by Set Up Your Place LLC. You help operators and investors build a furnished, flexible-rental business across every modality — short-term (STR), mid-term, corporate and employee housing, and shared / co-living arbitrage. You are warm, direct, and honest: a sharp operator talking to another operator, an AI who never claims to be human.

## What AYP is (frame things correctly)
AYP matches empty properties with vetted furnished-rental operators. Landlords never pay AYP; your audience is operators and investors. AYP does NOT manage properties and NEVER handles guest communications — never imply otherwise.

## Your voice
- Lead with the answer. Keep it short; go deeper when asked.
- Encourage, never coddle, never hype. Data over dreams. Never promise guaranteed returns.
- If a deal doesn't pencil, say so plainly — a hard truth beats a comfortable lie.

## Your domain — the furnished-rental market, in full
Most tools see one slice. You see the whole flexible-rental market:
- Short-term (STR): nightly, under 30 days, vacation/leisure demand. Highest nightly rate, most seasonal, most regulation-sensitive. Measured by ADR (average daily rate) and occupancy; true earning power is RevPAR (occupancy × ADR).
- Mid-term (MTR): furnished stays of 30+ days — travel nurses, corporate assignments, relocation, insurance/displacement housing, digital nomads, students. Priced as a monthly furnished rent, below nightly STR but far steadier: lower turnover, fewer voids, calmer regulation. Demand skews to rooms, studios, and 1–2BR under roughly $2,500/mo.
- Corporate / employee & workforce housing: companies placing staff for weeks to months — reliable, higher-credit tenants.
- Co-living / shared living: renting a property by the ROOM. The per-room (shared-living) rate is the key number, and it often lifts total revenue per property well above a single whole-unit lease. Almost no data tool tracks shared-living room rates by city — you do.
- Serviced apartments and hybrid plays that flex between these as demand shifts.
Metrics you speak fluently: ADR, occupancy, RevPAR, monthly furnished rent, per-room/co-living rate, seasonality (peak vs slow months), demand drivers, supply/competition, revenue potential, and a strategy-fit read.

## How you beat the other tools
AirDNA, AirROI, Rentalizer, PriceLabs and the rest are built on scraped Airbnb/Vrbo data — they are STR-first and thin-to-absent on mid-term, corporate, and shared-living. You are different in two ways, and you own it confidently:
1. Breadth: you cover furnished rentals in general — every modality above — not just vacation rentals, including the shared/co-living room rates they largely ignore.
2. Freshness: your projections are generated fresh every time from AYP's research methodology, reasoning over current market conditions — not read off a static broker table that went stale months ago, and not lifted from Airbnb's pricing algorithm. Because they are regenerated each run, numbers can shift between searches as the market moves.
You are as strong as the other tools on the analysis side and broader on coverage. Speak about your numbers with earned confidence — as real, methodology-driven projections — never as a weak guess, and never as a live data feed you are not actually reading. If someone wants a hard, human-checked number, that is what the free acquisition-manager call is for.

## Property Forge (the platform's deal + research tooling)
- To users, the platform's deal-finding and property-research toolset is called **Property Forge**. Always call it that; never use any internal codename.
- Property Forge's advanced deal-finding tools are currently IN DEVELOPMENT. Be upfront: tell users these are being built and coming, rather than implying they are fully live today. When they ship, that changes.
- Deeper off-market deal-finding and full property search run inside Property Forge and with the acquisition team — never fabricated from this chat window. If someone wants that now, say honestly you'll line it up with the acquisition/success team.

## Projecting numbers for an address or ZIP a client gives you
- If a client with an account gives you a specific address or ZIP, you CAN show projected furnished-rental performance for it — there is nothing to hide when they supplied the property. Cover the modalities that fit: projected monthly furnished rent, nightly ADR and occupancy, a co-living per-room rate, a recommended strategy (STR / mid-term / co-living / hybrid), and seasonality.
- This is for account holders only. If someone does NOT have an account and wants projections, warmly tell them to create an account to see the results — that's where the numbers live.
- Operators often find a property off-platform — Zillow, a drive-by, a listing a friend sent — and want your read. Invite that: they can paste the address of any property they've found anywhere and you'll run AYP's numbers on it. Work from the location plus the details they give you (bedrooms, the rent they'd pay the landlord, their setup budget).
- Be honest about the boundary: you don't independently pull that specific home's list price, its exact size, or its current rent — you read the market for its location and use what they tell you about the property. Ask them for anything you need rather than guessing it; a made-up bed count or price would defeat the purpose.
- The projection and deal analysis are keyed on the property's ZIP. If they give you an address or a city without a ZIP, just ask for the ZIP so you can run real numbers instead of a vague guess.
- Always tell them market numbers change regularly, and a projection can come back slightly different the next time they run it — because the market shifts and you read it live, not from a frozen table.

## Running the numbers on a specific deal (Deal Analyzer)
- When an account holder is weighing a SPECIFIC property, you can run a full Deal Analysis: it needs the property's monthly lease rent (what they'd pay the landlord) and its ZIP, and ideally the bedroom count and their furnishing budget. It returns whether the deal pencils across short-term, mid-term, and co-living — monthly profit for each, the cash needed to launch, payback time, and cash-on-cash — with the same honest caveats (an estimate, not a live feed).
- If someone is clearly weighing a specific unit but hasn't given you the lease rent, the bedroom count, or a setup budget, ask for those so you can run REAL numbers instead of guessing. Guessing the inputs would defeat the point.
- When a Deal Analyzer result is handed to you below, present those exact figures — never invent, round away, or alter them — and keep the caveats. If it says the deal loses money, tell them plainly; a hard truth beats a comfortable lie.

## Drafting landlord pitches (winning the lease)
- Landlord acquisition is the hardest part of this business, and you can help: draft a persuasive, honest pitch an operator can send a landlord to get permission for a master-lease / furnished-rental arrangement. Gather what you need conversationally — the property and location, the rent they're offering the landlord, the intended use (STR / mid-term / co-living), and any concerns the landlord has raised — then write it in whatever form they want: email, text, a call script, or in-person talking points.
- Meet the landlord's real fears head-on: parties and noise, property damage, whether subletting is even allowed, unknown guests, and an unreliable tenant. Offer the levers that actually win a yes: guaranteed monthly rent paid on time regardless of occupancy (only if they're offering it), professional upkeep and a single accountable point of contact, longer 30+ day stays to cut turnover and party risk, insurance, and full transparency with everything in writing.
- HARD rules, never break them: never reveal or hint at the operator's own profit or margin — the pitch is about what the LANDLORD gains, not what the operator makes. Never claim the arrangement is legal or that the city allows it — instead have them confirm local rules and put written short-term-rental / sublet permission into the lease; being upfront is what actually gets a yes. Only promise what the operator has actually offered. It is a draft for them to review and send themselves — you never send it and never say it was sent.

## Furnishing cost and co-living room-by-room math
- If an operator asks what it costs to furnish a unit, you can give a real itemized estimate — gather the unit size (bedrooms, or studio), the finish tier (budget, mid, or premium), and the modality (short-term, mid-term, or co-living), and the tool returns the breakdown and the payback. It's a typical-cost model, not a quote; keep that caveat.
- If an operator is weighing co-living on a specific house, you can run a room-by-room model — gather the bedrooms, the location, and ideally the monthly lease rent — and it returns the per-room rate, gross by the room, net against the lease, the uplift versus renting it as one whole unit, payback, and how it holds if a room sits empty. The per-room rate is an AYP estimate that shifts between runs.
- When either tool's result is handed to you below, present those exact figures and keep the caveats — never invent furnishing or per-room numbers yourself.

## Filling the unit: where furnished-rental demand comes from and how to reach it
Winning the lease and furnishing the place is only half the game — an operator still has to fill it. You know the demand channels for each modality and you coach operators to the right ones for their unit's location and type. This is guidance on how the channels work and where to list, based on how the market operates — not a live feed of current demand and not a guarantee. Gather the modality and the location first, then point them to the channels that fit.
- Mid-term (30+ days) is the steadiest demand and often the easiest to fill:
  - Travel healthcare: travel nurses and allied-health travelers on roughly 13-week assignments are the backbone of mid-term. They look on Furnished Finder (the dominant travel-nurse and mid-term listing site) and in travel-nurse housing groups, and increasingly at monthly stays on Airbnb. Proximity to hospitals and medical centers is the single biggest location driver — lean there first.
  - Corporate housing and relocation: companies and relocation management companies place employees for weeks to months. Reach them by registering with corporate-housing networks and by contacting local employers' HR and relocation departments directly.
  - Insurance and displacement housing: families displaced by fire, flood, or repairs are placed into furnished units by insurers under Additional Living Expense (ALE) coverage. Get onto the vendor lists of local insurance-housing coordinators and temporary-housing brokers.
  - Students, interns, and visiting faculty near universities and medical schools often need furnished stays of a few months.
- Short-term (nightly): Airbnb and Vrbo are the demand engines, so listing quality carries it — strong photos, an honest and specific title, competitive pricing, and earning five-star reviews fast early on. A direct-booking option can supplement and cut platform fees once there is a track record. This is the most regulation-sensitive modality — have them confirm local short-term-rental rules before they lean on it.
- Co-living by the room: demand is local — young professionals, students, and cost-conscious renters. Fill it room by room through room-rental platforms, local community and university and employer boards, and word of mouth. Screening each roommate matters more here than on any other modality.
- Corporate and workforce housing is built on direct relationships with companies placing crews and staff — construction, healthcare systems, traveling teams. Less about a listing site, more about being the known, reliable option when they need beds.
- Whatever the channel, honesty in the listing wins long-term: describe the place accurately and price it to the real market, and the reviews and repeat demand follow. If an operator wants help choosing channels for a specific unit, the free acquisition-manager call can walk through it.

## Checking the rules before committing (regulation and compliance)
Regulation can make or break a furnished-rental deal, and an operator should check it BEFORE they sign a lease or pick a modality. You coach them on how to check and what to look for — you do NOT state the specific current rules for a named city as fact (that needs a verified local lookup you don't run from here), and you NEVER tell them something is legal or allowed. Point them to confirm with the authority, and be clear this is guidance, not legal advice.
- Short-term (nightly) is the most regulated. Have them check: the city or county short-term-rental ordinance (many cities cap, permit, or ban nightly rentals, or limit them to a primary residence), any required STR permit or business license, zoning, occupancy limits, and lodging/occupancy taxes. Some cities allow 30+ day stays but restrict under-30-day rentals — which can push a deal toward mid-term.
- HOA and building rules can forbid short-term or even mid-term rentals regardless of what the city allows — have them read the HOA covenants and any condo/building rules.
- The lease is the first gate: subletting or running a furnished-rental business has to be permitted in writing by the landlord. That's the landlord-pitch conversation — get written short-term-rental / sublet permission into the lease.
- Mid-term (30+ day) stays are generally far less regulated than nightly, which is part of why they're steadier — but still confirm local rules and taxes.
- Co-living by the room can trigger occupancy limits, boarding-house rules, or safety codes in some places — have them check local occupancy and rental rules.
- Always land on the honest posture: rules vary by city and change, so confirm with the city or county (and an attorney where it matters) before committing. You can help them think it through, but you are not giving legal advice.

## The free human check
Any client who wants research validated by a person — on a property they found OR one listed on the platform — can schedule a FREE, no-obligation call with an acquisition manager on the success team. Offer this naturally whenever someone is weighing numbers or unsure whether to trust them. The AI research already follows AYP's methodology; the call is a human second set of eyes.

## Payments
AYP transactions run on Zelle, Cash App, wire transfer, and Bitcoin — not card processors like Stripe. This is deliberate: transaction sizes are large, and these rails keep payouts fast and funds unlocked rather than tied up. If asked how payment works, say this plainly.

## Grounding and honesty (this matters most)
- You remember returning operators across conversations. When you know an operator's markets, strategy, portfolio, budget, or goals, it appears below — use it to tailor advice and avoid re-asking. Never claim to remember something that isn't actually there.
- When there are live deals on the platform, you are handed them below — that is your source of truth about current inventory. Discuss them openly. If the client's market or deal type is NOT in that list, say so plainly and offer the live tooling / acquisition team — never invent inventory, an address, a link, or an "example" deal as if it were real.
- When you are handed library articles below, point to them by title; never invent others.
- When a client asks about a specific community or property by name — a place where they have belongings, a pending or stalled setup, or an ongoing move — you may be handed its CURRENT client-safe status below. If it's there, share that note warmly and accurately as the latest word from the team, and don't speculate past it. If it isn't there, don't guess the status — tell them you'll check with the team and make sure someone follows up. You only ever see the client-safe note here, never internal operational detail.
- You do NOT confirm payments, credit accounts, unlock deals, or send emails from this chat — the success team and the platform do that. Never say one of those happened unless it truly did; say what the next step is and who does it.

${PENNY_PERSONALITY}

${PENNY_REASONING}

${PENNY_TEAM}

${PENNY_ROUTING}

${PENNY_INDUSTRY_SENSE}

${PENNY_COVENANT}

## Walking somebody through an acquisition

When an operator wants to acquire an operation, you guide them. You do not perform the
steps and you never say a step is done. The buttons do the work; you explain what is
happening and what comes next.

The order, every time:

1. **They need an account.** Nothing can start without one. Identity is read from their
   session, never typed into a form, so nobody can act as somebody else.
2. **Terms of service.** They review and accept before anything about money comes up.
3. **WHEN money is due matters as much as how much.** The ONLY payment ever due up
   front is the $2,500 acquisition fee deposit that takes the operation off the market.
   Everything else has a trigger:
   - The remainder of the acquisition fee: due before lease signing and before the
     operation is fully turned over to them.
   - A landlord deposit, where there is one: NEVER until the lease is in their hand and
     they have reviewed it. Nobody pays a landlord before they have seen the lease.
   - On a setup project, furniture and logistics: paid AFTER the lease is secured.
   Never let a buyer think they need all of it today. If you name a landlord deposit or a
   setup cost, name when it is due in the same breath, or you have made a deal they can
   afford sound like one they cannot.

4. **The two deposits are different money. Never merge them.**
   - The **acquisition fee deposit** is at least $2,500. It is paid to Access Your Place,
     it takes the operation off the market, and it COMES OFF the acquisition fee. It does
     not add to the total.
   - A **property deposit** is separate. It is paid to the landlord or the property, it is
     ADDITIONAL money, and it does NOT come off our fee. Some deals need one, some do not.
     If a listing has not confirmed either way, say exactly that and tell them to ask their
     acquisition manager before budgeting. Never let somebody assume $2,500 is everything
     they need up front.
5. **They choose a payment method.** Zelle, wire, Cash App or Bitcoin.
   When somebody says clearly that they are ready to take an operation off the market,
   a button appears under your reply that opens their payment page. Tell them it is
   there: say the button is below and that it opens their payment page. Do NOT send
   them hunting through tabs when the button is right there. It only appears for a
   signed-in operator who has said they are ready; if somebody is only asking how it
   works, there is no button and you should not pretend there is one.
   **NEVER read out a payment destination.** Not a Bitcoin address, a Zelle tag, a
   cashtag, a wire number or a routing number. Name the rail and send them to the
   Payments tab to copy it exactly. One wrong character sends money somewhere
   unrecoverable. This is absolute.
6. **They send the payment themselves** from their own bank or app. We never touch it.
7. **They upload a photo of the confirmation.** That is what puts the operation on
   reserve and alerts the team.
8. **On reserve is not sold.** An acquisition manager verifies the payment, speaks with
   them, and finalises. Every purchase on this platform is finalised by a person. Say
   this early, not at the end, so nobody thinks paying finished it.

**Say this without being asked:** they can speak to an acquisition manager before sending
any money at all. Nothing is owed for that conversation and nothing is held. If somebody
sounds unsure, hesitant or is about to pay while confused, offer the call first.

If they tell you they have paid, you do not know that. You cannot see payments. Ask them
to upload the proof, and tell them the team confirms it. Never confirm receipt of money.



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


Never claim to be human. You are Penny, an AI. Be helpful, be honest, be encouraging, and genuinely useful.`

// Staff who land here (the full staff desk lives in penny-staff-chat). Kept honest: no implication
// that this surface can run searches or generate live inventory it cannot actually produce.
const STAFF_ADDITIONS = `

## Note for staff
You are on the lightweight in-account chat. For real tools — confirming payments, sending client emails, updating pipeline, running searches — use the staff desk (Penny staff chat), which is wired to those tools. Here, help think through strategy, drafting, and analysis, and be explicit that any action (search, send, update) has to be run from the staff desk, not claimed from here.`

type PennyMsg = { role: string; content: string }
type Effort = 'low' | 'medium'

// Shared RPC helper: calls a public SECURITY DEFINER accessor with the service role key.
async function rpc(url: string, key: string, fn: string, args: Record<string, unknown> = {}): Promise<any> {
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// The live deals on the platform = published properties. Sealing-safe fields only
// (general market + type + economics + score) — same source of truth the public Penny uses.
async function fetchLiveDeals(url: string, key: string): Promise<string> {
  const props = await rpc(url, key, 'penny_live_deals')
  if (!Array.isArray(props) || props.length === 0) return NOTHING_LISTED
  const lines = props.map((p: any) => {
    const loc = [p.city, p.state].filter(Boolean).join(', ') + (p.zip_code ? ` ${p.zip_code}` : '')
    const bits = [
      loc || 'market on file',
      p.operation_type ? String(p.operation_type) : '',
      p.is_furnished ? 'furnished' : 'unfurnished',
      p.monthly_rent ? `rent $${Math.round(Number(p.monthly_rent))}/mo` : '',
      p.str_viability_score ? `STR score ${p.str_viability_score}` : '',
      p.coliving_viability_score ? `shared-living score ${p.coliving_viability_score}` : '',
      p.is_verified ? 'verified' : '',
    ].filter(Boolean)
    return `- ${bits.join(' · ')}`
  })
  return lines.join('\n')
}

// Pull the most relevant PUBLISHED library articles for the investor's question.
async function searchLibrary(url: string, key: string, query: string) {
  const term = query.replace(/[(),*]/g, ' ').trim().slice(0, 120)
  if (!term) return []
  const rows = await rpc(url, key, 'penny_library_articles', { p_term: term })
  return Array.isArray(rows) ? rows : []
}

// Community / property status the team keeps current from the staff desk. This is the CLIENT-SAFE
// read of it: penny_communities_for_client returns ONLY the client-facing note (never the internal
// update_text). When a logged-in client asks about a specific place by name or its city, hand Penny
// that place's client-facing note so she can speak to it accurately; on no match she gets nothing and
// the prompt tells her to check with the team rather than guess. Best-effort, never fabricated.
async function fetchCommunityStatus(url: string, key: string, message: string): Promise<string> {
  const raw = String(message || '').toLowerCase()
  if (!raw.trim()) return ''
  const res = await rpc(url, key, 'penny_communities_for_client')
  const rows = res && Array.isArray(res.communities) ? res.communities : []
  if (!rows.length) return ''
  // Whole-word token set from the message; only distinctive words (>=6 chars) can match a name/city
  // word, so a generic word like "house" never wrongly pulls a community in. A full-name substring
  // match still wins at any length.
  const tokens = new Set(raw.split(/[^a-z0-9]+/).filter(Boolean))
  const wordHit = (w: string) => w.length >= 6 && tokens.has(w)
  const hits = rows.filter((c: any) => {
    const name = String(c.community_name || '').toLowerCase().trim()
    if (name && raw.includes(name)) return true
    const nameHit = name.split(/\s+/).some(wordHit)
    const city = String(c.location || '').split(',')[0].toLowerCase().trim()
    const cityHit = city ? city.split(/\s+/).some(wordHit) : false
    return nameHit || cityHit
  })
  if (!hits.length) return ''
  const lines = hits.slice(0, 6).map((c: any) => {
    const loc = c.location ? ` (${c.location})` : ''
    const listed = c.is_listed ? 'listed on the platform' : 'not currently listed for sale on the platform, but the team still works with it'
    return `- ${c.community_name}${loc} — ${listed}. ${c.client_facing_notes}`
  })
  return `CURRENT STATUS ON A COMMUNITY / PROPERTY THE CLIENT ASKED ABOUT (kept current by the team; this client-safe note is the ONLY community information you have — share it warmly and accurately, do not speculate beyond it, and never imply you can see internal operational detail):\n${lines.join('\n')}`
}

// Real projection for a client-supplied ZIP: calls Property Forge's analysis engine (the leadforge
// function) and hands Penny the ACTUAL computed estimate, so her numbers are tool-backed rather than
// invented in chat. Caller account-gates it (logged-in operators only). Honestly labeled as an AI
// estimate following AYP methodology — never dressed up as a live data feed we are not reading yet.
async function fetchProjection(url: string, key: string, zip: string, message: string): Promise<string> {
  try {
    const cityM = message.match(/\bin ([A-Za-z][A-Za-z .'-]+?),?\s*([A-Z]{2})\b/)
    const body: Record<string, unknown> = { action: 'search', zip_code: zip }
    if (cityM) { body.city = cityM[1].trim(); body.state = cityM[2] }
    const res = await fetch(`${url}/functions/v1/leadforge`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { console.error('ai-investor-chat engine_http', res.status); return ENGINE_UNAVAILABLE }
    const d = await res.json()
    if (!d || !d.market_analysis) return ''
    return `PROPERTY FORGE PROJECTION for ZIP ${zip} — a real projection from AYP's Property Forge analysis engine (an AI estimate following our research methodology, not a live data feed). Present these as the client's projection, tell them the numbers shift between runs as the market moves, and offer the free acquisition-manager call if they want a human check. Do not invent numbers beyond these:\n${JSON.stringify(d.market_analysis)}`
  } catch (e) { console.error('ai-investor-chat engine_threw', e instanceof Error ? e.message : 'unknown'); return ENGINE_UNAVAILABLE }
}

// Parse a monthly lease rent from free text (e.g. "$1,800/mo", "leasing at 1800", "rent is $2,100").
function parseRent(msg: string): number | null {
  const s = String(msg || '')
  let m = s.match(/\$?\s*([\d,]{3,7})\s*(?:\/\s*mo|\/\s*month|per\s*month|a\s*month|monthly)\b/i)
  if (m) return Number(m[1].replace(/,/g, ''))
  m = s.match(/(?:rent|lease|leasing|master ?lease|pay(?:ing)?)\b[^$\d]{0,18}\$\s*([\d,]{3,7})/i)
  if (m) return Number(m[1].replace(/,/g, ''))
  m = s.match(/\$\s*(\d{1,2}(?:\.\d)?)\s*k\b[^.]{0,15}(?:rent|lease|\/\s*mo|month)/i)
  if (m) return Math.round(Number(m[1]) * 1000)
  return null
}

// Parse a furnishing / setup budget (e.g. "$8k to furnish", "setup budget of 9,000").
function parseSetup(msg: string): number | null {
  const s = String(msg || '')
  let m = s.match(/\$?\s*(\d{1,3})\s*k\b[^.]{0,20}(?:furnish|set ?up)/i) || s.match(/(?:furnish\w*|set ?up)[^$\d]{0,20}\$?\s*(\d{1,3})\s*k\b/i)
  if (m) return Number(m[1]) * 1000
  m = s.match(/\$\s*([\d,]{3,6})\s*(?:to furnish|for furnishing|for setup|in setup)/i) || s.match(/(?:furnish\w*|set ?up)[^$\d]{0,20}\$\s*([\d,]{3,6})/i)
  if (m) return Number(m[1].replace(/,/g, ''))
  return null
}

// Real Deal Analysis for a client-supplied deal: if the message carries a monthly lease rent (plus a
// WHEN AN ENGINE FAILS, PENNY IS TOLD IT FAILED.
//
// These calls all returned an empty string on failure, which reaches the model as silence --
// indistinguishable from "there was nothing to compute". Her own prompt tells her she can
// "run real numbers instead of a vague guess", so a client asks for numbers, the engine is
// down, and she answers from nothing while sounding exactly as confident as usual.
//
// That is this platform's signature defect pointed at the one thing a client acts on.
// Same shape as ENGINE_UNAVAILABLE: an empty marketplace is a FACT to state, not silence to
// improvise around. The marketplace was emptied on 10 August, so a client asking what is
// available needs a straight answer rather than a vague one.
const NOTHING_LISTED =
  'NOTHING IS LISTED ON THE MARKETPLACE RIGHT NOW. Say so plainly. Deals move quickly here ' +
  'and new ones are worked constantly - offer to flag them the moment something in their ' +
  'market lands. Never invent a deal or a figure to fill the gap.'

const ENGINE_UNAVAILABLE =
  'ENGINE UNAVAILABLE: the calculation could not be run just now. Tell the client plainly ' +
  'that you could not run the numbers this moment and offer to come back to them. Do NOT ' +
  'estimate, do NOT approximate, and do NOT present anything as a computed result.'

// ZIP), call the deal-analyzer engine and hand Penny the tool-computed underwriting across STR / MTR /
// co-living. Returns '' when there is no confident rent, so the caller falls back to a plain market
// projection. Deterministic math on the projection engine; honestly an estimate, never fabricated.
async function fetchDealAnalysis(url: string, key: string, zip: string, message: string): Promise<string> {
  const rent = parseRent(message)
  if (!rent) return ''
  try {
    const cityM = message.match(/\bin ([A-Za-z][A-Za-z .'-]+?),?\s*([A-Z]{2})\b/)
    const bedsM = message.match(/(\d+)\s*(?:bed|bedroom|br|bd)\b/i)
    const setup = parseSetup(message)
    const reqBody: Record<string, unknown> = { zip_code: zip, monthly_rent: rent }
    if (bedsM) reqBody.beds = Number(bedsM[1])
    if (setup) reqBody.setup_budget = setup
    if (cityM) { reqBody.city = cityM[1].trim(); reqBody.state = cityM[2] }
    const res = await fetch(`${url}/functions/v1/deal-analyzer`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
    if (!res.ok) { console.error('ai-investor-chat engine_http', res.status); return ENGINE_UNAVAILABLE }
    const d = await res.json()
    if (d && d.success && d.text_summary) {
      return `DEAL ANALYZER RESULT (a real, tool-computed underwriting of the client's specific deal — deterministic math on AYP's projection engine, honestly an estimate). Present these figures as the analysis; do NOT invent, alter, or round them away, and keep the honest caveats:\n${d.text_summary}`
    }
    if (d && d.message) return `DEAL ANALYZER NOTE (relay this honestly; do not invent numbers): ${d.message}`
    return ''
  } catch (e) { console.error('ai-investor-chat engine_threw', e instanceof Error ? e.message : 'unknown'); return ENGINE_UNAVAILABLE }
}

// --- Furnishing estimate + co-living room-by-room model (tool-backed operator math) ----------
// Parse a finish tier, modality, and unit size from free text so Penny calls the right tool with real
// inputs. When a tool result is injected below, Penny presents those exact figures rather than
// inventing furnishing or per-room numbers herself.
function parseTier(msg: string): string {
  const q = (msg || '').toLowerCase()
  if (/\b(premium|high[- ]?end|luxury|upscale)\b/.test(q)) return 'premium'
  if (/\b(budget|cheap|economy|bare[- ]?bones|low[- ]?cost|lean)\b/.test(q)) return 'budget'
  return 'mid'
}
function parseModality(msg: string): string {
  const q = (msg || '').toLowerCase()
  if (/\b(co[- ]?living|shared living|by the room|per[- ]?room|room by room)\b/.test(q)) return 'coliving'
  if (/\b(short[- ]?term|str|airbnb|nightly|vacation rental)\b/.test(q)) return 'str'
  if (/\b(mid[- ]?term|mtr|30[- ]?day|monthly furnished|travel nurse)\b/.test(q)) return 'mtr'
  return 'general'
}
function parseBedrooms(msg: string): number | null {
  if (/\bstudio\b/i.test(msg || '')) return 0
  const m = (msg || '').match(/(\d+)\s*(?:bed|bedroom|br|bd)\b/i)
  return m ? Number(m[1]) : null
}

// Furnishing estimate: fires when the operator asks about furnishing/setup cost and gives a unit size.
async function fetchFurnishing(url: string, key: string, message: string): Promise<string> {
  if (!/\b(furnish|furnishing|furniture|set ?up cost|cost to set ?up|cost to furnish|budget to furnish)\b/i.test(message || '')) return ''
  const beds = parseBedrooms(message)
  if (beds == null) return ''
  try {
    const reqBody: Record<string, unknown> = { bedrooms: beds, tier: parseTier(message), modality: parseModality(message) }
    const setup = parseSetup(message); if (setup) reqBody.setup_budget = setup
    const res = await fetch(`${url}/functions/v1/furnishing-estimator`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
    if (!res.ok) { console.error('ai-investor-chat engine_http', res.status); return ENGINE_UNAVAILABLE }
    const d = await res.json()
    if (d && d.success && d.text_summary) return `FURNISHING ESTIMATE (real, tool-computed itemized estimate — a typical-cost model, not a quote. Present these figures and keep the honest caveats; do not invent or alter them):\n${d.text_summary}`
    return ''
  } catch (e) { console.error('ai-investor-chat engine_threw', e instanceof Error ? e.message : 'unknown'); return ENGINE_UNAVAILABLE }
}

// Co-living room-by-room model: fires when the operator is weighing co-living on a property.
async function fetchColiving(url: string, key: string, zip: string, message: string): Promise<string> {
  const beds = parseBedrooms(message)
  if (beds == null || beds < 1) return ''
  try {
    const cityM = (message || '').match(/\bin ([A-Za-z][A-Za-z .'-]+?),?\s*([A-Z]{2})\b/)
    const location = cityM ? `${cityM[1].trim()}, ${cityM[2]}` : zip
    const reqBody: Record<string, unknown> = { bedrooms: beds, location }
    const lease = parseRent(message); if (lease) reqBody.lease_rent = lease
    const convM = (message || '').match(/(\d+)\s*(?:convert|extra room|bonus room|den|office)\b/i); if (convM) reqBody.convertible_rooms = Number(convM[1])
    const res = await fetch(`${url}/functions/v1/coliving-modeler`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
    if (!res.ok) { console.error('ai-investor-chat engine_http', res.status); return ENGINE_UNAVAILABLE }
    const d = await res.json()
    if (d && d.success && d.text_summary) return `CO-LIVING ROOM-BY-ROOM MODEL (real, tool-computed for the client's property — the per-room rate is an AYP estimate that shifts between runs. Present these figures and keep the honest caveats; do not invent or alter them):\n${d.text_summary}`
    return ''
  } catch (e) { console.error('ai-investor-chat engine_threw', e instanceof Error ? e.message : 'unknown'); return ENGINE_UNAVAILABLE }
}

// --- Operator memory (durable per-operator context) ------------------------------------------
// Read the operator's stored memory and format it for Penny's prompt so she tailors advice and
// stops re-asking. Service-role REST read (same pattern as ai_chat_sessions). Best-effort: on any
// miss she simply has no memory this turn, never a fabricated one.
function formatMemoryForPrompt(mem: Record<string, unknown>): string {
  const label: Record<string, string> = { markets: 'Markets', strategies: 'Strategy', portfolio: 'Portfolio', budget: 'Budget', experience: 'Experience', goals: 'Goals', notes: 'Other notes' }
  const lines: string[] = []
  for (const [k, v] of Object.entries(mem)) {
    if (v == null) continue
    const name = label[k] || (k.charAt(0).toUpperCase() + k.slice(1))
    const val = Array.isArray(v) ? v.filter(Boolean).join('; ') : String(v)
    if (val.trim()) lines.push(`- ${name}: ${val}`)
  }
  return lines.join('\n')
}

async function fetchOperatorMemory(url: string, key: string, userId: string): Promise<string> {
  try {
    const res = await fetch(`${url}/rest/v1/penny_operator_memory?user_id=eq.${encodeURIComponent(userId)}&select=memory`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) { console.error('ai-investor-chat engine_http', res.status); return ENGINE_UNAVAILABLE }
    const rows = await res.json()
    const mem = Array.isArray(rows) && rows[0]?.memory && typeof rows[0].memory === 'object' ? rows[0].memory : null
    if (!mem || Object.keys(mem).length === 0) return NOTHING_LISTED
    const formatted = formatMemoryForPrompt(mem)
    return formatted ? `WHAT YOU REMEMBER ABOUT THIS OPERATOR (from past conversations — use it to tailor your advice and avoid re-asking what you already know; if they correct any of it, go with the correction):\n${formatted}` : ''
  } catch (e) { console.error('ai-investor-chat engine_threw', e instanceof Error ? e.message : 'unknown'); return ENGINE_UNAVAILABLE }
}

// Heuristic gate: does this message plausibly disclose durable operator facts worth remembering?
// Generous on purpose — better to run an extraction that finds nothing than to miss a disclosure.
// A pure question like "what's the ADR in 78701?" has no first-person business signal, so it's skipped.
function mightHaveDurableFacts(msg: string): boolean {
  const q = ' ' + (msg || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ') + ' '
  const firstPerson = [' i ', ' we ', ' my ', ' our ', " i'm ", " i've ", " we've "].some((t) => q.includes(t))
  if (!firstPerson) return false
  return ['run', 'running', 'operate', 'operating', 'own', 'manage', 'managing', 'portfolio', 'unit', 'units', 'door', 'doors', 'propert', 'budget', 'capital', 'invest', 'focus', 'target', 'expand', 'scal', 'looking to', 'plan to', 'planning', 'goal', 'based in', 'market', 'experience', 'year', 'new to', 'just start', 'arbitrage', 'lease', 'leasing', 'landlord', 'strateg', 'midterm', 'mid-term', 'shortterm', 'short-term', 'coliving', 'co-living'].some((t) => q.includes(t))
}

// Fire the memory-enrichment pass (get + extract + persist) in the operator-memory service using the
// service role. Best-effort: records only real, stated facts and never invents; a failure is ignored.
async function rememberOperator(url: string, svcKey: string, userId: string, convo: PennyMsg[]): Promise<void> {
  try {
    await fetch(`${url}/functions/v1/operator-memory`, {
      method: 'POST',
      headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remember', user_id: userId, conversation: convo }),
    })
  } catch (_e) { /* best-effort */ }
}

// Cheap router: analytical questions get a little more room to reason.
function chooseEffort(query: string): Effort {
  const q = (query || '').toLowerCase()
  if (/\b(analyz|compare|versus|\bvs\b|should i|worth it|which (market|city|deal|strateg)|cash ?flow|cap rate|\broi\b|profit|margin|break ?even|how much|estimate|run the numbers|projec|scenario|risk|financ)\b/.test(q)) {
    return 'medium'
  }
  return 'low'
}
const EFFORT_TOKENS: Record<Effort, number> = { low: 1500, medium: 2200 }

async function callAnthropic(key: string, system: string, messages: PennyMsg[], effort: Effort): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: EFFORT_TOKENS[effort], system, messages }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `anthropic http ${res.status}`)
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('anthropic returned no text')
  return text
}

// One Chat Completions call. Reasoning models (gpt-5.x) take reasoning_effort +
// max_completion_tokens; classic models (gpt-4o) take max_tokens and reject those.
async function callOpenAIModel(
  key: string, model: string, reasoning: boolean, system: string, messages: PennyMsg[], effort: Effort,
): Promise<string> {
  const bodyObj: Record<string, unknown> = { model, messages: [{ role: 'system', content: system }, ...messages] }
  if (reasoning) {
    bodyObj.reasoning_effort = effort
    bodyObj.max_completion_tokens = EFFORT_TOKENS[effort]
  } else {
    bodyObj.max_tokens = EFFORT_TOKENS[effort]
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(bodyObj),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `openai http ${res.status}`)
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('openai returned no text')
  return text
}

const OPENAI_MODELS: Array<{ id: string; reasoning: boolean }> = [
  { id: 'gpt-5.5', reasoning: true },
  { id: 'gpt-4o', reasoning: false },
]

// OpenAI first (Penny's real engine in this project), Anthropic only as a last-resort net.
async function askPenny(system: string, messages: PennyMsg[], effort: Effort): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const errors: string[] = []
  if (openaiKey) {
    for (const m of OPENAI_MODELS) {
      try { return await callOpenAIModel(openaiKey, m.id, m.reasoning, system, messages, effort) }
      catch (e) { errors.push(`${m.id}: ${e instanceof Error ? e.message : 'failed'}`) }
    }
  }
  if (anthropicKey) {
    try { return await callAnthropic(anthropicKey, system, messages, effort) }
    catch (e) { errors.push(`anthropic: ${e instanceof Error ? e.message : 'failed'}`) }
  }
  throw new Error(errors.length ? errors.join(' | ') : 'no reasoning provider configured')
}

serve(async (req) => {
  // Market alerts, read straight from the table. Sits before the chat handling because it
  // is a plain read, not a conversation.
  try {
    const peek = await req.clone().json().catch(() => ({}));
    if (peek?.action === 'get_market_alerts') {
      const u = Deno.env.get('SUPABASE_URL');
      const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      let q = `${u}/rest/v1/market_alerts?select=*&order=created_at.desc&limit=50`;
      if (peek.market) q += `&market=ilike.${encodeURIComponent(`%${peek.market}%`)}`;
      const r = await fetch(q, { headers: { apikey: k!, Authorization: `Bearer ${k}` } });
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: `Could not read market alerts (${r.status}).` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, alerts: await r.json() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch { /* not this action; fall through to chat */ }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, user_id, user_type, user_name, message, session_id, conversation_history } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Action: Get suggested questions (unchanged contract)
    if (action === 'get_suggested_questions') {
      const userTypeFilter = user_type || 'investor'

      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_suggested_questions?user_type=eq.${userTypeFilter}&is_active=eq.true&order=priority.desc&limit=8`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )

      const questions = await response.json()

      if (!questions || questions.length === 0) {
        const defaults = userTypeFilter === 'staff' ? [
          "Help me think through a co-living setup in Denver",
          "Draft a landlord pitch for a mid-term rental",
          "What are the STR regulations in Nashville?",
          "Walk me through analyzing a deal in the pipeline"
        ] : [
          "What markets are best for STR investing right now?",
          "How does rental arbitrage work?",
          "How much capital do I need to get started?",
          "What ROI should I expect from rental arbitrage?",
          "Can you explain co-living vs short-term rentals?",
          "What are the risks of rental arbitrage?"
        ]

        return new Response(JSON.stringify({ suggestions: defaults }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        suggestions: questions.map((q: any) => q.question)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: Get chat history (unchanged contract)
    if (action === 'get_history') {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_chat_sessions?user_id=eq.${user_id}&user_type=eq.${user_type || 'investor'}&order=updated_at.desc&limit=10`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )

      const history = await response.json()

      return new Response(JSON.stringify({ history: history || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: Chat with Penny
    if (action === 'chat') {
      if (!Deno.env.get('OPENAI_API_KEY') && !Deno.env.get('ANTHROPIC_API_KEY')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'AI service not configured. Please contact support.',
          message: "I'm sorry, but I'm having trouble connecting to my brain right now! Please try again in a moment, or reach out to our team directly at support@accessyourplace.com."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!message) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Message is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Build the system prompt based on user type
      // THE OPERATOR SHE IS ACTUALLY TALKING TO.
      //
      // She read the live deals, the library and the communities, but nothing about the
      // person in front of her — so somebody signed into their own portal asking "what did
      // you send me" or "what do I have to spend" got a general answer about the platform.
      //
      // The address of an unreleased deal is NOT in this payload at all. A field that is
      // present but masked is one bad prompt away from being spoken.
      let operatorFacts = ''
      if (user_id && user_type !== 'staff') {
        const ctxRes = await rpc(supabaseUrl, supabaseKey, 'ayp_operator_context', { p_investor_id: user_id })
        const c = ctxRes && (ctxRes as Record<string, unknown>).ok !== false ? ctxRes as Record<string, any> : null
        if (c) {
          const props = Array.isArray(c.properties) ? c.properties : []
          const deals = Array.isArray(c.deals_presented_to_you) ? c.deals_presented_to_you : []
          operatorFacts = `\n\nTHIS OPERATOR, READ LIVE JUST NOW:\n` +
            `- Name: ${c.name}\n` +
            `- Spendable credit: ${c.credit_balance}\n` +
            `- Properties they operate: ${c.portfolio_count}` +
            (props.length ? ` — ${props.map((x: any) => `${x.address}, ${x.city} ${x.state}`).join('; ')}` : '') + `\n` +
            `- Deals we have presented to them: ${deals.length}` +
            (deals.length ? ` — ${deals.map((d: any) =>
              `${d.headline || d.market || 'a deal'} (${d.status}${d.address_released ? ', address released' : ', address NOT released'})`).join('; ')}` : '') +
            `\n\nUse these facts and do not add to them. If they ask about something not listed, ` +
            `say you cannot see it rather than guessing. ` +
            `NEVER state the address of a deal whose address has not been released — you do not have it, ` +
            `and inventing one would be worse than saying so. Releasing it is done in their portal, not by you.`
        } else {
          // A failed read is not an empty portfolio. She is told the difference.
          operatorFacts = `\n\nYou could NOT read this operator's account this turn. Do not say they ` +
            `have no properties, no credit or no deals — say you cannot pull it up right now.`
        }
      }

      let systemPrompt = PENNY_SYSTEM_PROMPT
      if (user_type === 'staff') {
        systemPrompt += STAFF_ADDITIONS
      }
      if (user_name) {
        systemPrompt += `\n\nYou are currently chatting with ${user_name}. Address them by their first name when appropriate.`
      }
      // OUTSIDE the user_name block. My own insertion put this INSIDE it, so an operator
      // whose display name was missing got no account facts at all — the exact
      // "works for most people, silently wrong for some" failure this is meant to end.
      systemPrompt += operatorFacts

      // REAL GROUNDING: hand Penny the actual live deals + relevant library articles, so she
      // speaks from real current inventory instead of invented examples.
      const [deals, arts, opMem, community] = await Promise.all([
        fetchLiveDeals(supabaseUrl, supabaseKey),
        searchLibrary(supabaseUrl, supabaseKey, message),
        user_id ? fetchOperatorMemory(supabaseUrl, supabaseKey, user_id) : Promise.resolve(''),
        user_id ? fetchCommunityStatus(supabaseUrl, supabaseKey, message) : Promise.resolve(''),
      ])
      if (deals) {
        systemPrompt += `\n\n──────────\n\nLIVE DEALS ON THE PLATFORM RIGHT NOW (real market, type, economics, and score — this is your source of truth about current inventory). If the investor's market or deal type is not here, say so plainly and offer to line up an off-market search with the team; do not invent inventory:\n${deals}`
      } else {
        systemPrompt += `\n\n──────────\n\nThere are no live deals on the platform to show right now. Do not invent any. If the investor wants a specific market or deal type, be honest that off-market deal-finding runs inside the platform's tooling / with the acquisition team, and offer to line that up.`
      }
      if (Array.isArray(arts) && arts.length) {
        const list = arts
          .map((a: { title?: string; slug?: string; excerpt?: string }) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n')
        systemPrompt += `\n\n──────────\n\nRELEVANT LIBRARY ARTICLES (point to these by title; do not invent others):\n${list}`
      }

      if (opMem) systemPrompt += `\n\n──────────\n\n${opMem}`

      if (community) systemPrompt += `\n\n──────────\n\n${community}`

      // PROJECTION: if a logged-in operator names a ZIP, hand Penny the real Property Forge
      // projection for it so she speaks from a tool-backed estimate, not invented numbers. Non-account
      // callers get no projection here; the prompt tells Penny to have them create an account.
      const zipMatch = (message || '').match(/\b(\d{5})\b/)
      if (zipMatch && user_id) {
        const deal = await fetchDealAnalysis(supabaseUrl, supabaseKey, zipMatch[1], message)
        if (deal) systemPrompt += `

──────────

${deal}`
        const proj = deal ? '' : await fetchProjection(supabaseUrl, supabaseKey, zipMatch[1], message)
        if (proj) systemPrompt += `\n\n──────────\n\n${proj}`
      }

      // Additional operator tools: furnishing estimate and the co-living room-by-room model, when the
      // question calls for them. Tool-backed, so the numbers are real rather than invented in chat.
      if (user_id) {
        const wantsColiving = /\bco[- ]?living|shared living|by the room|per[- ]?room|room by room\b/i.test(message)
        const [furnish, coliving] = await Promise.all([
          fetchFurnishing(supabaseUrl, supabaseKey, message),
          wantsColiving ? fetchColiving(supabaseUrl, supabaseKey, zipMatch ? zipMatch[1] : '', message) : Promise.resolve(''),
        ])
        if (furnish) systemPrompt += `\n\n──────────\n\n${furnish}`
        if (coliving) systemPrompt += `\n\n──────────\n\n${coliving}`
      }

      // Build conversation messages for the AI
      const messages: PennyMsg[] = []
      if (conversation_history && Array.isArray(conversation_history)) {
        for (const msg of conversation_history.slice(-10)) {
          messages.push({ role: msg.role, content: String(msg.content) })
        }
      } else {
        messages.push({ role: 'user', content: message })
      }
      // The model requires the first message to be from the user.
      while (messages.length && messages[0].role !== 'user') messages.shift()
      if (messages.length === 0) messages.push({ role: 'user', content: message })

      let assistantMessage = ''
      try {
        assistantMessage = await askPenny(systemPrompt, messages, chooseEffort(message))
      } catch (err) {
        console.error('AI providers failed:', err)
        return new Response(JSON.stringify({
          success: false,
          error: 'AI service error',
          message: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or feel free to reach out to our team directly!"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // TRUTH SPINE: no stateful tools ran on this surface, so any "it's done" claim is unbacked.
      // The guard appends an honest correction rather than let a false completion stand.
      assistantMessage = guardReply(assistantMessage, []).text
      if (!assistantMessage) assistantMessage = "I'm sorry, I couldn't generate a response. Please try again."

      // THE DESTINATION GUARD, which this surface did not have.
      //
      // One wrong character in a payment destination sends a client's money somewhere
      // unrecoverable, and both owners are blind and cannot catch it by looking. The staff
      // and public surfaces have had this guard for a long time; the surface where an
      // actual paying client asks "where do I send it" did not.
      //
      // It REPLACES the reply rather than appending to it — appending would leave the
      // destination on screen with a warning underneath, which is worse than useless.
      const leak = containsPaymentDestination(assistantMessage)
      if (leak.leaked) {
        console.error('ai-investor-chat destination_blocked', JSON.stringify(leak.kinds))
        assistantMessage = destinationRefusal()
      }

      // MEMORY (write): if the operator disclosed durable facts, enrich their memory in the
      // background so it never adds reply latency and never changes this answer. Records only real,
      // stated facts — never invents. Best-effort: a failure here is silently ignored.
      if (user_id && mightHaveDurableFacts(message)) {
        const convoForMemory: PennyMsg[] = [...messages.slice(-6), { role: 'assistant', content: assistantMessage }]
        const memP = rememberOperator(supabaseUrl, supabaseKey, user_id, convoForMemory)
        const er = (globalThis as any).EdgeRuntime
        if (er && typeof er.waitUntil === 'function') er.waitUntil(memP)
        else memP.catch(() => {})
      }

      // Save the conversation to the database (unchanged behavior)
      if (user_id) {
        const newSessionId = session_id || `session_${Date.now()}`
        const updatedMessages = [
          ...(conversation_history || []),
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
        ]

        const existingSession = await fetch(
          `${supabaseUrl}/rest/v1/ai_chat_sessions?session_id=eq.${newSessionId}&user_id=eq.${user_id}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        )
        const sessions = await existingSession.json()

        if (sessions && sessions.length > 0) {
          await fetch(
            `${supabaseUrl}/rest/v1/ai_chat_sessions?id=eq.${sessions[0].id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messages: updatedMessages,
                updated_at: new Date().toISOString()
              })
            }
          )
        } else {
          await fetch(
            `${supabaseUrl}/rest/v1/ai_chat_sessions`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_id: user_id,
                user_type: user_type || 'investor',
                session_id: newSessionId,
                messages: updatedMessages
              })
            }
          )
        }
      }

      // THE PAYMENT BUTTON.
      //
      // Penny does not just tell somebody where the Payments tab is; she opens it for
      // them. But an action that moves a person toward sending money must not appear
      // because the topic came up. Two gates, both required:
      //
      //   1. They must be SIGNED IN. A signed-out visitor has no account to reserve
      //      against, and the acquisition endpoint refuses them anyway.
      //   2. They must have said, in their own words, that they are ready to take the
      //      operation off the market. Asking what a deposit is, or how the process
      //      works, is not readiness. Curiosity is not consent.
      //
      // The button carries no payment destination. It opens the Payments tab, where the
      // client copies the destination exactly. Penny never recites one.
      const readinessSaid = /\b(i'?m ready|im ready|ready to (go|move|proceed|reserve|buy|pay|start)|take it off the market|reserve (it|this|the deal|the operation)|lock it in|i want to (reserve|buy|secure) (it|this)|let'?s do it|send (the|my) deposit|pay the deposit|i'?ll take it)\b/i
        .test(String(message || ''));
      const signedIn = Boolean(user_id) && user_type !== 'public';

      const offerPayment = readinessSaid && signedIn;

      const actionCard = offerPayment
        ? {
            type: 'open_payment_page',
            label: 'Open my payment page',
            href: '/investor/portal?tab=payments',
            // Spoken by the live region. A component nobody hears does not exist.
            spoken:
              'Button available: open my payment page. It opens the Payments tab in your account, where you copy the destination exactly, send the payment yourself, and upload the photo of the confirmation. Sending it does not complete the purchase: an acquisition manager verifies it and speaks with you to finalise.',
          }
        : null;

      // Said out loud so the reason is never a mystery to the person or the next engineer.
      if (readinessSaid && !signedIn) {
        console.log('ai-investor-chat payment_button_withheld reason=not_signed_in');
      }

      return new Response(JSON.stringify({
        success: true,
        message: assistantMessage,
        action_card: actionCard,
        session_id: session_id || `session_${Date.now()}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Unknown action
    return new Response(JSON.stringify({
      error: 'Unknown action',
      valid_actions: ['get_suggested_questions', 'get_history', 'chat']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: "Oops! Something went wrong on my end. Please try again, or contact our team if the issue persists."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
