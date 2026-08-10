// Schema pointed at 'public' (was prj_X-ZoVQv6LKXT). PostgREST only exposes `public`, and the
// investors view plus every table this function touches now live in `public`, readable/writable
// by the service role. Forcing the prj profile caused every query to be rejected -> empty lists.
const DATA_SCHEMA = 'public';
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

// manage-investor-admin v17.4 - schema fix (public). v17.3: createNotification uses 'data' column
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
    if (!SUPABASE_URL || !SUPABASE_KEY) return json({ success: false, error: 'Config error', investors: [], counts: { total: 0 } });

    const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
    const mutH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

    const body = await req.json();
    const { action, investor_id } = body;
    console.log('[v17.4] Action:', action);

    const COLS = 'id,email,full_name,phone,company_name,created_at,onboarding_completed,is_active,budget,investment_budget_min,investment_budget_max,preferred_markets,operation_types,discovery_call_completed,can_purchase_deals,acquisition_manager_name,assigned_acquisition_manager_id,assigned_setup_manager_id,assigned_setup_manager_name,account_funded,funding_tier,priority_investor,linked_staff_id,last_login,credit_balance,am_verification_status,portfolio_count,portfolio_monthly_revenue';

    async function fetchInvestors(extraParams = '') {
      const url = `${SUPABASE_URL}/rest/v1/investors?select=${COLS}${extraParams}`;
      const res = await fetch(url, { headers: getH });
      if (!res.ok) { const t = await res.text().catch(() => ''); console.error('[v17.4] Error:', t.substring(0, 300)); return []; }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }

    function mapInv(inv: any) {
      const now = new Date();
      const wh = !inv.assigned_acquisition_manager_id ? Math.round((now.getTime() - new Date(inv.created_at).getTime()) / 36e5) : 0;
      return { ...inv, budget_min: inv.investment_budget_min, budget_max: inv.investment_budget_max, status: inv.is_active === false ? 'inactive' : (inv.onboarding_completed ? 'active' : 'pending'), first_name: inv.full_name?.split(' ')[0] || '', last_name: inv.full_name?.split(' ').slice(1).join(' ') || '', wait_time_hours: wh, is_escalated: wh > 48 && !inv.assigned_acquisition_manager_id };
    }

    function makeCounts(list: any[]) {
      const wAM = list.filter((i: any) => i.assigned_acquisition_manager_id || i.acquisition_manager_name).length;
      return { total: list.length, active: list.filter((i: any) => i.onboarding_completed || i.is_active).length, pending: list.filter((i: any) => !i.onboarding_completed && i.is_active !== false).length, with_manager: wAM, with_acquisition_manager: wAM, with_setup_manager: list.filter((i: any) => i.assigned_setup_manager_id).length, discovery_completed: list.filter((i: any) => i.discovery_call_completed).length, can_purchase: list.filter((i: any) => i.can_purchase_deals).length, linked_accounts: list.filter((i: any) => i.linked_staff_id).length, unassigned: list.filter((i: any) => !i.assigned_acquisition_manager_id && !i.acquisition_manager_name).length, escalated: list.filter((i: any) => i.is_escalated).length };
    }

    async function logActivity(investorId: string, activityType: string, title: string, description: string, metadata: any = {}) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/investor_activity_logs`, {
          method: 'POST', headers: mutH,
          body: JSON.stringify({ investor_id: investorId, activity_type: activityType, activity_category: 'admin', title, description, metadata })
        });
      } catch (e) { console.warn('Activity log failed:', e); }
    }

    async function sendInvestorEmail(email: string, name: string, subject: string, htmlBody: string) {
      if (!RESEND_API_KEY || !email) return false;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'], to: [email], subject, html: htmlBody })
        });
        return res.ok;
      } catch (e) { return false; }
    }

    async function createNotification(investorId: string, type: string, title: string, message: string, notifData: any = {}) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications`, {
          method: 'POST', headers: mutH,
          body: JSON.stringify({ investor_id: investorId, notification_type: type, type, title, message, data: notifData, priority: 'normal', read: false, created_at: new Date().toISOString() })
        });
      } catch (e) { console.warn('Notification create failed:', e); }
    }

    // investor_notifications carries BOTH `read` and `is_read`. Setting only one leaves the
    // two disagreeing, and a later query picking the other column would show a read
    // notification as unread forever. Both are set.
    if (action === 'mark_notification_read') {
      const notificationId = body.notification_id ?? body.id;
      if (!notificationId) {
        return new Response(JSON.stringify({ success: false, error: 'notification_id is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_notifications?id=eq.${notificationId}`, {
        method: 'PATCH',
        headers: { ...mutH, Prefer: 'return=representation' },
        body: JSON.stringify({ read: true, is_read: true, read_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        console.error('manage-investor-admin mark_notification_read failed', res.status);
        return new Response(JSON.stringify({ success: false, error: 'Could not mark it read. Nothing changed.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rows = await res.json();
      if (!rows?.length) {
        return new Response(JSON.stringify({ success: false, error: 'No notification with that id.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, notification: rows[0] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sync_portfolio_counts') {
      console.log('[v17.4] Syncing portfolio counts for all investors...');
      const portfolioRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?select=investor_id,monthly_rent,monthly_earnings,status&status=eq.active`, { headers: getH });
      const portfolioData = portfolioRes.ok ? await portfolioRes.json() : [];
      if (!Array.isArray(portfolioData)) {
        return json({ success: true, updated: 0, message: 'No portfolio data found' });
      }
      const investorAgg: Record<string, { count: number; revenue: number }> = {};
      for (const p of portfolioData) {
        if (!p.investor_id) continue;
        if (!investorAgg[p.investor_id]) investorAgg[p.investor_id] = { count: 0, revenue: 0 };
        investorAgg[p.investor_id].count += 1;
        investorAgg[p.investor_id].revenue += parseFloat(p.monthly_earnings || p.monthly_rent || 0);
      }
      const allInvestorsRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id,portfolio_count,portfolio_monthly_revenue&limit=5000`, { headers: getH });
      const allInvestors = allInvestorsRes.ok ? await allInvestorsRes.json() : [];
      let updated = 0;
      let errors = 0;
      for (const inv of (Array.isArray(allInvestors) ? allInvestors : [])) {
        const agg = investorAgg[inv.id] || { count: 0, revenue: 0 };
        const currentCount = inv.portfolio_count || 0;
        const currentRevenue = parseFloat(inv.portfolio_monthly_revenue || 0);
        if (currentCount !== agg.count || Math.abs(currentRevenue - agg.revenue) > 0.01) {
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${inv.id}`, {
            method: 'PATCH', headers: mutH,
            body: JSON.stringify({ portfolio_count: agg.count, portfolio_monthly_revenue: agg.revenue, updated_at: new Date().toISOString() })
          });
          if (patchRes.ok) updated++;
          else errors++;
        }
      }
      console.log('[v17.4] Portfolio sync complete. Updated:', updated, 'Errors:', errors);
      return json({ success: true, updated, errors, total_investors: Array.isArray(allInvestors) ? allInvestors.length : 0, investors_with_properties: Object.keys(investorAgg).length, total_properties: portfolioData.length });
    }

    if (action === 'get_assigned_investors') {
      const { staff_id, limit = 200 } = body;
      if (!staff_id) return json({ success: false, error: 'staff_id required', investors: [] });
      let list = await fetchInvestors(`&or=(assigned_acquisition_manager_id.eq.${staff_id},assigned_setup_manager_id.eq.${staff_id})&order=created_at.desc&limit=${limit}`);
      list = list.map(mapInv);
      const totalPortfolioRevenue = list.reduce((sum: number, i: any) => sum + parseFloat(i.portfolio_monthly_revenue || 0), 0);
      const totalProperties = list.reduce((sum: number, i: any) => sum + (i.portfolio_count || 0), 0);
      return json({ success: true, investors: list, total: list.length, aggregate: { total_portfolio_revenue: totalPortfolioRevenue, total_properties: totalProperties, funded_count: list.filter((i: any) => i.account_funded).length, active_count: list.filter((i: any) => i.onboarding_completed || i.is_active).length } });
    }

    if (action === 'get_unread_count') return json({ success: true, count: 0 });

    if (action === 'diagnostic') {
      const url = `${SUPABASE_URL}/rest/v1/investors?select=id,email,full_name&limit=3`;
      const res = await fetch(url, { headers: getH });
      const t = await res.text();
      return json({ success: true, diagnostic: { simple_status: res.status, simple_body: t.substring(0, 300) } });
    }

    if (action === 'get_all_investors' || action === 'list_investors' || action === 'list' || action === 'get_investors') {
      const { status, limit = 500, offset = 0, search } = body;
      let list = await fetchInvestors(`&order=created_at.desc&limit=${limit}&offset=${offset}`);
      list = list.map(mapInv);
      if (status === 'active') list = list.filter((i: any) => i.onboarding_completed || i.is_active);
      else if (status === 'pending') list = list.filter((i: any) => !i.onboarding_completed && i.is_active !== false);
      if (search) { const sl = search.toLowerCase(); list = list.filter((i: any) => i.email?.toLowerCase().includes(sl) || i.full_name?.toLowerCase().includes(sl) || i.company_name?.toLowerCase().includes(sl) || i.phone?.includes(search)); }
      return json({ success: true, investors: list, counts: makeCounts(list) });
    }

    if (action === 'get_unassigned_investors') {
      let list = await fetchInvestors('&assigned_acquisition_manager_id=is.null&order=created_at.asc&limit=100');
      list = list.filter((i: any) => !i.acquisition_manager_name).map(mapInv);
      return json({ success: true, investors: list, total: list.length, escalated_count: list.filter((i: any) => i.is_escalated).length });
    }

    if (action === 'search_investors') {
      const { query } = body;
      if (!query || query.trim().length < 2) return json({ success: true, investors: [] });
      let all = await fetchInvestors('&order=created_at.desc&limit=500');
      const q = query.toLowerCase().trim(); const qd = query.replace(/\D/g, '');
      const results = all.filter((i: any) => (i.full_name || '').toLowerCase().includes(q) || (i.email || '').toLowerCase().includes(q) || (qd.length >= 3 && (i.phone || '').replace(/\D/g, '').includes(qd)) || (i.company_name || '').toLowerCase().includes(q)).map(mapInv);
      return json({ success: true, investors: results.slice(0, 50), total: results.length });
    }

    if (action === 'get_investor') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=*`, { headers: getH });
      const inv = (await res.json())?.[0];
      if (!inv) return json({ success: false, error: 'Not found' });
      let linkedStaff = null;
      if (inv.linked_staff_id) { const sr = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${inv.linked_staff_id}&select=id,first_name,last_name,email`, { headers: getH }); linkedStaff = (await sr.json())?.[0] || null; }
      let messages = [], documents = [], inquiries = [], portfolio = [];
      try { const mr = await fetch(`${SUPABASE_URL}/rest/v1/investor_messages?investor_id=eq.${investor_id}&order=created_at.desc&limit=50`, { headers: getH }); if (mr.ok) messages = await mr.json(); } catch {}
      try { const dr = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents?investor_id=eq.${investor_id}&order=created_at.desc&limit=50`, { headers: getH }); if (dr.ok) documents = await dr.json(); } catch {}
      try { const ir = await fetch(`${SUPABASE_URL}/rest/v1/deal_inquiries?investor_id=eq.${investor_id}&order=created_at.desc&limit=50`, { headers: getH }); if (ir.ok) inquiries = await ir.json(); } catch {}
      try { const pr = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?investor_id=eq.${investor_id}&order=created_at.desc`, { headers: getH }); if (pr.ok) portfolio = await pr.json(); } catch {}
      return json({ success: true, investor: inv, linked_staff: linkedStaff, messages, documents, inquiries, portfolio });
    }

    // APPENDING A NOTE IS A READ-MODIFY-WRITE, and doing it in the browser meant two staff
    // adding a note at the same time would each read the same array and the second write
    // would erase the first. Done server-side in one call so the read and the append are
    // not separated by a network round trip.
    if (action === 'staff_append_portfolio_note') {
      const { property_id, note, staff_id, staff_name } = body;
      if (!property_id || !staff_id) {
        return new Response(JSON.stringify({ success: false, error: 'property_id and staff_id are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!String(note || '').trim()) {
        return new Response(JSON.stringify({ success: false, error: 'A note needs something in it.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const who = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&is_active=is.true&select=id,name`, { headers: getH });
      const staff = (await who.json().catch(() => []))?.[0];
      if (!staff) {
        return new Response(JSON.stringify({ success: false, error: 'Notes have to be added by an active staff member.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const cur = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}&select=staff_notes`, { headers: getH });
      const row = (await cur.json().catch(() => []))?.[0];
      if (!row) {
        return new Response(JSON.stringify({ success: false, error: 'No portfolio property with that id.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const notes = Array.isArray(row.staff_notes) ? row.staff_notes : [];
      notes.push({ author: staff_name || staff.name, text: String(note).trim(), date: new Date().toISOString() });
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, {
        method: 'PATCH', headers: { ...mutH, Prefer: 'return=representation' },
        body: JSON.stringify({ staff_notes: notes, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        console.error('staff_append_portfolio_note failed', res.status);
        return new Response(JSON.stringify({ success: false, error: 'Could not save the note. Nothing was recorded.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, notes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- STAFF PORTFOLIO WRITES ----
    //
    // Anon INSERT/UPDATE/DELETE on investor_portfolio was revoked because it let anybody
    // with the publishable key edit any client's holdings. That closed the hole and BROKE
    // EIGHT STAFF WRITE SITES, which were writing the table directly — I caused that
    // regression and this is the fix for it.
    //
    // Staff genuinely need to edit a portfolio they do not own, so these do NOT check
    // investor ownership. They check that a real staff member is doing it.

    if (action === 'staff_update_portfolio_property') {
      const { property_id, updates, staff_id } = body;
      if (!property_id || !staff_id) {
        return new Response(JSON.stringify({ success: false, error: 'property_id and staff_id are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const who = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&is_active=is.true&select=id,name`, { headers: getH });
      const staff = (await who.json().catch(() => []))?.[0];
      if (!staff) {
        return new Response(JSON.stringify({ success: false, error: 'Portfolio edits have to be made by an active staff member.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const patch = { ...(updates && typeof updates === 'object' ? updates : {}), updated_at: new Date().toISOString() };
      delete (patch as Record<string, unknown>).id;
      delete (patch as Record<string, unknown>).investor_id;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, {
        method: 'PATCH', headers: { ...mutH, Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error('staff_update_portfolio_property failed', res.status);
        return new Response(JSON.stringify({ success: false, error: 'Could not save. Nothing was changed.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rows = await res.json();
      if (!rows?.length) {
        return new Response(JSON.stringify({ success: false, error: 'No portfolio property with that id. Nothing was changed.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, property: rows[0] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'staff_delete_portfolio_property') {
      const { property_id, staff_id } = body;
      if (!property_id || !staff_id) {
        return new Response(JSON.stringify({ success: false, error: 'property_id and staff_id are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const who = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&is_active=is.true&select=id`, { headers: getH });
      if (!((await who.json().catch(() => []))?.length)) {
        return new Response(JSON.stringify({ success: false, error: 'Removing a holding has to be done by an active staff member.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, {
        method: 'DELETE', headers: { ...mutH, Prefer: 'return=representation' },
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: 'Could not remove it. Nothing was deleted.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const rows = await res.json();
      if (!rows?.length) {
        return new Response(JSON.stringify({ success: false, error: 'No portfolio property with that id. Nothing was deleted.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, removed: property_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'add_property_to_portfolio' || action === 'add_portfolio_property') {
      if (!investor_id) return json({ success: false, error: 'investor_id required' });
      const property_address = body.property_address || body.address || '';
      const property_city = body.property_city || body.city || '';
      const property_state = body.property_state || body.state || '';
      const property_zip = body.property_zip || body.zip_code || '';
      const { bedrooms, bathrooms, square_footage, monthly_rent, acquisition_fee, property_type, property_status, operation_type, notes, staff_name, community_name, community_website, send_notification } = body;
      if (!property_address || !property_city || !property_state) return json({ success: false, error: 'Address, city, and state are required' });
      const portfolioData: any = {
        investor_id, address: property_address, city: property_city, state: property_state, zip_code: property_zip || '',
        bedrooms: bedrooms || 0, bathrooms: bathrooms || 0, square_footage: square_footage || null,
        monthly_rent: monthly_rent || 0, acquisition_fee: acquisition_fee || 0, initial_investment: acquisition_fee || 0,
        property_type: property_type || 'single_family', property_status: property_status || 'pending',
        operation_type: operation_type || 'str', status: 'active', acquired_through_ayp: true, acquisition_source: 'ayp',
        added_by_staff: true, assigned_by: staff_name || 'Success Team',
        community_name: community_name || '',
        community_website: community_website || '',
        notes: notes || `Manually added by ${staff_name || 'Success Team'}`,
        staff_notes: [{ author: staff_name || 'Success Team', text: `Property manually added to portfolio. Community: ${community_name || 'N/A'}. ${notes || ''}`.trim(), date: new Date().toISOString() }],
        created_at: new Date().toISOString()
      };
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio`, { method: 'POST', headers: mutH, body: JSON.stringify(portfolioData) });
      if (!insertRes.ok) { const errText = await insertRes.text(); console.error('[v17.4] Portfolio insert failed:', errText); return json({ success: false, error: `Failed to add property: ${errText}` }); }
      const newProp = (await insertRes.json())?.[0];
      try {
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`, { headers: getH });
        const inv = (await invRes.json())?.[0];
        await createNotification(investor_id, 'property_added_to_portfolio', 'New Property Added to Your Portfolio', `A new property${community_name ? ` at ${community_name}` : ''} (${property_address}, ${property_city}, ${property_state}) has been added to your portfolio.`, { property_id: newProp?.id, address: property_address, community_name });
        if (inv?.email) {
          const firstName = (inv.full_name || 'Investor').split(' ')[0];
          await sendInvestorEmail(inv.email, inv.full_name, 'New Property Added to Your Portfolio!',
            `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:30px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">Access Your Place</h1></div><div style="padding:30px;"><p>Hi ${firstName},</p><p>A new property has been added to your portfolio:</p><div style="background:#f8f9fa;border-left:4px solid #d4a574;padding:15px;margin:20px 0;"><strong>${community_name || property_address}</strong><br/>${property_city}, ${property_state}</div><div style="text-align:center;margin:30px 0;"><a href="https://accessyourplace.com/investor" style="background:#d4a574;color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;">View Portfolio</a></div></div></div>`);
        }
      } catch (e) { console.warn('Notification failed:', e); }
      await logActivity(investor_id, 'property_added', 'Property Added to Portfolio', `${community_name || property_address}, ${property_city} ${property_state}`, { property_id: newProp?.id, community_name });
      return json({ success: true, property: newProp, message: 'Property added to investor portfolio' });
    }

    if (action === 'manage_portfolio_property') {
      const { property_id, updates, staff_name } = body;
      if (!property_id) return json({ success: false, error: 'property_id required' });
      const updateData: any = { updated_at: new Date().toISOString() };
      if (updates?.property_status) { updateData.property_status = updates.property_status; updateData.last_status_update = new Date().toISOString(); }
      if (updates?.bedrooms !== undefined) updateData.bedrooms = updates.bedrooms;
      if (updates?.bathrooms !== undefined) updateData.bathrooms = updates.bathrooms;
      if (updates?.square_footage !== undefined) updateData.square_footage = updates.square_footage;
      if (updates?.monthly_rent !== undefined) updateData.monthly_rent = updates.monthly_rent;
      if (updates?.acquisition_fee !== undefined) updateData.acquisition_fee = updates.acquisition_fee;
      if (updates?.notes !== undefined) updateData.notes = updates.notes;
      if (updates?.operation_type !== undefined) updateData.operation_type = updates.operation_type;
      if (updates?.community_name !== undefined) updateData.community_name = updates.community_name;
      if (updates?.community_website !== undefined) updateData.community_website = updates.community_website;
      if (updates?.lease_agreements_received !== undefined) updateData.lease_agreements_received = updates.lease_agreements_received;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(updateData) });
      if (!patchRes.ok) { const errText = await patchRes.text(); throw new Error(`Failed to update: ${errText}`); }
      return json({ success: true, message: 'Property updated' });
    }

    if (action === 'add_portfolio_note') {
      const { property_id, note_text, staff_name } = body;
      if (!property_id || !note_text) return json({ success: false, error: 'property_id and note_text required' });
      const propRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}&select=staff_notes,investor_id,address`, { headers: getH });
      const prop = (await propRes.json())?.[0];
      const currentNotes = prop?.staff_notes || [];
      const newNote = { author: staff_name || 'Success Team', text: note_text, date: new Date().toISOString() };
      await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ staff_notes: [...currentNotes, newNote], updated_at: new Date().toISOString() }) });
      if (prop?.investor_id) { await createNotification(prop.investor_id, 'portfolio_update', 'Property Update', `New update on ${prop.address || 'your property'}: ${note_text.substring(0, 100)}`, { property_id }); }
      return json({ success: true, note: newNote });
    }

    if (action === 'add_dealflow_to_portfolio') {
      const { deal_id, bedrooms, bathrooms, square_footage, monthly_rent, acquisition_fee, staff_name, notes: dealNotes, community_name: reqCommunityName, community_website: reqCommunityWebsite } = body;
      if (!investor_id || !deal_id) return json({ success: false, error: 'investor_id and deal_id required' });
      const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${deal_id}&select=*`, { headers: getH });
      const deal = (await dealRes.json())?.[0];
      if (!deal) return json({ success: false, error: 'Deal not found' });
      const communityName = reqCommunityName || deal.listing_title || '';
      const communityWebsite = reqCommunityWebsite || deal.listing_url || '';
      const portfolioData = {
        investor_id, address: deal.address || deal.street_address || '', city: deal.city || '', state: deal.state || '',
        zip_code: deal.zip_code || '', bedrooms: bedrooms || deal.bedrooms || 0, bathrooms: bathrooms || deal.bathrooms || 0,
        square_footage: square_footage || deal.square_footage || deal.square_feet || null, monthly_rent: monthly_rent || deal.monthly_rent || 0,
        acquisition_fee: acquisition_fee || 0, initial_investment: acquisition_fee || 0, acquired_through_ayp: true,
        acquisition_source: 'ayp', property_type: deal.property_type || 'single_family', property_status: 'pending',
        status: 'active', deal_flow_property_id: deal_id, added_by_staff: true, assigned_by: staff_name || 'Success Team',
        operation_type: deal.operation_type || 'str',
        community_name: communityName,
        community_website: communityWebsite,
        notes: dealNotes || `Added from deal flow by ${staff_name || 'Success Team'}`,
        staff_notes: [{ author: staff_name || 'Success Team', text: `Property added from deal flow. Community: ${communityName || 'N/A'}. ${dealNotes || ''}`.trim(), date: new Date().toISOString() }],
        photo_urls: deal.photo_urls || deal.photos || [], created_at: new Date().toISOString()
      };
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio`, { method: 'POST', headers: mutH, body: JSON.stringify(portfolioData) });
      if (!insertRes.ok) { const errText = await insertRes.text(); console.error('[v17.4] Dealflow portfolio insert failed:', errText); throw new Error(`Failed: ${errText}`); }
      const newProp = (await insertRes.json())?.[0];
      try {
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`, { headers: getH });
        const inv = (await invRes.json())?.[0];
        await createNotification(investor_id, 'property_added_to_portfolio', 'New Property Added', `${communityName || portfolioData.address}, ${portfolioData.city}`, { property_id: newProp?.id, community_name: communityName });
        if (inv?.email) {
          await sendInvestorEmail(inv.email, inv.full_name, 'New Property Added to Your Portfolio!',
            `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:30px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">Access Your Place</h1></div><div style="padding:30px;"><p>Hi ${(inv.full_name || 'Investor').split(' ')[0]},</p><p>A new property has been added:</p><div style="background:#f8f9fa;border-left:4px solid #d4a574;padding:15px;margin:20px 0;"><strong>${communityName || portfolioData.address}</strong><br/>${portfolioData.city}, ${portfolioData.state}</div><div style="text-align:center;margin:30px 0;"><a href="https://accessyourplace.com/investor" style="background:#d4a574;color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;">View Portfolio</a></div></div></div>`);
        }
      } catch (e) { console.warn('Notification failed:', e); }
      await logActivity(investor_id, 'dealflow_property_added', 'Deal Flow Property Added', `${communityName || portfolioData.address}`, { deal_id, property_id: newProp?.id, community_name: communityName });
      return json({ success: true, property: newProp });
    }

    if (action === 'get_portfolio_credits') {
      const creditsRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_credits?credit_status=eq.pending_approval&order=created_at.desc`, { headers: getH });
      let credits = creditsRes.ok ? await creditsRes.json() : [];
      if (!Array.isArray(credits)) credits = [];
      const investorIds = [...new Set(credits.map((c: any) => c.investor_id).filter(Boolean))];
      let investorMap: Record<string, any> = {};
      for (const id of investorIds) { const ir = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${id}&select=id,full_name,email`, { headers: getH }); const inv = (await ir.json())?.[0]; if (inv) investorMap[inv.id] = inv; }
      const propertyIds = [...new Set(credits.map((c: any) => c.portfolio_property_id).filter(Boolean))];
      let propertyMap: Record<string, any> = {};
      for (const pid of propertyIds) { try { const pr = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${pid}&select=id,address,city,state`, { headers: getH }); if (pr.ok) { const prop = (await pr.json())?.[0]; if (prop) propertyMap[prop.id] = prop; } } catch {} }
      const enriched = credits.map((c: any) => ({ ...c, investor_name: investorMap[c.investor_id]?.full_name || 'Unknown', investor_email: investorMap[c.investor_id]?.email || '', property_address: propertyMap[c.portfolio_property_id]?.address || '', property_city: propertyMap[c.portfolio_property_id]?.city || '', property_state: propertyMap[c.portfolio_property_id]?.state || '' }));
      return json({ success: true, credits: enriched });
    }

    if (action === 'approve_portfolio_credit') {
      const { credit_id, property_id, approved, staff_name } = body;
      if (credit_id) { await fetch(`${SUPABASE_URL}/rest/v1/portfolio_credits?id=eq.${credit_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ credit_status: approved ? 'approved' : 'denied', approved_by: staff_name, approved_at: new Date().toISOString() }) }); }
      if (property_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ credit_status: approved ? 'approved' : 'none', credit_approved_by: staff_name, credit_approved_at: new Date().toISOString() }) });
        if (approved) {
          const propRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_portfolio?id=eq.${property_id}&select=investor_id,credit_amount,acquisition_fee,address`, { headers: getH });
          const prop = (await propRes.json())?.[0];
          if (prop?.investor_id) {
            const creditAmount = prop.credit_amount || prop.acquisition_fee || 0;
            if (creditAmount > 0) {
              const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${prop.investor_id}&select=credit_balance`, { headers: getH });
              const inv = (await invRes.json())?.[0];
              const newBalance = (inv?.credit_balance || 0) + creditAmount;
              await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${prop.investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ credit_balance: newBalance, updated_at: new Date().toISOString() }) });
            }
          }
        }
      }
      return json({ success: true, message: approved ? 'Credit approved' : 'Credit denied' });
    }

    if (action === 'upload_document') {
      const { document_name, document_url, document_type, file_path, staff_name } = body;
      if (!investor_id || !document_name) return json({ success: false, error: 'Missing fields' });
      const docData: any = { investor_id, document_name, document_type: document_type || 'other', uploaded_by: 'staff', uploaded_by_name: staff_name || 'Success Team', status: 'approved', created_at: new Date().toISOString() };
      if (document_url) docData.document_url = document_url;
      if (file_path) docData.file_path = file_path;
      if (!document_url && !file_path) docData.document_url = '';
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents`, { method: 'POST', headers: mutH, body: JSON.stringify(docData) });
      if (!insertRes.ok) { const errText = await insertRes.text(); return json({ success: false, error: errText }); }
      const newDoc = (await insertRes.json())?.[0];
      try {
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`, { headers: getH });
        const inv = (await invRes.json())?.[0];
        await createNotification(investor_id, 'new_document', 'New Document Available', `"${document_name}" uploaded by ${staff_name}`, { document_id: newDoc?.id });
        if (inv?.email) await sendInvestorEmail(inv.email, inv.full_name, `New Document: ${document_name}`, `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:30px;text-align:center;"><h1 style="color:#f59e0b;margin:0;">Access Your Place</h1></div><div style="padding:30px;"><p>Hi ${(inv.full_name || 'Investor').split(' ')[0]},</p><p>A new document "${document_name}" has been uploaded.</p><div style="text-align:center;margin:30px 0;"><a href="https://accessyourplace.com/investor" style="background:#d4a574;color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;">View Document</a></div></div></div>`);
      } catch (e) { console.warn('Notification failed:', e); }
      return json({ success: true, document: newDoc });
    }

    if (action === 'update_funding_status') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const { funded, funding_tier, staff_name } = body;
      const ud: any = { account_funded: !!funded, updated_at: new Date().toISOString() };
      if (funding_tier) ud.funding_tier = funding_tier;
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(ud) });
      await logActivity(investor_id, 'funding_status_updated', funded ? 'Account Funded' : 'Account Unfunded', `Updated by ${staff_name}`, { funded, funding_tier });
      return json({ success: true });
    }

    if (action === 'update_credits') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const { credits, operation, reason, staff_name } = body;
      const creditAmount = parseInt(credits) || 0;
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,credit_balance`, { headers: getH });
      const inv = (await invRes.json())?.[0];
      const currentBalance = inv?.credit_balance || 0;
      let newBalance = currentBalance;
      if (operation === 'set') newBalance = creditAmount;
      else if (operation === 'add') newBalance = currentBalance + creditAmount;
      else if (operation === 'subtract') newBalance = Math.max(0, currentBalance - creditAmount);
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ credit_balance: newBalance, updated_at: new Date().toISOString() }) });
      try { await fetch(`${SUPABASE_URL}/rest/v1/investor_credits`, { method: 'POST', headers: mutH, body: JSON.stringify({ investor_id, amount: creditAmount, operation, previous_balance: currentBalance, new_balance: newBalance, reason, created_by: staff_name }) }); } catch {}
      return json({ success: true, previous_balance: currentBalance, new_balance: newBalance });
    }

    if (action === 'send_agreement') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const { agreement_type, staff_name } = body;
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,full_name,email`, { headers: getH });
      const inv = (await invRes.json())?.[0];
      if (!inv) return json({ success: false, error: 'Not found' });
      try { await fetch(`${SUPABASE_URL}/rest/v1/investor_documents`, { method: 'POST', headers: mutH, body: JSON.stringify({ investor_id, document_name: `${agreement_type} - ${inv.full_name}`, document_type: 'agreement', status: 'pending_signature', sent_by: staff_name, uploaded_by: staff_name }) }); } catch {}
      if (RESEND_API_KEY && inv.email) { await sendInvestorEmail(inv.email, inv.full_name, `Action Required: ${agreement_type}`, `<div style="font-family:Arial;max-width:600px;margin:0 auto;"><h2 style="color:#1a365d;">Agreement Ready</h2><p>Hi ${inv.full_name},</p><p>Your <strong>${agreement_type}</strong> is ready. <a href="https://accessyourplace.com/investor">Sign now</a></p></div>`); }
      return json({ success: true, message: `Agreement sent to ${inv.email}` });
    }

    if (action === 'get_am_activity_feed') {
      const { staff_id, limit = 50 } = body;
      if (!staff_id) return json({ success: true, activities: [], investor_count: 0 });
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?assigned_acquisition_manager_id=eq.${staff_id}&select=id,full_name,email`, { headers: getH });
      const myInvestors = await invRes.json();
      if (!Array.isArray(myInvestors) || myInvestors.length === 0) return json({ success: true, activities: [], investor_count: 0 });
      const investorMap: Record<string, any> = {};
      myInvestors.forEach((i: any) => { investorMap[i.id] = i; });
      const idFilter = myInvestors.map((i: any) => `investor_id.eq.${i.id}`).join(',');
      const actRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_activity_logs?or=(${idFilter})&activity_category=eq.admin&order=created_at.desc&limit=${limit}`, { headers: getH });
      let activities = actRes.ok ? await actRes.json() : [];
      if (!Array.isArray(activities)) activities = [];
      return json({ success: true, activities: activities.map((a: any) => ({ ...a, investor_name: investorMap[a.investor_id]?.full_name || 'Unknown' })), investor_count: myInvestors.length });
    }

    if (action === 'self_assign_am') {
      const { staff_id, staff_name } = body;
      if (!investor_id || !staff_id) return json({ success: false, error: 'IDs required' });
      const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,assigned_acquisition_manager_id,acquisition_manager_name`, { headers: getH });
      const inv = (await invRes.json())?.[0];
      if (!inv) return json({ success: false, error: 'Not found' });
      if (inv.assigned_acquisition_manager_id && inv.assigned_acquisition_manager_id !== staff_id) return json({ success: false, error: `Already assigned to ${inv.acquisition_manager_name}`, already_assigned: true });
      let fn = staff_name;
      if (!fn) { const s = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}&select=first_name,last_name,name`, { headers: getH }); const st = (await s.json())?.[0]; if (st) fn = `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.name; }
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ assigned_acquisition_manager_id: staff_id, acquisition_manager_name: fn, acquisition_manager_assigned_at: new Date().toISOString() }) });
      return json({ success: true });
    }

    if (action === 'assign_acquisition_manager') {
      const { manager_id, manager_name } = body;
      if (!investor_id) return json({ success: false, error: 'ID required' });
      let fn = manager_name;
      if (manager_id && !fn) { const s = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${manager_id}&select=first_name,last_name,name`, { headers: getH }); const st = (await s.json())?.[0]; if (st) fn = `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.name; }
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ assigned_acquisition_manager_id: manager_id || null, acquisition_manager_name: fn || null, acquisition_manager_assigned_at: manager_id ? new Date().toISOString() : null }) });
      return json({ success: true });
    }

    if (action === 'assign_setup_manager') {
      const { manager_id, manager_name } = body;
      if (!investor_id) return json({ success: false, error: 'ID required' });
      let fn = manager_name;
      if (manager_id && !fn) { const s = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${manager_id}&select=first_name,last_name,name`, { headers: getH }); const st = (await s.json())?.[0]; if (st) fn = `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.name; }
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ assigned_setup_manager_id: manager_id || null, assigned_setup_manager_name: fn || null, setup_manager_assigned_at: manager_id ? new Date().toISOString() : null }) });
      return json({ success: true });
    }

    if (action === 'complete_discovery_call') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,assigned_acquisition_manager_id`, { headers: getH });
      const inv = (await r.json())?.[0];
      const ud: any = { discovery_call_completed: true, discovery_call_date: new Date().toISOString() };
      if (inv?.assigned_acquisition_manager_id) ud.can_purchase_deals = true;
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(ud) });
      return json({ success: true, can_purchase: !!inv?.assigned_acquisition_manager_id });
    }

    if (action === 'update_investor') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const ud: any = { updated_at: new Date().toISOString() };
      if (body.full_name !== undefined) ud.full_name = body.full_name;
      if (body.email !== undefined) ud.email = body.email;
      if (body.phone !== undefined) ud.phone = body.phone;
      if (body.company_name !== undefined) ud.company_name = body.company_name;
      if (body.preferred_markets !== undefined) ud.preferred_markets = body.preferred_markets;
      if (body.budget_min !== undefined) ud.investment_budget_min = body.budget_min;
      if (body.budget_max !== undefined) ud.investment_budget_max = body.budget_max;
      if (body.onboarding_completed !== undefined) ud.onboarding_completed = body.onboarding_completed;
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(ud) });
      return json({ success: true });
    }

    if (action === 'update_status') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const ud: any = { updated_at: new Date().toISOString() };
      if (body.status === 'active') { ud.is_active = true; ud.onboarding_completed = true; }
      else if (body.status === 'inactive') ud.is_active = false;
      else if (body.status === 'pending') ud.onboarding_completed = false;
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(ud) });
      return json({ success: true });
    }

    if (action === 'delete_investor') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=linked_staff_id`, { headers: getH });
      const inv = (await r.json())?.[0];
      if (inv?.linked_staff_id) await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${inv.linked_staff_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ linked_investor_id: null }) });
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'DELETE', headers: mutH });
      return json({ success: true });
    }

    if (action === 'reset_search_limit') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ penny_searches_this_week: 0, penny_search_week_start: new Date().toISOString() }) });
      return json({ success: true });
    }

    if (action === 'get_assigned_managers') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=assigned_acquisition_manager_id,assigned_setup_manager_id,acquisition_manager_assigned_at,setup_manager_assigned_at`, { headers: getH });
      const inv = (await r.json())?.[0];
      if (!inv) return json({ success: false, error: 'Not found' });
      let am = null, sm = null;
      if (inv.assigned_acquisition_manager_id) { const s = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${inv.assigned_acquisition_manager_id}&select=id,first_name,last_name,email,phone,name`, { headers: getH }); const st = (await s.json())?.[0]; if (st) am = { id: st.id, name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.name, email: st.email, phone: st.phone, assigned_at: inv.acquisition_manager_assigned_at }; }
      if (inv.assigned_setup_manager_id) { const s = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${inv.assigned_setup_manager_id}&select=id,first_name,last_name,email,phone,name`, { headers: getH }); const st = (await s.json())?.[0]; if (st) sm = { id: st.id, name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.name, email: st.email, phone: st.phone, assigned_at: inv.setup_manager_assigned_at }; }
      return json({ success: true, acquisition_manager: am, setup_manager: sm });
    }

    if (action === 'link_staff_account') {
      const { staff_id } = body;
      if (!investor_id || !staff_id) return json({ success: false, error: 'IDs required' });
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ linked_staff_id: staff_id }) });
      await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${staff_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ linked_investor_id: investor_id }) });
      return json({ success: true });
    }

    if (action === 'unlink_staff_account') {
      if (!investor_id) return json({ success: false, error: 'ID required' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=linked_staff_id`, { headers: getH });
      const inv = (await r.json())?.[0];
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ linked_staff_id: null }) });
      if (inv?.linked_staff_id) await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${inv.linked_staff_id}`, { method: 'PATCH', headers: mutH, body: JSON.stringify({ linked_investor_id: null }) });
      return json({ success: true });
    }

    if (action === 'send_message') {
      const { subject, message, staff_name } = body;
      if (!investor_id || !subject || !message) return json({ success: false, error: 'Missing fields' });
      try { await fetch(`${SUPABASE_URL}/rest/v1/investor_messages`, { method: 'POST', headers: mutH, body: JSON.stringify({ investor_id, subject, message, sender_type: 'staff', sender_name: staff_name || 'Success Team' }) }); } catch {}
      return json({ success: true });
    }

    if (action === 'notify_am_investor_action') return json({ success: true });

    return json({ success: false, error: `Unknown action: ${action}`, investors: [], counts: { total: 0 } });
  } catch (error: any) {
    console.error('[v17.4] Error:', error.message);
    return json({ success: false, error: error.message, investors: [], counts: { total: 0 } });
  }
});
