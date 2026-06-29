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
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER')
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    // Helper to send email notification
    async function sendEmailNotification(to: string, subject: string, html: string) {
      if (!resendKey) return
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: [to],
            subject,
            html
          })
        })
      } catch (e) { console.error('Email error:', e) }
    }

    // Helper to send SMS notification
    async function sendSmsNotification(to: string, message: string) {
      if (!twilioSid || !twilioToken || !twilioPhone || !to) return
      try {
        const formData = new URLSearchParams()
        formData.append('To', to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`)
        formData.append('From', twilioPhone)
        formData.append('Body', message)
        
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`)
          },
          body: formData.toString()
        })
      } catch (e) { console.error('SMS error:', e) }
    }

    // Helper to get investor details
    async function getInvestor(investorId: string) {
      const res = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=id,email,full_name,phone,sms_opt_in`, { headers })
      const investors = await res.json()
      return investors?.[0] || null
    }

    // Create new dispute
    if (action === 'create') {
      const { investor_id, category, subject, description, related_entity_type, related_entity_id } = body
      
      const ticketNumber = 'DSP-' + Date.now().toString(36).toUpperCase()
      
      const res = await fetch(`${supabaseUrl}/rest/v1/disputes`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          investor_id,
          category,
          subject,
          description,
          related_entity_type,
          related_entity_id,
          ticket_number: ticketNumber,
          status: 'open',
          priority: 'medium'
        })
      })
      const dispute = (await res.json())[0]
      
      // Send confirmation notification to investor
      const investor = await getInvestor(investor_id)
      if (investor) {
        const portalUrl = 'https://accessyourplace.com/investor/portal'
        
        // Email notification
        await sendEmailNotification(
          investor.email,
          `Dispute Received: ${subject} [${ticketNumber}]`,
          `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
            <div style="background:#1e293b;padding:20px;text-align:center;">
              <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
            </div>
            <div style="padding:30px;background:#f8fafc;">
              <p>Hi ${investor.full_name},</p>
              <p>We've received your dispute and our team is reviewing it.</p>
              <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
                <p style="margin:0 0 10px;"><strong>Ticket:</strong> ${ticketNumber}</p>
                <p style="margin:0 0 10px;"><strong>Subject:</strong> ${subject}</p>
                <p style="margin:0 0 10px;"><strong>Category:</strong> ${category}</p>
                <p style="margin:0;"><strong>Status:</strong> Open</p>
              </div>
              <p>We aim to respond within 24-48 hours.</p>
              <p style="text-align:center;margin:30px 0;">
                <a href="${portalUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">View in Portal</a>
              </p>
            </div>
          </div>`
        )
        
        // SMS notification (if opted in)
        if (investor.sms_opt_in && investor.phone) {
          await sendSmsNotification(
            investor.phone,
            `Access Your Place: Your dispute ${ticketNumber} has been received. Subject: ${subject}. We'll respond within 24-48 hours.`
          )
        }
      }
      
      return new Response(JSON.stringify({ success: true, dispute }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Update dispute status
    if (action === 'update_status') {
      const { dispute_id, status, resolution_notes, staff_id, staff_name } = body
      
      // Get current dispute
      const dispRes = await fetch(`${supabaseUrl}/rest/v1/disputes?id=eq.${dispute_id}&select=*`, { headers })
      const disputes = await dispRes.json()
      if (!disputes?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Dispute not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const dispute = disputes[0]
      const oldStatus = dispute.status
      
      // Update dispute
      const updateData: any = { status, updated_at: new Date().toISOString() }
      if (resolution_notes) updateData.resolution_notes = resolution_notes
      if (status === 'resolved') updateData.resolved_at = new Date().toISOString()
      if (staff_id) updateData.assigned_to = staff_id
      
      await fetch(`${supabaseUrl}/rest/v1/disputes?id=eq.${dispute_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      })
      
      // Send notification if status changed
      if (oldStatus !== status) {
        const investor = await getInvestor(dispute.investor_id)
        if (investor) {
          const portalUrl = 'https://accessyourplace.com/investor/portal'
          const statusLabels: Record<string, string> = {
            'open': 'Open',
            'in_progress': 'In Progress',
            'pending_info': 'Pending Your Response',
            'resolved': 'Resolved',
            'closed': 'Closed'
          }
          
          // Email notification
          await sendEmailNotification(
            investor.email,
            `Dispute Update: ${dispute.subject} [${dispute.ticket_number}]`,
            `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
              <div style="background:#1e293b;padding:20px;text-align:center;">
                <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
              </div>
              <div style="padding:30px;background:#f8fafc;">
                <p>Hi ${investor.full_name},</p>
                <p>Your dispute status has been updated.</p>
                <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
                  <p style="margin:0 0 10px;"><strong>Ticket:</strong> ${dispute.ticket_number}</p>
                  <p style="margin:0 0 10px;"><strong>Subject:</strong> ${dispute.subject}</p>
                  <p style="margin:0 0 10px;"><strong>Previous Status:</strong> ${statusLabels[oldStatus] || oldStatus}</p>
                  <p style="margin:0;"><strong>New Status:</strong> <span style="color:#f59e0b;font-weight:bold;">${statusLabels[status] || status}</span></p>
                </div>
                ${resolution_notes ? `<p><strong>Resolution Notes:</strong><br/>${resolution_notes}</p>` : ''}
                <p style="text-align:center;margin:30px 0;">
                  <a href="${portalUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">View Details</a>
                </p>
              </div>
            </div>`
          )
          
          // SMS notification
          if (investor.sms_opt_in && investor.phone) {
            await sendSmsNotification(
              investor.phone,
              `Access Your Place: Dispute ${dispute.ticket_number} status updated to "${statusLabels[status] || status}". View details in your portal.`
            )
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Add message to dispute
    if (action === 'add_message') {
      const { dispute_id, sender_type, sender_id, sender_name, message, is_internal } = body
      
      // Get dispute
      const dispRes = await fetch(`${supabaseUrl}/rest/v1/disputes?id=eq.${dispute_id}&select=*`, { headers })
      const disputes = await dispRes.json()
      if (!disputes?.length) {
        return new Response(JSON.stringify({ success: false, error: 'Dispute not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const dispute = disputes[0]
      
      // Insert message
      await fetch(`${supabaseUrl}/rest/v1/dispute_messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dispute_id,
          sender_type,
          sender_id,
          sender_name,
          message,
          is_internal: is_internal || false
        })
      })
      
      // Update dispute timestamp
      await fetch(`${supabaseUrl}/rest/v1/disputes?id=eq.${dispute_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      })
      
      // Send notification to investor if staff sent a non-internal message
      if (sender_type === 'staff' && !is_internal) {
        const investor = await getInvestor(dispute.investor_id)
        if (investor) {
          const portalUrl = 'https://accessyourplace.com/investor/portal'
          
          // Email notification
          await sendEmailNotification(
            investor.email,
            `New Response: ${dispute.subject} [${dispute.ticket_number}]`,
            `<div style="font-family:Arial;max-width:600px;margin:0 auto;">
              <div style="background:#1e293b;padding:20px;text-align:center;">
                <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
              </div>
              <div style="padding:30px;background:#f8fafc;">
                <p>Hi ${investor.full_name},</p>
                <p>You have a new response on your dispute.</p>
                <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0;">
                  <p style="margin:0 0 10px;"><strong>Ticket:</strong> ${dispute.ticket_number}</p>
                  <p style="margin:0 0 10px;"><strong>Subject:</strong> ${dispute.subject}</p>
                  <p style="margin:0 0 10px;"><strong>From:</strong> ${sender_name || 'Support Team'}</p>
                  <div style="background:#f1f5f9;padding:15px;border-radius:6px;margin-top:15px;">
                    <p style="margin:0;white-space:pre-wrap;">${message}</p>
                  </div>
                </div>
                <p style="text-align:center;margin:30px 0;">
                  <a href="${portalUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">Reply Now</a>
                </p>
              </div>
            </div>`
          )
          
          // SMS notification
          if (investor.sms_opt_in && investor.phone) {
            await sendSmsNotification(
              investor.phone,
              `Access Your Place: New response on dispute ${dispute.ticket_number}. Check your portal to view and reply.`
            )
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get investor disputes
    if (action === 'get_investor_disputes') {
      const { investor_id } = body
      const res = await fetch(`${supabaseUrl}/rest/v1/disputes?investor_id=eq.${investor_id}&order=created_at.desc&select=*`, { headers })
      const disputes = await res.json()
      return new Response(JSON.stringify({ success: true, disputes: disputes || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get all disputes (for staff)
    if (action === 'get_all_disputes') {
      const { status, category, search } = body
      let url = `${supabaseUrl}/rest/v1/disputes?order=created_at.desc&select=*,investors(full_name,email)`
      if (status && status !== 'all') url += `&status=eq.${status}`
      if (category && category !== 'all') url += `&category=eq.${category}`
      
      const res = await fetch(url, { headers })
      let disputes = await res.json()
      
      if (search) {
        const s = search.toLowerCase()
        disputes = disputes.filter((d: any) => 
          d.subject?.toLowerCase().includes(s) || 
          d.ticket_number?.toLowerCase().includes(s) ||
          d.investors?.full_name?.toLowerCase().includes(s)
        )
      }
      
      return new Response(JSON.stringify({ success: true, disputes: disputes || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get dispute details with messages
    if (action === 'get_dispute_details') {
      const { dispute_id, include_internal } = body
      
      const dispRes = await fetch(`${supabaseUrl}/rest/v1/disputes?id=eq.${dispute_id}&select=*,investors(full_name,email,phone)`, { headers })
      const disputes = await dispRes.json()
      
      let msgUrl = `${supabaseUrl}/rest/v1/dispute_messages?dispute_id=eq.${dispute_id}&order=created_at.asc`
      if (!include_internal) msgUrl += `&is_internal=eq.false`
      
      const msgRes = await fetch(msgUrl, { headers })
      const messages = await msgRes.json()
      
      return new Response(JSON.stringify({
        success: true,
        dispute: disputes?.[0] || null,
        messages: messages || []
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get stats
    if (action === 'get_stats') {
      const res = await fetch(`${supabaseUrl}/rest/v1/disputes?select=status,category`, { headers })
      const disputes = await res.json()
      
      const stats = {
        total: disputes?.length || 0,
        by_status: {} as Record<string, number>,
        by_category: {} as Record<string, number>
      }
      
      disputes?.forEach((d: any) => {
        stats.by_status[d.status] = (stats.by_status[d.status] || 0) + 1
        stats.by_category[d.category] = (stats.by_category[d.category] || 0) + 1
      })
      
      return new Response(JSON.stringify({ success: true, stats }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
