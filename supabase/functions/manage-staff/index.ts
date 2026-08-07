import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

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
    const headers = { 
      'apikey': supabaseKey, 
      'Authorization': `Bearer ${supabaseKey}`, 
      'Content-Type': 'application/json' 
    }

    // ==================== GET STAFF ====================
    if (action === 'get_staff') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?is_active=eq.true&order=created_at.desc&select=*`,
        { headers }
      )
      const staff = await res.json()
      return new Response(JSON.stringify({ success: true, staff: staff || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== ADD STAFF ====================
    if (action === 'add_staff') {
      const { first_name, last_name, email, phone, department, roles, base_url } = body
      
      // Check if email already exists
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
        { headers }
      )
      const existing = await checkRes.json()
      
      if (existing?.length > 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'A staff member with this email already exists' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Generate invitation token
      const invitationToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      
      // Create staff user
      const createRes = await fetch(`${supabaseUrl}/rest/v1/staff_users`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone: phone || null,
          department,
          roles: roles || [department],
          invitation_token: invitationToken,
          invitation_expires: invitationExpires.toISOString(),
          is_active: true,
          account_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })
      
      const newStaff = await createRes.json()
      
      if (!createRes.ok) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to create staff member' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Send invitation email
      if (resendKey) {
        const inviteUrl = `${base_url || 'https://accessyourplace.com'}/staff/login?invitation=${invitationToken}`
        const departmentName = department.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: [email],
            subject: 'Welcome to Access Your Place - Complete Your Account Setup',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
                  <h1 style="color:#f59e0b;margin:0;font-size:28px;">Access Your Place</h1>
                  <p style="color:#94a3b8;margin:10px 0 0;font-size:14px;">Staff Portal</p>
                </div>
                <div style="padding:30px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
                  <h2 style="color:#1e293b;margin-top:0;">Welcome to the Team, ${first_name}!</h2>
                  <p style="color:#475569;line-height:1.6;">
                    You've been added to the Access Your Place team as a <strong>${departmentName}</strong>.
                  </p>
                  <p style="color:#475569;line-height:1.6;">
                    Click the button below to set up your password and complete your account:
                  </p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="${inviteUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                      Complete Account Setup
                    </a>
                  </div>
                  <p style="color:#64748b;font-size:12px;">
                    This invitation link expires in 7 days. If you have any questions, please contact your administrator.
                  </p>
                </div>
                <div style="padding:20px;background:#1e293b;text-align:center;border-radius:0 0 8px 8px;">
                  <p style="color:#94a3b8;margin:0;font-size:12px;">
                    © ${new Date().getFullYear()} Access Your Place. All rights reserved.
                  </p>
                </div>
              </div>
            `
          })
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        staff: Array.isArray(newStaff) ? newStaff[0] : newStaff 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== UPDATE ROLES ====================
    if (action === 'update_roles') {
      const { staff_id, roles } = body
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          roles,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== DEACTIVATE STAFF ====================
    if (action === 'deactivate_staff') {
      const { staff_id, deactivated_by } = body
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          is_active: false,
          // deactivated_by / deactivated_at do NOT exist on staff_users. Including them
          // failed the whole PATCH, so is_active never became false and deactivating a
          // staff member silently left their access intact.
          session_token: null,
          session_expires: null,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== RESEND INVITATION ====================
    if (action === 'resend_invitation') {
      const { staff_id, base_url } = body
      
      // Get staff details
      const staffRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}&select=*`,
        { headers }
      )
      const staffData = await staffRes.json()
      const staff = staffData?.[0]
      
      if (!staff) {
        return new Response(JSON.stringify({ success: false, error: 'Staff not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Generate new invitation token
      const invitationToken = crypto.randomUUID() + '-' + crypto.randomUUID()
      const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          invitation_token: invitationToken,
          invitation_expires: invitationExpires.toISOString(),
          updated_at: new Date().toISOString()
        })
      })
      
      // Send email
      if (resendKey) {
        const inviteUrl = `${base_url || 'https://accessyourplace.com'}/staff/login?invitation=${invitationToken}`
        const departmentName = staff.department?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Staff'
        
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Access Your Place <noreply@accessyourplace.com>',
            to: [staff.email],
            subject: 'Reminder: Complete Your Access Your Place Account Setup',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:30px;text-align:center;border-radius:8px 8px 0 0;">
                  <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
                  <p style="color:#94a3b8;margin:10px 0 0;">Staff Portal</p>
                </div>
                <div style="padding:30px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
                  <h2 style="color:#1e293b;margin-top:0;">Hi ${staff.first_name},</h2>
                  <p style="color:#475569;">This is a reminder to complete your account setup as a ${departmentName}.</p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="${inviteUrl}" style="background:#f59e0b;color:#1e293b;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">
                      Complete Account Setup
                    </a>
                  </div>
                  <p style="color:#64748b;font-size:12px;">This link expires in 7 days.</p>
                </div>
              </div>
            `
          })
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET DEPARTMENTS ====================
    if (action === 'get_departments') {
      const departments = [
        { id: 'success_managers', name: 'Success Managers', description: 'Full platform access', permissions: ['all'] },
        { id: 'acquisition_managers', name: 'Acquisition Managers', description: 'Deal and investor management', permissions: ['deals', 'acquisitions', 'investors', 'crm'] },
        { id: 'setup_managers', name: 'Setup Managers', description: 'Property setup management', permissions: ['deals', 'setups', 'investors', 'crm'] },
        { id: 'content_team', name: 'Content Team', description: 'Content and blog management', permissions: ['content'] },
        { id: 'support_team', name: 'Support Team', description: 'Customer support', permissions: ['support', 'crm'] }
      ]
      
      return new Response(JSON.stringify({ success: true, departments }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== LINK INVESTOR ACCOUNT ====================
    if (action === 'link_investor_account') {
      const { staff_id, investor_id } = body
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          linked_investor_id: investor_id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== UNLINK INVESTOR ACCOUNT ====================
    if (action === 'unlink_investor_account') {
      const { staff_id } = body
      
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          linked_investor_id: null,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET LINKED INVESTOR ====================
    if (action === 'get_linked_investor') {
      const { staff_id } = body
      
      const staffRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?id=eq.${staff_id}&select=linked_investor_id`,
        { headers }
      )
      const staffData = await staffRes.json()
      
      if (!staffData?.[0]?.linked_investor_id) {
        return new Response(JSON.stringify({ success: true, investor: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const invRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?id=eq.${staffData[0].linked_investor_id}&select=id,full_name,email,phone,company_name`,
        { headers }
      )
      const investors = await invRes.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        investor: investors?.[0] || null 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== GET CERTIFICATIONS ====================
    if (action === 'get_certifications') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/staff_certifications?order=uploaded_at.desc&select=*`,
        { headers }
      )
      const certifications = await res.json()
      
      // Get staff names for each certification
      const enrichedCerts = await Promise.all((certifications || []).map(async (cert) => {
        const staffRes = await fetch(
          `${supabaseUrl}/rest/v1/staff_users?id=eq.${cert.staff_id}&select=first_name,last_name`,
          { headers }
        )
        const staffData = await staffRes.json()
        const staff = staffData?.[0]
        
        let uploadedByName = 'Unknown'
        if (cert.uploaded_by) {
          const uploaderRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_users?id=eq.${cert.uploaded_by}&select=first_name,last_name`,
            { headers }
          )
          const uploaderData = await uploaderRes.json()
          if (uploaderData?.[0]) {
            uploadedByName = `${uploaderData[0].first_name} ${uploaderData[0].last_name}`
          }
        }
        
        return {
          ...cert,
          staff_name: staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown',
          uploaded_by_name: uploadedByName
        }
      }))
      
      return new Response(JSON.stringify({ success: true, certifications: enrichedCerts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== UPLOAD CERTIFICATION ====================
    if (action === 'upload_certification') {
      const { staff_id, certification_url, file_name, uploaded_by } = body
      
      const createRes = await fetch(`${supabaseUrl}/rest/v1/staff_certifications`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          staff_id,
          certification_type: 'yp_certification',
          file_url: certification_url,
          file_name,
          status: 'pending',
          uploaded_by,
          uploaded_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== VERIFY CERTIFICATION ====================
    if (action === 'verify_certification') {
      const { certification_id, verified_by } = body
      
      // Get certification to find staff_id
      const certRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_certifications?id=eq.${certification_id}&select=staff_id`,
        { headers }
      )
      const certData = await certRes.json()
      const cert = certData?.[0]
      
      if (!cert) {
        return new Response(JSON.stringify({ success: false, error: 'Certification not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Update certification status
      await fetch(`${supabaseUrl}/rest/v1/staff_certifications?id=eq.${certification_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'approved',
          verified_by,
          verified_at: new Date().toISOString()
        })
      })
      
      // Update staff user as YP certified
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${cert.staff_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          yp_certified: true,
          yp_certification_verified: true,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== REJECT CERTIFICATION ====================
    if (action === 'reject_certification') {
      const { certification_id, verified_by, rejection_reason } = body
      
      await fetch(`${supabaseUrl}/rest/v1/staff_certifications?id=eq.${certification_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'rejected',
          verified_by,
          verified_at: new Date().toISOString(),
          rejection_reason
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET UNREAD COUNT ====================
    if (action === 'get_unread_count') {
      const { staff_id } = body
      
      const res = await fetch(
        `${supabaseUrl}/rest/v1/staff_messages?recipient_id=eq.${staff_id}&read=eq.false&select=id`,
        { headers }
      )
      const messages = await res.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        count: messages?.length || 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== GET ACQUISITION MANAGERS WITH COUNTS ====================
    if (action === 'get_acquisition_managers_with_counts') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?is_active=eq.true&select=*`,
        { headers }
      )
      const allStaff = await res.json()
      
      // Filter to acquisition managers
      const ams = (allStaff || []).filter(s => 
        s.department === 'acquisition_managers' || 
        s.roles?.includes('acquisition_managers')
      )
      
      // Get investor counts for each AM
      const amsWithCounts = await Promise.all(ams.map(async (am) => {
        const countRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?assigned_acquisition_manager_id=eq.${am.id}&select=id`,
          { headers }
        )
        const investors = await countRes.json()
        
        return {
          ...am,
          investor_count: investors?.length || 0
        }
      }))
      
      return new Response(JSON.stringify({ 
        success: true, 
        staff: amsWithCounts 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== GET AM ASSIGNMENT REQUESTS ====================
    if (action === 'get_am_assignment_requests') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/am_assignment_requests?status=eq.pending&order=created_at.desc&select=*`,
        { headers }
      )
      const requests = await res.json()
      
      // Enrich with investor data
      const enrichedRequests = await Promise.all((requests || []).map(async (req) => {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${req.investor_id}&select=id,full_name,email,preferred_markets,portfolio_count`,
          { headers }
        )
        const investors = await invRes.json()
        
        return {
          ...req,
          investor: investors?.[0] || null
        }
      }))
      
      return new Response(JSON.stringify({ 
        success: true, 
        requests: enrichedRequests 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== MATCH AM ASSIGNMENT ====================
    if (action === 'match_am_assignment') {
      const { request_id, investor_id, am_id, matched_by } = body
      
      // Update the request
      await fetch(`${supabaseUrl}/rest/v1/am_assignment_requests?id=eq.${request_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'approved',
          assigned_am_id: am_id,
          matched_by,
          matched_at: new Date().toISOString()
        })
      })
      
      // Update the investor
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          assigned_acquisition_manager_id: am_id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== REJECT AM ASSIGNMENT ====================
    if (action === 'reject_am_assignment') {
      const { request_id, rejected_by, rejection_reason } = body
      
      await fetch(`${supabaseUrl}/rest/v1/am_assignment_requests?id=eq.${request_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'rejected',
          rejected_by,
          rejection_reason,
          rejected_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET AM CHANGE REQUESTS ====================
    if (action === 'get_am_change_requests') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/am_change_requests?status=eq.pending&order=created_at.desc&select=*`,
        { headers }
      )
      const requests = await res.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        requests: requests || [] 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== APPROVE AM CHANGE ====================
    if (action === 'approve_am_change') {
      const { request_id, investor_id, new_am_id, approved_by } = body
      
      await fetch(`${supabaseUrl}/rest/v1/am_change_requests?id=eq.${request_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'approved',
          approved_by,
          approved_at: new Date().toISOString()
        })
      })
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          assigned_acquisition_manager_id: new_am_id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== REJECT AM CHANGE ====================
    if (action === 'reject_am_change') {
      const { request_id, rejected_by, rejection_reason } = body
      
      await fetch(`${supabaseUrl}/rest/v1/am_change_requests?id=eq.${request_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'rejected',
          rejected_by,
          rejection_reason,
          rejected_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET INVESTORS WITHOUT AM ====================
    if (action === 'get_investors_without_am') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/investors?assigned_acquisition_manager_id=is.null&onboarding_completed=eq.true&order=created_at.desc&limit=50&select=id,full_name,email,preferred_markets,portfolio_count,created_at`,
        { headers }
      )
      const investors = await res.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        investors: investors || [] 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== BULK ASSIGN AM ====================
    if (action === 'bulk_assign_am') {
      const { investor_ids, am_id, assigned_by } = body
      
      for (const investorId of investor_ids) {
        await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            assigned_acquisition_manager_id: am_id,
            updated_at: new Date().toISOString()
          })
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        assigned_count: investor_ids.length 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== ASSIGN AM TO INVESTOR ====================
    if (action === 'assign_am_to_investor') {
      const { investor_id, am_id } = body
      
      await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          assigned_acquisition_manager_id: am_id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==================== GET ASSIGNED INVESTORS ====================
    if (action === 'get_assigned_investors') {
      const { am_id } = body
      
      const res = await fetch(
        `${supabaseUrl}/rest/v1/investors?assigned_acquisition_manager_id=eq.${am_id}&order=created_at.desc&select=*`,
        { headers }
      )
      const investors = await res.json()
      
      return new Response(JSON.stringify({ 
        success: true, 
        investors: investors || [] 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== FIND MATCHING EMAILS ====================
    if (action === 'find_matching_emails') {
      // Get all staff emails
      const staffRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?is_active=eq.true&linked_investor_id=is.null&select=id,email,first_name,last_name`,
        { headers }
      )
      const staff = await staffRes.json()
      
      // Get all investor emails
      const invRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?select=id,email,full_name`,
        { headers }
      )
      const investors = await invRes.json()
      
      // Find matches
      const matches = []
      for (const s of (staff || [])) {
        const matchingInvestor = (investors || []).find(
          i => i.email.toLowerCase() === s.email.toLowerCase()
        )
        if (matchingInvestor) {
          matches.push({
            staff_id: s.id,
            staff_email: s.email,
            staff_name: `${s.first_name} ${s.last_name}`,
            investor_id: matchingInvestor.id,
            investor_email: matchingInvestor.email,
            investor_name: matchingInvestor.full_name
          })
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        matches 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==================== AUTO LINK BY EMAIL ====================
    if (action === 'auto_link_by_email') {
      const { email } = body
      
      // Find staff with this email
      const staffRes = await fetch(
        `${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
        { headers }
      )
      const staffData = await staffRes.json()
      
      // Find investor with this email
      const invRes = await fetch(
        `${supabaseUrl}/rest/v1/investors?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`,
        { headers }
      )
      const invData = await invRes.json()
      
      if (!staffData?.[0] || !invData?.[0]) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No matching accounts found' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Link them
      await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${staffData[0].id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          linked_investor_id: invData[0].id,
          updated_at: new Date().toISOString()
        })
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Unknown action
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Unknown action: ${action}` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
