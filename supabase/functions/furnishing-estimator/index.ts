// furnishing-estimator — what it costs to furnish a unit, itemized, and how fast it pays back.
//
// Furnishing is the single biggest up-front cash outlay in this business, and operators consistently
// under-budget it. This gives an honest, itemized estimate scaled by unit size, finish tier, and
// modality (STR vs mid-term vs co-living each need different things), plus the payback if they tell
// us the monthly profit. It complements the Deal Analyzer (which takes a setup budget as an input):
// this is the tool that helps them set that number in the first place.
//
// HONESTY: these are typical cost RANGES from a stated model, not a quote. Actual cost swings with
// taste, sourcing (retail vs marketplace/estate finds), and local delivery — the output says so and
// gives a low-to-high band, never a single false-precise figure. Every assumption is visible. No DB,
// no money movement, no PII. verify_jwt false (same posture as deal-analyzer / coliving-modeler).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Finish tiers scale the furniture spend. Supplies scale far less (a towel is a towel).
const TIER_MULT: Record<string, number> = { budget: 0.65, mid: 1.0, premium: 1.7 }
const SUPPLY_MULT: Record<string, number> = { budget: 0.85, mid: 1.0, premium: 1.2 }
const TIER_LABEL: Record<string, string> = { budget: 'budget', mid: 'mid-range', premium: 'premium' }

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}
function band(n: number): string {
  return `${money(n * 0.85)}–${money(n * 1.15)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const bedroomsRaw = Number(body?.bedrooms)
    const bedrooms = isFinite(bedroomsRaw) && bedroomsRaw >= 0 ? Math.floor(bedroomsRaw) : NaN
    const tier = ['budget', 'mid', 'premium'].includes(String(body?.tier)) ? String(body.tier) : 'mid'
    const modality = ['str', 'mtr', 'coliving'].includes(String(body?.modality)) ? String(body.modality) : 'general'
    const monthlyProfit = Number(body?.monthly_profit) > 0 ? Number(body.monthly_profit) : null
    const targetBudget = Number(body?.setup_budget) > 0 ? Number(body.setup_budget) : null

    if (!isFinite(bedrooms)) {
      return new Response(JSON.stringify({ success: false, error: 'bedrooms required', message: 'Tell me the unit size (bedrooms, or 0 for a studio) and I can itemize the furnishing cost. A finish tier (budget, mid, or premium) and the modality help me sharpen it.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sleepingAreas = bedrooms > 0 ? bedrooms : 1 // a studio still needs one sleeping setup
    const bathrooms = Math.max(1, Math.round(bedrooms / 2))
    const tMult = TIER_MULT[tier]
    const sMult = SUPPLY_MULT[tier]

    // Base (mid-tier) furniture spend by category.
    let living = 1600
    let bedroomsCost = 1300 * sleepingAreas
    let kitchen = 700
    let dining = bedrooms >= 1 ? 550 : 350 // studios get a small bistro set, not a full dining suite
    let bathroomsCost = 180 * bathrooms
    let electronics = 650
    let decor = 500

    // Modality shapes what a unit actually needs.
    let modalityNote = ''
    if (modality === 'str') {
      decor += 400            // guests judge on look; STR leans harder on styling/photos
      electronics += 150      // smart lock for self check-in
      modalityNote = 'Short-term setup leans into styling and a smart lock for self check-in — look drives bookings and reviews.'
    } else if (modality === 'coliving') {
      electronics += 120 * sleepingAreas // a keyed/smart lock per private room
      modalityNote = `Co-living adds a lock per private room (${sleepingAreas} of them) and heavier shared-space supplies; each bedroom is furnished as its own independent space.`
    } else if (modality === 'mtr') {
      kitchen += 150          // 30+ day guests actually cook — a fuller kitchen pays off
      decor = Math.max(300, decor - 100) // leaner styling than STR
      modalityNote = 'Mid-term setup can go lighter on styling but fuller on the kitchen — 30+ day guests cook and settle in.'
    }

    const furnitureBase = living + bedroomsCost + kitchen + dining + bathroomsCost + electronics + decor
    const furniture = furnitureBase * tMult

    // Supplies / consumables to launch (linens, toiletries, paper, cleaning, pantry starter, kitchen basics).
    let suppliesBase = 350
    if (modality === 'str') suppliesBase += 300           // guest consumables + backup linen sets
    if (modality === 'coliving') suppliesBase += 80 * sleepingAreas
    const supplies = suppliesBase * sMult

    // Delivery, assembly, and pre-launch odds and ends.
    const deliveryAssembly = 0.08 * furniture + 250
    const setupMisc = 300

    const total = furniture + supplies + deliveryAssembly + setupMisc
    const payback = monthlyProfit ? total / monthlyProfit : null

    // Itemized, tiered category costs for display.
    const items: Array<{ label: string; cost: number }> = [
      { label: 'Living room', cost: living * tMult },
      { label: `Bedroom${sleepingAreas === 1 ? '' : 's'} (${sleepingAreas})`, cost: bedroomsCost * tMult },
      { label: 'Kitchen', cost: kitchen * tMult },
      { label: 'Dining', cost: dining * tMult },
      { label: `Bathroom${bathrooms === 1 ? '' : 's'} (${bathrooms})`, cost: bathroomsCost * tMult },
      { label: 'Electronics & locks', cost: electronics * tMult },
      { label: 'Decor & art', cost: decor * tMult },
      { label: 'Starter supplies & linens', cost: supplies },
      { label: 'Delivery, assembly & setup', cost: deliveryAssembly + setupMisc },
    ]

    // Honest, VoiceOver-friendly summary.
    const unitName = bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom`
    const L: string[] = []
    L.push(`Furnishing a ${unitName} unit at a ${TIER_LABEL[tier]} finish${modality !== 'general' ? ` for ${modality === 'str' ? 'short-term' : modality === 'mtr' ? 'mid-term' : 'co-living'} use` : ''}: about ${money(total)} all in, realistically ${band(total)} depending on how you source it.`)
    L.push('')
    L.push('Where it goes:')
    for (const it of items) L.push(`- ${it.label}: about ${money(it.cost)}`)
    L.push('')
    if (modalityNote) { L.push(modalityNote); L.push('') }
    if (payback != null) {
      L.push(`At about ${money(monthlyProfit as number)}/mo profit, this furnishing pays itself back in roughly ${payback.toFixed(1)} months. After that it's working capital you own — you keep it, reuse it, or move it to the next unit.`)
      L.push('')
    }
    if (targetBudget != null) {
      const diff = total - targetBudget
      if (diff > total * 0.08) {
        L.push(`Your ${money(targetBudget)} budget is about ${money(diff)} under this estimate. You can close that by going a tier down on furniture, buying key pieces secondhand, or furnishing in phases — just be honest with yourself that a thin setup shows in photos and reviews.`)
      } else if (diff < -total * 0.08) {
        L.push(`Your ${money(targetBudget)} budget has roughly ${money(-diff)} of headroom over this estimate — room to lift the finish a notch where guests notice (beds, sofa, lighting) or hold as a cushion.`)
      } else {
        L.push(`Your ${money(targetBudget)} budget lines up well with this estimate — you're in the right range.`)
      }
      L.push('')
    }
    L.push(`Honest notes: this is a typical-cost model, not a quote — the real number swings with your taste, where you source (marketplace and estate finds cut it a lot), and local delivery. Buy the things guests touch and sleep on well (mattress, sofa, pillows, lighting) and save on the rest. If you want a human to sanity-check the plan, an acquisition manager will do it free.`)

    return new Response(JSON.stringify({
      success: true,
      unit: unitName,
      tier,
      modality,
      bedrooms,
      sleeping_areas: sleepingAreas,
      bathrooms,
      total_estimate: Math.round(total),
      range_low: Math.round(total * 0.85),
      range_high: Math.round(total * 1.15),
      items: items.map((i) => ({ label: i.label, cost: Math.round(i.cost) })),
      payback_months: payback != null ? Math.round(payback * 10) / 10 : null,
      text_summary: L.join('\n'),
      message: L.join('\n'),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('furnishing-estimator error:', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'furnishing-estimator failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
