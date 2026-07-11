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
