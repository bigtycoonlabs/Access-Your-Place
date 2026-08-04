// operator-memory — Penny's durable, per-operator memory service.
//
// Penny should feel like an operator's actual advisor: she should remember their markets, their
// strategy, the units they run, their budget and goals — instead of re-asking every session. This
// service is the store and the brain for that memory. Penny's chat surface reads it at the start of
// a turn (to tailor advice) and hands it a conversation snippet at the end (to enrich it).
//
// HONESTY + PRIVACY (the whole point):
//   - The extraction records ONLY what the operator actually stated or clearly implied about
//     themselves/their business. It never invents or guesses a fact — a made-up "you operate 4 units
//     in Dallas" is exactly the fabrication that must never happen, worse in a paid product a blind
//     founder can't visually audit. If nothing durable was shared, memory is returned unchanged.
//   - Memory is private per operator. The table has RLS on with no policies, so only the service role
//     touches it. Every database action here requires the service-role key; a frontend can never read
//     or write another operator's memory through this function.
//   - Penny uses memory to TAILOR, not to make completion claims. She never announces "I saved that";
//     she simply remembers next time. So there's no false-action surface here.
//
// Actions:
//   extract  { conversation, existing_memory? }  -> model extraction + safe merge, NO database.
//                                                   Anon-safe (pure function of its inputs); this is
//                                                   the piece whose quality is worth testing directly.
//   get      { user_id }                          -> read stored memory.            [service role]
//   remember { user_id, conversation }            -> get + extract + persist merge.  [service role]
//   set      { user_id, memory }                  -> overwrite stored memory.        [service role]
//   merge    { user_id, patch }                   -> shallow-merge a patch.          [service role]
//   clear    { user_id }                          -> reset to empty.                 [service role]

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTRACT_SYSTEM = `You maintain a durable memory profile about a furnished-rental OPERATOR, for their assistant Penny at Access Your Place. Given the operator's existing memory and a recent conversation snippet, return the COMPLETE updated memory as a single JSON object.

Record only durable, useful facts the operator actually stated or clearly implied about THEMSELVES or THEIR business, under these keys (include a key only if there is something real to put in it):
- markets: array of cities, areas, or ZIPs they operate in or are actively targeting.
- strategies: array drawn from "short-term", "mid-term", "co-living", "corporate".
- portfolio: a brief description of the properties or units they currently operate.
- budget: their stated capital or furnishing budget.
- experience: their experience level or relevant background.
- goals: what they are trying to achieve.
- notes: array of other durable facts worth remembering long-term (max 20).

HARD RULES:
- NEVER invent, assume, or guess a fact. If it was not actually stated or clearly implied, do not add it. An invented fact is worse than an empty field.
- PRESERVE existing facts unless the operator corrected them; carry them forward in your output.
- Do NOT record transient one-off questions, the specifics of a single deal they're just asking about, or anything not durably about the operator.
- Keep every value concise.
- Return ONLY the JSON object — no explanation, no markdown, no code fences.`

function formatConversation(conversation: unknown): string {
  if (typeof conversation === 'string') return conversation.slice(0, 6000)
  if (Array.isArray(conversation)) {
    return conversation
      .slice(-12)
      .map((m: any) => `${(m?.role || 'user')}: ${String(m?.content ?? '')}`)
      .join('\n')
      .slice(0, 6000)
  }
  return ''
}

// Keep memory bounded and clean: cap notes, drop empties, and hard-cap total size.
function sanitizeMemory(mem: any): Record<string, unknown> {
  if (!mem || typeof mem !== 'object' || Array.isArray(mem)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(mem)) {
    if (v == null) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'string' && !v.trim()) continue
    out[k] = v
  }
  if (Array.isArray(out.notes)) out.notes = (out.notes as unknown[]).slice(-20)
  // Hard size cap: if oversized, trim notes first, then give up gracefully to existing shape.
  let s = JSON.stringify(out)
  while (s.length > 6000 && Array.isArray(out.notes) && (out.notes as unknown[]).length > 0) {
    ;(out.notes as unknown[]).shift()
    s = JSON.stringify(out)
  }
  return out
}

async function extractMemory(conversation: unknown, existing: any): Promise<Record<string, unknown>> {
  const key = Deno.env.get('OPENAI_API_KEY')
  const existingClean = sanitizeMemory(existing)
  const convo = formatConversation(conversation)
  if (!key || !convo.trim()) return existingClean

  const userPrompt = `EXISTING MEMORY:\n${JSON.stringify(existingClean)}\n\nRECENT CONVERSATION:\n${convo}\n\nReturn the complete updated memory JSON.`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: EXTRACT_SYSTEM }, { role: 'user', content: userPrompt }],
        max_tokens: 800,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })
    const data = await res.json()
    if (!res.ok || data?.error) throw new Error(data?.error?.message || `openai http ${res.status}`)
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('empty extraction')
    let parsed: any
    try { parsed = JSON.parse(text) }
    catch { parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim()) }
    // Safety net: shallow-merge model output OVER existing, so an omitted category can never be lost.
    return sanitizeMemory({ ...existingClean, ...(parsed && typeof parsed === 'object' ? parsed : {}) })
  } catch (e) {
    console.error('operator-memory extract failed:', e)
    return existingClean // never fabricate; on failure keep what we had
  }
}

// --- Database access (service role only; identical PostgREST pattern to ai_chat_sessions) ---
const SB_URL = Deno.env.get('SUPABASE_URL')!
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TABLE = 'penny_operator_memory'

async function dbGet(userId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${SB_URL}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=memory`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
  })
  if (!res.ok) return {}
  const rows = await res.json()
  return Array.isArray(rows) && rows[0]?.memory ? rows[0].memory : {}
}

async function dbUpsert(userId: string, memory: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SB_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ user_id: userId, memory, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`db upsert http ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) && rows[0]?.memory ? rows[0].memory : memory
}

function isTrusted(req: Request): boolean {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  return !!SVC && token === SVC
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '').toLowerCase()

    // extract — pure function of inputs, no database, no cross-operator data. Anon-safe + testable.
    if (action === 'extract') {
      const memory = await extractMemory(body?.conversation, body?.existing_memory)
      return json({ success: true, memory })
    }

    // Everything below reads or writes the store: trusted server callers only.
    if (!isTrusted(req)) {
      return json({ success: false, error: 'unauthorized', message: 'This memory action requires a trusted server credential.' }, 401)
    }

    const userId = String(body?.user_id || '').trim()
    if (!userId) return json({ success: false, error: 'user_id required' }, 400)

    if (action === 'get') {
      return json({ success: true, memory: sanitizeMemory(await dbGet(userId)) })
    }

    if (action === 'remember') {
      const existing = await dbGet(userId)
      const updated = await extractMemory(body?.conversation, existing)
      const saved = await dbUpsert(userId, updated)
      return json({ success: true, memory: saved })
    }

    if (action === 'set') {
      const saved = await dbUpsert(userId, sanitizeMemory(body?.memory))
      return json({ success: true, memory: saved })
    }

    if (action === 'merge') {
      const existing = await dbGet(userId)
      const merged = sanitizeMemory({ ...existing, ...(body?.patch && typeof body.patch === 'object' ? body.patch : {}) })
      const saved = await dbUpsert(userId, merged)
      return json({ success: true, memory: saved })
    }

    if (action === 'clear') {
      const saved = await dbUpsert(userId, {})
      return json({ success: true, memory: saved })
    }

    return json({ success: false, error: 'unknown_action', valid_actions: ['extract', 'get', 'remember', 'set', 'merge', 'clear'] }, 400)

  } catch (error: any) {
    console.error('operator-memory error:', error)
    return json({ success: false, error: error?.message || 'operator-memory failed' }, 500)
  }
})
