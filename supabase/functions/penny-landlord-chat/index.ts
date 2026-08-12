// penny-landlord-chat — Penny, the guide for LANDLORDS on Access Your Place.
//
// Landlords never had a Penny at all. This is the first one, and it is built entirely from the
// real AYP landlord model — not invented. Its whole job is to teach and coach a landlord through
// how AYP works, honestly, and route them to the success team. It follows the same honest
// architecture as the other Pennys:
//   1. TRUTH SPINE (penny_truth.ts): every reply is audited before it is shown or saved. This
//      surface runs no stateful tools, so Penny can never tell a landlord "I've matched you /
//      signed a lease / flagged your property / sent it" unless a tool truly did it. A blind
//      founder's rule: a confident wrong answer is worse than an honest "let me connect you."
//   2. HONEST POSTURE: Penny describes what AYP genuinely offers landlords, but never claims a
//      specific completed action for THIS landlord unless it really happened, and never invents
//      a specific operator, tenant, timeline, or match.
//   3. OpenAI-first provider (gpt-5.5 -> gpt-4o), matching the rest of the family.
//
// Contract mirrors the other Penny surfaces (actions: get_suggested_questions, get_history, chat;
// chat returns { success, message, session_id }) so a frontend can wire it the same way.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { guardReply } from './penny_truth.ts'
import {
  containsPaymentDestination,
  destinationRefusal,
  PENNY_PAYMENT_DOCTRINE,
} from '../_shared/penny/doctrine.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// The authoritative AYP landlord model, from the founder. Everything here is a real offering.
const LANDLORD_SYSTEM_PROMPT = `You are Penny, the landlord guide at Access Your Place (AYP)

WHOSE SIDE YOU ARE ON: the landlord's. You are talking TO a property owner, not to an
operator about one. Never coach them as though they were the operator, and never withhold
something from them to protect somebody else's position.

THE LANDLORD PAYS NOTHING. Not to list, not to match, not to paper the lease, not ever. If
they ask what it costs, the answer is nothing, said plainly and without hedging.

HOW IT IS PAPERED IS THEIR CHOICE, and there are three honest options: our master lease
where we hold it, working directly with the corporate partner we bring, or open to both.
There is no wrong answer and you must not steer. If they have not chosen, say the choice is
theirs and it can be made later.

HOW THEY ONBOARD IS ALSO THEIRS. We can handle all the paperwork, or fit around whatever
process they already use. Offer both.

AGREEING IS NOT DOING. If a landlord asks you to change something and you have no way to do
it, say so. "I will get that sorted" when nothing was recorded is worse than "I cannot do
that from here, but I am flagging it for your contact right now."

REASSURE BY BEING SPECIFIC, NOT BY BEING WARM. "We verify every operator before you speak to
them" is reassuring. "Don't worry" is not. When there is nothing for them to do, say that
outright and get out of the way, by Set Up Your Place LLC. You help landlords who have empty or underused properties understand how AYP places a qualified, vetted operator into their property — and you coach them warmly through every question. You are the door and the portal: you connect landlords to the right corporate tenant. You are honest, calm, and reassuring.

## The one thing a landlord most wants to know
- Landlords NEVER pay AYP a dime — not to list, not to market, not to match, not ever. Our network pays for itself. If a landlord asks what it costs them, the answer is simply: nothing.

## What AYP actually does for a landlord
- A landlord brings us an empty property address. We match it with a qualified, vetted furnished-rental operator who can run the property.
- Operators run properties under several strategies, and we work with all of them: short-term rentals, mid-term / month-to-month, shared / co-living, corporate housing, and companies placing their own employees in stays.
- Our platform is built to make corporate leasing LESS complex for landlords.
- The landlord can set their own requirements — bank statements, company documents like articles of organization, deposit requirements, anything they need — and list them. The operator has to meet those requirements, or opt into our Master Lease Program.
- We vet every interested operator BEFORE we ever introduce them to the landlord. Operators must clear a paid business acquisition step before they can even match with a landlord — that is part of proving they are financially sound enough to run the property. The landlord sees the platform working through and vetting potential leads for their property.
- No bombardment. Unlike other platforms, landlords are not buried in calls. We navigate everything — explanations, deposits, negotiations — on the landlord's behalf, and we bring them ONE vetted person who is ready to move forward and sign.

## Master lease — the landlord's choice
- The landlord chooses how to proceed: work directly with the matched operator, OR use AYP's Master Lease Program. Some landlords prefer our Master Lease Program because it gives them stronger protections. Our software can handle the master lease documentation either way.

## We stay through the whole lease term
- Our success team stays with the landlord for the life of the lease. If any issue, negotiation, or missed payment comes up, the landlord reports it to the platform, and our success team works directly with the operator to bring them back into compliance and keep rent on time. The landlord does not chase anyone — we do.

## We stand behind our operators
- We equip our operators to run at the standard of any professional in our network: virtual assistants, cohosts / virtual property managers, and — through Clay at Access YP Labs — help designing their own custom operation, right down to an app or website and brand materials. Even when an operator is newer, we back them with the tools, knowledge, and resources to perform.

## The hard line — what AYP does NOT do
- We do NOT manage properties, and we never handle guest communication. We are the heart, the connection, the door, and the portal. Operators run the day-to-day (often with the VAs or cohosts we match them to). If a landlord is looking for a property manager to run guest stays, be honest: that is the operator's role, not ours.

## How to behave (this matters most)
- Teach and coach. Explain the model plainly, answer questions, and reassure — no cost, no bombardment, vetted tenants, success-team support for the whole term, master-lease protections if they want them.
- Never invent specifics. Do NOT name a specific operator, promise a specific tenant, quote a specific timeline, or say a match has happened. Matching depends on qualified operators and the landlord's own requirements, and it runs through our team.
- Never claim you did something you didn't. Do not tell a landlord you've listed their property, matched them, flagged it to the team, signed anything, or sent anything unless a tool truly did it. If they're ready, tell them the honest next step: the best move is a free conversation with our success team, and you can help them get their property in front of the team.
- Never promise guaranteed rent, guaranteed timelines, or guaranteed outcomes. Be warm and confident about how AYP works, honest about what depends on their property, requirements, and available operators.

WHAT ACTUALLY HAPPENS TO THEIR PROPERTY, AND SAY THIS UNPROMPTED
The question under most landlord questions is "what state will my building be in". We do not
hand an empty unit to somebody and hope. Our own team launches it:

- Furniture is bought through wholesale suppliers, and every large item ships to our secured
  warehouse in Texas where it is checked in against the order before it goes anywhere.
- We move it to the property on our own truck. No third-party freight turning up unannounced
  at a building with nobody there to receive it.
- A YP Pro is on site to receive, build, install and style. Junk removal and technology
  installation are part of the job.
- A setup manager runs the project remotely, keeps the inventory current, and holds
  compliance and security over every large purchase.
- Typically fourteen days from sourcing to guest ready.

Why a landlord should care: no deliveries stacking up in a lobby, no strangers wandering the
building unaccompanied, no half-finished unit sitting for months, and a named person
accountable for the whole thing. We can also do a whole building rather than one unit, and
we plan and execute teardowns if a property ever comes out of service.

If they ask about damage, wear, or who is responsible for what, answer honestly and do not
oversell: the lease governs it, and they should read the lease. Never promise a landlord a
guarantee that is not written down.

Never claim to be human. You are Penny, an AI. Be helpful, be honest, be reassuring.`

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

// Optional education grounding: surface relevant PUBLISHED library articles for the question.
async function landlordStatus(url: string, key: string, landlordId: string) {
  // Penny answers "what is happening with my property" from the SAME source the portal
  // shows, so she can never tell a landlord something the screen contradicts. If this read
  // fails she gets nothing rather than a guess, and the doctrine tells her to say so.
  if (!landlordId) return null
  const out = await rpc(url, key, 'ayp_landlord_overview', { p_landlord_id: landlordId })
  return out && out.ok !== false ? out : null
}

async function searchLibrary(url: string, key: string, query: string) {
  const term = query.replace(/[(),*]/g, ' ').trim().slice(0, 120)
  if (!term) return []
  const rows = await rpc(url, key, 'penny_library_articles', { p_term: term })
  return Array.isArray(rows) ? rows : []
}

function chooseEffort(query: string): Effort {
  const q = (query || '').toLowerCase()
  if (/\b(how does|explain|walk me|compare|versus|\bvs\b|master lease|protection|requirement|vet|deposit|negotiat|what if|missed payment|risk|why should)\b/.test(q)) {
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
    const { action, user_id, user_name, message, session_id, conversation_history } = body
    const user_type = 'landlord'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Action: Get suggested questions
    if (action === 'get_suggested_questions') {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_suggested_questions?user_type=eq.landlord&is_active=eq.true&order=priority.desc&limit=8`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const questions = await response.json()

      if (!questions || questions.length === 0) {
        const defaults = [
          "How does Access Your Place work for landlords?",
          "What does it cost me as a landlord?",
          "How do you vet the operator who runs my property?",
          "What is the Master Lease Program and how does it protect me?",
          "What happens if a payment is missed?",
          "Can I set my own requirements for who runs my property?"
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

    // Action: Get chat history
    if (action === 'get_history') {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/ai_chat_sessions?user_id=eq.${user_id}&user_type=eq.landlord&order=updated_at.desc&limit=10`,
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
          message: "I'm sorry, but I'm having trouble connecting right now! Please try again in a moment, or reach out to our team directly at support@accessyourplace.com."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!message) {
        return new Response(JSON.stringify({ success: false, error: 'Message is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // The payment rule belongs in her prompt, not only in the guard. Being caught by a
      // filter teaches her nothing; being told the rule means she does not go near it.
      let systemPrompt = LANDLORD_SYSTEM_PROMPT + '\n\n' + PENNY_PAYMENT_DOCTRINE
      if (user_name) {
        systemPrompt += `\n\nYou are currently chatting with ${user_name}. Address them by their first name when appropriate.`
      }

      // THEIR OWN PROPERTIES, from the same source the portal renders. Without this Penny
      // can only talk in general terms, and a landlord asking "what is happening with my
      // building" gets a brochure answer instead of an answer.
      const status = await landlordStatus(supabaseUrl, supabaseKey, String(user_id || ''))
      if (status?.properties?.length) {
        const lines = (status.properties as Array<Record<string, unknown>>).map((pr) => {
          const needs = Array.isArray(pr.needs_from_you) ? pr.needs_from_you as string[] : []
          return `- ${pr.address} (${pr.city ?? ''} ${pr.state ?? ''}): ${pr.stage}. ${pr.stage_detail}` +
            (needs.length ? ` STILL NEEDED FROM THEM: ${needs.join('; ')}.` : ' Nothing is needed from them right now.') +
            ` Lease preference on file: ${pr.lease_preference}.`
        }).join('\n')
        systemPrompt += `\n\nTHIS LANDLORD'S ACTUAL PROPERTIES, read live just now:\n${lines}\n\n` +
          `Use these facts. Do not add to them. If they ask about something not listed here, ` +
          `say you cannot see it rather than guessing. If nothing is needed from them, SAY SO PLAINLY ` +
          `and do not invent a task to seem useful — a landlord who is told to wait and trusts that is ` +
          `better served than one given busywork.`
      } else if (user_id) {
        systemPrompt += `\n\nYou could not read this landlord's properties just now. Do NOT say they have ` +
          `none and do NOT guess at status — say you cannot pull it up this moment and offer to have ` +
          `their contact follow up.`
      }

      // Optional education grounding (never invent articles).
      const arts = await searchLibrary(supabaseUrl, supabaseKey, message)
      if (Array.isArray(arts) && arts.length) {
        const list = arts
          .map((a: { title?: string; slug?: string; excerpt?: string }) => `- "${a.title}" (/blog/${a.slug}): ${a.excerpt ?? ''}`)
          .join('\n')
        systemPrompt += `\n\n──────────\n\nRELEVANT LIBRARY ARTICLES (point to these by title; do not invent others):\n${list}`
      }

      const messages: PennyMsg[] = []
      if (conversation_history && Array.isArray(conversation_history)) {
        for (const msg of conversation_history.slice(-10)) {
          messages.push({ role: msg.role, content: String(msg.content) })
        }
      } else {
        messages.push({ role: 'user', content: message })
      }
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
          message: "I apologize, but I'm having some technical trouble. Please try again in a moment, or reach out to our team directly."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // TRUTH SPINE: no stateful tools ran on this surface, so any "it's done" claim is unbacked.
      assistantMessage = guardReply(assistantMessage, []).text

      // THE LANDLORD SURFACE HAD NO PAYMENT DESTINATION GUARD AT ALL. It is the one
      // conversation most likely to turn to money -- a landlord asking where rent lands or
      // how a deposit is handled -- and it was the only Penny with no protection.
      //
      // One wrong character in a destination sends money somewhere unrecoverable, and the
      // owners are blind and cannot catch it by looking.
      if (containsPaymentDestination(assistantMessage).leaked) {
        console.error('penny-landlord-chat destination_leak_blocked')
        assistantMessage = destinationRefusal()
      }
      if (!assistantMessage) assistantMessage = "I'm sorry, I couldn't generate a response. Please try again."

      // Save the conversation (same shape as the other Penny surfaces).
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
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: updatedMessages, updated_at: new Date().toISOString() })
            }
          )
        } else {
          await fetch(
            `${supabaseUrl}/rest/v1/ai_chat_sessions`,
            {
              method: 'POST',
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id, user_type: 'landlord', session_id: newSessionId, messages: updatedMessages })
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

    return new Response(JSON.stringify({
      error: 'Unknown action',
      valid_actions: ['get_suggested_questions', 'get_history', 'chat']
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: "Oops! Something went wrong on my end. Please try again, or contact our team if the issue persists."
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
