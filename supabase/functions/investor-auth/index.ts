const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !key) return json({ success: false, error: 'Server configuration error' }, 500);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept-Profile': 'public', 'Content-Profile': 'public' };
  const read = async (table: string, query: string) => {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { headers });
    const data = await response.json().catch(() => []);
    if (!response.ok) throw new Error(data?.message || data?.error || `Database read failed (${response.status})`);
    return Array.isArray(data) ? data : [];
  };
  const write = async (table: string, method: string, query: string, payload: unknown) => {
    const response = await fetch(`${baseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`, { method, headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || data?.error || `Database write failed (${response.status})`);
    return data;
  };
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const investorId = body.investor_id || body.investorId;
    const getInvestor = async () => investorId ? (await read('investors', `id=eq.${encodeURIComponent(investorId)}&select=*`))[0] || null : null;

    // STRICT: a staff account counts as "the investor's staff account" ONLY when it is
    // explicitly linked (staff_users.linked_investor_id === investor.id). Matching on email
    // alone is NOT sufficient — that would let anyone who registers an investor account under
    // a staff member's email escalate into the staff dashboard. Linking is a deliberate action
    // performed from account settings, not an email coincidence.
    const findLinkedStaff = async (investor: any) => {
      if (!investor) return null;
      const rows = await read('staff_users', `linked_investor_id=eq.${encodeURIComponent(investor.id)}&is_active=eq.true&select=id,email,name,first_name,last_name,phone,team,role,department,permissions,roles,linked_investor_id`);
      return rows[0] || null;
    };

    if (action === 'get_link_suggestions') {
      const investor = await getInvestor();
      if (!investor || !investor.email) return json({ success: true, suggestions: [], accounts: [], link_suggestions: [], has_suggestions: false });
      const rows = await read('staff_users', `email=eq.${encodeURIComponent(String(investor.email).toLowerCase())}&is_active=eq.true&select=id,email,name,first_name,last_name,linked_investor_id`);
      const staff = rows[0];
      const suggestions = staff && staff.linked_investor_id !== investor.id ? [{ id: staff.id, staff_id: staff.id, email: staff.email, name: staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim(), type: 'staff', match_reason: 'Matching email address', linked_investor_id: staff.linked_investor_id || null }] : [];
      return json({ success: true, suggestions, accounts: suggestions, link_suggestions: suggestions, has_suggestions: suggestions.length > 0 });
    }
    if (action === 'get_linked_staff') {
      const investor = await getInvestor();
      const staff = await findLinkedStaff(investor);
      return json({ success: true, staff_id: staff?.id || null, staff: staff || null });
    }
    if (action === 'switch_to_staff') {
      const investor = await getInvestor();
      if (!investor) return json({ success: false, error: 'Investor not found' }, 404);
      const staff = await findLinkedStaff(investor);
      if (!staff) return json({ success: false, error: 'No linked staff account found' }, 404);
      let permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
      if (!permissions.length && ['success_managers','leadership'].includes(staff.department)) permissions = ['all'];
      return json({ success: true, staff: { ...staff, permissions, linked_investor_id: staff.linked_investor_id || investor.id } });
    }
    if (action === 'get_am_info') {
      const investor = await getInvestor();
      if (!investor) return json({ success: true, am: null, am_info: null, pending_request: null, pending_change_request: null });
      const amId = investor.assigned_acquisition_manager_id;
      let am = null;
      if (amId) {
        const row = (await read('staff_users', `id=eq.${encodeURIComponent(amId)}&select=id,email,name,first_name,last_name,phone`))[0];
        if (row) am = { id: row.id, name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(), email: row.email, phone: row.phone, assigned_at: investor.am_assigned_at };
      }
      const pending = (await read('am_assignment_requests', `investor_id=eq.${encodeURIComponent(investorId)}&status=eq.pending&select=*&order=created_at.desc&limit=1`))[0] || null;
      const change = (await read('am_change_requests', `investor_id=eq.${encodeURIComponent(investorId)}&status=eq.pending&select=*&order=created_at.desc&limit=1`))[0] || null;
      return json({ success: true, am, am_info: am, pending_request: pending, pending_change_request: change });
    }
    if (action === 'get_portfolio_properties') {
      const properties = await read('investor_portfolio', `investor_id=eq.${encodeURIComponent(investorId)}&status=eq.active&order=created_at.desc`);
      return json({ success: true, properties });
    }
    if (action === 'get_investor_credits') {
      const investor = await getInvestor();
      const transactions = await read('investor_credit_transactions', `investor_id=eq.${encodeURIComponent(investorId)}&order=created_at.desc&limit=50`);
      return json({ success: true, credit_balance: investor?.credit_balance || 0, total_earned: investor?.total_credits_earned || 0, total_spent: investor?.total_credits_spent || 0, transactions });
    }
    if (action === 'submit_am_assignment') {
      const investor = await getInvestor();
      const created = await write('am_assignment_requests', 'POST', '', { investor_id: investorId, investor_email: body.investor_email || investor?.email, investor_name: body.investor_name || investor?.full_name, investor_phone: body.investor_phone || investor?.phone, request_type: 'acquisition_manager', preferred_markets: Array.isArray(body.preferred_markets) ? body.preferred_markets : [], preferred_operation_types: Array.isArray(body.preferred_operation_types) ? body.preferred_operation_types : [], investment_budget_min: body.investment_budget_min, investment_budget_max: body.investment_budget_max, investment_goals: body.investment_goals, notes: body.notes, status: 'pending' });
      return json({ success: true, request: Array.isArray(created) ? created[0] : created });
    }
    if (action === 'request_am_change') {
      const investor = await getInvestor();
      const created = await write('am_change_requests', 'POST', '', { investor_id: investorId, investor_email: investor?.email, investor_name: body.investor_name || investor?.full_name, current_am_id: body.current_am_id || investor?.assigned_acquisition_manager_id, reason: body.reason, preferred_am_name: body.preferred_am_name, status: 'pending' });
      return json({ success: true, request: Array.isArray(created) ? created[0] : created });
    }
    if (action === 'export_data') {
      const investor = await getInvestor();
      return json({ success: true, data: { investor } });
    }
    return json({ success: false, error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'Investor request failed' }, 500);
  }
});
