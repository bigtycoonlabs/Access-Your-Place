import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }
const ALLOWED_RADII = new Set([10, 25, 50, 100])
const REQUEST_TIMEOUT_MS = 25_000
const MAX_RESPONSE_CHARS = 20_000

const APOLLO_MCP = {
  type: 'url',
  url: 'https://mcp.apollo.io/mcp',
  name: 'apollo',
}

function getAllowedOrigins(): string[] {
  return (Deno.env.get('LEADFORGE_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigins = getAllowedOrigins()
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || ''

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...JSON_HEADERS },
  })
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip)
}

async function authorize(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { userId: data.user.id }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) })
  }

  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const authorized = await authorize(req)
    if (!authorized) return json(req, { error: 'Authentication required' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('[apollo-leadforge] Missing ANTHROPIC_API_KEY')
      return json(req, { error: 'LeadForge is not configured' }, 503)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(req, { error: 'Invalid JSON body' }, 400)

    const zip = sanitizeText((body as Record<string, unknown>).zip, 5)
    const radius = Number((body as Record<string, unknown>).radius)

    if (!isValidZip(zip)) return json(req, { error: 'A valid 5-digit ZIP code is required' }, 400)
    if (!ALLOWED_RADII.has(radius)) return json(req, { error: 'Unsupported search radius' }, 400)

    const prompt = [
      'Analyze the leasing and flexible-housing market for Access Your Place.',
      `Target ZIP code: ${zip}.`,
      `Search radius: ${radius} miles.`,
      'Return one JSON object only with this exact schema:',
      '{"market":"string","category":"string","summary":"string","score":75}',
      'The score must be an integer from 0 to 100. Keep the summary under 900 characters.',
      'Do not include markdown, commentary, credentials, personal data, or any fields not in the schema.',
    ].join('\n')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let anthropicRes: Response
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5',
          max_tokens: 1200,
          mcp_servers: [APOLLO_MCP],
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    } finally {
      clearTimeout(timeout)
    }

    const responseText = (await anthropicRes.text()).slice(0, MAX_RESPONSE_CHARS)
    if (!anthropicRes.ok) {
      console.error('[apollo-leadforge] Provider error', anthropicRes.status, responseText)
      return json(req, { error: 'LeadForge provider request failed' }, 502)
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[apollo-leadforge] Provider returned invalid JSON envelope')
      return json(req, { error: 'LeadForge returned an invalid response' }, 502)
    }

    const content = Array.isArray(data.content) ? data.content : []
    const text = content
      .filter((block): block is { type: string; text: string } => Boolean(block) && typeof block === 'object' && (block as { type?: unknown }).type === 'text' && typeof (block as { text?: unknown }).text === 'string')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!text) return json(req, { error: 'LeadForge returned an empty response' }, 502)

    return json(req, { text })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return json(req, { error: 'LeadForge request timed out' }, 504)
    }

    console.error('[apollo-leadforge] Unhandled error', error)
    return json(req, { error: 'LeadForge request failed' }, 500)
  }
})
