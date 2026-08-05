const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT'
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function dealEmailHtml(property: any): string {
  const where = property.market || property.city || 'a new market'
  const beds = property.bedrooms ?? '?'
  const baths = property.bathrooms ?? '?'
  const price = property.asking_price ? `$${Number(property.asking_price).toLocaleString()}` : 'Contact us'
  const addr = property.listing_title || property.address || where
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td bgcolor="#1e3a5f" style="background:#1e3a5f;padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
<h1 style="color:#f59e0b;margin:0;font-size:24px;">Access Your Place</h1></td></tr>
<tr><td style="padding:32px 40px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<h2 style="color:#1e3a5f;margin:0 0 12px;font-size:20px;">A new deal matching your criteria just went live</h2>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 8px;"><strong>${addr}</strong> in ${where}</p>
<p style="color:#475569;line-height:1.7;font-size:15px;margin:0 0 18px;">${beds} bed &middot; ${baths} bath &middot; ${price}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<a href="https://accessyourplace.com/investor/login" style="background:#f59e0b;border-radius:8px;color:#ffffff;display:inline-block;font-size:16px;font-weight:bold;line-height:52px;text-align:center;text-decoration:none;width:260px;">View This Deal</a></td></tr></table>
<p style="color:#94a3b8;line-height:1.6;font-size:13px;margin:20px 0 0;">You're receiving this because it matches your saved deal criteria. Reply or reach us at <a href="mailto:success@accessyourplace.com" style="color:#1e3a5f;">success@accessyourplace.com</a>.</p></td></tr>
<tr><td style="padding:18px;text-align:center;"><p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Set Up Your Place LLC</p></td></tr>
</table></td></tr></table></body></html>`
}

async function sendEmail(resendKey: string, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Access Your Place <notifications@accessyourplace.com>',
        to: [to], reply_to: 'success@accessyourplace.com', subject, html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const propertyId = body.propertyId || body.property_id
    // Staff-supplied exclusions: any investor id or email in this list is skipped entirely.
    const excludeRaw: string[] = Array.isArray(body.exclude) ? body.exclude
      : Array.isArray(body.exclude_emails) || Array.isArray(body.exclude_ids)
        ? [...(body.exclude_emails || []), ...(body.exclude_ids || [])]
        : []
    const excludeSet = new Set(excludeRaw.filter(Boolean).map((v: string) => String(v).trim().toLowerCase()))

    const { data: property, error: propError } = await supabase
      .from('properties').select('*').eq('id', propertyId).single()
    if (propError || !property) throw new Error('Property not found')

    const { data: investors } = await supabase
      .from('investors').select('*').eq('status', 'active')

    let matchingInvestors = (investors || []).filter((inv: any) => {
      const prefs = inv.investment_preferences || {}
      if (prefs.markets?.length && !prefs.markets.includes(property.market)) return false
      if (prefs.max_budget && property.asking_price > prefs.max_budget) return false
      if (prefs.min_budget && property.asking_price < prefs.min_budget) return false
      if (prefs.property_types?.length && !prefs.property_types.includes(property.property_type)) return false
      return true
    })

    // Honor staff exclusions (match on id OR email, case-insensitive).
    const matchedCount = matchingInvestors.length
    if (excludeSet.size > 0) {
      matchingInvestors = matchingInvestors.filter((inv: any) =>
        !excludeSet.has(String(inv.id).toLowerCase()) &&
        !(inv.email && excludeSet.has(String(inv.email).trim().toLowerCase())))
    }
    const excludedCount = matchedCount - matchingInvestors.length

    // In-app notifications for the (non-excluded) matches.
    const notifications = matchingInvestors.map((inv: any) => ({
      investor_id: inv.id,
      type: 'new_deal',
      title: 'New Deal Matching Your Criteria!',
      message: `A new property in ${property.market || property.city} is now available. ${property.bedrooms || '?'} bed, ${property.bathrooms || '?'} bath - $${property.asking_price?.toLocaleString() || 'TBD'}`,
      data: { propertyId, address: property.address, market: property.market, price: property.asking_price },
    }))
    if (notifications.length > 0) {
      await supabase.from('investor_notifications').insert(notifications)
    }

    // Emails — brand-correct sender, and we count only sends that actually succeeded.
    let emailed = 0
    if (resendKey && matchingInvestors.length > 0) {
      const html = dealEmailHtml(property)
      const subject = `New Deal Alert: ${property.market || property.city || 'Access Your Place'}`
      for (const inv of matchingInvestors.slice(0, 25)) {
        if (!inv.email) continue
        const ok = await sendEmail(resendKey, inv.email, subject, html)
        if (ok) emailed++
      }
    }

    await supabase.from('deal_analytics_events').insert({
      event_type: 'deal_published',
      property_id: propertyId,
      market: property.market,
      metadata: { matched: matchedCount, notified: matchingInvestors.length, emailed, excluded: excludedCount },
    })

    return new Response(JSON.stringify({
      success: true,
      matched: matchedCount,
      notified: matchingInvestors.length,
      emailed,
      excluded: excludedCount,
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
