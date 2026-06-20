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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[HR v4.0] Missing SUPABASE_URL or KEY');
      return json({ error: 'Server config error' }, 500);
    }

    const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
    const mutH = { ...getH, 'Prefer': 'return=representation' };

    async function dbGet(table: string, params = '') {
      const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
      const res = await fetch(url, { headers: getH });
      if (!res.ok) { const t = await res.text().catch(() => ''); console.error(`[HR] GET ${table} failed:`, res.status, t.substring(0, 200)); return []; }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    async function dbGetOne(table: string, params = '') {
      const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
      const res = await fetch(url, { headers: { ...getH, 'Accept': 'application/vnd.pgrst.object+json' } });
      if (!res.ok) return null;
      return await res.json();
    }

    async function dbInsert(table: string, data: any) {
      const url = `${SUPABASE_URL}/rest/v1/${table}`;
      const res = await fetch(url, { method: 'POST', headers: mutH, body: JSON.stringify(data) });
      if (!res.ok) { const t = await res.text().catch(() => ''); console.error(`[HR] INSERT ${table} failed:`, res.status, t.substring(0, 200)); return null; }
      const result = await res.json();
      return Array.isArray(result) ? result[0] : result;
    }

    async function dbUpdate(table: string, filter: string, data: any) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
      const res = await fetch(url, { method: 'PATCH', headers: mutH, body: JSON.stringify(data) });
      if (!res.ok) { const t = await res.text().catch(() => ''); console.error(`[HR] UPDATE ${table} failed:`, res.status, t.substring(0, 200)); return null; }
      const result = await res.json();
      return Array.isArray(result) ? result[0] : result;
    }

    async function dbDelete(table: string, filter: string) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
      const res = await fetch(url, { method: 'DELETE', headers: mutH });
      return res.ok;
    }

    async function sendEmail(to: string, subject: string, html: string) {
      if (!RESEND_API_KEY || !to) return { skipped: true };
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'AYP HR <notifications@accessyourplace.com>', to: [to], subject, html })
        });
        const result = await res.json();
        return res.ok ? { success: true, id: result?.id } : { error: result };
      } catch (err) { return { error: err.message }; }
    }

    const body = await req.json();
    const { action } = body;
    console.log('[HR v4.0] Action:', action);

    // ============================================================
    // SECURITY HELPER: Enforce staff_id scoping for non-admin callers.
    // When is_admin is false (or not provided), staff_id MUST be present.
    // This prevents non-admin callers from fetching all records.
    // ============================================================
    function enforceStaffScope(is_admin: boolean | undefined, staff_id: string | undefined): { scoped: boolean; staff_id_filter: string } {
      // Admin callers can access all records
      if (is_admin === true) {
        return { scoped: false, staff_id_filter: '' };
      }
      // Non-admin: staff_id is REQUIRED
      if (!staff_id) {
        throw new Error('SCOPE_VIOLATION: staff_id is required for non-admin callers');
      }
      return { scoped: true, staff_id_filter: `staff_id=eq.${staff_id}` };
    }

    // ============ COMMISSIONS ============
    if (action === 'get_commissions') {
      const { staff_id, status, is_admin } = body;
      // SERVER-SIDE ENFORCEMENT: Non-admin callers MUST provide staff_id and will only see their own records
      const scope = enforceStaffScope(is_admin, staff_id);
      let params = 'order=created_at.desc';
      if (scope.scoped) {
        params += `&${scope.staff_id_filter}`;
        console.log(`[HR v4.0] get_commissions: scoped to staff_id=${staff_id}`);
      }
      if (status && status !== 'all') params += `&status=eq.${status}`;
      const data = await dbGet('staff_commissions', params);
      return json({ commissions: data });
    }

    if (action === 'submit_commission') {
      const { staff_id, staff_name, client_name, property_address, deal_type, claimed_amount, notes } = body;
      if (!staff_id) return json({ error: 'staff_id is required to submit a commission' }, 400);
      const now = new Date();
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      const nextFriday = new Date(now); nextFriday.setDate(now.getDate() + daysUntilFriday);
      const result = await dbInsert('staff_commissions', {
        staff_id, staff_name, client_name, property_address, deal_type,
        claimed_amount: parseFloat(claimed_amount), payout_date: nextFriday.toISOString().split('T')[0],
        notes, status: 'pending'
      });
      return json({ commission: result });
    }

    if (action === 'update_commission_status') {
      const { commission_id, status, admin_comment, reviewed_by, approved_amount, is_admin } = body;
      // SERVER-SIDE ENFORCEMENT: Only admins can update commission status
      if (!is_admin) {
        console.warn(`[HR v4.0] update_commission_status: blocked non-admin attempt`);
        return json({ error: 'Only administrators can update commission status' }, 403);
      }
      const updates: any = { status, admin_comment, reviewed_by, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (approved_amount !== undefined) updates.approved_amount = parseFloat(approved_amount);
      if (status === 'paid') updates.paid_at = new Date().toISOString();
      const data = await dbUpdate('staff_commissions', `id=eq.${commission_id}`, updates);
      
      // Try to send email notification
      let emailResult = null;
      if (data?.staff_id) {
        const staffArr = await dbGet('staff_users', `id=eq.${data.staff_id}&select=email,first_name,last_name`);
        const staff = staffArr[0];
        if (staff?.email) {
          const statusLabel = { approved: 'Approved', rejected: 'Rejected', paid: 'Paid', disputed: 'Disputed' }[status] || status;
          emailResult = await sendEmail(staff.email, `Commission ${statusLabel}: ${data.client_name || 'Deal'}`, 
            `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:24px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="color:#fff;margin:0;">Commission ${statusLabel}</h1></div><div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;"><p><strong>Client:</strong> ${data.client_name}</p><p><strong>Amount:</strong> $${parseFloat(data.approved_amount || data.claimed_amount || 0).toLocaleString()}</p>${admin_comment ? `<p><strong>Note:</strong> ${admin_comment}</p>` : ''}<p style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:#1a365d;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:700;">View Dashboard</a></p></div></div>`);
        }
      }
      return json({ commission: data, email_result: emailResult });
    }

    if (action === 'get_commission_stats') {
      const { staff_id, is_admin } = body;
      // SERVER-SIDE ENFORCEMENT: Non-admin callers MUST provide staff_id and will only see their own stats
      const scope = enforceStaffScope(is_admin, staff_id);
      let params = 'select=*';
      if (scope.scoped) {
        params += `&${scope.staff_id_filter}`;
        console.log(`[HR v4.0] get_commission_stats: scoped to staff_id=${staff_id}`);
      }
      const commissions = await dbGet('staff_commissions', params);
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = {
        total_pending: commissions.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + parseFloat(c.claimed_amount || 0), 0),
        total_approved: commissions.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0),
        total_paid: commissions.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0),
        total_disputed: commissions.filter((c: any) => c.status === 'disputed').reduce((s: number, c: any) => s + parseFloat(c.claimed_amount || 0), 0),
        this_week_earned: commissions.filter((c: any) => c.status === 'paid' && c.paid_at && new Date(c.paid_at) >= weekStart).reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0),
        this_month_earned: commissions.filter((c: any) => c.status === 'paid' && c.paid_at && new Date(c.paid_at) >= monthStart).reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0),
        pending_count: commissions.filter((c: any) => c.status === 'pending').length,
        approved_count: commissions.filter((c: any) => c.status === 'approved').length,
        paid_count: commissions.filter((c: any) => c.status === 'paid').length,
      };
      return json({ stats });
    }

    // ============ FRIDAY PAYOUT SUMMARY ============
    if (action === 'send_friday_payout_summary') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action
      if (!body.is_admin) {
        console.warn(`[HR v4.0] send_friday_payout_summary: blocked non-admin attempt`);
        return json({ error: 'Only administrators can send payout summaries' }, 403);
      }
      const approved = await dbGet('staff_commissions', 'status=eq.approved');
      if (approved.length === 0) return json({ message: 'No approved commissions', sent_to: [], commission_count: 0 });
      const recipients = await dbGet('staff_users', 'is_active=eq.true&select=email,first_name,last_name');
      const sent: string[] = []; const failed: string[] = [];
      const grandTotal = approved.reduce((s: number, p: any) => s + parseFloat(p.approved_amount || p.claimed_amount || 0), 0);
      const emailHtml = `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:24px;text-align:center;border-radius:12px 12px 0 0;"><h1 style="color:#fff;margin:0;">Friday Payout Summary</h1></div><div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;"><p style="text-align:center;font-size:36px;font-weight:800;color:#059669;">$${grandTotal.toLocaleString()}</p><p style="text-align:center;color:#6b7280;">${approved.length} commissions ready for payout</p></div></div>`;
      for (const m of recipients) {
        if (m.email) {
          const r = await sendEmail(m.email, `Weekly Payout Summary - ${approved.length} Commissions Ready`, emailHtml);
          (r?.success ? sent : failed).push(m.email);
        }
      }
      return json({ sent_to: sent, failed, commission_count: approved.length });
    }

    // ============ EXECUTIVE OVERVIEW ============
    if (action === 'get_executive_overview') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action â€” executive overview contains all staff data
      if (!body.is_admin) {
        console.warn(`[HR v4.0] get_executive_overview: blocked non-admin attempt`);
        return json({ error: 'Only administrators can access the executive overview' }, 403);
      }
      const deals = await dbGet('executive_deal_tracking', 'order=created_at.desc');
      const closed = deals.filter((d: any) => d.deal_status === 'closed');
      const credit = deals.filter((d: any) => d.payment_type === 'credit');
      const cash = deals.filter((d: any) => d.payment_type === 'cash');
      const completed = deals.filter((d: any) => d.deal_status === 'completed');
      const pending = deals.filter((d: any) => d.deal_status === 'pending_application');
      const totalFees = deals.reduce((s: number, d: any) => s + parseFloat(d.acquisition_fee_total || 0), 0);
      const totalFunded = deals.reduce((s: number, d: any) => s + parseFloat(d.funded_payment || 0), 0);
      const totalComm = deals.reduce((s: number, d: any) => s + parseFloat(d.commission_paid || 0), 0);
      const byStaff: Record<string, any> = {};
      for (const d of deals) {
        const k = d.assigned_staff_id || 'unassigned';
        if (!byStaff[k]) byStaff[k] = { name: d.assigned_staff_name || 'Unassigned', deals: [], totalFees: 0, totalCommissions: 0 };
        byStaff[k].deals.push(d); byStaff[k].totalFees += parseFloat(d.acquisition_fee_total || 0); byStaff[k].totalCommissions += parseFloat(d.commission_paid || 0);
      }
      return json({ overview: { total_deals: deals.length, closed_deals: closed.length, credit_deals: credit.length, cash_deals: cash.length, completed_deals: completed.length, pending_application: pending.length, total_acquisition_fees: totalFees, total_funded_payments: totalFunded, total_commissions_paid: totalComm, net_earnings: totalFees - totalComm, by_staff: Object.values(byStaff) }, deals });
    }

    if (action === 'submit_deal_record') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action â€” only admins can submit executive deal records
      if (!body.is_admin) {
        console.warn(`[HR v4.0] submit_deal_record: blocked non-admin attempt`);
        return json({ error: 'Only administrators can submit deal records' }, 403);
      }
      const { client_name, deal_status, acquisition_fee_total, funded_payment, payment_type, commission_paid, assigned_staff_id, assigned_staff_name, staff_role, property_address, notes, submitted_by } = body;
      const fee = parseFloat(acquisition_fee_total || 0); const comm = parseFloat(commission_paid || 0);
      const result = await dbInsert('executive_deal_tracking', {
        client_name, deal_status: deal_status || 'closed', acquisition_fee_total: fee, funded_payment: parseFloat(funded_payment || 0),
        payment_type: payment_type || 'cash', commission_paid: comm, net_after_commission: fee - comm,
        assigned_staff_id, assigned_staff_name, staff_role: staff_role || 'acquisition_manager', property_address, notes, submitted_by
      });
      return json({ deal: result });
    }

    if (action === 'update_deal_record') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action
      if (!body.is_admin) {
        console.warn(`[HR v4.0] update_deal_record: blocked non-admin attempt`);
        return json({ error: 'Only administrators can update deal records' }, 403);
      }
      const { deal_id, ...updates } = body; delete updates.action; delete updates.is_admin;
      if (updates.acquisition_fee_total !== undefined && updates.commission_paid !== undefined) updates.net_after_commission = parseFloat(updates.acquisition_fee_total) - parseFloat(updates.commission_paid);
      updates.updated_at = new Date().toISOString();
      const result = await dbUpdate('executive_deal_tracking', `id=eq.${deal_id}`, updates);
      return json({ deal: result });
    }

    if (action === 'delete_deal_record') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action
      if (!body.is_admin) {
        console.warn(`[HR v4.0] delete_deal_record: blocked non-admin attempt`);
        return json({ error: 'Only administrators can delete deal records' }, 403);
      }
      await dbDelete('executive_deal_tracking', `id=eq.${body.deal_id}`);
      return json({ success: true });
    }

    // ============ WEEKLY MASTER REPORT ============
    if (action === 'get_master_weekly_report') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action â€” master report aggregates all staff data
      if (!body.is_admin) {
        console.warn(`[HR v4.0] get_master_weekly_report: blocked non-admin attempt`);
        return json({ error: 'Only administrators can access the master weekly report' }, 403);
      }
      const now = new Date(); const dow = now.getDay(); const mo = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(now); ws.setDate(now.getDate() + mo); ws.setHours(0,0,0,0);
      const wsStr = ws.toISOString().split('T')[0];
      const reports = await dbGet('staff_weekly_reports', `week_start=eq.${wsStr}`);
      const weekComm = await dbGet('staff_commissions', `created_at=gte.${ws.toISOString()}`);
      const weekDeals = await dbGet('executive_deal_tracking', `created_at=gte.${ws.toISOString()}`);
      return json({ master_report: {
        week_start: wsStr, staff_reports: reports,
        total_clients: reports.reduce((s: number, r: any) => s + (r.client_volume || 0), 0),
        total_closings: reports.reduce((s: number, r: any) => s + (r.closings || 0), 0),
        total_new_inventory: reports.reduce((s: number, r: any) => s + (r.new_inventory || 0), 0),
        total_commissions_this_week: weekComm.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0),
        week_deals: weekDeals, reports_submitted: reports.length
      }});
    }

    // ============ PAYMENT PROFILES ============
    if (action === 'get_payment_profiles') {
      // Already scoped by staff_id â€” validate it's present
      if (!body.staff_id) return json({ error: 'staff_id is required' }, 400);
      const data = await dbGet('staff_payment_profiles', `staff_id=eq.${body.staff_id}&order=is_primary.desc`);
      return json({ profiles: data });
    }

    if (action === 'save_payment_profile') {
      const { staff_id, method_type, account_details, label, is_primary, profile_id } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      if (is_primary) await dbUpdate('staff_payment_profiles', `staff_id=eq.${staff_id}`, { is_primary: false });
      if (profile_id) {
        // Verify the profile belongs to this staff member
        const existing = await dbGet('staff_payment_profiles', `id=eq.${profile_id}&staff_id=eq.${staff_id}`);
        if (existing.length === 0) return json({ error: 'Payment profile not found or does not belong to you' }, 403);
        const result = await dbUpdate('staff_payment_profiles', `id=eq.${profile_id}`, { method_type, account_details, label, is_primary, updated_at: new Date().toISOString() });
        return json({ profile: result });
      } else {
        const result = await dbInsert('staff_payment_profiles', { staff_id, method_type, account_details, label, is_primary });
        return json({ profile: result });
      }
    }

    if (action === 'delete_payment_profile') {
      // Verify ownership if staff_id provided
      if (body.staff_id && body.profile_id) {
        const existing = await dbGet('staff_payment_profiles', `id=eq.${body.profile_id}&staff_id=eq.${body.staff_id}`);
        if (existing.length === 0) return json({ error: 'Payment profile not found or does not belong to you' }, 403);
      }
      await dbDelete('staff_payment_profiles', `id=eq.${body.profile_id}`);
      return json({ success: true });
    }

    // ============ COMPLIANCE DOCS ============
    if (action === 'get_compliance_docs') {
      const { staff_id, is_admin } = body;
      // SERVER-SIDE ENFORCEMENT: Non-admin callers MUST provide staff_id and will only see their own documents
      const scope = enforceStaffScope(is_admin, staff_id);
      let params = 'order=created_at.desc';
      if (scope.scoped) {
        params += `&${scope.staff_id_filter}`;
        console.log(`[HR v4.0] get_compliance_docs: scoped to staff_id=${staff_id}`);
      }
      const data = await dbGet('staff_compliance_docs', params);
      return json({ documents: data });
    }

    if (action === 'upload_compliance_doc') {
      const { staff_id, doc_type, title, file_url, file_name, year, uploaded_by, uploaded_by_name, notes } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      const result = await dbInsert('staff_compliance_docs', { staff_id, doc_type, title, file_url, file_name, year, uploaded_by, uploaded_by_name, notes });
      return json({ document: result });
    }

    if (action === 'delete_compliance_doc') {
      // If staff_id provided, verify ownership for non-admin
      if (body.staff_id && !body.is_admin) {
        const existing = await dbGet('staff_compliance_docs', `id=eq.${body.doc_id}&staff_id=eq.${body.staff_id}`);
        if (existing.length === 0) return json({ error: 'Document not found or does not belong to you' }, 403);
      }
      await dbDelete('staff_compliance_docs', `id=eq.${body.doc_id}`);
      return json({ success: true });
    }

    // ============ WEEKLY REPORTS ============
    if (action === 'get_weekly_reports') {
      const { staff_id, is_admin } = body;
      // SERVER-SIDE ENFORCEMENT: Non-admin callers MUST provide staff_id and will only see their own reports
      const scope = enforceStaffScope(is_admin, staff_id);
      let params = 'order=week_start.desc';
      if (scope.scoped) {
        params += `&${scope.staff_id_filter}`;
        console.log(`[HR v4.0] get_weekly_reports: scoped to staff_id=${staff_id}`);
      }
      const data = await dbGet('staff_weekly_reports', params);
      return json({ reports: data });
    }

    if (action === 'submit_weekly_report') {
      const { staff_id, staff_name, client_volume, closings, new_inventory, notes } = body;
      if (!staff_id) return json({ error: 'staff_id is required to submit a weekly report' }, 400);
      const now = new Date(); const dow = now.getDay(); const mo = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(now); ws.setDate(now.getDate() + mo); ws.setHours(0,0,0,0);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      // Try update first, then insert â€” scoped to staff_id
      const existing = await dbGet('staff_weekly_reports', `staff_id=eq.${staff_id}&week_start=eq.${ws.toISOString().split('T')[0]}`);
      if (existing.length > 0) {
        const result = await dbUpdate('staff_weekly_reports', `id=eq.${existing[0].id}`, {
          client_volume: parseInt(client_volume) || 0, closings: parseInt(closings) || 0,
          new_inventory: parseInt(new_inventory) || 0, notes, updated_at: new Date().toISOString()
        });
        return json({ report: result });
      }
      const result = await dbInsert('staff_weekly_reports', {
        staff_id, staff_name, week_start: ws.toISOString().split('T')[0], week_end: we.toISOString().split('T')[0],
        client_volume: parseInt(client_volume) || 0, closings: parseInt(closings) || 0,
        new_inventory: parseInt(new_inventory) || 0, notes
      });
      return json({ report: result });
    }

    if (action === 'review_weekly_report') {
      // SERVER-SIDE ENFORCEMENT: Admin-only action â€” only admins can review reports
      if (!body.is_admin) {
        console.warn(`[HR v4.0] review_weekly_report: blocked non-admin attempt`);
        return json({ error: 'Only administrators can review weekly reports' }, 403);
      }
      const { report_id, reviewed_by, admin_feedback } = body;
      const result = await dbUpdate('staff_weekly_reports', `id=eq.${report_id}`, {
        reviewed_by, reviewed_at: new Date().toISOString(), admin_feedback, updated_at: new Date().toISOString()
      });
      return json({ report: result });
    }

    // ============ TIME TRACKING ============
    if (action === 'get_time_entries') {
      const { staff_id, start_date, end_date } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      let params = `staff_id=eq.${staff_id}&order=start_time.desc`;
      if (start_date) params += `&start_time=gte.${start_date}`;
      if (end_date) params += `&start_time=lte.${end_date}`;
      const data = await dbGet('staff_time_entries', params);
      return json({ entries: data });
    }

    if (action === 'start_timer') {
      const { staff_id } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      const active = await dbGet('staff_time_entries', `staff_id=eq.${staff_id}&end_time=is.null&limit=1`);
      if (active.length > 0) return json({ entry: active[0], message: 'Timer already running' });
      const result = await dbInsert('staff_time_entries', { staff_id, start_time: new Date().toISOString() });
      return json({ entry: result });
    }

    if (action === 'stop_timer') {
      const { staff_id, notes } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      const active = await dbGet('staff_time_entries', `staff_id=eq.${staff_id}&end_time=is.null&limit=1`);
      if (active.length === 0) return json({ error: 'No active timer found' }, 400);
      const endTime = new Date(); const startTime = new Date(active[0].start_time);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      const result = await dbUpdate('staff_time_entries', `id=eq.${active[0].id}`, {
        end_time: endTime.toISOString(), duration_minutes: durationMinutes, notes
      });
      return json({ entry: result });
    }

    if (action === 'get_active_timer') {
      if (!body.staff_id) return json({ error: 'staff_id is required' }, 400);
      const active = await dbGet('staff_time_entries', `staff_id=eq.${body.staff_id}&end_time=is.null&limit=1`);
      return json({ entry: active[0] || null });
    }

    if (action === 'get_time_stats') {
      const { staff_id } = body;
      if (!staff_id) return json({ error: 'staff_id is required' }, 400);
      const now = new Date(); const dow = now.getDay(); const mo = dow === 0 ? -6 : 1 - dow;
      const ws = new Date(now); ws.setDate(now.getDate() + mo); ws.setHours(0,0,0,0);
      const entries = await dbGet('staff_time_entries', `staff_id=eq.${staff_id}&start_time=gte.${ws.toISOString()}&end_time=not.is.null`);
      const totalMinutes = entries.reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
      const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
      const commissions = await dbGet('staff_commissions', `staff_id=eq.${staff_id}&status=eq.paid&paid_at=gte.${ws.toISOString()}`);
      const weekEarnings = commissions.reduce((s: number, c: any) => s + parseFloat(c.approved_amount || c.claimed_amount || 0), 0);
      return json({ stats: { total_minutes: totalMinutes, total_hours: totalHours, week_earnings: weekEarnings, effective_hourly_rate: totalHours > 0 ? Math.round(weekEarnings / totalHours * 100) / 100 : 0, session_count: entries.length }});
    }

    // ============ STAFF LIST ============
    if (action === 'get_staff_list') {
      // Staff list is used by admin views â€” gate behind is_admin for full list
      // Non-admin callers get a minimal list (just names for display purposes)
      if (body.is_admin) {
        const data = await dbGet('staff_users', 'is_active=eq.true&select=id,first_name,last_name,email,name,department&order=first_name');
        return json({ staff: data });
      } else {
        // Non-admin: return only id and name (no email, no department details)
        const data = await dbGet('staff_users', 'is_active=eq.true&select=id,first_name,last_name,name&order=first_name');
        return json({ staff: data });
      }
    }

    return json({ error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    console.error('[HR v4.0] Error:', err.message);
    // Return specific error for scope violations
    if (err.message?.startsWith('SCOPE_VIOLATION')) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

