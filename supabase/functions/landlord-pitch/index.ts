// landlord-pitch — Property Forge's landlord-acquisition assistant.
//
// Landlord acquisition is THE bottleneck in furnished-rental arbitrage — a brutal numbers game where
// even a seasoned operator converts maybe one landlord in five, and beginners far fewer. Landlords
// balk for known reasons: fear of parties/noise, property damage and wear, the legality of
// subletting, and not knowing who's really in their unit. This tool drafts a tailored, professional
// pitch that meets those fears head-on with the levers that actually win a yes: guaranteed rent,
// professional upkeep, longer minimum stays, insurance, transparency, and everything in writing.
//
// HONESTY + GUARDRAILS (non-negotiable):
//   - It DRAFTS a pitch for the operator to review and send themselves. It never sends anything and
//     never implies it was sent. Surfacing/drafting is in-lane; running outreach is not.
//   - It NEVER reveals or hints at the operator's profit margin — the pitch is about what the LANDLORD
//     gets, not what the operator makes. Disclosing the spread is how operators lose the deal.
//   - It NEVER claims the arrangement is legal or permitted. It tells the operator to confirm local
//     short-term-rental rules and to get written sublet/STR permission into the lease. The research is
//     clear that being upfront is what gets landlords to yes — so the pitch is transparent, not slick.
//   - It only promises what the operator actually offers (e.g. guaranteed rent), framed as their offer.
//     No invented guarantees, no hype, no manipulation.
//
// One OpenAI call for the prose; the honesty reminders and disclaimer are code-appended so they are
// always present, exact, and never dropped by the model. No database, no money, no PII stored.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a landlord-acquisition specialist for furnished-rental operators at Access Your Place. You draft a persuasive, professional, HONEST pitch an operator can send a landlord to win permission for a master-lease / furnished-rental arrangement (short-term, mid-term, or co-living).

The landlord's real fears — address the relevant ones head-on, calmly and concretely:
- Parties, noise, and disruptive guests.
- Property damage and excess wear.
- Whether subletting / short-term rental is even allowed.
- Not knowing who is actually staying in their property.
- An unreliable tenant who pays late or vanishes.

The levers that actually win a yes — use the ones that fit the operator's offer:
- Guaranteed monthly rent, paid on time, whether or not the unit is occupied (only if the operator is offering this).
- Professional management: the unit kept in better-than-average condition, regular upkeep, a single accountable point of contact.
- Longer minimum stays (30+ day mid-term stays) to cut turnover and virtually eliminate party risk — a strong fear-reducer.
- Appropriate insurance coverage.
- Treating it as a real business with a written plan, screening, and clear house rules.
- Full transparency and getting everything in writing — landlords say yes far more often when the operator is upfront rather than sneaky.

HARD RULES:
- NEVER reveal, state, or hint at the operator's profit, margin, or what they expect to earn. The pitch centers entirely on what the LANDLORD gets. If you catch yourself mentioning the operator's upside, remove it.
- NEVER claim the arrangement is legal or that the city allows it. Instead, propose to confirm local rules together and to write short-term-rental / sublet permission explicitly into the lease.
- Only promise what the operator has actually offered. Do not invent a rent figure, a guarantee, or a term they didn't give you. If a detail is missing, write the pitch so it reads naturally without it (or leave a clearly-marked [bracket] for the operator to fill in).
- Be warm, credible, and concise. No hype, no pressure tactics, no fake urgency. A landlord should feel reassured, not sold.
- This is a DRAFT for the operator to review and send themselves. Do not write as if it has been sent.

Write only the pitch itself in the requested format. Do not add commentary before or after it.`

async function callOpenAI(key: string, userPrompt: string): Promise<string> {
  const models: Array<{ id: string; reasoning: boolean }> = [
    { id: 'gpt-5.5', reasoning: true },
    { id: 'gpt-4o', reasoning: false },
  ]
  const errors: string[] = []
  for (const m of models) {
    try {
      const bodyObj: Record<string, unknown> = {
        model: m.id,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
      }
      if (m.reasoning) { bodyObj.reasoning_effort = 'medium'; bodyObj.max_completion_tokens = 1400 }
      else { bodyObj.max_tokens = 1400 }
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(bodyObj),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error?.message || `openai http ${res.status}`)
      const text = data?.choices?.[0]?.message?.content
      if (text) return text
      throw new Error('empty completion')
    } catch (e) {
      errors.push(`${m.id}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }
  throw new Error(errors.join(' | '))
}

const CHANNEL_FORMAT: Record<string, string> = {
  email: 'Format as a short email: a subject line, then a warm, professional body of 150-220 words. Sign off leaving a [bracket] for the operator name if none was given.',
  text: 'Format as a brief, friendly text message under 90 words — an opener that earns a reply, not the whole pitch.',
  call_script: 'Format as a phone-call script: a natural opening line, 4-6 talking points that address the landlord fears and offer the levers, and a clear ask to move forward.',
  in_person: 'Format as concise in-person talking points the operator can speak from: a one-line opener, the key reassurances as short spoken lines, and a closing ask.',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const {
      city, state, zip_code, beds, baths, monthly_rent,
      modality, channel, operator_name, operator_company, operator_experience,
      landlord_name, landlord_concerns, extra_notes,
    } = body || {}

    const loc = [city, state].filter(Boolean).join(', ') || (zip_code ? `ZIP ${zip_code}` : '')
    if (!loc && !monthly_rent && !modality) {
      return new Response(JSON.stringify({
        success: false,
        error: 'missing_inputs',
        message: 'To draft a landlord pitch I need at least a location (city or ZIP), the rent you are offering the landlord, and the intended use (short-term, mid-term, co-living, or hybrid). The landlord\'s name and any specific concerns make it sharper.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const modalityLabel = ({
      str: 'short-term (nightly) furnished rental',
      mtr: 'mid-term (30+ day) furnished rental',
      coliving: 'co-living (rented by the room)',
      hybrid: 'a flexible mix of mid-term and short-term furnished rental',
    } as Record<string, string>)[String(modality || '').toLowerCase()] || 'furnished rental'

    const ch = CHANNEL_FORMAT[String(channel || 'email').toLowerCase()] ? String(channel || 'email').toLowerCase() : 'email'

    const details: string[] = []
    if (loc) details.push(`Property location: ${loc}${zip_code && (city || state) ? ` (${zip_code})` : ''}.`)
    if (beds) details.push(`Bedrooms: ${beds}${baths ? `, baths: ${baths}` : ''}.`)
    if (monthly_rent) details.push(`Monthly rent the operator is offering the landlord: $${Math.round(Number(monthly_rent))}. Frame this as guaranteed, reliable rent to the landlord — never mention the operator's own economics.`)
    details.push(`Intended use: ${modalityLabel}.`)
    if (String(modality || '').toLowerCase() === 'mtr') details.push('Lean on the fact that 30+ day stays mean stable, vetted, longer-term guests and almost no party risk.')
    if (operator_name) details.push(`Operator's name (for the sign-off): ${operator_name}.`)
    if (operator_company) details.push(`Operator's company: ${operator_company}.`)
    if (operator_experience) details.push(`Operator's relevant experience to establish credibility: ${operator_experience}.`)
    if (landlord_name) details.push(`Address the landlord by name: ${landlord_name}.`)
    if (landlord_concerns) details.push(`The landlord has specifically raised these concerns — address them directly and reassuringly: ${landlord_concerns}.`)
    if (extra_notes) details.push(`Additional context from the operator: ${extra_notes}.`)

    const userPrompt = `Draft a landlord pitch.\n\n${details.join('\n')}\n\n${CHANNEL_FORMAT[ch]}\n\nRemember the hard rules: never reveal the operator's profit or margin; never claim the arrangement is legal — propose confirming local rules and putting written permission in the lease; only promise what is stated above; keep it honest and reassuring.`

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response(JSON.stringify({ success: false, error: 'no_ai', message: 'The pitch generator is not configured right now. Please try again shortly.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let pitch = ''
    try {
      pitch = await callOpenAI(openaiKey, userPrompt)
    } catch (e) {
      console.error('landlord-pitch openai failed:', e)
      return new Response(JSON.stringify({ success: false, error: 'ai_error', message: 'I could not generate the pitch just now. Please try again in a moment.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Code-appended, always-present honesty layer (never left to the model to remember).
    const honesty_reminders = [
      'This is a draft to review and send yourself — nothing has been sent.',
      'Before you sign anything, confirm your city\'s short-term-rental rules and get written permission for subletting / short-term use INTO the lease. Rental arbitrage only works when both the law and the landlord allow it in writing.',
      'Only promise what you can actually deliver — a guarantee you can\'t keep ends the relationship fast.',
      'Keep your own economics out of it; the pitch is about what the landlord gains.',
    ]

    return new Response(JSON.stringify({
      success: true,
      channel: ch,
      modality: modalityLabel,
      pitch,
      honesty_reminders,
      disclaimer: 'Draft for the operator to review and send. Not legal advice. Confirm local regulations and secure written landlord permission before operating.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('landlord-pitch error:', error)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'pitch failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
