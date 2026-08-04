// coliving-modeler — a deep, room-by-room co-living (shared-living) model for one property.
//
// This is the tool almost no one else has: AirDNA, PriceLabs and the STR crowd price whole units off
// scraped nightly data. AYP's edge is renting a house BY THE ROOM, and the per-room rate is the number
// that makes co-living pencil. This function models that end to end: how many rentable rooms a house
// has, the estimated per-room rate for its market, the gross by the room, realistic all-bills-included
// operating costs, the net against the landlord lease, the uplift versus renting the place as a single
// furnished unit, the furnishing cash to launch, payback, and how the numbers hold if a room sits empty.
//
// HONESTY (the whole point, for a founder whose users can't visually audit the math):
//   - The per-room rate and the single-unit comparison rent are ESTIMATES following AYP's methodology,
//     reasoned live from the market — not a live data feed. They shift between runs. Labeled as such.
//   - If the market rate can't be estimated and the operator didn't supply one, this NEVER invents a
//     number. It returns the room structure and asks for a per-room rate instead. A missing number is
//     honest; a made-up one is the cardinal sin.
//   - Every operating-cost and occupancy assumption is stated openly so the operator sees the model,
//     not a black box. Nothing is guaranteed.
//   - It flags the two things that actually sink co-living deals: converting a common area to a
//     "bedroom" needs a legal room (egress/closet) and local occupancy rules, and renting by the room
//     needs written landlord permission and can hit city caps on unrelated occupants. Verify locally.
//
// No database, no money movement, no PII. verify_jwt is false (same posture as deal-analyzer /
// landlord-pitch): callable by the platform UI and by Penny.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Deterministic model assumptions (stated openly in the output, never hidden) ---
const UTIL_BASE = 180        // base monthly utilities + internet for the house (all-bills-included model)
const UTIL_PER_ROOM = 45     // marginal utilities per rentable room
const CLEAN_PER_ROOM = 30    // common-area cleaning attributable per room
const SUPPLY_PER_ROOM = 15   // shared consumables/supplies per room
const OCC_ASSUMPTION = 0.90  // effective occupancy: rooms turn over independently, so full occupancy is optimistic
const FURNISH_PER_ROOM = 3000 // furnishing a bedroom (bed, storage, desk, decor)
const FURNISH_COMMON = 3000   // furnishing shared spaces (living, kitchen, supplies) once

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

// Ask the model for a market-grounded per-room rate and a single-unit comparison rent. Returns null on
// any failure — the caller then refuses to invent a number and asks the operator for one instead.
async function estimateRates(location: string, bedrooms: number): Promise<
  { per_room_low: number; per_room_typical: number; per_room_high: number; whole_unit_furnished_typical: number; rationale: string } | null
> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key || !location) return null
  const sys = `You estimate furnished-rental rates for Access Your Place, following AYP's research methodology. You reason about the local market from what you know; you are NOT reading a live feed, and you never pretend a false precision. Return a single JSON object with these numeric monthly-dollar fields and one short string:
- per_room_typical: typical all-bills-included monthly rent for ONE furnished private bedroom in a shared/co-living house in this market.
- per_room_low, per_room_high: a realistic low and high around that typical.
- whole_unit_furnished_typical: typical monthly rent if the SAME property were rented as a single whole furnished unit on a 30+ day (mid-term) basis, for comparison.
- rationale: one short sentence on what drives these numbers in this market.
Base the numbers on the location and bedroom count given. Be realistic, not optimistic. Return ONLY the JSON object.`
  const user = `Location: ${location}\nBedrooms in the house: ${bedrooms}\nReturn the JSON estimate.`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })
    const data = await res.json()
    if (!res.ok || data?.error) return null
    const txt = data?.choices?.[0]?.message?.content
    if (!txt) return null
    const p = JSON.parse(txt)
    const num = (x: unknown) => (typeof x === 'number' && isFinite(x) && x > 0 ? x : null)
    const typical = num(p.per_room_typical)
    if (!typical) return null
    return {
      per_room_typical: typical,
      per_room_low: num(p.per_room_low) ?? Math.round(typical * 0.85),
      per_room_high: num(p.per_room_high) ?? Math.round(typical * 1.15),
      whole_unit_furnished_typical: num(p.whole_unit_furnished_typical) ?? 0,
      rationale: typeof p.rationale === 'string' ? p.rationale : '',
    }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const bedrooms = Number(body?.bedrooms)
    const location = String(body?.location || body?.city || body?.zip_code || '').trim()
    const convertible = Math.max(0, Number(body?.convertible_rooms) || 0)
    const leaseRent = Number(body?.lease_rent) > 0 ? Number(body.lease_rent) : null
    const overrideRate = Number(body?.per_room_rate) > 0 ? Number(body.per_room_rate) : null
    const setupBudget = Number(body?.setup_budget) > 0 ? Number(body.setup_budget) : null

    if (!bedrooms || bedrooms < 1) {
      return new Response(JSON.stringify({ success: false, error: 'bedrooms required', message: 'Tell me how many bedrooms the house has and I can model it by the room.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rooms = bedrooms + convertible

    // Per-room rate: operator's own number wins; otherwise a market estimate; otherwise we DO NOT invent one.
    let estimate: Awaited<ReturnType<typeof estimateRates>> = null
    let perRoom = overrideRate
    let rateSource = overrideRate ? 'your number' : ''
    if (!perRoom) {
      estimate = await estimateRates(location, bedrooms)
      if (estimate) { perRoom = estimate.per_room_typical; rateSource = 'AYP market estimate' }
    }

    // Honest refusal: no rate and none could be estimated -> return structure, ask for the rate.
    if (!perRoom) {
      const summary = `That house has ${rooms} rentable room${rooms === 1 ? '' : 's'}${convertible ? ` (${bedrooms} bedroom${bedrooms === 1 ? '' : 's'} plus ${convertible} converted common-area room${convertible === 1 ? '' : 's'})` : ''}. I couldn't pin down a reliable per-room rate for ${location || 'that market'} right now, and I won't guess one — a made-up number would be worse than none. Tell me the per-room monthly rate you'd expect (or that you've seen locally) and I'll run the full room-by-room model: gross by the room, operating costs, net against the lease, payback, and how it holds if a room sits empty.`
      return new Response(JSON.stringify({ success: true, rooms, rate_available: false, message: summary, text_summary: summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- Deterministic room-by-room math ---
    const grossFull = rooms * perRoom
    const grossEff = grossFull * OCC_ASSUMPTION
    const opex = UTIL_BASE + rooms * (UTIL_PER_ROOM + CLEAN_PER_ROOM + SUPPLY_PER_ROOM)
    const netFull = leaseRent != null ? grossFull - leaseRent - opex : null
    const netEff = leaseRent != null ? grossEff - leaseRent - opex : null

    const wholeUnit = estimate?.whole_unit_furnished_typical || 0
    const upliftVsWholeUnit = wholeUnit > 0 ? grossEff - wholeUnit : null // effective by-the-room revenue vs one furnished unit

    const setup = setupBudget ?? (FURNISH_PER_ROOM * rooms + FURNISH_COMMON)
    const paybackMonths = netEff != null && netEff > 0 ? setup / netEff : null
    const cashOnCash = netEff != null && netEff > 0 ? (netEff * 12) / setup : null

    // Occupancy sensitivity: profit as rooms sit empty (only meaningful when we know the lease).
    const sensitivity: Array<{ rooms_filled: number; monthly_net: number }> = []
    if (leaseRent != null) {
      for (let filled = rooms; filled >= Math.max(0, rooms - 2); filled--) {
        sensitivity.push({ rooms_filled: filled, monthly_net: Math.round(filled * perRoom - leaseRent - opex) })
      }
    }

    // --- Honest, VoiceOver-friendly summary ---
    const L: string[] = []
    L.push(`Co-living model for a ${bedrooms}-bedroom house${location ? ` in ${location}` : ''}${convertible ? `, plus ${convertible} common-area room${convertible === 1 ? '' : 's'} you'd convert` : ''} — ${rooms} rentable room${rooms === 1 ? '' : 's'} total.`)
    L.push('')
    if (rateSource === 'your number') {
      L.push(`Per-room rate: ${money(perRoom)}/mo (your number).`)
    } else {
      L.push(`Per-room rate: about ${money(perRoom)}/mo typical (AYP market estimate${estimate && estimate.per_room_low ? `, roughly ${money(estimate.per_room_low)}–${money(estimate.per_room_high)} depending on the room and finish` : ''}). This is a methodology-based estimate, not a live feed, so it shifts between runs.`)
      if (estimate?.rationale) L.push(estimate.rationale)
    }
    L.push('')
    L.push(`Gross by the room: ${money(grossFull)}/mo at full occupancy, or about ${money(grossEff)}/mo at a realistic ${Math.round(OCC_ASSUMPTION * 100)}% (rooms turn over independently, so full is optimistic).`)
    L.push(`Operating costs (all-bills-included model): about ${money(opex)}/mo — utilities and internet ${money(UTIL_BASE + rooms * UTIL_PER_ROOM)}, common-area cleaning ${money(rooms * CLEAN_PER_ROOM)}, supplies ${money(rooms * SUPPLY_PER_ROOM)}.`)
    if (leaseRent != null) {
      L.push('')
      L.push(`Against a ${money(leaseRent)}/mo lease to the landlord, net profit is about ${money(netEff as number)}/mo at ${Math.round(OCC_ASSUMPTION * 100)}% occupancy (${money(netFull as number)}/mo if every room is full).`)
      if (wholeUnit > 0) {
        if ((upliftVsWholeUnit as number) > 0) {
          L.push(`Renting the same place as a single furnished unit would bring roughly ${money(wholeUnit)}/mo, so co-living looks like about ${money(upliftVsWholeUnit as number)}/mo more revenue — that's the by-the-room upside, before the extra operating work.`)
        } else {
          L.push(`Renting the same place as a single furnished unit would bring roughly ${money(wholeUnit)}/mo — close to or above the by-the-room revenue here, so co-living may not be worth the extra operating work on this one. A hard truth beats a comfortable lie.`)
        }
      }
      L.push(`Launch cash to furnish: about ${money(setup)}${setupBudget ? ' (your budget)' : ` (roughly ${money(FURNISH_PER_ROOM)}/room plus ${money(FURNISH_COMMON)} for shared spaces)`}.`)
      if (paybackMonths != null) {
        L.push(`Payback: about ${paybackMonths.toFixed(1)} months, a cash-on-cash return near ${Math.round((cashOnCash as number) * 100)}% a year — if the room-rate estimate holds.`)
      } else {
        L.push(`At these numbers the deal doesn't clear its costs, so there's no payback to show — it loses money each month as modeled. Worth re-checking the rent, the room count, or the rate before moving.`)
      }
      if (sensitivity.length) {
        const parts = sensitivity.map((s) => `${s.rooms_filled} filled → ${money(s.monthly_net)}/mo`)
        L.push(`If rooms sit empty: ${parts.join(', ')}. That's your cushion — how many vacancies the deal can absorb before it stops making money.`)
      }
    } else {
      L.push('')
      L.push(`Give me the monthly lease you'd pay the landlord and I'll finish the picture: net profit, the comparison to renting it as one unit, launch cash, payback, and how many empty rooms it can absorb.`)
    }
    L.push('')
    L.push(`A few honest checks before you count on this: converting a common area to a rentable bedroom needs a real bedroom (egress and a closet in most places) and has to fit local occupancy rules; renting by the room needs written permission in the lease and some cities cap unrelated occupants — confirm both locally. And if you want a human second set of eyes, an acquisition manager will check it free.`)

    return new Response(JSON.stringify({
      success: true,
      rate_available: true,
      rooms,
      bedrooms,
      convertible_rooms: convertible,
      per_room_rate: Math.round(perRoom),
      per_room_source: rateSource,
      per_room_range: estimate ? { low: Math.round(estimate.per_room_low), high: Math.round(estimate.per_room_high) } : null,
      whole_unit_furnished_estimate: wholeUnit || null,
      monthly: {
        gross_full: Math.round(grossFull),
        gross_effective: Math.round(grossEff),
        opex: Math.round(opex),
        net_effective: netEff != null ? Math.round(netEff) : null,
        net_full: netFull != null ? Math.round(netFull) : null,
        occupancy_assumption: OCC_ASSUMPTION,
      },
      uplift_vs_whole_unit: upliftVsWholeUnit != null ? Math.round(upliftVsWholeUnit) : null,
      setup_estimate: Math.round(setup),
      payback_months: paybackMonths != null ? Math.round(paybackMonths * 10) / 10 : null,
      cash_on_cash: cashOnCash != null ? Math.round(cashOnCash * 100) / 100 : null,
      occupancy_sensitivity: sensitivity,
      text_summary: L.join('\n'),
      message: L.join('\n'),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('coliving-modeler error:', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'coliving-modeler failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
