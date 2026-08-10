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
    // ---- ADDED 9 Aug 2026 ----
    //
    // A client could see their portfolio and not touch it. Editing and removing a unit
    // both existed staff-side (manage-portfolio-approvals update_property_details) but not
    // for the person who owns it — a different authorisation context, so this is not a
    // rename and could not be aliased.
    //
    // EVERY ONE OF THESE CHECKS OWNERSHIP against the row before writing. Without that, a
    // client could edit or delete somebody else's holding by passing its id.

    if (action === 'update_portfolio_property') {
      const { investor_id, property_id, property_data } = body;
      if (!investor_id || !property_id) return json({ success: false, error: 'investor_id and property_id are required.' }, 400);

      const own = await fetch(`${baseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}&investor_id=eq.${investor_id}&select=id`, { headers });
      const rows = await own.json().catch(() => []);
      if (!Array.isArray(rows) || !rows.length) {
        return json({ success: false, error: 'That property is not on your portfolio.' }, 403);
      }

      // Allowlist. A client describing their own unit must not be able to change what it
      // COST them or who it belongs to.
      const allowed = ['address', 'city', 'state', 'bedrooms', 'bathrooms', 'monthly_rent',
                       'monthly_earnings', 'status', 'notes', 'photo_urls', 'title'];
      const patch: Record<string, unknown> = {};
      const src = property_data && typeof property_data === 'object' ? property_data : body;
      for (const k of allowed) if (k in src) patch[k] = (src as Record<string, unknown>)[k];
      if (!Object.keys(patch).length) {
        return json({ success: false, error: `Nothing updatable was sent. You can change: ${allowed.join(', ')}.` }, 400);
      }
      patch.updated_at = new Date().toISOString();

      const upd = await fetch(`${baseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!upd.ok) {
        console.error('investor-auth update_portfolio_property failed', upd.status);
        return json({ success: false, error: 'Could not save the change. Nothing was updated.' }, 502);
      }
      const out = await upd.json();
      return json({ success: true, property: out?.[0] ?? null });
    }

    if (action === 'delete_portfolio_property') {
      const { investor_id, property_id } = body;
      if (!investor_id || !property_id) return json({ success: false, error: 'investor_id and property_id are required.' }, 400);

      const own = await fetch(`${baseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}&investor_id=eq.${investor_id}&select=id,address`, { headers });
      const rows = await own.json().catch(() => []);
      if (!Array.isArray(rows) || !rows.length) {
        return json({ success: false, error: 'That property is not on your portfolio.' }, 403);
      }

      const del = await fetch(`${baseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}&investor_id=eq.${investor_id}`, {
        method: 'DELETE', headers,
      });
      if (!del.ok) {
        console.error('investor-auth delete_portfolio_property failed', del.status);
        return json({ success: false, error: 'Could not remove it. Nothing was deleted.' }, 502);
      }
      return json({ success: true, removed: rows[0].address || property_id,
        note: 'Removed from your portfolio. This does not cancel a lease or tell anyone — if you have exited the property, message the Success Team.' });
    }

    if (action === 'delete_account') {
      // DELIBERATELY NOT A DELETE. A client account is attached to closings, commission
      // records, documents and a client file built over years. Erasing it orphans all of
      // that and cannot be undone, and this business has legal obligations that outlive an
      // account. So the request is RECORDED and routed to admin, who own compliance.
      const { investor_id, reason } = body;
      if (!investor_id) return json({ success: false, error: 'investor_id is required.' }, 400);

      const who = await fetch(`${baseUrl}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`, { headers });
      const rows = await who.json().catch(() => []);
      if (!Array.isArray(rows) || !rows.length) return json({ success: false, error: 'No such account.' }, 404);
      const person = rows[0];

      const alert = await fetch(`${baseUrl}/rest/v1/staff_alerts`, {
        method: 'POST', headers,
        body: JSON.stringify({
          for_role: 'admin', kind: 'account_deletion_request', severity: 'urgent',
          title: `${person.full_name || person.email} has asked to close their account`,
          body: `Reason given: ${String(reason || 'none given')}. This needs a human: there are records attached that cannot simply be erased, and there may be obligations that outlive the account.`,
          investor_id,
          dedupe_key: `delacct:${investor_id}`,
        }),
      });
      if (!alert.ok) {
        console.error('investor-auth delete_account alert failed', alert.status);
        return json({ success: false, error: 'Could not record your request. Nothing was submitted — please email the Success Team directly.' }, 502);
      }
      return json({ success: true,
        note: 'Your request has been recorded and sent to our team. Nothing has been deleted yet — someone will contact you, because there are records attached to your account that we cannot simply erase.' });
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
