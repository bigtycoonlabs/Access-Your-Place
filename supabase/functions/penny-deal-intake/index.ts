import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Msg = { role: string; content: unknown }
type Tool = { name: string; description: string; input_schema: Record<string, unknown> }

// Penny's staff-side deal-intake brain. She structures + validates a deal from the story the
// team tells her, submits it as a DRAFT through the proven am-submit-deal pipeline, and — only
// after the staff confirm — sends the seller/landlord onboarding email. She never invents numbers.
const SYSTEM = `You are Penny, helping a STAFF member (Success Team or Acquisition Manager) list a deal on Access Your Place just by talking to you and sending photos. Turn the address, photos, and the deal story into a clean, structured listing — and VALIDATE the team's numbers before it is saved.

RULES:
- Draft-first: whatever you submit is saved as a DRAFT that is NOT public. A staff member reviews and publishes it. So move fast, but be accurate. Never say a deal is verified, approved, or live — it is a draft pending staff review.
- Validate, never invent: sanity-check that asking price, monthly revenue, expenses, ADR, occupancy, room rate, and rent hang together. If a number looks off, say so. If a figure was not given, do NOT guess it — either ask, or leave it out and flag it. Never fabricate or inflate a number.
- Identify the source. THIRD-PARTY SELLER = someone selling their existing operation or an assignable lease (set is_third_party_seller true and capture the seller's name/email in seller_name/seller_email). LANDLORD / community deal = a property owner we work with (is_third_party_seller false). Either way, capture the landlord or master-lease contact (name + phone or email).
- Required before you submit: street address, city, state, ZIP, asking price, monthly revenue, operation type, a landlord/master-lease name with a phone or email, and at least one photo. If anything required is missing, ask the staff member for exactly what's missing — one or two clear asks at a time, easy to read aloud. Do not call submit_structured_deal until you have them.
- When you have everything, call submit_structured_deal. Fill validation_summary with your honest read of whether the numbers make sense, and verification_flags with what still needs proof (lease, landlord call, financials, photos).

AFTER a draft is saved: tell the staff member it's saved as a draft (not public), give a one-line read on the numbers and what still needs verifying, then OFFER to send the onboarding email — to the seller (for a third-party-seller deal) or to the landlord — and wait. Only call onboard_contact once the staff member confirms they want it sent. To onboard someone you need their name and email; if you don't have the email, ask for it. Never send an onboarding email on your own initiative — always offer and wait for a yes. When a deal is later published and surfaced to operators, staff can tell you to leave specific people out of that outreach — honor that.
Keep replies short and speakable.`

const SUBMIT_TOOL: Tool = {
  name: 'submit_structured_deal',
  description: 'Submit the deal as a DRAFT once all required fields are gathered and the numbers have been sanity-checked. Creates a non-public draft that staff review and publish.',
  input_schema: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Street address' },
      city: { type: 'string' },
      state: { type: 'string', description: 'Two-letter state code' },
      zip_code: { type: 'string' },
      operation_type: { type: 'string', enum: ['str', 'mtr', 'corporate', 'co_living', 'sober_living', 'group_home', 'other'], description: 'Operation model' },
      asking_price: { type: 'number', description: 'Asking price in dollars' },
      monthly_revenue: { type: 'number', description: 'Current or projected monthly revenue in dollars' },
      monthly_rent: { type: 'number', description: 'Monthly lease rent paid to the landlord' },
      bedrooms: { type: 'number' },
      bathrooms: { type: 'number' },
      sqft: { type: 'number' },
      property_type: { type: 'string', description: 'e.g. single_family, apartment, multi_unit' },
      is_third_party_seller: { type: 'boolean', description: 'True if a third-party seller is selling their existing operation/lease; false for a landlord/community deal' },
      seller_name: { type: 'string', description: 'Third-party seller name (only when is_third_party_seller is true)' },
      seller_email: { type: 'string', description: 'Third-party seller email (only when is_third_party_seller is true)' },
      landlord_name: { type: 'string', description: 'Landlord or master-lease holder name' },
      landlord_email: { type: 'string' },
      landlord_phone: { type: 'string' },
      community_name: { type: 'string' },
      listing_title: { type: 'string' },
      listing_description: { type: 'string' },
      adr_peak_season: { type: 'number' },
      adr_slow_season: { type: 'number' },
      monthly_room_rate: { type: 'number' },
      avg_occupancy_rate: { type: 'number', description: 'Average occupancy as a percent, e.g. 72' },
      projected_yearly_revenue: { type: 'number' },
      deposits_concessions_notes: { type: 'string', description: 'Any deposits or special lease provisions the operator would pay the landlord' },
      validation_summary: { type: 'string', description: 'Your honest read on whether the numbers hang together' },
      verification_flags: { type: 'array', items: { type: 'string' }, description: 'What still needs proof before publish' },
      notes: { type: 'string', description: 'Any other internal notes' },
    },
    required: ['address', 'city', 'state', 'zip_code', 'operation_type', 'asking_price', 'monthly_revenue', 'landlord_name'],
  },
}

const ONBOARD_TOOL: Tool = {
  name: 'onboard_contact',
  description: "Send an onboarding email to the deal's third-party seller or landlord. ONLY call this after the staff member has explicitly confirmed they want it sent. Requires the contact's name and email.",
  input_schema: {
    type: 'object',
    properties: {
      contact_type: { type: 'string', enum: ['seller', 'landlord'], description: 'seller for a third-party-seller deal, landlord for a landlord/community deal' },
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string', description: 'Landlord phone (optional)' },
      company_name: { type: 'string', description: 'Landlord company/community name (optional)' },
    },
    required: ['contact_type', 'name', 'email'],
  },
}

async function callClaude(key: string, messages: Msg[], tools?: Tool[]): Promise<{ content: unknown[]; stop: string }> {
  const payload: Record<string, unknown> = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    system: SYSTEM,
    messages,
  }
  if (tools && tools.length) payload.tools = tools
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `anthropic http ${res.status}`)
  return { content: Array.isArray(data?.content) ? data.content : [], stop: data?.stop_reason || '' }
}

function textOf(content: unknown[]): string {
  return content
    .filter((b): b is { type: string; text: string } => (b as { type?: string })?.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_KEY) {
      return json({ success: false, error: 'AI not configured', message: "I can't reach my reasoning engine right now — please try again in a moment." })
    }

    const body = await req.json()
    const { message, conversation_history, staff_id, staff_name, photo_urls } = body
    if (!message) return json({ success: false, error: 'message is required' }, 400)
    const photos: string[] = Array.isArray(photo_urls) ? photo_urls.filter((p: string) => p && String(p).trim()) : []

    const messages: Msg[] = []
    if (Array.isArray(conversation_history)) {
      for (const m of conversation_history.slice(-12)) messages.push({ role: m.role, content: m.content })
    }
    messages.push({ role: 'user', content: photos.length ? `${message}\n\n[${photos.length} photo(s) attached and ready to include]` : message })

    // First pass — Penny asks for what's missing, submits the draft, or (on confirmation) onboards.
    const first = await callClaude(ANTHROPIC_KEY, messages, [SUBMIT_TOOL, ONBOARD_TOOL])
    const toolUse = first.content.find(
      (b): b is { type: string; id: string; name: string; input: Record<string, unknown> } =>
        (b as { type?: string })?.type === 'tool_use',
    )

    if (!toolUse) {
      return json({ success: true, created: false, message: textOf(first.content) || "Tell me the address, the deal story, and attach a few photos, and I'll get it structured." })
    }

    let toolResult: Record<string, unknown> = {}
    let createdPropertyId: string | null = null
    let didCreate = false
    let didOnboard = false

    if (toolUse.name === 'submit_structured_deal') {
      if (photos.length === 0) {
        return json({ success: true, created: false, needs_photos: true, message: "I've got the details — I just need at least one photo of the property before I can save the draft. Upload a photo or two and I'll finish it." })
      }
      const p = toolUse.input
      const flags = Array.isArray(p.verification_flags) ? (p.verification_flags as string[]) : []
      const noteParts = [
        p.validation_summary ? `[Penny validation] ${p.validation_summary}` : '',
        flags.length ? `[Needs verification] ${flags.join('; ')}` : '',
        p.notes ? String(p.notes) : '',
      ].filter(Boolean)

      const submitPayload: Record<string, unknown> = {
        action: 'submit_deal',
        address: p.address, city: p.city, state: p.state, zip_code: p.zip_code,
        operation_type: p.operation_type, asking_price: p.asking_price, monthly_revenue: p.monthly_revenue,
        monthly_room_rate: p.monthly_room_rate ?? null,
        bedrooms: p.bedrooms ?? null, bathrooms: p.bathrooms ?? null, sqft: p.sqft ?? null,
        property_type: p.property_type ?? null,
        photos,
        landlord_name: p.landlord_name ?? null, landlord_email: p.landlord_email ?? null, landlord_phone: p.landlord_phone ?? null,
        community_name: p.community_name ?? null,
        is_third_party_seller: !!p.is_third_party_seller,
        submitted_by_type: 'acquisition_manager',
        submitted_by_staff_id: staff_id ?? null, submitted_by_staff_name: staff_name ?? null,
        submitted_by_client_name: p.seller_name ?? null, submitted_by_client_email: p.seller_email ?? null,
        listing_title: p.listing_title ?? null, listing_description: p.listing_description ?? null,
        adr_peak_season: p.adr_peak_season ?? null, adr_slow_season: p.adr_slow_season ?? null,
        avg_occupancy_rate: p.avg_occupancy_rate ?? null, projected_yearly_revenue: p.projected_yearly_revenue ?? null,
        deposits_concessions_notes: p.deposits_concessions_notes ?? null,
        notes: noteParts.join('\n') || null,
      }

      let submitResult: Record<string, unknown>
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/am-submit-deal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify(submitPayload),
        })
        submitResult = await res.json()
      } catch (e) {
        submitResult = { success: false, error: e instanceof Error ? e.message : 'submit failed' }
      }
      didCreate = submitResult?.success === true
      createdPropertyId = (submitResult?.property_id ?? submitResult?.id ?? null) as string | null
      toolResult = {
        submitted: didCreate,
        property_id: createdPropertyId,
        is_draft: didCreate,
        validation_errors: submitResult?.validation_errors ?? null,
        error: didCreate ? null : (submitResult?.error ?? 'submission failed'),
      }
    } else if (toolUse.name === 'onboard_contact') {
      const inp = toolUse.input
      const isLandlord = inp.contact_type === 'landlord'
      const onboardPayload = isLandlord
        ? { action: 'onboard_landlord', landlord_name: inp.name, landlord_email: inp.email, landlord_phone: inp.phone ?? null, company_name: inp.company_name ?? null, staff_id: staff_id ?? null, staff_name: staff_name ?? null }
        : { action: 'onboard_seller', seller_name: inp.name, seller_email: inp.email, staff_id: staff_id ?? null, staff_name: staff_name ?? null }
      let onboardResult: Record<string, unknown>
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/penny-onboard-contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify(onboardPayload),
        })
        onboardResult = await res.json()
      } catch (e) {
        onboardResult = { success: false, error: e instanceof Error ? e.message : 'onboarding failed' }
      }
      didOnboard = onboardResult?.email_sent === true
      toolResult = {
        contact_type: inp.contact_type,
        email_sent: onboardResult?.email_sent ?? false,
        already_onboarded: onboardResult?.already_onboarded ?? false,
        error: onboardResult?.success ? null : (onboardResult?.error ?? 'onboarding failed'),
      }
    } else {
      return json({ success: true, created: false, message: textOf(first.content) || "Let me know how you'd like to proceed." })
    }

    // Let Penny explain the result to the staff member (confirmation, next step, or a fix).
    const followupMessages: Msg[] = [
      ...messages,
      { role: 'assistant', content: first.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] },
    ]
    const second = await callClaude(ANTHROPIC_KEY, followupMessages)

    return json({
      success: true,
      created: didCreate,
      onboarded: didOnboard,
      property_id: createdPropertyId,
      message: textOf(second.content) || (didCreate
        ? "Draft saved. It's not public yet — a staff member can review and publish it. Want me to send the onboarding email?"
        : didOnboard
          ? "Onboarding email sent."
          : "Done. Let me know what's next."),
    })
  } catch (error) {
    console.error('[penny-deal-intake] error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'unknown', message: "Something went wrong on my end — please try again." }, 500)
  }
})
