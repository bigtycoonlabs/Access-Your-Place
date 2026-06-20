const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

// manage-staff v10.0 - Fixed email from domain, added find_matching_emails, auto_link_by_email, convert_investor_to_staff
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const getH = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    const body = await req.json();
    const { action } = body;
    console.log('[manage-staff v10.0] Action:', action);

    // v10.0 FIX: Changed from unverified arfrequency.com to verified accessyourplace.com
    async function sendEmail(to: string, subject: string, html: string) {
      if (!RESEND_API_KEY) {
        console.error('[v10.0] RESEND_API_KEY not configured');
        return { success: false, error: 'Email not configured - RESEND_API_KEY missing' };
      }
      try {
        console.log(`[v10.0] Sending email to ${to} subject="${subject}"`);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Access Your Place <notifications@accessyourplace.com>',
            to: [to],
            subject,
            html
          })
        });
        const result = await res.json();
        if (!res.ok) {
          console.error(`[v10.0] Resend API error: status=${res.status} body=${JSON.stringify(result)}`);
          return { success: false, error: result?.message || `Resend API error (${res.status})` };
        }
        console.log(`[v10.0] Email sent successfully to ${to}, id=${result.id}`);
        return { success: true, id: result.id };
      } catch (e: any) {
        console.error(`[v10.0] Email send exception: ${e.message}`);
        return { success: false, error: e.message };
      }
    }

    async function sendSMS(to: string, message: string, recipientName?: string): Promise<{ success: boolean; sid?: string; error?: string }> {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        return { success: false, error: 'SMS not configured' };
      }
      let formattedPhone = String(to).replace(/\D/g, '');
      if (formattedPhone.length === 10) formattedPhone = '+1' + formattedPhone;
      else if (formattedPhone.length === 11 && formattedPhone.charAt(0) === '1') formattedPhone = '+' + formattedPhone;
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const formBody = `To=${encodeURIComponent(formattedPhone)}&From=${encodeURIComponent(TWILIO_PHONE_NUMBER)}&Body=${encodeURIComponent(message)}`;
        const response = await fetch(twilioUrl, { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody });
        const result = await response.json();
        if (response.ok && result.sid) {
          try { await fetch(`${SUPABASE_URL}/rest/v1/sms_logs`, { method: 'POST', headers, body: JSON.stringify({ recipient_phone: formattedPhone, recipient_name: recipientName || null, message_type: 'am_assignment', message_content: message, status: 'sent', delivery_status: 'queued', twilio_sid: result.sid }) }); } catch (logErr) {}
          return { success: true, sid: result.sid };
        }
        return { success: false, error: result.message || 'SMS send failed' };
      } catch (e: any) { return { success: false, error: e.message }; }
    }

    async function createNotification(investorId: string, title: string, message: string, type: string) {
      try { await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications`, { method: 'POST', headers, body: JSON.stringify({ investor_id: investorId, title, message, type, read: false, created_at: new Date().toISOString() }) }); } catch (e) {}
    }

    // ==================== UPDATE TRAINEE PROGRESS (v9.0) ====================
    if (action === 'update_trainee_progress') {
      const { trainee_id, updated_by_id, updated_by_name, pillar_1_deals_approved, pillar_2_leads_generated, pillar_2_leads_closed, pillar_3_full_cycles, pillar_4_exam_score } = body;
      if (!trainee_id) return json({ success: false, error: 'trainee_id is required' }, 400);

      const updates: any = { updated_at: new Date().toISOString() };
      if (pillar_1_deals_approved !== undefined && pillar_1_deals_approved !== null) updates.pillar_1_deals_approved = Math.max(0, parseInt(String(pillar_1_deals_approved)) || 0);
      if (pillar_2_leads_generated !== undefined && pillar_2_leads_generated !== null) updates.pillar_2_leads_generated = Math.max(0, parseInt(String(pillar_2_leads_generated)) || 0);
      if (pillar_2_leads_closed !== undefined && pillar_2_leads_closed !== null) updates.pillar_2_leads_closed = Math.max(0, parseInt(String(pillar_2_leads_closed)) || 0);
      if (pillar_3_full_cycles !== undefined && pillar_3_full_cycles !== null) updates.pillar_3_full_cycles = Math.max(0, parseInt(String(pillar_3_full_cycles)) || 0);
      if (pillar_4_exam_score !== undefined && pillar_4_exam_score !== null) {
        const score = Math.max(0, Math.min(100, parseInt(String(pillar_4_exam_score)) || 0));
        updates.pillar_4_exam_score = score;
        updates.pillar_4_exam_passed = score >= 90;
      }

      const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${trainee_id}&select=pillar_1_deals_approved,pillar_2_leads_generated,pillar_2_leads_closed,pillar_3_full_cycles,pillar_4_exam_score,pillar_4_exam_passed,first_name,last_name,email`, { headers: getH });
      const current = (await currentRes.json())?.[0];
      
      if (current) {
        const finalP1 = updates.pillar_1_deals_approved ?? current.pillar_1_deals_approved ?? 0;
        const finalP2Gen = updates.pillar_2_leads_generated ?? current.pillar_2_leads_generated ?? 0;
        const finalP2Close = updates.pillar_2_leads_closed ?? current.pillar_2_leads_closed ?? 0;
        const finalP3 = updates.pillar_3_full_cycles ?? current.pillar_3_full_cycles ?? 0;
        const finalP4Passed = updates.pillar_4_exam_passed ?? current.pillar_4_exam_passed ?? false;
        const allComplete = finalP1 >= 3 && finalP2Gen >= 3 && finalP2Close >= 2 && finalP3 >= 3 && finalP4Passed;
        if (allComplete) {
          updates.yp_certified = true;
          updates.trainee_status = 'certified';
          updates.commission_split = 100;
          if (current.email) {
            sendEmail(current.email, 'Congratulations! You are now YP Certified!',
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#d4a574,#c49464);padding:30px;text-align:center;border-radius:10px 10px 0 0;"><h1 style="color:#fff;margin:0;font-size:28px;">YP CERTIFIED</h1></div><div style="padding:30px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 10px 10px;"><p>Congratulations ${current.first_name || 'Team Member'}!</p><p>You have completed all 4 Pillars and are now a YP Certified Acquisition Manager.</p><div style="background:#ecfdf5;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #a7f3d0;"><p style="margin:0;color:#065f46;font-weight:bold;">Your commission rate has been upgraded!</p></div></div></div>`
            ).catch(() => {});
          }
        }
      }

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${trainee_id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
      if (!updateRes.ok) { const errText = await updateRes.text(); return json({ success: false, error: 'Failed to update: ' + errText.substring(0, 200) }); }

      try { await fetch(`${SUPABASE_URL}/rest/v1/mentor_communication_log`, { method: 'POST', headers, body: JSON.stringify({ mentor_id: updated_by_id || null, mentor_name: updated_by_name || 'Staff', trainee_id, message_type: 'progress_update', message: `Progress updated`, created_at: new Date().toISOString() }) }); } catch (e) {}

      return json({ success: true, message: 'Trainee progress updated', auto_certified: updates.yp_certified === true });
    }

    // ==================== FIND MATCHING EMAILS (v10.0) ====================
    if (action === 'find_matching_emails') {
      console.log('[v10.0] Finding matching emails between staff and investors...');
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?select=id,email,first_name,last_name,name,linked_investor_id&is_active=eq.true`, { headers: getH });
      const staffList = staffRes.ok ? await staffRes.json() : [];
      
      const investorRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,email,full_name,linked_staff_id&limit=5000`, { headers: getH });
      const investorList = investorRes.ok ? await investorRes.json() : [];
      
      if (!Array.isArray(staffList) || !Array.isArray(investorList)) {
        return json({ success: true, matches: [], already_linked: 0, unlinked_matches: 0 });
      }

      const investorByEmail: Record<string, any> = {};
      for (const inv of investorList) {
        if (inv.email) investorByEmail[inv.email.toLowerCase()] = inv;
      }

      const matches: any[] = [];
      let alreadyLinked = 0;
      let unlinkedMatches = 0;

      for (const staff of staffList) {
        if (!staff.email) continue;
        const matchingInvestor = investorByEmail[staff.email.toLowerCase()];
        if (matchingInvestor) {
          const isLinked = !!(staff.linked_investor_id || matchingInvestor.linked_staff_id);
          if (isLinked) alreadyLinked++;
          else unlinkedMatches++;
          matches.push({
            staff_id: staff.id,
            staff_name: staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
            staff_email: staff.email,
            investor_id: matchingInvestor.id,
            investor_name: matchingInvestor.full_name || matchingInvestor.email,
            investor_email: matchingInvestor.email,
            already_linked: isLinked
          });
        }
      }

      return json({ success: true, matches, already_linked: alreadyLinked, unlinked_matches: unlinkedMatches, total_staff: staffList.length, total_investors: investorList.length });
    }

    // ==================== AUTO LINK BY EMAIL (v10.0) ====================
    if (action === 'auto_link_by_email') {
      const { email } = body;
      if (!email) return json({ success: false, error: 'email required' });
      const emailLower = email.toLowerCase().trim();

      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=id,linked_investor_id`, { headers: getH });
      const staff = (await staffRes.json())?.[0];
      if (!staff) return json({ success: false, error: 'No staff account with this email' });

      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(emailLower)}&select=id,linked_staff_id`, { headers: getH });
      const investor = (await invRes.json())?.[0];
      if (!investor) return json({ success: false, error: 'No investor account with this email' });

      if (staff.linked_investor_id || investor.linked_staff_id) {
        return json({ success: true, already_linked: true, message: 'Accounts are already linked' });
      }

      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff.id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: investor.id }) });
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor.id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: staff.id }) });

      return json({ success: true, linked: true, staff_id: staff.id, investor_id: investor.id });
    }

    // ==================== CONVERT INVESTOR TO STAFF (v10.0) ====================
    if (action === 'convert_investor_to_staff') {
      const { investor_id, department, roles, mentor_id, mentor_name, base_url } = body;
      if (!investor_id || !department) return json({ success: false, error: 'investor_id and department required' });

      // Fetch investor data
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,email,full_name,phone,linked_staff_id`, { headers: getH });
      const investor = (await invRes.json())?.[0];
      if (!investor) return json({ success: false, error: 'Investor not found' });
      if (!investor.email) return json({ success: false, error: 'Investor has no email address' });

      const emailLower = investor.email.toLowerCase().trim();

      // Check if staff account already exists with this email
      const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=id,first_name,last_name`, { headers: getH });
      const existingStaff = (await existingRes.json())?.[0];

      if (existingStaff) {
        // Staff account exists - just link them
        await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${existingStaff.id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: investor_id }) });
        await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: existingStaff.id }) });
        return json({ success: true, converted: false, linked: true, staff_id: existingStaff.id, message: `Staff account already exists for ${emailLower}. Accounts have been linked.` });
      }

      // Create new staff account from investor data
      const nameParts = (investor.full_name || '').split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';
      const tempPassword = 'Ayp' + Math.random().toString(36).slice(-6) + '!' + Math.floor(Math.random() * 100);
      const isAM = department === 'acquisition_managers';

      const staffData: any = {
        email: emailLower,
        first_name: firstName,
        last_name: lastName,
        name: investor.full_name || emailLower,
        phone: investor.phone || null,
        department,
        role: department,
        roles: roles?.length > 0 ? roles : [department],
        team: department,
        is_active: true,
        account_completed: false,
        password_hash: tempPassword,
        linked_investor_id: investor_id,
        created_at: new Date().toISOString()
      };

      if (isAM && mentor_id) {
        staffData.assigned_mentor_id = mentor_id;
        staffData.assigned_mentor_name = mentor_name || 'Certified AM';
        staffData.trainee_status = 'active';
        staffData.trainee_start_date = new Date().toISOString();
        const certDeadline = new Date();
        certDeadline.setMonth(certDeadline.getMonth() + 4);
        staffData.certification_deadline = certDeadline.toISOString();
        staffData.commission_split = 50;
      }

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users`, { method: 'POST', headers, body: JSON.stringify(staffData) });
      if (!createRes.ok) {
        const errText = await createRes.text();
        return json({ success: false, error: `Failed to create staff: ${errText}` });
      }
      const newStaff = await createRes.json();
      const newStaffId = newStaff?.[0]?.id || newStaff?.id;

      // Link investor to new staff
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: newStaffId }) });

      // Send welcome email
      const loginUrl = `${base_url || 'https://accessyourplace.com'}/staff/login`;
      const emailResult = await sendEmail(emailLower, 'Welcome to Access Your Place - Staff Account Created',
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">Welcome to the Team, ${firstName}!</h2><p>Your staff account has been created and linked to your investor account:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e2e8f0;"><p><strong>Email:</strong> ${emailLower}</p><p><strong>Temporary Password:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:16px;font-weight:bold;">${tempPassword}</code></p><p><strong>Department:</strong> ${department.replace(/_/g, ' ')}</p></div><p style="color:#dc2626;font-weight:bold;">Use the temporary password above to log in. You will be prompted to change it.</p><p><a href="${loginUrl}" style="display:inline-block;background:#d4a574;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">Login to Staff Dashboard</a></p></div></div>`
      );

      return json({
        success: true,
        converted: true,
        linked: true,
        staff_id: newStaffId,
        email_sent: emailResult.success,
        temp_password: tempPassword,
        message: `Investor ${investor.full_name} converted to staff and accounts linked.`
      });
    }

    // ==================== SEARCH INVESTORS FOR CONVERSION (v10.0) ====================
    if (action === 'search_investors') {
      const { query } = body;
      if (!query || query.trim().length < 2) return json({ success: true, investors: [] });
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,email,full_name,phone,company_name,linked_staff_id&order=created_at.desc&limit=500`, { headers: getH });
      const allInvestors = invRes.ok ? await invRes.json() : [];
      if (!Array.isArray(allInvestors)) return json({ success: true, investors: [] });
      const q = query.toLowerCase().trim();
      const results = allInvestors.filter((i: any) =>
        (i.full_name || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q) ||
        (i.phone || '').includes(query) ||
        (i.company_name || '').toLowerCase().includes(q)
      ).slice(0, 20).map((i: any) => ({
        id: i.id,
        full_name: i.full_name,
        email: i.email,
        phone: i.phone,
        company_name: i.company_name,
        already_linked: !!i.linked_staff_id
      }));
      return json({ success: true, investors: results });
    }

    // ==================== INVESTOR AM VERIFICATION REQUESTS ====================
    if (action === 'get_am_verification_requests') {
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?am_verification_status=eq.pending&select=id,email,full_name,phone,acquisition_manager_first_name,acquisition_manager_last_name,am_verification_status,am_verification_requested_at,account_funded,created_at&order=am_verification_requested_at.desc`, { headers: getH });
      if (!invRes.ok) return json({ success: true, requests: [] });
      return json({ success: true, requests: await invRes.json() || [] });
    }

    if (action === 'get_certified_ams') {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?or=(department.eq.acquisition_managers,roles.cs.{acquisition_managers})&is_active=eq.true&select=id,name,first_name,last_name,email,phone,yp_certified,yp_certification_verified`, { headers: getH });
      const ams = await amRes.json() || [];
      const formattedAms = ams.map((am: any) => ({ id: am.id, full_name: am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim(), email: am.email, phone: am.phone, yp_certified: am.yp_certified || am.yp_certification_verified }));
      return json({ success: true, ams: formattedAms });
    }

    if (action === 'verify_am_request') {
      const { investor_id, am_staff_id, verified_by } = body;
      if (!investor_id || !am_staff_id) return json({ success: false, error: 'investor_id and am_staff_id are required' }, 400);
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,email,full_name,phone`, { headers: getH });
      const investor = (await invRes.json())?.[0];
      if (!investor) return json({ success: false, error: 'Investor not found' }, 404);
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${am_staff_id}&select=id,name,first_name,last_name,email,phone`, { headers: getH });
      const am = (await amRes.json())?.[0];
      if (!am) return json({ success: false, error: 'AM not found' }, 404);
      const amName = am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim();
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ assigned_am_id: am_staff_id, assigned_acquisition_manager_id: am_staff_id, assigned_am_name: amName, am_verification_status: 'verified', am_verified_at: new Date().toISOString(), am_verified_by: verified_by, am_assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
      if (investor.email) sendEmail(investor.email, 'Your Acquisition Manager Has Been Verified', `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">Great News!</h2><p>Your AM <strong>${amName}</strong> has been verified.</p><p><a href="https://accessyourplace.com/investor" style="display:inline-block;background:#d4a574;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">Go to Portal</a></p></div></div>`).catch(() => {});
      if (am.email) sendEmail(am.email, 'New Investor Assigned', `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">New Investor Assignment</h2><p><strong>${investor.full_name || 'Investor'}</strong> has been assigned to you.</p></div></div>`).catch(() => {});
      if (investor.phone) sendSMS(investor.phone, `Access Your Place: Your AM ${amName} has been verified!`).catch(() => {});
      if (am.phone) sendSMS(am.phone, `Access Your Place: New investor ${investor.full_name || 'Investor'} assigned to you.`).catch(() => {});
      await createNotification(investor_id, 'AM Verified', `Your AM ${amName} has been verified.`, 'am_verified');
      return json({ success: true, message: 'AM verified and linked successfully' });
    }

    if (action === 'reject_am_request') {
      const { investor_id, reason } = body;
      if (!investor_id) return json({ success: false, error: 'investor_id is required' }, 400);
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,email,full_name,phone`, { headers: getH });
      const investor = (await invRes.json())?.[0];
      if (!investor) return json({ success: false, error: 'Investor not found' }, 404);
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ am_verification_status: 'not_found', am_verification_rejection_reason: reason || 'No certified AM found', updated_at: new Date().toISOString() }) });
      if (investor.email) sendEmail(investor.email, 'AM Verification Update', `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">AM Verification Update</h2><p>We were unable to verify the requested AM. ${reason ? 'Reason: ' + reason : ''}</p></div></div>`).catch(() => {});
      await createNotification(investor_id, 'AM Not Found', `We couldn't verify the requested AM.`, 'am_not_found');
      return json({ success: true });
    }

    if (action === 'assign_am_to_investor') {
      const { investor_id, am_staff_id, assigned_by } = body;
      if (!investor_id || !am_staff_id) return json({ success: false, error: 'investor_id and am_staff_id are required' }, 400);
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,email,full_name,phone`, { headers: getH });
      const investor = (await invRes.json())?.[0];
      if (!investor) return json({ success: false, error: 'Investor not found' }, 404);
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${am_staff_id}&select=id,name,first_name,last_name,email,phone`, { headers: getH });
      const am = (await amRes.json())?.[0];
      if (!am) return json({ success: false, error: 'AM not found' }, 404);
      const amName = am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim();
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ assigned_am_id: am_staff_id, assigned_acquisition_manager_id: am_staff_id, assigned_am_name: amName, am_verification_status: 'verified', am_verified_at: new Date().toISOString(), am_assigned_at: new Date().toISOString(), am_assigned_by: assigned_by || null, updated_at: new Date().toISOString() }) });
      if (investor.email) sendEmail(investor.email, 'Your AM Has Been Assigned', `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">AM Assigned!</h2><p>${amName} has been assigned as your Acquisition Manager.</p></div></div>`).catch(() => {});
      if (am.email) sendEmail(am.email, 'New Investor Assigned', `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">New Investor Assignment</h2><p>${investor.full_name || 'Investor'} has been assigned to you.</p></div></div>`).catch(() => {});
      if (investor.phone) sendSMS(investor.phone, `Access Your Place: ${amName} has been assigned as your AM!`).catch(() => {});
      if (am.phone) sendSMS(am.phone, `Access Your Place: New investor ${investor.full_name || 'Investor'} assigned to you.`).catch(() => {});
      await createNotification(investor_id, 'AM Assigned', `${amName} has been assigned as your AM.`, 'am_assigned');
      return json({ success: true });
    }

    // ==================== GET ALL STAFF ====================
    if (action === 'get_staff') {
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?select=*&order=created_at.desc`, { headers: getH });
      if (!staffRes.ok) return json({ success: false, error: await staffRes.text() }, 500);
      return json({ success: true, staff: await staffRes.json() || [] });
    }

    // ==================== ADD STAFF (v10.0: improved email logging) ====================
    if (action === 'add_staff') {
      const { first_name, last_name, email, phone, department, roles, base_url, mentor_id, mentor_name } = body;
      if (!first_name || !last_name || !email || !department) return json({ success: false, error: 'first_name, last_name, email, and department are required' }, 400);
      
      const emailLower = email.toLowerCase().trim();
      const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?email=eq.${encodeURIComponent(emailLower)}&select=id`, { headers: getH });
      const existing = await existingRes.json();
      if (existing?.length > 0) return json({ success: false, error: 'A staff member with this email already exists' }, 400);
      
      const tempPassword = 'Ayp' + Math.random().toString(36).slice(-6) + '!' + Math.floor(Math.random() * 100);
      const fullName = `${first_name.trim()} ${last_name.trim()}`;
      const isAM = department === 'acquisition_managers';
      
      const staffData: any = { 
        email: emailLower, first_name: first_name.trim(), last_name: last_name.trim(), name: fullName, 
        phone: phone || null, department, role: department, roles: roles?.length > 0 ? roles : [department], 
        team: department, is_active: true, account_completed: false, password_hash: tempPassword, 
        created_at: new Date().toISOString() 
      };

      // Check if investor account exists with same email and auto-link
      const invCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(emailLower)}&select=id,full_name`, { headers: getH });
      const matchingInvestor = (await invCheckRes.json())?.[0];
      if (matchingInvestor) {
        staffData.linked_investor_id = matchingInvestor.id;
        console.log(`[v10.0] Auto-linking new staff to existing investor: ${matchingInvestor.id} (${matchingInvestor.full_name})`);
      }
      
      if (isAM && mentor_id) {
        staffData.assigned_mentor_id = mentor_id;
        staffData.assigned_mentor_name = mentor_name || 'Certified AM';
        staffData.trainee_status = 'active';
        staffData.trainee_start_date = new Date().toISOString();
        const certDeadline = new Date();
        certDeadline.setMonth(certDeadline.getMonth() + 4);
        staffData.certification_deadline = certDeadline.toISOString();
        staffData.commission_split = 50;
      }
      
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users`, { method: 'POST', headers, body: JSON.stringify(staffData) });
      if (!createRes.ok) {
        const errText = await createRes.text();
        return json({ success: false, error: `Failed to create staff: ${errText}` }, 500);
      }
      const newStaff = await createRes.json();
      const newStaffId = newStaff?.[0]?.id || newStaff?.id;

      // If auto-linked, update investor side too
      if (matchingInvestor && newStaffId) {
        await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${matchingInvestor.id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: newStaffId }) });
      }
      
      const loginUrl = `${base_url || 'https://accessyourplace.com'}/staff/login`;
      console.log(`[v10.0] Sending welcome email to ${emailLower} with temp password`);
      const emailResult = await sendEmail(emailLower, 'Welcome to Access Your Place - Staff Account Created',
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">Welcome to the Team, ${first_name}!</h2><p>Your staff account has been created:</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e2e8f0;"><p><strong>Email:</strong> ${emailLower}</p><p><strong>Temporary Password:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:16px;font-weight:bold;">${tempPassword}</code></p><p><strong>Department:</strong> ${department.replace(/_/g, ' ')}</p></div><p style="color:#dc2626;font-weight:bold;">Important: Use the temporary password above to log in. You will be prompted to change it.</p><p><a href="${loginUrl}" style="display:inline-block;background:#d4a574;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">Login to Staff Dashboard</a></p></div></div>`
      );
      console.log(`[v10.0] Welcome email result: success=${emailResult.success} error=${emailResult.error || 'none'}`);
      
      if (isAM && !mentor_id) {
        try {
          const smRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?department=eq.success_managers&is_active=eq.true&select=email,first_name`, { headers: getH });
          const successManagers = await smRes.json();
          if (Array.isArray(successManagers)) {
            for (const sm of successManagers) {
              if (sm.email) sendEmail(sm.email, `Action Required: New AM ${fullName} Needs Mentor Assignment`, `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1e3a5f;padding:20px;text-align:center;"><h1 style="color:#fff;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#fff;border:1px solid #e5e7eb;"><div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px;"><h3 style="color:#92400e;margin:0 0 8px;">Mentor Assignment Needed</h3><p style="color:#92400e;margin:0;">A new AM has been added but has not been assigned a mentor.</p></div><p><strong>Name:</strong> ${fullName}</p><p><strong>Email:</strong> ${emailLower}</p><div style="text-align:center;margin:24px 0;"><a href="https://accessyourplace.com/staff" style="background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">Go to Staff Dashboard</a></div></div></div>`).catch(() => {});
            }
          }
        } catch (notifyErr) {}
      }
      
      return json({ 
        success: true, staff: newStaff?.[0] || newStaff, staff_id: newStaffId, id: newStaffId, 
        temp_password: tempPassword, email_sent: emailResult.success, email_error: emailResult.error || null,
        mentor_assigned: isAM && !!mentor_id, auto_linked_investor: !!matchingInvestor,
        message: `Staff member ${fullName} created successfully.${matchingInvestor ? ' Auto-linked to existing investor account.' : ''}`
      });
    }

    // ==================== UPDATE STAFF ====================
    if (action === 'update_staff') {
      const { staff_id, updates } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      if (updates.first_name || updates.last_name) {
        const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=first_name,last_name`, { headers: getH });
        const currentStaff = (await staffRes.json())?.[0];
        if (currentStaff) updates.name = `${updates.first_name || currentStaff.first_name} ${updates.last_name || currentStaff.last_name}`;
      }
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
      return updateRes.ok ? json({ success: true }) : json({ success: false, error: 'Failed to update staff' }, 500);
    }

    // ==================== GET DEPARTMENTS ====================
    if (action === 'get_departments') {
      return json({ success: true, departments: [
        { id: 'success_managers', name: 'Success Managers', description: 'Manage client success and operations', permissions: ['all'] },
        { id: 'acquisition_managers', name: 'Acquisition Managers', description: 'Source and close property deals', permissions: ['deals', 'investors', 'crm'] },
        { id: 'setup_managers', name: 'Setup Managers', description: 'Manage property setup and launch', permissions: ['setups', 'deals'] },
        { id: 'content_team', name: 'Content Team', description: 'Create and manage content', permissions: ['content'] },
        { id: 'support_team', name: 'Support Team', description: 'Handle customer support', permissions: ['support', 'investors'] }
      ]});
    }

    // ==================== UPDATE ROLES ====================
    if (action === 'update_roles') {
      const { staff_id, roles } = body;
      if (!staff_id || !roles?.length) return json({ success: false, error: 'staff_id and roles are required' }, 400);
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ roles, department: roles[0], role: roles[0] }) });
      return updateRes.ok ? json({ success: true }) : json({ success: false, error: 'Failed to update roles' }, 500);
    }

    // ==================== RESEND INVITATION ====================
    if (action === 'resend_invitation') {
      const { staff_id, base_url } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=*`, { headers: getH });
      const staff = (await staffRes.json())?.[0];
      if (!staff) return json({ success: false, error: 'Staff member not found' }, 404);
      const tempPassword = 'Ayp' + Math.random().toString(36).slice(-6) + '!' + Math.floor(Math.random() * 100);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ password_hash: tempPassword, account_completed: false }) });
      const loginUrl = `${base_url || 'https://accessyourplace.com'}/staff/login`;
      const emailResult = await sendEmail(staff.email, 'Access Your Place - New Login Credentials',
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:20px;text-align:center;"><h1 style="color:white;margin:0;">Access Your Place</h1></div><div style="padding:30px;background:#f8fafc;"><h2 style="color:#1a365d;">New Login Credentials</h2><p>Hi ${staff.first_name || staff.name},</p><div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e2e8f0;"><p><strong>Email:</strong> ${staff.email}</p><p><strong>Temporary Password:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-size:16px;font-weight:bold;">${tempPassword}</code></p></div><p style="color:#dc2626;font-weight:bold;">Use this temporary password to log in directly.</p><p><a href="${loginUrl}" style="display:inline-block;background:#d4a574;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">Login to Staff Dashboard</a></p></div></div>`
      );
      return json({ success: true, message: 'New credentials sent', email_sent: emailResult.success, email_error: emailResult.error || null });
    }

    // ==================== DEACTIVATE/REACTIVATE STAFF ====================
    if (action === 'deactivate_staff' || action === 'reactivate_staff') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ is_active: action === 'reactivate_staff' }) });
      return json({ success: true });
    }

    // ==================== DELETE STAFF ====================
    if (action === 'delete_staff') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'DELETE', headers });
      return deleteRes.ok ? json({ success: true }) : json({ success: false, error: 'Failed to delete staff' }, 500);
    }

    // ==================== GET ACQUISITION MANAGERS WITH COUNTS ====================
    if (action === 'get_acquisition_managers_with_counts') {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?or=(department.eq.acquisition_managers,roles.cs.{acquisition_managers})&is_active=eq.true&select=id,name,first_name,last_name,email,phone,yp_certified,yp_certification_verified,created_at`, { headers: getH });
      const ams = await amRes.json() || [];
      const amWithCounts = await Promise.all(ams.map(async (am: any) => {
        const countRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?or=(assigned_am_id.eq.${am.id},assigned_acquisition_manager_id.eq.${am.id})&select=id`, { headers: getH });
        const investors = await countRes.json() || [];
        return { ...am, investor_count: investors.length, display_name: am.name || `${am.first_name || ''} ${am.last_name || ''}`.trim() || am.email };
      }));
      return json({ success: true, acquisition_managers: amWithCounts });
    }

    // ==================== GET INVESTORS WITHOUT AM ====================
    if (action === 'get_investors_without_am') {
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,full_name,email,phone,created_at,status,investor_type,assigned_am_id,assigned_acquisition_manager_id&order=created_at.desc&limit=100`, { headers: getH });
      const allInvestors = await invRes.json() || [];
      const unassigned = allInvestors.filter((inv: any) => !inv.assigned_am_id && !inv.assigned_acquisition_manager_id);
      return json({ success: true, investors: unassigned });
    }

    // ==================== BULK ASSIGN AM ====================
    if (action === 'bulk_assign_am') {
      const { investor_ids, am_id, assigned_by } = body;
      if (!investor_ids?.length || !am_id) return json({ success: false, error: 'investor_ids array and am_id are required' }, 400);
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${am_id}&select=name,first_name,last_name,phone`, { headers: getH });
      const am = (await amRes.json())?.[0];
      const amName = am?.name || `${am?.first_name || ''} ${am?.last_name || ''}`.trim();
      let successCount = 0;
      for (const investor_id of investor_ids) {
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ assigned_am_id: am_id, assigned_acquisition_manager_id: am_id, assigned_am_name: amName, am_assigned_at: new Date().toISOString(), am_assigned_by: assigned_by || null }) });
        if (updateRes.ok) successCount++;
      }
      return json({ success: true, assigned_count: successCount, total: investor_ids.length });
    }

    // ==================== CERTIFICATIONS ====================
    if (action === 'get_certifications') {
      const certRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_certifications?select=*&order=uploaded_at.desc`, { headers: getH });
      return json({ success: true, certifications: certRes.ok ? await certRes.json() || [] : [] });
    }

    if (action === 'upload_certification') {
      const { staff_id, certification_url, file_name, uploaded_by } = body;
      if (!staff_id || !certification_url) return json({ success: false, error: 'staff_id and certification_url are required' }, 400);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_certifications`, { method: 'POST', headers, body: JSON.stringify({ staff_id, certification_type: 'yp_certification', file_url: certification_url, file_name: file_name || 'certification.pdf', status: 'pending', uploaded_by, uploaded_at: new Date().toISOString() }) });
      return json({ success: true });
    }

    if (action === 'verify_certification') {
      const { certification_id, verified_by } = body;
      if (!certification_id) return json({ success: false, error: 'certification_id is required' }, 400);
      const certRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_certifications?id=eq.${certification_id}&select=*`, { headers: getH });
      const cert = (await certRes.json())?.[0];
      if (!cert) return json({ success: false, error: 'Certification not found' }, 404);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_certifications?id=eq.${certification_id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'approved', verified_by, verified_at: new Date().toISOString() }) });
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${cert.staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ yp_certified: true, yp_certification_id: certification_id, yp_certification_url: cert.file_url, yp_certification_verified: true }) });
      return json({ success: true });
    }

    if (action === 'reject_certification') {
      const { certification_id, verified_by, rejection_reason } = body;
      if (!certification_id) return json({ success: false, error: 'certification_id is required' }, 400);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_certifications?id=eq.${certification_id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'rejected', verified_by, verified_at: new Date().toISOString(), rejection_reason }) });
      return json({ success: true });
    }

    // ==================== ACCOUNT LINKING ====================
    if (action === 'get_linked_investor') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=linked_investor_id`, { headers: getH });
      const staff = (await staffRes.json())?.[0];
      if (!staff?.linked_investor_id) return json({ success: true, investor: null });
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${staff.linked_investor_id}&select=id,full_name,email`, { headers: getH });
      return json({ success: true, investor: (await invRes.json())?.[0] });
    }

    if (action === 'link_to_investor' || action === 'link_investor_account') {
      const { staff_id, investor_id, investor_email } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      let targetInvestorId = investor_id;
      if (!targetInvestorId && investor_email) {
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(investor_email.toLowerCase())}&select=id`, { headers: getH });
        const investors = await invRes.json();
        if (investors?.length > 0) targetInvestorId = investors[0].id;
        else return json({ success: false, error: 'Investor not found with that email' }, 404);
      }
      if (!targetInvestorId) return json({ success: false, error: 'investor_id or investor_email is required' }, 400);
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: targetInvestorId }) });
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${targetInvestorId}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: staff_id }) });
      return json({ success: true });
    }

    if (action === 'unlink_from_investor' || action === 'unlink_investor_account') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=linked_investor_id`, { headers: getH });
      const staff = (await staffRes.json())?.[0];
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_investor_id: null }) });
      if (staff?.linked_investor_id) await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${staff.linked_investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ linked_staff_id: null }) });
      return json({ success: true });
    }

    if (action === 'get_link_suggestions') {
      const { staff_id } = body;
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=email`, { headers: getH });
      const staff = (await staffRes.json())?.[0];
      if (!staff?.email) return json({ success: true, suggestions: [] });
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?email=eq.${encodeURIComponent(staff.email)}&linked_staff_id=is.null&select=id,full_name,email`, { headers: getH });
      return json({ success: true, suggestions: await invRes.json() || [] });
    }

    // ==================== NOTIFICATIONS ====================
    if (action === 'notify_success_managers') {
      const { notification_type, data } = body;
      const smRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?department=eq.success_managers&is_active=eq.true&select=id,name,first_name,last_name,email,phone`, { headers: getH });
      const successManagers = await smRes.json() || [];
      let emailsSent = 0;
      for (const sm of successManagers) {
        if (sm.email) { const result = await sendEmail(sm.email, `Access Your Place: ${notification_type}`, `<p>Notification: ${notification_type}</p><pre>${JSON.stringify(data, null, 2)}</pre>`); if (result.success) emailsSent++; }
      }
      return json({ success: true, emails_sent: emailsSent });
    }

    if (action === 'get_staff_list') {
      const { role, department } = body;
      let url = `${SUPABASE_URL}/rest/v1/staff_users?select=id,name,first_name,last_name,email,phone,role,department,is_active&is_active=eq.true`;
      if (role) url += `&role=eq.${encodeURIComponent(role)}`;
      if (department) url += `&department=eq.${encodeURIComponent(department)}`;
      const staffRes = await fetch(url, { headers: getH });
      return json({ success: true, staff: await staffRes.json() || [] });
    }

    if (action === 'get_unread_count') {
      const { staff_id } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400);
      const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_messages?recipient_id=eq.${staff_id}&read=eq.false&select=id`, { headers: getH });
      return json({ success: true, count: msgRes.ok ? (await msgRes.json())?.length || 0 : 0 });
    }

    // ==================== AM ASSIGNMENT REQUESTS ====================
    if (action === 'get_am_assignment_requests' || action === 'get_am_change_requests') {
      const { status = 'pending' } = body;
      const table = action === 'get_am_assignment_requests' ? 'am_assignment_requests' : 'am_change_requests';
      let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc`;
      if (status !== 'all') url += `&status=eq.${status}`;
      const reqRes = await fetch(url, { headers: getH });
      return json({ success: true, requests: reqRes.ok ? await reqRes.json() || [] : [] });
    }

    if (action === 'approve_am_assignment_request') {
      const { request_id, approved_by } = body;
      if (!request_id) return json({ success: false, error: 'request_id is required' }, 400);
      const reqRes = await fetch(`${SUPABASE_URL}/rest/v1/am_assignment_requests?id=eq.${request_id}&select=*`, { headers: getH });
      const request = (await reqRes.json())?.[0];
      if (!request) return json({ success: false, error: 'Request not found' }, 404);
      await fetch(`${SUPABASE_URL}/rest/v1/am_assignment_requests?id=eq.${request_id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'approved', approved_by, approved_at: new Date().toISOString() }) });
      if (request.investor_id && request.requested_am_id) await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${request.investor_id}`, { method: 'PATCH', headers, body: JSON.stringify({ assigned_am_id: request.requested_am_id, assigned_acquisition_manager_id: request.requested_am_id, am_assigned_at: new Date().toISOString(), am_assigned_by: approved_by }) });
      return json({ success: true });
    }

    if (action === 'reject_am_assignment_request') {
      const { request_id, rejected_by, rejection_reason } = body;
      if (!request_id) return json({ success: false, error: 'request_id is required' }, 400);
      await fetch(`${SUPABASE_URL}/rest/v1/am_assignment_requests?id=eq.${request_id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'rejected', rejected_by, rejected_at: new Date().toISOString(), rejection_reason }) });
      return json({ success: true });
    }

    // DEFAULT
    return json({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (error: any) {
    console.error('[manage-staff v10.0] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

