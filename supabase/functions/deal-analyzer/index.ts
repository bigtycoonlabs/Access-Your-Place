// deal-analyzer — Property Forge's "run the real numbers" underwriter.
//
// Given a SPECIFIC property an operator is weighing — the monthly lease rent they'd pay the
// landlord, the ZIP, the bedroom count, and their furnishing budget — this tells them whether
// the deal pencils across all three modalities AYP covers: short-term (STR), mid-term (MTR), and
// co-living. It is the natural partner to the ZIP projection: the projection describes the market;
// this decides whether one real unit makes money.
//
// HONESTY ARCHITECTURE (this is the whole point):
//   1. REVENUE side is an AI estimate, and labeled as one. It comes from the SAME projection engine
//      (the leadforge function) that Penny already uses, so numbers stay consistent across the
//      platform. If that engine can't return numbers for a ZIP, this returns an honest
//      "couldn't get market numbers" — it NEVER invents revenue to fill the gap. Fabricating a
//      number a blind operator can't sanity-check is the one thing we never do.
//   2. COST side is the operator's own real inputs (rent, setup budget, bedrooms) plus a small set
//      of TRANSPARENT default assumptions that are returned in the response, so nothing is hidden
//      in a black box. The operator can see and override every assumption.
//   3. The VERDICT is pure deterministic arithmetic on 1 and 2 — no model, no fabrication. If the
//      deal loses money, it says so plainly. A hard truth beats a comfortable lie.
//
// Pure math + one call to the projection engine. No database writes, no money, no PII.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAYS_PER_MONTH = 30.44

// TRANSPARENT default assumptions. Every one is returned in the response and can be overridden by
// passing an `assumptions` object. These are planning defaults, deliberately middle-of-the-road.
const DEFAULTS = {
  // STR (short-term)
  str_avg_stay_nights: 3.5,        // drives how many cleaning turns per month
  str_cleaning_per_turn: 90,       // paid per guest turnover
  str_platform_fee_pct: 0.03,      // host-side platform service fee on gross
  str_supplies_monthly: 90,        // consumables, restocking
  str_utilities_monthly: 240,      // power, water, internet (guest-heavy usage)
  // MTR (mid-term, 30+ day furnished stays)
  mtr_furnished_premium: 1.35,     // furnished monthly rent vs. the area's unfurnished long-term rent
  mtr_platform_monthly: 30,        // e.g. Furnished Finder subscription, amortized
  mtr_cleaning_monthly: 90,        // ~one turn per month
  mtr_supplies_monthly: 45,
  mtr_utilities_monthly: 220,
  // Co-living (rent by the room)
  coliving_platform_monthly: 40,
  coliving_supplies_monthly: 120,
  coliving_utilities_monthly: 400, // all-inclusive, multiple tenants
  coliving_extra_mgmt_monthly: 120,// coordinating more tenants
  // Launch capital
  deposit_months: 1,               // security deposit = this many months of rent
  default_setup_base: 2500,        // furnishing/setup floor when no budget is given
  default_setup_per_bed: 3000,     // added per bedroom when estimating setup
}

const round = (n: number) => Math.round(n)
const round1 = (n: number) => Math.round(n * 10) / 10
const money = (n: number) => `$${round(n).toLocaleString('en-US')}`

// Call the real projection engine (leadforge) for this ZIP and return its market_analysis + source.
// Same source of truth Penny uses, so the platform never quotes two different sets of numbers.
async function fetchMarket(url: string, key: string, zip: string, city?: string, state?: string) {
  try {
    const body: Record<string, unknown> = { action: 'search', zip_code: zip }
    if (city) body.city = city
    if (state) body.state = state
    const res = await fetch(`${url}/functions/v1/leadforge`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { analysis: null, source: 'unavailable' as const }
    const d = await res.json()
    if (!d || !d.market_analysis) return { analysis: null, source: 'unavailable' as const }
    return { analysis: d.market_analysis, source: (d.analysis_source || 'ai_estimate') as string }
  } catch {
    return { analysis: null, source: 'unavailable' as const }
  }
}

interface Modality {
  modality: string
  computable: boolean
  note?: string
  gross_monthly?: number
  costs?: Record<string, number>
  total_monthly_costs?: number
  net_monthly?: number
  annual_net?: number
  months_to_recoup_setup?: number | null
  cash_on_cash_pct?: number
  extra?: Record<string, number>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const {
      zip_code, city, state,
      monthly_rent, beds, baths,
      setup_budget, assumptions: overrides,
    } = body || {}

    // Required inputs. Without a ZIP we can't get market numbers; without the lease rent there is
    // nothing to underwrite. We say exactly what's missing rather than guess.
    const zip = zip_code ? String(zip_code).match(/\b(\d{5})\b/)?.[1] : null
    const rent = Number(monthly_rent)
    if (!zip || !rent || rent <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'missing_inputs',
        need: [!zip ? 'a 5-digit ZIP code' : null, (!rent || rent <= 0) ? 'the monthly lease rent you would pay the landlord' : null].filter(Boolean),
        message: 'To run a real deal analysis I need at least the property ZIP and the monthly lease rent. Bedrooms and your furnishing budget make it sharper.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const A = { ...DEFAULTS, ...(overrides && typeof overrides === 'object' ? overrides : {}) }
    const bedCount = Number.isFinite(Number(beds)) && Number(beds) > 0 ? Math.floor(Number(beds)) : null

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { analysis, source } = await fetchMarket(supabaseUrl, supabaseKey, zip, city, state)

    // No market numbers => no revenue side. We do NOT invent it. Honest stop.
    if (!analysis || source === 'unavailable') {
      return new Response(JSON.stringify({
        success: false,
        error: 'market_unavailable',
        zip_code: zip,
        message: `I couldn't get market numbers for ZIP ${zip} right now, so I won't guess at the revenue — that wouldn't be fair to base a decision on. Try again in a moment, or schedule a free acquisition-manager call and we'll pull the numbers with you by hand.`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---- Launch capital (cash to get the door open) ----
    const setup = Number.isFinite(Number(setup_budget)) && Number(setup_budget) > 0
      ? Number(setup_budget)
      : A.default_setup_base + A.default_setup_per_bed * (bedCount || 2)
    const deposit = rent * A.deposit_months
    const firstMonth = rent
    const cashToLaunch = setup + deposit + firstMonth

    const modalities: Modality[] = []

    // ---- STR ----
    const adr = Number(analysis.str_avg_adr) || 0
    const occ = Number(analysis.str_avg_occupancy) || 0
    if (adr > 0 && occ > 0) {
      const gross = adr * DAYS_PER_MONTH * occ
      const turns = DAYS_PER_MONTH / A.str_avg_stay_nights
      const cleaning = turns * A.str_cleaning_per_turn
      const platform = gross * A.str_platform_fee_pct
      const costs = {
        lease_rent: rent,
        platform_fee: round(platform),
        cleaning: round(cleaning),
        utilities: A.str_utilities_monthly,
        supplies: A.str_supplies_monthly,
      }
      const total = Object.values(costs).reduce((a, b) => a + b, 0)
      const net = gross - total
      // Occupancy needed just to cover the fixed monthly costs from nightly revenue.
      const fixed = rent + A.str_utilities_monthly + A.str_supplies_monthly
      const breakEvenOcc = adr > 0 ? fixed / (adr * DAYS_PER_MONTH) : null
      modalities.push({
        modality: 'Short-term (STR)',
        computable: true,
        gross_monthly: round(gross),
        costs,
        total_monthly_costs: round(total),
        net_monthly: round(net),
        annual_net: round(net * 12),
        months_to_recoup_setup: net > 0 ? round1(cashToLaunch / net) : null,
        cash_on_cash_pct: round1((net * 12 / cashToLaunch) * 100),
        extra: {
          adr_used: round(adr),
          occupancy_used_pct: round(occ * 100),
          break_even_occupancy_pct: breakEvenOcc != null ? round(Math.min(breakEvenOcc, 2) * 100) : 0,
        },
      })
    } else {
      modalities.push({ modality: 'Short-term (STR)', computable: false, note: 'The market estimate did not include a nightly rate and occupancy for this ZIP.' })
    }

    // ---- MTR (mid-term) ----
    // Base furnished rent off the area's long-term rent for the closest unit size, times a furnished
    // premium (a stated assumption). Fall back to 2BR rent if size is unknown.
    const baseRent = bedCount && bedCount >= 3 ? Number(analysis.avg_rent_3br) : Number(analysis.avg_rent_2br)
    const ltRent = baseRent || Number(analysis.avg_rent_2br) || Number(analysis.avg_rent_3br) || 0
    if (ltRent > 0) {
      const gross = ltRent * A.mtr_furnished_premium
      const costs = {
        lease_rent: rent,
        platform_fee: A.mtr_platform_monthly,
        cleaning: A.mtr_cleaning_monthly,
        utilities: A.mtr_utilities_monthly,
        supplies: A.mtr_supplies_monthly,
      }
      const total = Object.values(costs).reduce((a, b) => a + b, 0)
      const net = gross - total
      modalities.push({
        modality: 'Mid-term (MTR)',
        computable: true,
        gross_monthly: round(gross),
        costs,
        total_monthly_costs: round(total),
        net_monthly: round(net),
        annual_net: round(net * 12),
        months_to_recoup_setup: net > 0 ? round1(cashToLaunch / net) : null,
        cash_on_cash_pct: round1((net * 12 / cashToLaunch) * 100),
        extra: {
          furnished_rent_used: round(gross),
          based_on_long_term_rent: round(ltRent),
          furnished_premium_pct: round((A.mtr_furnished_premium - 1) * 100),
        },
      })
    } else {
      modalities.push({ modality: 'Mid-term (MTR)', computable: false, note: 'The market estimate did not include an area rent to base a furnished mid-term rate on.' })
    }

    // ---- Co-living (rent by the room) ----
    const roomRate = Number(analysis.coliving_room_rate) || 0
    if (roomRate > 0 && bedCount) {
      const gross = roomRate * bedCount
      const costs = {
        lease_rent: rent,
        platform_fee: A.coliving_platform_monthly,
        utilities: A.coliving_utilities_monthly,
        supplies: A.coliving_supplies_monthly,
        management: A.coliving_extra_mgmt_monthly,
      }
      const total = Object.values(costs).reduce((a, b) => a + b, 0)
      const net = gross - total
      modalities.push({
        modality: 'Co-living (by the room)',
        computable: true,
        gross_monthly: round(gross),
        costs,
        total_monthly_costs: round(total),
        net_monthly: round(net),
        annual_net: round(net * 12),
        months_to_recoup_setup: net > 0 ? round1(cashToLaunch / net) : null,
        cash_on_cash_pct: round1((net * 12 / cashToLaunch) * 100),
        extra: { per_room_rate_used: round(roomRate), rooms_rented: bedCount },
      })
    } else if (roomRate > 0 && !bedCount) {
      modalities.push({ modality: 'Co-living (by the room)', computable: false, note: `Per-room rate is about ${money(roomRate)}/room. Tell me the bedroom count and I'll compute the full co-living number.` })
    } else {
      modalities.push({ modality: 'Co-living (by the room)', computable: false, note: 'The market estimate did not include a per-room co-living rate for this ZIP.' })
    }

    // ---- Verdict (deterministic) ----
    const computed = modalities.filter((m) => m.computable && typeof m.net_monthly === 'number')
    const positive = computed.filter((m) => (m.net_monthly as number) > 0)
    let best: Modality | null = null
    for (const m of computed) if (!best || (m.net_monthly as number) > (best.net_monthly as number)) best = m
    const pencils = positive.length > 0

    // ---- Plain-English, VoiceOver-friendly summary, built deterministically from the numbers ----
    const lines: string[] = []
    lines.push(`Deal analysis for a ${bedCount ? bedCount + '-bedroom ' : ''}property in ZIP ${zip}${city ? `, ${city}${state ? ', ' + state : ''}` : ''}, leasing at ${money(rent)} a month.`)
    lines.push(`To launch it you'd put in about ${money(cashToLaunch)} up front — ${money(setup)} to furnish and set up, ${money(deposit)} deposit, and ${money(firstMonth)} first month's rent.`)
    for (const m of modalities) {
      if (!m.computable) { lines.push(`${m.modality}: not enough data to run it. ${m.note || ''}`.trim()); continue }
      const net = m.net_monthly as number
      const verdictWord = net > 0 ? 'nets' : 'loses'
      let line = `${m.modality}: about ${money(m.gross_monthly as number)} a month coming in, ${money(m.total_monthly_costs as number)} going out, so it ${verdictWord} roughly ${money(Math.abs(net))} a month`
      if (net > 0) line += ` — around ${money(m.annual_net as number)} a year, recouping your setup in about ${m.months_to_recoup_setup} months (${m.cash_on_cash_pct}% cash-on-cash)`
      lines.push(line + '.')
    }
    if (pencils && best) {
      lines.push(`The strongest fit here is ${best.modality.toLowerCase()}, at about ${money(best.net_monthly as number)} a month. Mid-term is generally the steadier income; short-term is higher but more seasonal; co-living usually grosses the most but is the most hands-on.`)
    } else {
      lines.push(`At these numbers this deal doesn't pencil in any modality — the rent and costs eat the revenue. That's the honest read; it would take a lower lease rent or a stronger market to work.`)
    }
    lines.push(`These are planning estimates: the revenue side is an AI estimate from AYP's research methodology (not a live data feed), and the costs use standard assumptions you can adjust. Numbers shift between runs as the market moves. For a human-checked read, you can book a free, no-obligation call with an acquisition manager on the success team.`)

    return new Response(JSON.stringify({
      success: true,
      zip_code: zip,
      city: city || null,
      state: state || null,
      inputs: { monthly_rent: rent, beds: bedCount, baths: baths ?? null, setup_budget_used: setup },
      market_source: source,                 // 'ai_estimate' — the revenue side is an estimate, labeled
      market_analysis: analysis,             // the raw projection, for transparency
      assumptions_used: A,                   // every cost assumption, exposed — nothing hidden
      cash_to_launch: { setup: round(setup), deposit: round(deposit), first_month: round(firstMonth), total: round(cashToLaunch) },
      modalities,
      verdict: {
        pencils,
        best_modality: best ? best.modality : null,
        best_net_monthly: best ? best.net_monthly : null,
      },
      text_summary: lines.join(' '),
      disclaimer: 'Planning estimate. Revenue is an AI estimate following AYP methodology, not verified market data. Costs use standard, adjustable assumptions. Not financial advice.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('deal-analyzer error:', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'analyzer failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
