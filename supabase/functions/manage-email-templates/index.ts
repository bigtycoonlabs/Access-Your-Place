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


    // Small helpers so each handler below is one readable line rather than a repeated
    // fetch incantation. The schema header is not needed: these are public views.
    const H = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }
    const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const bad = (m: string, code = 400) => new Response(JSON.stringify({ success: false, error: m }), { status: code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const read = async (path: string) => {
      const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: H })
      if (!r.ok) { console.error('manage-email-templates read_failed', path, r.status); return null }
      return await r.json()
    }
    const write = async (table: string, method: string, qs: string, payload: unknown) => {
      const r = await fetch(`${supabaseUrl}/rest/v1/${table}${qs ? '?' + qs : ''}`, {
        method, headers: { ...H, Prefer: 'return=representation' },
        body: payload === null ? undefined : JSON.stringify(payload),
      })
      const t = await r.text()
      if (!r.ok) { console.error('manage-email-templates write_failed', table, r.status, t.slice(0, 200)); return { ok: false, status: r.status, detail: t.slice(0, 200) } }
      return { ok: true, data: t ? JSON.parse(t) : null }
    }

    // ---- ADDED 9 Aug 2026 ----
    //
    // Sixteen actions across three staff screens — the campaign sender, the document
    // template manager and the email template builder — all threw "Unknown action". The
    // tables were there the whole time; only the handlers were missing.

    // Custom email templates (EmailTemplateBuilder)
    if (action === 'cancel_campaign') {
      if (!body.id) return bad('id is required.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (!rows?.length) return bad('No campaign with that id.', 404)
      // A campaign that has already sent to people cannot be un-sent. Cancelling stops
      // what is left; saying otherwise would imply we can recall mail.
      const sent = rows[0].sent_count || 0
      const r = await write('email_campaigns', 'PATCH', `id=eq.${body.id}`, {
        status: 'cancelled', completed_at: new Date().toISOString(),
      })
      if (!r.ok) return bad(`Could not cancel the campaign (${r.status}).`, 502)
      return ok({ success: true,
        note: sent > 0
          ? `Cancelled. ${sent} email(s) had ALREADY GONE OUT and cannot be recalled — only the remainder is stopped.`
          : 'Cancelled before anything was sent.' })
    }

    if (action === 'reschedule_campaign') {
      if (!body.id || !body.scheduled_for) return bad('id and scheduled_for are required.')
      const when = new Date(body.scheduled_for)
      if (Number.isNaN(when.getTime())) return bad('That is not a readable date and time.')
      if (when.getTime() < Date.now()) return bad('That time is in the past. Nothing was changed.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (!rows?.length) return bad('No campaign with that id.', 404)
      if ((rows[0].sent_count || 0) > 0) {
        return bad('This campaign has already started sending, so it cannot be rescheduled. Cancel it instead.')
      }
      const r = await write('email_campaigns', 'PATCH', `id=eq.${body.id}`, {
        scheduled_for: when.toISOString(), status: 'scheduled',
      })
      if (!r.ok) return bad(`Could not reschedule (${r.status}).`, 502)
      return ok({ success: true, scheduled_for: when.toISOString() })
    }

    if (action === 'send_scheduled_now') {
      if (!body.id) return bad('id is required.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (!rows?.length) return bad('No campaign with that id.', 404)
      // Marks it ready to go NOW. It does not itself send — the mail path does, and
      // reporting a send here that has not happened is precisely the defect this codebase
      // keeps producing.
      const r = await write('email_campaigns', 'PATCH', `id=eq.${body.id}`, {
        scheduled_for: new Date().toISOString(), status: 'sending',
      })
      if (!r.ok) return bad(`Could not release the campaign (${r.status}).`, 502)
      return ok({ success: true, status: 'sending',
        note: 'Released to send now. Nothing has left yet — the counts will move as batches are recorded.' })
    }

    if (action === 'send_test') {
      if (!body.to || !String(body.to).includes('@')) return bad('A test needs a real email address to go to.')
      if (!body.subject) return bad('A test needs a subject.')
      const rkey = Deno.env.get('RESEND_API_KEY')
      if (!rkey) return bad('Email is not configured on the server, so no test was sent.', 500)
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rkey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Access Your Place <penny@accessyourplace.com>',
          to: [String(body.to)],
          subject: `[TEST] ${body.subject}`,
          html: body.html_content || undefined,
          text: body.plain_text_content || body.text || 'Test send.',
        }),
      })
      const out = await r.json().catch(() => null)
      // The result is READ, not assumed from the status.
      if (!r.ok || !out?.id) {
        console.error('manage-email-templates test_send_failed', r.status, JSON.stringify(out).slice(0, 200))
        return bad(`The test did NOT send (${r.status}). ${JSON.stringify(out).slice(0, 160)}`, 502)
      }
      return ok({ success: true, sent_to: body.to, id: out.id })
    }

    if (action === 'list_custom_templates') {
      const rows = await read('custom_email_templates?order=updated_at.desc')
      if (rows === null) return bad('Could not read the templates.', 502)
      return ok({ success: true, templates: rows })
    }
    if (action === 'create_custom_template') {
      if (!body.name) return bad('A template needs a name.')
      const r = await write('custom_email_templates', 'POST', '', {
        name: body.name, subject: body.subject ?? null, category: body.category ?? 'general',
        blocks: body.blocks ?? [], is_active: body.is_active ?? true, created_by: body.staff_id ?? null,
      })
      if (!r.ok) return bad(`Could not save the template (${r.status}).`, 502)
      return ok({ success: true, template: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'update_custom_template') {
      if (!body.id) return bad('id is required.')
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      for (const k of ['name', 'subject', 'category', 'blocks', 'is_active']) if (k in body) patch[k] = body[k]
      const r = await write('custom_email_templates', 'PATCH', `id=eq.${body.id}`, patch)
      if (!r.ok) return bad(`Could not update the template (${r.status}).`, 502)
      return ok({ success: true, template: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'delete_custom_template') {
      if (!body.id) return bad('id is required.')
      const r = await write('custom_email_templates', 'DELETE', `id=eq.${body.id}`, null)
      if (!r.ok) return bad(`Could not delete the template (${r.status}).`, 502)
      return ok({ success: true, deleted: body.id })
    }

    // Document templates (DocumentTemplatesTab)
    if (action === 'list_documents') {
      const rows = await read('document_templates?order=updated_at.desc')
      if (rows === null) return bad('Could not read the documents.', 502)
      return ok({ success: true, documents: rows })
    }
    if (action === 'create_document') {
      if (!body.name) return bad('A document needs a name.')
      const r = await write('document_templates', 'POST', '', {
        name: body.name, template_type: body.template_type ?? 'general',
        category: body.category ?? null, content: body.content ?? '',
        variables: body.variables ?? [], is_active: body.is_active ?? true,
        created_by: body.staff_id ?? null,
      })
      if (!r.ok) return bad(`Could not save the document (${r.status}).`, 502)
      return ok({ success: true, document: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'update_document') {
      if (!body.id) return bad('id is required.')
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: body.staff_id ?? null }
      for (const k of ['name', 'template_type', 'category', 'content', 'variables', 'is_active']) if (k in body) patch[k] = body[k]
      const r = await write('document_templates', 'PATCH', `id=eq.${body.id}`, patch)
      if (!r.ok) return bad(`Could not update the document (${r.status}).`, 502)
      return ok({ success: true, document: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'delete_document') {
      if (!body.id) return bad('id is required.')
      const r = await write('document_templates', 'DELETE', `id=eq.${body.id}`, null)
      if (!r.ok) return bad(`Could not delete the document (${r.status}).`, 502)
      return ok({ success: true, deleted: body.id })
    }

    // Campaigns (BulkEmailCampaign)
    if (action === 'list_campaigns') {
      const rows = await read('email_campaigns?order=created_at.desc&limit=50')
      if (rows === null) return bad('Could not read the campaigns.', 502)
      return ok({ success: true, campaigns: rows })
    }
    if (action === 'create_campaign') {
      if (!body.name || !body.subject) return bad('A campaign needs a name and a subject.')
      const ids: string[] = Array.isArray(body.recipient_ids) ? body.recipient_ids : []
      if (ids.length === 0) return bad('A campaign with no recipients would send to nobody. Nothing was created.')
      const r = await write('email_campaigns', 'POST', '', {
        name: body.name, subject: body.subject,
        template_id: body.template_id ?? null, template_name: body.template_name ?? null,
        recipient_ids: ids, total_recipients: ids.length,
        sent_count: 0, delivered_count: 0, opened_count: 0, bounced_count: 0,
        status: 'draft', scheduled_for: body.scheduled_for ?? null,
      })
      if (!r.ok) return bad(`Could not create the campaign (${r.status}).`, 502)
      return ok({ success: true, campaign: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'get_campaign') {
      if (!body.id) return bad('id is required.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (rows === null) return bad('Could not read the campaign.', 502)
      if (!rows.length) return bad('No campaign with that id.', 404)
      return ok({ success: true, campaign: rows[0] })
    }
    if (action === 'send_campaign_batch') {
      // Records progress ONLY. The actual sending happens through the mail path, and a
      // counter that moves without a send is the exact lie this platform keeps producing.
      if (!body.id) return bad('id is required.')
      if (typeof body.sent !== 'number') return bad('This records a real batch result — it needs the number actually sent.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (!rows?.length) return bad('No campaign with that id.', 404)
      const cur = rows[0]
      const r = await write('email_campaigns', 'PATCH', `id=eq.${body.id}`, {
        sent_count: (cur.sent_count || 0) + body.sent,
        bounced_count: (cur.bounced_count || 0) + (body.bounced || 0),
        status: 'sending',
      })
      if (!r.ok) return bad(`Could not record the batch (${r.status}).`, 502)
      return ok({ success: true, campaign: Array.isArray(r.data) ? r.data[0] : r.data })
    }
    if (action === 'complete_campaign') {
      if (!body.id) return bad('id is required.')
      const rows = await read(`email_campaigns?id=eq.${body.id}&limit=1`)
      if (!rows?.length) return bad('No campaign with that id.', 404)
      const cur = rows[0]
      const r = await write('email_campaigns', 'PATCH', `id=eq.${body.id}`, {
        status: 'completed', completed_at: new Date().toISOString(),
      })
      if (!r.ok) return bad(`Could not complete the campaign (${r.status}).`, 502)
      // Said plainly rather than rounded up. "Completed" with nothing sent is the failure
      // mode this platform is most prone to.
      const sent = cur.sent_count || 0
      const total = cur.total_recipients || 0
      return ok({
        success: true, campaign: Array.isArray(r.data) ? r.data[0] : r.data,
        note: sent === 0
          ? `Marked complete, but NOTHING was sent — 0 of ${total}. Do not report this as delivered.`
          : sent < total
            ? `Marked complete. ${sent} of ${total} were sent; ${total - sent} did not go out.`
            : `Marked complete. All ${sent} were sent.`,
      })
    }

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
