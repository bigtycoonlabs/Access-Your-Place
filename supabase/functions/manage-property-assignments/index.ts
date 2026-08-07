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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const body = await req.json();
    const { action } = body;

    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation'
    };

    const getHeaders = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };

    // Helper: ensure value is a proper array
    function ensureArray(val: any): string[] {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter((v: any) => typeof v === 'string');
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed; } catch {}
        if (val.startsWith('{') && val.endsWith('}')) {
          return val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
        }
      }
      return [];
    }

    // ============================================================
    // LIST assignments
    // ============================================================
    if (action === 'list') {
      const { investor_id, property_id, status } = body;
      let queryParams = 'select=*&order=created_at.desc';
      if (investor_id) queryParams += `&investor_id=eq.${investor_id}`;
      if (property_id) queryParams += `&property_id=eq.${property_id}`;
      if (status) queryParams += `&status=eq.${status}`;

      const response = await fetch(`${supabaseUrl}/rest/v1/property_assignments?${queryParams}`, {
        method: 'GET', headers: getHeaders
      });
      const data = await response.json();
      return new Response(JSON.stringify({ success: true, assignments: data }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // CREATE assignment + portfolio + notification + emails
    // ============================================================
    if (action === 'create') {
      const { property_id, investor_id, assigned_by, payment_amount, notes } = body;

      if (!property_id || !investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'property_id and investor_id are required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log(`[assign] START property=${property_id} investor=${investor_id} by=${assigned_by}`);
      const steps: Record<string, string> = {};

      // Step 1: Fetch property
      let property: any = null;
      try {
        const r = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property_id}&select=*`, { headers: getHeaders });
        const d = await r.json();
        property = Array.isArray(d) ? d[0] : d;
        steps.property = property ? 'OK' : 'NOT_FOUND';
      } catch (e: any) { steps.property = `ERR: ${e.message}`; }

      // Step 2: Fetch investor
      let investor: any = null;
      try {
        const r = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=id,full_name,email,phone,acquisition_manager_name,assigned_acquisition_manager_id`, { headers: getHeaders });
        const d = await r.json();
        investor = Array.isArray(d) ? d[0] : d;
        steps.investor = investor ? 'OK' : 'NOT_FOUND';
      } catch (e: any) { steps.investor = `ERR: ${e.message}`; }

      // Step 3: Create property_assignments (optional table)
      let assignment: any = null;
      try {
        const r = await fetch(`${supabaseUrl}/rest/v1/property_assignments`, {
          method: 'POST', headers,
          body: JSON.stringify({
            property_id, investor_id,
            assigned_by: String(assigned_by || 'Staff'),
            payment_amount: payment_amount || property?.acquisition_fee || null,
            notes: notes || null,
            status: 'pending'
          })
        });
        if (r.ok) {
          const result = await r.json();
          assignment = Array.isArray(result) ? result[0] : result;
          steps.assignment = 'OK';
        } else {
          steps.assignment = 'SKIP';
        }
      } catch { steps.assignment = 'SKIP'; }

      // Step 4: Update property
      try {
        const r = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${property_id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ assigned_investor_id: investor_id, acquisition_status: 'assigned' })
        });
        steps.update_prop = r.ok ? 'OK' : 'FAIL';
      } catch { steps.update_prop = 'ERR'; }

      // Step 5: Create investor_portfolio entry (CRITICAL)
      let portfolioEntry: any = null;
      try {
        const communityName = String(property?.listing_title || property?.community_name || '');
        const communityWebsite = String(property?.listing_url || property?.community_website || '');
        const addr = String(property?.address || '');
        const city = String(property?.city || '');
        const state = String(property?.state || '');

        const staffNotesArr = [{
          author: String(assigned_by || 'Staff'),
          text: String(`Assigned from deal flow.${communityName ? ' Community: ' + communityName + '.' : ''}${notes ? ' ' + String(notes) : ''}`),
          date: new Date().toISOString()
        }];

        const photoUrls = ensureArray(property?.photos || property?.photo_urls);

        const portfolioData: Record<string, any> = {
          investor_id,
          address: addr,
          city,
          state,
          zip_code: String(property?.zip_code || ''),
          bedrooms: parseInt(String(property?.bedrooms || '0')) || 0,
          bathrooms: parseFloat(String(property?.bathrooms || '0')) || 0,
          square_footage: parseInt(String(property?.sqft || property?.square_feet || property?.square_footage || '0')) || null,
          monthly_rent: parseFloat(String(property?.monthly_rent || '0')) || 0,
          acquisition_fee: parseFloat(String(payment_amount || property?.acquisition_fee || '0')) || 0,
          initial_investment: parseFloat(String(payment_amount || property?.acquisition_fee || '0')) || 0,
          property_type: String(property?.property_type || 'single_family'),
          property_status: 'pending',
          status: 'active',
          acquired_through_ayp: true,
          acquisition_source: 'ayp',
          deal_flow_property_id: property_id,
          added_by_staff: true,
          assigned_by: String(assigned_by || 'Staff'),
          operation_type: String(property?.operation_type || 'str'),
          community_name: communityName,
          community_website: communityWebsite,
          notes: notes ? String(notes) : `Assigned from deal flow by ${assigned_by || 'Staff'}`,
          staff_notes: staffNotesArr,
          photo_urls: photoUrls,
          created_at: new Date().toISOString()
        };

        // Remove null square_footage to avoid issues
        if (!portfolioData.square_footage) delete portfolioData.square_footage;

        console.log('[assign] Inserting portfolio:', addr, city, state);

        const r = await fetch(`${supabaseUrl}/rest/v1/investor_portfolio`, {
          method: 'POST', headers,
          body: JSON.stringify(portfolioData)
        });

        if (r.ok) {
          const result = await r.json();
          portfolioEntry = Array.isArray(result) ? result[0] : result;
          steps.portfolio = `OK: ${portfolioEntry?.id || 'created'}`;
          console.log('[assign] Portfolio created:', portfolioEntry?.id);
        } else {
          const errText = await r.text();
          steps.portfolio = `FAIL: ${errText.substring(0, 150)}`;
          console.error('[assign] Portfolio insert failed:', errText);
        }
      } catch (e: any) {
        steps.portfolio = `ERR: ${e.message}`;
        console.error('[assign] Portfolio error:', e.message);
      }

      // Step 6: Create notification (use 'data' column, not 'metadata')
      try {
        const propLabel = property?.listing_title || property?.address || 'a new property';
        const propLoc = property?.city && property?.state ? ` in ${property.city}, ${property.state}` : '';

        const r = await fetch(`${supabaseUrl}/rest/v1/investor_notifications`, {
          method: 'POST', headers,
          body: JSON.stringify({
            investor_id,
            type: 'property_assigned',
            notification_type: 'property_assigned',
            title: 'New Property Added to Your Portfolio',
            message: `${propLabel}${propLoc} has been added to your portfolio by ${assigned_by || 'your team'}. View it in your Portfolio tab.`,
            data: {
              property_id,
              address: property?.address || '',
              city: property?.city || '',
              state: property?.state || '',
              assigned_by: String(assigned_by || 'Staff'),
              portfolio_entry_id: portfolioEntry?.id || null
            },
            read: false,
            created_at: new Date().toISOString()
          })
        });
        steps.notification = r.ok ? 'OK' : 'FAIL';
      } catch { steps.notification = 'ERR'; }

      // Step 7: Email AM (internal staff notification)
      if (investor?.assigned_acquisition_manager_id) {
        try {
          let amEmail = '';
          let amName = investor.acquisition_manager_name || '';

          // Try staff_users
          try {
            const r = await fetch(`${supabaseUrl}/rest/v1/staff_users?id=eq.${investor.assigned_acquisition_manager_id}&select=id,first_name,last_name,email,name`, { headers: getHeaders });
            if (r.ok) { const d = await r.json(); const am = Array.isArray(d) ? d[0] : d; if (am?.email) { amEmail = am.email; amName = am.first_name ? `${am.first_name} ${am.last_name || ''}`.trim() : (am.name || amName); } }
          } catch {}

          // Try staff_members
          if (!amEmail) {
            try {
              const r = await fetch(`${supabaseUrl}/rest/v1/staff_members?id=eq.${investor.assigned_acquisition_manager_id}&select=id,name,email`, { headers: getHeaders });
              if (r.ok) { const d = await r.json(); const am = Array.isArray(d) ? d[0] : d; if (am?.email) { amEmail = am.email; amName = am.full_name || amName; } }
            } catch {}
          }

          if (amEmail) {
            const propLabel = property?.listing_title || property?.address || 'a property';
            const propLoc = property?.city && property?.state ? `${property.city}, ${property.state}` : '';
            const invLabel = investor?.full_name || 'an investor';

            await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                action: 'new_message',
                investor_id: investor.assigned_acquisition_manager_id,
                investor_name: amName,
                investor_email: amEmail,
                staff_name: assigned_by || 'AYP System',
                subject: `Property Assigned: ${propLabel} to ${invLabel}`,
                message_subject: 'New Property Assignment',
                message_preview: `Property: ${propLabel}\nLocation: ${propLoc}\nInvestor: ${invLabel}\nAssigned by: ${assigned_by || 'Staff'}\nRent: $${property?.monthly_rent || 'N/A'}/mo\nFee: $${property?.acquisition_fee || 'N/A'}`
              })
            });
            steps.am_email = `OK: ${amEmail}`;
          } else {
            steps.am_email = 'SKIP: no email';
          }
        } catch (e: any) { steps.am_email = `ERR: ${e.message}`; }
      } else {
        steps.am_email = 'SKIP: no AM';
      }

      // Step 8: Email investor â€” FIXED: Use 'property_assigned' action with correct investor-facing template
      if (investor?.email) {
        try {
          const propLabel = property?.listing_title || property?.address || 'a new property';
          const propLoc = property?.city && property?.state ? `${property.city}, ${property.state}` : '';
          await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              action: 'property_assigned',
              recipient_type: 'investor',
              investor_id,
              investor_name: investor.full_name || 'Investor',
              investor_email: investor.email,
              staff_name: assigned_by || 'AYP Team',
              property_address: property?.address || propLabel,
              property_city: property?.city || '',
              property_state: property?.state || '',
              property_bedrooms: property?.bedrooms || '',
              property_bathrooms: property?.bathrooms || '',
              property_rent: property?.monthly_rent || '',
              community_name: property?.listing_title || property?.community_name || '',
              subject: `New Property Added to Your Portfolio: ${propLabel}${propLoc ? ', ' + propLoc : ''}`,
              portal_url: 'https://accessyourplace.com/investor-login'
            })
          });
          steps.investor_email = 'OK';
        } catch (e: any) { steps.investor_email = `ERR: ${e.message}`; }
      } else {
        steps.investor_email = 'SKIP';
      }

      const ok = !!portfolioEntry;
      console.log(`[assign] DONE success=${ok}`, JSON.stringify(steps));

      return new Response(JSON.stringify({
        success: ok,
        assignment: assignment || null,
        portfolio_entry: portfolioEntry || null,
        notifications_sent: steps.notification === 'OK',
        steps,
        error: ok ? null : `Portfolio creation failed: ${steps.portfolio}`
      }), {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // UPDATE assignment
    // ============================================================
    if (action === 'update') {
      const { assignment_id, status, payment_date, payment_method, payment_reference, notes } = body;
      if (!assignment_id) {
        return new Response(JSON.stringify({ success: false, error: 'assignment_id required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const updateData: Record<string, any> = {};
      if (status) updateData.status = status;
      if (payment_date) updateData.payment_date = payment_date;
      if (payment_method) updateData.payment_method = payment_method;
      if (payment_reference) updateData.payment_reference = payment_reference;
      if (notes !== undefined) updateData.notes = notes;

      const r = await fetch(`${supabaseUrl}/rest/v1/property_assignments?id=eq.${assignment_id}`, {
        method: 'PATCH', headers, body: JSON.stringify(updateData)
      });
      if (!r.ok) { const t = await r.text(); throw new Error(`Update failed: ${t}`); }
      const updated = await r.json();

      if (status === 'paid') {
        try {
          const gr = await fetch(`${supabaseUrl}/rest/v1/property_assignments?id=eq.${assignment_id}&select=property_id`, { headers: getHeaders });
          const gd = await gr.json();
          if (gd[0]?.property_id) {
            await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${gd[0].property_id}`, {
              method: 'PATCH', headers,
              body: JSON.stringify({ acquisition_status: 'paid', acquisition_fee_paid: true, acquisition_fee_paid_date: payment_date || new Date().toISOString() })
            });
          }
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, assignment: updated[0] || updated }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // DELETE assignment
    // ============================================================
    if (action === 'delete') {
      const { assignment_id, property_id } = body;
      if (!assignment_id) {
        return new Response(JSON.stringify({ success: false, error: 'assignment_id required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const gr = await fetch(`${supabaseUrl}/rest/v1/property_assignments?id=eq.${assignment_id}&select=property_id`, { headers: getHeaders });
      const gd = await gr.json();
      const propId = property_id || gd[0]?.property_id;

      await fetch(`${supabaseUrl}/rest/v1/property_assignments?id=eq.${assignment_id}`, { method: 'DELETE', headers });

      if (propId) {
        await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${propId}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ assigned_investor_id: null, acquisition_status: 'available', acquisition_fee_paid: false, acquisition_fee_paid_date: null })
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // LIST DETAILED
    // ============================================================
    if (action === 'list_detailed') {
      const { investor_id, status } = body;
      let qp = 'select=*&order=created_at.desc';
      if (investor_id) qp += `&investor_id=eq.${investor_id}`;
      if (status) qp += `&status=eq.${status}`;

      const r = await fetch(`${supabaseUrl}/rest/v1/property_assignments?${qp}`, { headers: getHeaders });
      const assignments = await r.json();

      const detailed = await Promise.all((Array.isArray(assignments) ? assignments : []).map(async (a: any) => {
        const pr = await fetch(`${supabaseUrl}/rest/v1/properties?id=eq.${a.property_id}&select=*`, { headers: getHeaders });
        const props = await pr.json();
        return { ...a, property: props[0] || null };
      }));

      return new Response(JSON.stringify({ success: true, assignments: detailed }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Invalid action: ${action}` }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('[assign] Fatal:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
