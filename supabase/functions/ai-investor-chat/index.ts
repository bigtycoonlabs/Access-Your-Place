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

## The free human check
Any client who wants research validated by a person — on a property they found OR one listed on the platform — can schedule a FREE, no-obligation call with an acquisition manager on the success team. Offer this naturally whenever someone is weighing numbers or unsure whether to trust them. The AI research already follows AYP's methodology; the call is a human second set of eyes.

## Payments
AYP transactions run on Zelle, Cash App, wire transfer, and Bitcoin — not card processors like Stripe. This is deliberate: transaction sizes are large, and these rails keep payouts fast and funds unlocked rather than tied up. If asked how payment works, say this plainly.

## Grounding and honesty (this matters most)
- You remember returning operators across conversations. When you know an operator's markets, strategy, portfolio, budget, or goals, it appears below — use it to tailor advice and avoid re-asking. Never claim to remember something that isn't actually there.
- When there are live deals on the platform, you are handed them below — that is your source of truth about current inventory. Discuss them openly. If the client's market or deal type is NOT in that list, say so plainly and offer the live tooling / acquisition team — never invent inventory, an address, a link, or an "example" deal as if it were real.
- When you are handed library articles below, point to them by title; never invent others.
- You do NOT confirm payments, credit accounts, unlock deals, or send emails from this chat — the success team and the platform do that. Never say one of those happened unless it truly did; say what the next step is and who does it.

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
  if (!Array.isArray(props) || props.length === 0) return ''
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
    if (!res.ok) return ''
    const d = await res.json()
    if (!d || !d.market_analysis) return ''
    return `PROPERTY FORGE PROJECTION for ZIP ${zip} — a real projection from AYP's Property Forge analysis engine (an AI estimate following our research methodology, not a live data feed). Present these as the client's projection, tell them the numbers shift between runs as the market moves, and offer the free acquisition-manager call if they want a human check. Do not invent numbers beyond these:\n${JSON.stringify(d.market_analysis)}`
  } catch { return '' }
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
    if (!res.ok) return ''
    const d = await res.json()
    if (d && d.success && d.text_summary) {
      return `DEAL ANALYZER RESULT (a real, tool-computed underwriting of the client's specific deal — deterministic math on AYP's projection engine, honestly an estimate). Present these figures as the analysis; do NOT invent, alter, or round them away, and keep the honest caveats:\n${d.text_summary}`
    }
    if (d && d.message) return `DEAL ANALYZER NOTE (relay this honestly; do not invent numbers): ${d.message}`
    return ''
  } catch { return '' }
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
    if (!res.ok) return ''
    const d = await res.json()
    if (d && d.success && d.text_summary) return `FURNISHING ESTIMATE (real, tool-computed itemized estimate — a typical-cost model, not a quote. Present these figures and keep the honest caveats; do not invent or alter them):\n${d.text_summary}`
    return ''
  } catch { return '' }
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
    if (!res.ok) return ''
    const d = await res.json()
    if (d && d.success && d.text_summary) return `CO-LIVING ROOM-BY-ROOM MODEL (real, tool-computed for the client's property — the per-room rate is an AYP estimate that shifts between runs. Present these figures and keep the honest caveats; do not invent or alter them):\n${d.text_summary}`
    return ''
  } catch { return '' }
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
    if (!res.ok) return ''
    const rows = await res.json()
    const mem = Array.isArray(rows) && rows[0]?.memory && typeof rows[0].memory === 'object' ? rows[0].memory : null
    if (!mem || Object.keys(mem).length === 0) return ''
    const formatted = formatMemoryForPrompt(mem)
    return formatted ? `WHAT YOU REMEMBER ABOUT THIS OPERATOR (from past conversations — use it to tailor your advice and avoid re-asking what you already know; if they correct any of it, go with the correction):\n${formatted}` : ''
  } catch { return '' }
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
      let systemPrompt = PENNY_SYSTEM_PROMPT
      if (user_type === 'staff') {
        systemPrompt += STAFF_ADDITIONS
      }
      if (user_name) {
        systemPrompt += `\n\nYou are currently chatting with ${user_name}. Address them by their first name when appropriate.`
      }

      // REAL GROUNDING: hand Penny the actual live deals + relevant library articles, so she
      // speaks from real current inventory instead of invented examples.
      const [deals, arts, opMem] = await Promise.all([
        fetchLiveDeals(supabaseUrl, supabaseKey),
        searchLibrary(supabaseUrl, supabaseKey, message),
        user_id ? fetchOperatorMemory(supabaseUrl, supabaseKey, user_id) : Promise.resolve(''),
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

      return new Response(JSON.stringify({
        success: true,
        message: assistantMessage,
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
