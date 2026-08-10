import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const body = await req.json()
    const { action } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (action === 'get_templates') {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/report_templates?order=created_at.desc`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const templates = await response.json()
      return new Response(JSON.stringify({ templates: templates || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (action === 'save_template') {
      const { id, name, description, sections, colors, branding, data_points, is_default_weekly, is_default_monthly, is_active } = body
      const templateData = { name, description, sections, colors, branding, data_points, is_default_weekly, is_default_monthly, is_active }
      
      if (id) {
        await fetch(`${supabaseUrl}/rest/v1/report_templates?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(templateData)
        })
      } else {
        await fetch(`${supabaseUrl}/rest/v1/report_templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(templateData)
        })
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (action === 'delete_template') {
      const { template_id } = body
      await fetch(`${supabaseUrl}/rest/v1/report_templates?id=eq.${template_id}`, {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const H = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }
    const J = (b: unknown, st = 200) => new Response(JSON.stringify(b),
      { status: st, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // ---- ADDED 9 Aug 2026 ----
    //
    // market_report_schedules and the widget tables already existed. get_widget_settings
    // returns SETTINGS — which widgets somebody has turned on. get_dashboard_data is the
    // actual figures behind them, a different thing, so this is not a rename.

    if (action === 'get_schedule') {
      const { investor_id } = body
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      const res = await fetch(
        `${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}&select=*&limit=1`,
        { headers: H })
      if (!res.ok) {
        console.error('manage-market-reports get_schedule failed', res.status)
        return J({ success: false, error: 'Could not read your schedule.' }, 502)
      }
      const rows = await res.json()
      return J({ success: true, schedule: rows?.[0] ?? null,
        note: rows?.length ? null : 'No schedule set, so no reports are being sent.' })
    }

    if (action === 'save_schedule') {
      const { investor_id, frequency, day_of_week, day_of_month, markets, template_id, is_active } = body
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      const allowedFreq = ['daily', 'weekly', 'monthly']
      if (!allowedFreq.includes(String(frequency))) {
        return J({ success: false, error: `Frequency must be one of: ${allowedFreq.join(', ')}. Nothing was saved.` }, 400)
      }
      // A weekly schedule with no day would never fire, and the person would sit waiting
      // for a report that was never going to come.
      if (frequency === 'weekly' && (day_of_week === undefined || day_of_week === null)) {
        return J({ success: false, error: 'A weekly schedule needs a day of the week, or it would never send.' }, 400)
      }
      if (frequency === 'monthly' && (day_of_month === undefined || day_of_month === null)) {
        return J({ success: false, error: 'A monthly schedule needs a day of the month, or it would never send.' }, 400)
      }

      const existing = await fetch(
        `${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}&select=id&limit=1`,
        { headers: H })
      const rows = await existing.json().catch(() => [])
      const payload = {
        investor_id, frequency,
        day_of_week: day_of_week ?? null, day_of_month: day_of_month ?? null,
        markets: markets ?? null, template_id: template_id ?? null,
        is_active: is_active !== false,
      }
      const res = (Array.isArray(rows) && rows.length)
        ? await fetch(`${supabaseUrl}/rest/v1/market_report_schedules?id=eq.${rows[0].id}`,
            { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
        : await fetch(`${supabaseUrl}/rest/v1/market_report_schedules`,
            { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        console.error('manage-market-reports save_schedule failed', res.status)
        return J({ success: false, error: 'Could not save the schedule. Nothing was changed.' }, 502)
      }
      const out = await res.json()
      return J({ success: true, schedule: out?.[0] ?? null })
    }

    if (action === 'get_dashboard_data') {
      const { investor_id } = body
      if (!investor_id) return J({ success: false, error: 'investor_id is required.' }, 400)
      const [setRes, repRes, schRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/investor_widget_settings?investor_id=eq.${investor_id}&select=*&limit=1`, { headers: H }),
        fetch(`${supabaseUrl}/rest/v1/market_reports?investor_id=eq.${investor_id}&select=id,markets,report_type,status,generated_at&order=generated_at.desc&limit=5`, { headers: H }),
        fetch(`${supabaseUrl}/rest/v1/market_report_schedules?investor_id=eq.${investor_id}&select=frequency,next_scheduled_at,is_active&limit=1`, { headers: H }),
      ])
      // Each section reports its OWN failure. One dead read must not make the whole
      // dashboard look empty, and "we could not load this" is not the same as "you have
      // none of these".
      const settings = setRes.ok ? (await setRes.json())?.[0] ?? null : 'unavailable'
      const reports = repRes.ok ? await repRes.json() : 'unavailable'
      const schedule = schRes.ok ? (await schRes.json())?.[0] ?? null : 'unavailable'
      return J({ success: true, settings, recent_reports: reports, schedule })
    }

    if (action === 'get_widget_settings') {
      const { investor_id } = body
      const response = await fetch(
        `${supabaseUrl}/rest/v1/investor_widget_settings?investor_id=eq.${investor_id}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      )
      const settings = await response.json()
      return new Response(JSON.stringify({ settings: settings?.[0] || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (action === 'save_widget_settings') {
      const { investor_id, widgets } = body
      // Upsert
      await fetch(`${supabaseUrl}/rest/v1/investor_widget_settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ investor_id, widgets, updated_at: new Date().toISOString() })
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
