// Fully-qualify app-schema REST calls to the AYP data schema.
// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public'
const originalFetch = globalThis.fetch
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string' ? input : (input?.url?.toString?.() || input?.toString?.() || '')
  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {})
    headers.set('Accept-Profile', DATA_SCHEMA)
    headers.set('Content-Profile', DATA_SCHEMA)
    init = { ...init, headers }
  }
  return originalFetch(input, init)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'Access Your Place <notifications@accessyourplace.com>'
const REPLY_TO = 'success@accessyourplace.com'

const dbH = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
const enc = (v: string) => encodeURIComponent(v)

async function dbGet(table: string, params: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: dbH })
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
async function dbInsert(table: string, row: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { ...dbH, Prefer: 'return=representation' }, body: JSON.stringify(row),
  })
  try { return await res.json() } catch { return null }
}
async function dbPatch(table: string, filter: string, row: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: 'PATCH', headers: { ...dbH, Prefer: 'return=minimal' }, body: JSON.stringify(row),
    })
  } catch { /* best-effort */ }
}

// Call a public-schema RPC, bypassing the forced app-schema profile that the global fetch patch
// puts on every /rest/v1/ call. PostgREST only exposes `public`, so direct app-schema table
// writes/reads fail there; SECURITY DEFINER RPCs in public are the reliable path.
async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const res = await originalFetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(args),
    })
    return await res.json()
  } catch { return null }
}

// Truthful send: returns the real Resend result so we never mark an email as sent when it failed.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], reply_to: REPLY_TO, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

function landlordWelcomeHtml(name: string): string {
  const first = String(name || '').split(' ')[0] || 'there'
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td bgcolor="#1e3a5f" style="background:#1e3a5f;padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
<h1 style="color:#f59e0b;margin:0;font-size:24px;font-family:Arial,Helvetica,sans-serif;">Access Your Place</h1></td></tr>
<tr><td style="padding:32px 40px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<h2 style="color:#1e3a5f;margin:0 0 12px;font-size:20px;">Hi ${first},</h2>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;">Thank you for working with our team. We're getting your property set up so we can match it with qualified, vetted operators looking to run flexible, furnished-housing rentals.</p>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;">Here's what happens next: our Success Team places your property in front of operators who fit it, and <strong>you'll be notified whenever there's interest</strong>. There's no cost to you for this &mdash; operators handle the lease terms directly with you.</p>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;">If you have any questions, just reply to this email or reach our team at <a href="mailto:success@accessyourplace.com" style="color:#1e3a5f;">success@accessyourplace.com</a>.</p>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:18px 0 0;">&mdash; The Access Your Place Team</p></td></tr>
<tr><td style="padding:18px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Set Up Your Place LLC</p></td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json().catch(() => ({}))
    const { action } = body

    // ---- Onboard a THIRD-PARTY SELLER: reuse the proven investor-invitation flow (creates a
    // portal account via a signup link + invite code, with staff attribution). Idempotent. ----
    if (action === 'onboard_seller') {
      const { seller_name, seller_email, staff_id, staff_name } = body
      const email = String(seller_email || '').trim().toLowerCase()
      if (!email) return json({ success: false, error: 'seller_email is required' }, 400)

      const chk = await rpc('penny_seller_onboard_check', { p_email: email })
      if (chk?.has_account || chk?.has_pending_invite) {
        return json({ success: true, already_onboarded: true, email_sent: false, message: 'This seller already has an account or a pending invite — no new email sent.' })
      }

      let inviteResult: Record<string, unknown> = { success: false }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-investor-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ contacts: [{ name: seller_name || 'there', email }], channel: 'email', staff_id: staff_id || null, staff_name: staff_name || null }),
        })
        inviteResult = await res.json()
      } catch (e) {
        inviteResult = { success: false, error: e instanceof Error ? e.message : 'invite failed' }
      }
      const emailSent = Number((inviteResult?.sent as number) || 0) > 0
      return json({ success: true, onboarded: emailSent, email_sent: emailSent, detail: inviteResult })
    }

    // ---- Onboard a LANDLORD / community: ensure a landlords row, send a welcome once, and
    // record the real send result. Idempotent via welcome_email_sent_at. ----
    if (action === 'onboard_landlord') {
      const { landlord_name, landlord_email, landlord_phone, company_name, staff_id } = body
      const email = String(landlord_email || '').trim().toLowerCase()
      if (!email) return json({ success: false, error: 'landlord_email is required' }, 400)

      const r = await rpc('penny_onboard_landlord', {
        p_full_name: landlord_name || null,
        p_email: email,
        p_phone: landlord_phone || null,
        p_company: company_name || null,
        p_staff_id: staff_id || null,
      })
      const landlordId: string | null = r?.landlord_id ?? null
      if (!r?.ok || !landlordId) {
        return json({ success: false, error: 'Could not create or find the landlord record.', detail: r ?? null }, 500)
      }

      if (!r.needs_welcome_email) {
        return json({ success: true, already_onboarded: true, email_sent: false, landlord_id: landlordId, message: 'This landlord was already welcomed — no new email sent.' })
      }

      const emailSent = await sendEmail(email, 'Welcome to Access Your Place', landlordWelcomeHtml(landlord_name || ''))
      if (emailSent) {
        await rpc('penny_mark_landlord_welcomed', { p_landlord_id: landlordId })
      }
      return json({ success: true, onboarded: emailSent, email_sent: emailSent, landlord_id: landlordId })
    }

    return json({ success: false, error: `Unknown action: ${action}`, valid_actions: ['onboard_seller', 'onboard_landlord'] }, 400)
  } catch (error) {
    console.error('[penny-onboard-contact] error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'unknown' }, 500)
  }
})
