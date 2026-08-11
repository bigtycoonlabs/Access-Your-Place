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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Truthful send: returns the real Resend result so a notification is only ever logged as sent
// when it actually went out.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Penny <penny@accessyourplace.com>',
        to: [to], reply_to: 'success@accessyourplace.com', subject, html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

function interestHtml(recipName: string, listingLabel: string, buyerFirst: string, kind: string, note: string): string {
  const first = String(recipName || '').split(' ')[0] || 'there'
  const noteBlock = note
    ? `<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;"><em>What they said:</em> &ldquo;${note}&rdquo;</p>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td bgcolor="#1e3a5f" style="background:#1e3a5f;padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
<h1 style="color:#f59e0b;margin:0;font-size:24px;font-family:Arial,Helvetica,sans-serif;">Access Your Place</h1></td></tr>
<tr><td style="padding:32px 40px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<h2 style="color:#1e3a5f;margin:0 0 12px;font-size:20px;">Good news, ${first} — there's interest in your listing</h2>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;"><strong>${buyerFirst}</strong> just expressed interest in <strong>${listingLabel}</strong> (${kind}).</p>
${noteBlock}
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 14px;">Our Success Team will reach out shortly to coordinate the next steps — you don't need to do anything right now. If you'd like to get ahead of it, just reply to this email or reach us at <a href="mailto:success@accessyourplace.com" style="color:#1e3a5f;">success@accessyourplace.com</a>.</p>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:18px 0 0;">&mdash; The Access Your Place Team</p></td></tr>
<tr><td style="padding:18px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Set Up Your Place LLC</p></td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { property_id, name, email, phone, message, investment_type } = await req.json()

    if (!property_id || !name || !email) {
      throw new Error('Property ID, name, and email are required')
    }

    const { data, error } = await supabase.from('deal_inquiries').insert({
      property_id,
      investor_name: name,
      investor_email: email,
      investor_phone: phone || null,
      message: message || null,
      investment_type: investment_type || 'general',
      status: 'new',
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) throw error

    // Pinned staff note (unchanged behavior).
    await supabase.from('outreach_notes').insert({
      property_id,
      content: `New inquiry from ${name} (${email}): ${message || 'No message'}`,
      note_type: 'general',
      author_name: 'System',
      is_pinned: true,
    })

    // Notify the listing's owner that there's interest: the third-party seller for a seller deal,
    // otherwise the landlord. Best-effort — the inquiry is already saved — and logged truthfully.
    let owner_notified = false
    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('is_third_party_seller, submitted_by_client_name, submitted_by_client_email, landlord_name, landlord_email, listing_title, title, community_name, address, city, state')
        .eq('id', property_id)
        .single()
      if (prop) {
        const isSeller = !!prop.is_third_party_seller && !!prop.submitted_by_client_email
        const recipEmail: string | null = isSeller ? prop.submitted_by_client_email : prop.landlord_email
        const recipName: string = (isSeller ? prop.submitted_by_client_name : prop.landlord_name) || 'there'
        const role = isSeller ? 'Seller' : 'Landlord'
        if (recipEmail) {
          const label = prop.listing_title || prop.title || prop.community_name ||
            [prop.address, prop.city, prop.state].filter(Boolean).join(', ') || 'your listing'
          const buyerFirst = String(name || '').split(' ')[0] || 'Someone'
          const sent = await sendEmail(recipEmail, 'New interest in your listing', interestHtml(recipName, label, buyerFirst, investment_type || 'general', message || ''))
          owner_notified = sent
          await supabase.from('outreach_notes').insert({
            property_id,
            content: `${role} ${recipName} ${sent ? 'notified' : 'NOT notified (email failed)'} of interest from ${name}.`,
            note_type: 'general',
            author_name: 'System',
            is_pinned: false,
          })
        }
      }
    } catch (_) {
      // Non-fatal: the inquiry itself is saved; owner notification is a bonus.
    }

    return new Response(JSON.stringify({ success: true, inquiry: data, owner_notified }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
