# manage-email-templates Edge Function

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const defaultTemplates = [
  { template_type: 'password_reset', template_name: 'Password Reset', subject_template: 'Reset Your Password', description: 'Sent when user requests password reset', variables: ['name', 'reset_url', 'expires_in'], html_template: '<h1>Reset Password</h1><p>Hi {{name}},</p><p><a href="{{reset_url}}">Click here</a> to reset. Expires in {{expires_in}}.</p>' },
  { template_type: 'welcome_email', template_name: 'Welcome Email', subject_template: 'Welcome to Access Your Place!', description: 'Sent to new users', variables: ['name', 'email', 'portal_url'], html_template: '<h1>Welcome!</h1><p>Hi {{name}}, your account is ready at <a href="{{portal_url}}">{{portal_url}}</a></p>' },
  { template_type: 'new_deal_alert', template_name: 'New Deal Alert', subject_template: 'New Deal: {{property_address}}', description: 'Sent when new deal matches criteria', variables: ['investor_name', 'property_address', 'market', 'price', 'deal_id', 'portal_url'], html_template: '<h1>New Deal!</h1><p>{{investor_name}}, check out {{property_address}} in {{market}} for {{price}}</p>' },
  { template_type: 'acquisition_stage_changed', template_name: 'Acquisition Update', subject_template: 'Acquisition Update: {{property_address}}', description: 'Sent when acquisition stage changes', variables: ['investor_name', 'property_address', 'old_stage', 'new_stage', 'stage_description', 'portal_url'], html_template: '<h1>Stage Update</h1><p>{{investor_name}}, {{property_address}} moved from {{old_stage}} to {{new_stage}}</p>' },
  { template_type: 'document_status_changed', template_name: 'Document Status', subject_template: 'Document {{status_title}}: {{document_name}}', description: 'Sent when document status changes', variables: ['investor_name', 'document_name', 'document_type', 'status', 'status_title', 'portal_url'], html_template: '<h1>Document {{status_title}}</h1><p>{{investor_name}}, your {{document_type}} "{{document_name}}" is now {{status}}</p>' }
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (action === 'list') {
      const res = await fetch(`${supabaseUrl}/rest/v1/email_templates?order=template_name`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } })
      let templates = await res.json()
      if (!templates?.length) {
        for (const t of defaultTemplates) {
          await fetch(`${supabaseUrl}/rest/v1/email_templates`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify(t) })
        }
        templates = defaultTemplates
      }
      return new Response(JSON.stringify({ templates }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update') {
      const { id, subject_template, html_template, template_name, is_active } = body
      await fetch(`${supabaseUrl}/rest/v1/email_templates?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ subject_template, html_template, template_name, is_active, updated_at: new Date().toISOString() }) })
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'preview') {
      const { html_template, subject_template, sample_data } = body
      let html = html_template, subject = subject_template
      for (const [key, value] of Object.entries(sample_data || {})) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
      }
      return new Response(JSON.stringify({ success: true, preview_html: html, preview_subject: subject }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'reset') {
      const { template_type } = body
      const def = defaultTemplates.find(t => t.template_type === template_type)
      if (def) {
        await fetch(`${supabaseUrl}/rest/v1/email_templates?template_type=eq.${template_type}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify(def) })
        return new Response(JSON.stringify({ success: true, template: def }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```
