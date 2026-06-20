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
// Investor Auth v3.9.0 - 2026-02-03
// Added set_acquisition_manager and request_am_verification actions
// Fixed get_am_info to check both assigned_acquisition_manager_id and assigned_am_id fields
// Added claim_legacy_property and search_legacy_properties actions
// Added get_linked_staff and switch_to_staff actions for staff/investor account toggling
// Fixed portfolio property management and credit system
// Enhanced AM assignment flow with am_assignment_requests table
// Added success team notifications when investors add properties

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Send email helper
async function sendEmail(resendApiKey: string, to: string, subject: string, html: string) {
  if (!resendApiKey) return { error: 'No RESEND_API_KEY' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Access Your Place <notifications@accessyourplace.com>',
        to: [to],
        subject,
        html
      })
    });
    return res.ok ? { success: true } : { error: await res.text() };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Notify success managers
async function notifySuccessTeam(supabaseUrl: string, apiHeaders: any, notificationType: string, data: any) {
  try {
    // Get all success managers
    const smRes = await fetch(
      `${supabaseUrl}/rest/v1/staff?role=eq.success_manager&select=id,full_name,email`,
      { headers: apiHeaders }
    );
    const managers = await smRes.json();
    
    if (!managers || managers.length === 0) {
      console.log('[v3.9] No success managers found');
      return;
    }

    // Create notification for each manager
    for (const manager of managers) {
      await fetch(`${supabaseUrl}/rest/v1/staff_notifications`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          staff_id: manager.id,
          notification_type: notificationType,
          title: data.title,
          message: data.message,
          priority: data.priority || 'normal',
          metadata: data.metadata
        })
      });
    }
    
    console.log(`[v3.9] Notified ${managers.length} success managers`);
  } catch (e: any) {
    console.error('[v3.9] Error notifying success team:', e.message);
  }
}

Deno.serve(async (req: Request) => {
  console.log('[v3.9] investor-auth called');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
    console.log('[v3.9] Action:', action);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[v3.9] Missing env vars');
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiHeaders = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // ==================== SET ACQUISITION MANAGER ====================
    if (action === 'set_acquisition_manager') {
      const { investor_id, am_first_name, am_last_name } = body;
      console.log('[v3.9] set_acquisition_manager for:', investor_id, 'AM:', am_first_name, am_last_name);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!am_first_name || !am_last_name) {
        return new Response(JSON.stringify({ success: false, error: 'AM first and last name are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Update investor with AM name
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              acquisition_manager_first_name: am_first_name.trim(),
              acquisition_manager_last_name: am_last_name.trim(),
              am_verification_status: 'pending',
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!updateRes.ok) {
          throw new Error('Failed to update investor record');
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Acquisition Manager info saved successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] set_acquisition_manager error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== REQUEST AM VERIFICATION ====================
    if (action === 'request_am_verification') {
      const { investor_id, investor_email, am_first_name, am_last_name } = body;
      console.log('[v3.9] request_am_verification for:', investor_id, 'AM:', am_first_name, am_last_name);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!am_first_name || !am_last_name) {
        return new Response(JSON.stringify({ success: false, error: 'AM first and last name are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get investor info
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        // Update investor with AM info and verification request
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              acquisition_manager_first_name: am_first_name.trim(),
              acquisition_manager_last_name: am_last_name.trim(),
              am_verification_status: 'pending',
              am_verification_requested_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!updateRes.ok) {
          throw new Error('Failed to update investor record');
        }

        // Notify success team
        await notifySuccessTeam(supabaseUrl, apiHeaders, 'am_verification_request', {
          title: 'AM Verification Request',
          message: `${investor?.full_name || investor_email || 'An investor'} is requesting verification for AM: ${am_first_name} ${am_last_name}`,
          priority: 'high',
          metadata: {
            investor_id,
            investor_name: investor?.full_name,
            investor_email: investor_email || investor?.email,
            am_first_name,
            am_last_name
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'AM verification request submitted. Our Success Team will verify and notify you.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] request_am_verification error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== SEARCH LEGACY PROPERTIES ====================
    if (action === 'search_legacy_properties') {
      const { investor_id, investor_email, search_address } = body;
      console.log('[v3.9] search_legacy_properties for:', investor_id, 'address:', search_address);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        let email = investor_email;
        if (!email) {
          const invRes = await fetch(
            `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=email`,
            { method: 'GET', headers: apiHeaders }
          );
          const investor = (await invRes.json())?.[0];
          email = investor?.email;
        }

        let properties = [];

        if (search_address && search_address.trim().length >= 3) {
          const searchTerm = search_address.trim().toLowerCase();
          const propRes = await fetch(
            `${supabaseUrl}/rest/v1/legacy_properties?claim_status=eq.available&address=ilike.*${encodeURIComponent(searchTerm)}*&select=*`,
            { method: 'GET', headers: apiHeaders }
          );
          properties = await propRes.json();
        } else if (email) {
          const propRes = await fetch(
            `${supabaseUrl}/rest/v1/legacy_properties?claim_status=eq.available&original_investor_email=ilike.${encodeURIComponent(email)}&select=*`,
            { method: 'GET', headers: apiHeaders }
          );
          properties = await propRes.json();
        }

        return new Response(JSON.stringify({
          success: true,
          properties: properties || [],
          search_method: search_address ? 'address' : 'email'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] search_legacy_properties error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== CLAIM LEGACY PROPERTY ====================
    if (action === 'claim_legacy_property') {
      const { investor_id, legacy_property_id } = body;
      console.log('[v3.9] claim_legacy_property:', legacy_property_id, 'for investor:', investor_id);

      if (!investor_id || !legacy_property_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and legacy_property_id are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const legacyRes = await fetch(
          `${supabaseUrl}/rest/v1/legacy_properties?id=eq.${legacy_property_id}&select=*`,
          { method: 'GET', headers: apiHeaders }
        );
        const legacyProperty = (await legacyRes.json())?.[0];

        if (!legacyProperty) {
          return new Response(JSON.stringify({ success: false, error: 'Legacy property not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (legacyProperty.claim_status !== 'available') {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'This property has already been claimed',
            claim_status: legacyProperty.claim_status
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        const propRes = await fetch(`${supabaseUrl}/rest/v1/investor_portfolio`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            address: legacyProperty.address,
            city: legacyProperty.city,
            state: legacyProperty.state,
            zip_code: legacyProperty.zip_code,
            bedrooms: legacyProperty.bedrooms,
            bathrooms: legacyProperty.bathrooms,
            monthly_rent: legacyProperty.monthly_rent,
            property_type: legacyProperty.property_type,
            acquisition_date: legacyProperty.acquisition_date,
            acquired_through_ayp: true,
            property_status: 'pending_approval',
            legacy_property_id: legacy_property_id,
            notes: `Claimed from ${legacyProperty.legacy_system || 'legacy system'}. Original acquisition date: ${legacyProperty.acquisition_date || 'Unknown'}`,
            status: 'active'
          })
        });

        if (!propRes.ok) {
          throw new Error('Failed to create portfolio property');
        }

        const portfolioProperty = (await propRes.json())?.[0];

        await fetch(
          `${supabaseUrl}/rest/v1/legacy_properties?id=eq.${legacy_property_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              claimed_by_investor_id: investor_id,
              claimed_at: new Date().toISOString(),
              claim_status: 'claimed',
              updated_at: new Date().toISOString()
            })
          }
        );

        await fetch(`${supabaseUrl}/rest/v1/portfolio_approval_requests`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            portfolio_property_id: portfolioProperty?.id,
            property_address: `${legacyProperty.address}, ${legacyProperty.city}, ${legacyProperty.state}`,
            status: 'pending',
            notes: `Legacy property claim from ${legacyProperty.legacy_system || 'Master Spaces'}`,
            legacy_property_id: legacy_property_id
          })
        });

        await notifySuccessTeam(supabaseUrl, apiHeaders, 'legacy_property_claimed', {
          title: 'Legacy Property Claimed',
          message: `${investor?.full_name || investor?.email || 'An investor'} claimed a legacy property: ${legacyProperty.address}, ${legacyProperty.city}, ${legacyProperty.state}. Needs verification.`,
          priority: 'high',
          metadata: {
            investor_id,
            investor_name: investor?.full_name,
            investor_email: investor?.email,
            legacy_property_id,
            portfolio_property_id: portfolioProperty?.id,
            address: legacyProperty.address,
            city: legacyProperty.city,
            state: legacyProperty.state,
            legacy_system: legacyProperty.legacy_system
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Legacy property claimed successfully. Our team will verify and approve it shortly.',
          portfolio_property: portfolioProperty
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] claim_legacy_property error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET LINKED STAFF ====================
    if (action === 'get_linked_staff') {
      const { investor_id } = body;
      console.log('[v3.9] get_linked_staff for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=id,email,linked_staff_id`,
          { method: 'GET', headers: apiHeaders }
        );
        const investors = JSON.parse(await invRes.text());
        const investor = investors?.[0];

        if (!investor) {
          return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (investor.linked_staff_id) {
          return new Response(JSON.stringify({
            success: true,
            staff_id: investor.linked_staff_id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const staffRes = await fetch(
          `${supabaseUrl}/rest/v1/staff_users?linked_investor_id=eq.${investor_id}&is_active=eq.true&select=id,email,first_name,last_name,name,department,role`,
          { method: 'GET', headers: apiHeaders }
        );
        const staffMembers = JSON.parse(await staffRes.text());

        if (staffMembers && staffMembers.length > 0) {
          const staff = staffMembers[0];
          return new Response(JSON.stringify({
            success: true,
            staff_id: staff.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const staffByEmailRes = await fetch(
          `${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(investor.email.toLowerCase())}&is_active=eq.true&select=id,email,first_name,last_name,name,department,role`,
          { method: 'GET', headers: apiHeaders }
        );
        const staffByEmail = JSON.parse(await staffByEmailRes.text());

        if (staffByEmail && staffByEmail.length > 0) {
          const staff = staffByEmail[0];
          return new Response(JSON.stringify({
            success: true,
            staff_id: staff.id
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          staff_id: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] get_linked_staff error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== SWITCH TO STAFF ====================
    if (action === 'switch_to_staff') {
      const { investor_id } = body;
      console.log('[v3.9] switch_to_staff for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=id,email,linked_staff_id`,
          { method: 'GET', headers: apiHeaders }
        );
        const investors = JSON.parse(await invRes.text());
        const investor = investors?.[0];

        if (!investor) {
          return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let staff = null;

        if (investor.linked_staff_id) {
          const staffRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_users?id=eq.${investor.linked_staff_id}&is_active=eq.true&select=*`,
            { method: 'GET', headers: apiHeaders }
          );
          const staffMembers = JSON.parse(await staffRes.text());
          staff = staffMembers?.[0];
        }

        if (!staff) {
          const staffRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_users?linked_investor_id=eq.${investor_id}&is_active=eq.true&select=*`,
            { method: 'GET', headers: apiHeaders }
          );
          const staffMembers = JSON.parse(await staffRes.text());
          staff = staffMembers?.[0];
        }

        if (!staff) {
          const staffByEmailRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_users?email=eq.${encodeURIComponent(investor.email.toLowerCase())}&is_active=eq.true&select=*`,
            { method: 'GET', headers: apiHeaders }
          );
          const staffByEmail = JSON.parse(await staffByEmailRes.text());
          staff = staffByEmail?.[0];
        }

        if (!staff) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'No linked staff account found' 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let permissions = staff.permissions || [];
        if (!permissions.length && staff.department) {
          const deptRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_departments?name=eq.${encodeURIComponent(staff.department)}&select=permissions`,
            { method: 'GET', headers: apiHeaders }
          );
          const deptData = JSON.parse(await deptRes.text());
          permissions = deptData?.[0]?.permissions || [];
        }

        return new Response(JSON.stringify({
          success: true,
          staff: {
            id: staff.id,
            email: staff.email,
            name: staff.name || ((staff.first_name || '') + ' ' + (staff.last_name || '')).trim(),
            first_name: staff.first_name,
            last_name: staff.last_name,
            phone: staff.phone,
            team: staff.team,
            role: staff.role,
            department: staff.department,
            permissions: permissions,
            linked_investor_id: staff.linked_investor_id || investor_id,
            notification_preferences: staff.notification_preferences
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] switch_to_staff error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET AM INFO ====================
    if (action === 'get_am_info') {
      const { investor_id } = body;
      console.log('[v3.9] get_am_info for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get investor data
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=*`,
          { method: 'GET', headers: apiHeaders }
        );
        const investors = JSON.parse(await invRes.text());
        const investor = investors?.[0];

        if (!investor) {
          return new Response(JSON.stringify({ success: false, error: 'Investor not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let amInfo = null;
        let pendingRequest = null;

        // Check BOTH field names for AM assignment (assigned_acquisition_manager_id OR assigned_am_id)
        const amId = investor.assigned_acquisition_manager_id || investor.assigned_am_id;
        const amName = investor.assigned_am_name;
        const amAssignedAt = investor.am_assigned_at;

        console.log('[v3.9] AM lookup - assigned_acquisition_manager_id:', investor.assigned_acquisition_manager_id, 
                    'assigned_am_id:', investor.assigned_am_id, 'assigned_am_name:', amName);

        if (amId) {
          // Try staff_users table first (newer)
          let staffRes = await fetch(
            `${supabaseUrl}/rest/v1/staff_users?id=eq.${amId}&select=id,first_name,last_name,name,email,phone`,
            { method: 'GET', headers: apiHeaders }
          );
          let staff = JSON.parse(await staffRes.text())?.[0];
          
          // If not found, try staff table (legacy)
          if (!staff) {
            staffRes = await fetch(
              `${supabaseUrl}/rest/v1/staff?id=eq.${amId}&select=id,full_name,email,phone`,
              { method: 'GET', headers: apiHeaders }
            );
            staff = JSON.parse(await staffRes.text())?.[0];
          }
          
          if (staff) {
            amInfo = {
              id: staff.id,
              name: staff.full_name || staff.name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
              email: staff.email,
              phone: staff.phone,
              assigned_at: amAssignedAt
            };
          } else if (amName) {
            // Fallback to just the name if staff record not found
            amInfo = {
              id: amId,
              name: amName,
              email: null,
              phone: null,
              assigned_at: amAssignedAt
            };
          }
        }

        // Check for pending AM assignment request
        const reqRes = await fetch(
          `${supabaseUrl}/rest/v1/am_assignment_requests?investor_id=eq.${investor_id}&status=eq.pending&select=*&order=created_at.desc&limit=1`,
          { method: 'GET', headers: apiHeaders }
        );
        const requests = JSON.parse(await reqRes.text());
        if (requests?.[0]) {
          pendingRequest = requests[0];
        }

        // Check for pending AM change request
        const changeRes = await fetch(
          `${supabaseUrl}/rest/v1/am_change_requests?investor_id=eq.${investor_id}&status=eq.pending&select=*&order=created_at.desc&limit=1`,
          { method: 'GET', headers: apiHeaders }
        );
        const changeRequests = JSON.parse(await changeRes.text());

        console.log('[v3.9] get_am_info result - amInfo:', amInfo ? 'found' : 'null', 'pendingRequest:', pendingRequest ? 'found' : 'null');

        return new Response(JSON.stringify({
          success: true,
          am: amInfo,
          am_info: amInfo,
          pending_request: pendingRequest,
          pending_change_request: changeRequests?.[0] || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] get_am_info error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== SUBMIT AM ASSIGNMENT REQUEST ====================
    if (action === 'submit_am_assignment') {
      const { investor_id, investor_email, investor_name, investor_phone, preferred_markets, preferred_operation_types, investment_budget_min, investment_budget_max, investment_goals, notes, existing_am_name } = body;
      console.log('[v3.9] submit_am_assignment for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get investor info if not provided
        let email = investor_email;
        let name = investor_name;
        if (!email || !name) {
          const invRes = await fetch(
            `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=email,full_name`,
            { method: 'GET', headers: apiHeaders }
          );
          const inv = (await invRes.json())?.[0];
          email = email || inv?.email;
          name = name || inv?.full_name;
        }

        // Check for existing pending request
        const existingRes = await fetch(
          `${supabaseUrl}/rest/v1/am_assignment_requests?investor_id=eq.${investor_id}&status=eq.pending&request_type=eq.acquisition_manager&limit=1`,
          { method: 'GET', headers: apiHeaders }
        );
        const existingRequests = await existingRes.json();
        
        if (existingRequests && existingRequests.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'You already have a pending AM assignment request',
            existing_request: existingRequests[0]
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create the assignment request
        const reqRes = await fetch(`${supabaseUrl}/rest/v1/am_assignment_requests`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            investor_email: email,
            investor_name: name,
            investor_phone,
            request_type: 'acquisition_manager',
            preferred_markets: preferred_markets || [],
            preferred_operation_types: preferred_operation_types || [],
            investment_budget_min,
            investment_budget_max,
            investment_goals,
            notes,
            existing_am_name,
            status: 'pending',
            created_at: new Date().toISOString()
          })
        });

        if (!reqRes.ok) {
          throw new Error('Failed to create assignment request');
        }

        const request = await reqRes.json();

        // Notify success team
        await notifySuccessTeam(supabaseUrl, apiHeaders, 'am_assignment_request', {
          title: 'New AM Assignment Request',
          message: `${name || email} is requesting an Acquisition Manager. Markets: ${(preferred_markets || []).join(', ') || 'Any'}`,
          priority: 'high',
          metadata: {
            investor_id,
            investor_email: email,
            investor_name: name,
            preferred_markets,
            preferred_operation_types,
            investment_budget_min,
            investment_budget_max,
            investment_goals,
            existing_am_name
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'AM assignment request submitted successfully. Our team will match you within 24-48 hours.',
          request: request?.[0]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] submit_am_assignment error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== REQUEST AM CHANGE ====================
    if (action === 'request_am_change') {
      const { investor_id, investor_name, current_am_id, reason, preferred_am_name } = body;
      console.log('[v3.9] request_am_change for:', investor_id);

      if (!investor_id || !reason) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and reason are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get investor info
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=email,full_name,assigned_am_name,assigned_am_id,assigned_acquisition_manager_id`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        const currentAmId = current_am_id || investor?.assigned_acquisition_manager_id || investor?.assigned_am_id;
        const currentAmName = investor?.assigned_am_name;

        // Create the change request
        const reqRes = await fetch(`${supabaseUrl}/rest/v1/am_change_requests`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            investor_email: investor?.email,
            investor_name: investor_name || investor?.full_name,
            current_am_id: currentAmId,
            current_am_name: currentAmName,
            reason,
            preferred_am_name,
            status: 'pending',
            created_at: new Date().toISOString()
          })
        });

        if (!reqRes.ok) {
          throw new Error('Failed to create change request');
        }

        const request = await reqRes.json();

        // Notify success team
        await notifySuccessTeam(supabaseUrl, apiHeaders, 'am_change_request', {
          title: 'AM Change Request',
          message: `${investor?.full_name || investor?.email} is requesting a different Acquisition Manager. Current AM: ${currentAmName || 'Unknown'}. Reason: ${reason}`,
          priority: 'high',
          metadata: {
            investor_id,
            investor_email: investor?.email,
            investor_name: investor?.full_name,
            current_am_id: currentAmId,
            current_am_name: currentAmName,
            reason,
            preferred_am_name
          }
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'AM change request submitted successfully. Our team will review within 24-48 hours.',
          request: request?.[0]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] request_am_change error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== ADD PORTFOLIO PROPERTY ====================
    if (action === 'add_portfolio_property') {
      const { investor_id, property_data } = body;
      console.log('[v3.9] add_portfolio_property for:', investor_id);

      if (!investor_id || !property_data) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and property_data are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=full_name,email`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        const propRes = await fetch(`${supabaseUrl}/rest/v1/investor_portfolio`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            address: property_data.address,
            city: property_data.city,
            state: property_data.state,
            zip_code: property_data.zip_code,
            bedrooms: property_data.bedrooms,
            bathrooms: property_data.bathrooms,
            monthly_rent: property_data.monthly_rent,
            monthly_earnings: property_data.monthly_earnings,
            initial_investment: property_data.initial_investment,
            acquisition_fee: property_data.acquisition_fee,
            acquired_through_ayp: property_data.acquired_through_ayp,
            acquisition_manager: property_data.acquisition_manager,
            acquisition_date: property_data.acquisition_date,
            property_type: property_data.property_type,
            operation_type: property_data.operation_type,
            property_status: property_data.acquired_through_ayp ? 'pending_approval' : 'active',
            has_lease_documents: property_data.has_lease_documents || false,
            has_corporate_sublease: property_data.has_corporate_sublease || false,
            lease_type: property_data.lease_type,
            documents_complete: false,
            photo_urls: property_data.photo_urls || [],
            notes: property_data.notes,
            status: 'active'
          })
        });

        if (!propRes.ok) {
          const errText = await propRes.text();
          console.error('[v3.9] Failed to add property:', errText);
          throw new Error('Failed to add property to portfolio');
        }

        const property = (await propRes.json())?.[0];

        await notifySuccessTeam(supabaseUrl, apiHeaders, 'portfolio_property_added', {
          title: 'New Portfolio Property Added',
          message: `${investor?.full_name || investor?.email || 'An investor'} added ${property_data.address}, ${property_data.city}, ${property_data.state} to their portfolio.${property_data.acquired_through_ayp ? ' (Acquired through AYP - needs verification)' : ''}`,
          priority: property_data.acquired_through_ayp ? 'high' : 'normal',
          metadata: {
            investor_id,
            investor_name: investor?.full_name,
            investor_email: investor?.email,
            property_id: property?.id,
            address: property_data.address,
            city: property_data.city,
            state: property_data.state,
            monthly_rent: property_data.monthly_rent,
            monthly_earnings: property_data.monthly_earnings,
            acquired_through_ayp: property_data.acquired_through_ayp
          }
        });

        if (property_data.acquired_through_ayp) {
          await fetch(`${supabaseUrl}/rest/v1/portfolio_approval_requests`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              investor_id,
              portfolio_property_id: property?.id,
              property_address: `${property_data.address}, ${property_data.city}, ${property_data.state}`,
              acquisition_manager_claimed: property_data.acquisition_manager,
              status: 'pending',
              notes: property_data.notes
            })
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Property added to portfolio successfully',
          property
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] add_portfolio_property error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== UPDATE PORTFOLIO PROPERTY ====================
    if (action === 'update_portfolio_property') {
      const { investor_id, property_id, property_data } = body;
      console.log('[v3.9] update_portfolio_property:', property_id);

      if (!investor_id || !property_id || !property_data) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id, property_id, and property_data are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const propRes = await fetch(
          `${supabaseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}&investor_id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              address: property_data.address,
              city: property_data.city,
              state: property_data.state,
              zip_code: property_data.zip_code,
              bedrooms: property_data.bedrooms,
              bathrooms: property_data.bathrooms,
              monthly_rent: property_data.monthly_rent,
              monthly_earnings: property_data.monthly_earnings,
              initial_investment: property_data.initial_investment,
              acquisition_fee: property_data.acquisition_fee,
              acquired_through_ayp: property_data.acquired_through_ayp,
              acquisition_manager: property_data.acquisition_manager,
              acquisition_date: property_data.acquisition_date,
              property_type: property_data.property_type,
              operation_type: property_data.operation_type,
              has_lease_documents: property_data.has_lease_documents,
              has_corporate_sublease: property_data.has_corporate_sublease,
              lease_type: property_data.lease_type,
              photo_urls: property_data.photo_urls,
              notes: property_data.notes,
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!propRes.ok) {
          throw new Error('Failed to update property');
        }

        const property = (await propRes.json())?.[0];

        return new Response(JSON.stringify({
          success: true,
          message: 'Property updated successfully',
          property
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] update_portfolio_property error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET PORTFOLIO PROPERTIES ====================
    if (action === 'get_portfolio_properties') {
      const { investor_id } = body;
      console.log('[v3.9] get_portfolio_properties for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const propRes = await fetch(
          `${supabaseUrl}/rest/v1/investor_portfolio?investor_id=eq.${investor_id}&status=eq.active&order=created_at.desc`,
          { method: 'GET', headers: apiHeaders }
        );

        const properties = await propRes.json();

        return new Response(JSON.stringify({
          success: true,
          properties: properties || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] get_portfolio_properties error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== DELETE PORTFOLIO PROPERTY ====================
    if (action === 'delete_portfolio_property') {
      const { investor_id, property_id } = body;
      console.log('[v3.9] delete_portfolio_property:', property_id);

      if (!investor_id || !property_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and property_id are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const propRes = await fetch(
          `${supabaseUrl}/rest/v1/investor_portfolio?id=eq.${property_id}&investor_id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              status: 'deleted',
              updated_at: new Date().toISOString()
            })
          }
        );

        if (!propRes.ok) {
          throw new Error('Failed to delete property');
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Property removed from portfolio'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] delete_portfolio_property error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET INVESTOR CREDITS ====================
    if (action === 'get_investor_credits') {
      const { investor_id } = body;
      console.log('[v3.9] get_investor_credits for:', investor_id);

      if (!investor_id) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=credit_balance,total_credits_earned,total_credits_spent`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        const txRes = await fetch(
          `${supabaseUrl}/rest/v1/investor_credit_transactions?investor_id=eq.${investor_id}&order=created_at.desc&limit=50`,
          { method: 'GET', headers: apiHeaders }
        );
        const transactions = await txRes.json();

        return new Response(JSON.stringify({
          success: true,
          credit_balance: investor?.credit_balance || 0,
          total_earned: investor?.total_credits_earned || 0,
          total_spent: investor?.total_credits_spent || 0,
          transactions: transactions || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] get_investor_credits error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== USE CREDITS ====================
    if (action === 'use_credits') {
      const { investor_id, amount, description, reference_type, reference_id } = body;
      console.log('[v3.9] use_credits:', investor_id, amount);

      if (!investor_id || !amount || amount <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and positive amount are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=credit_balance,total_credits_spent`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        if (!investor) {
          throw new Error('Investor not found');
        }

        const currentBalance = investor.credit_balance || 0;
        if (currentBalance < amount) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Insufficient credits',
            current_balance: currentBalance,
            required: amount
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newBalance = currentBalance - amount;
        const newTotalSpent = (investor.total_credits_spent || 0) + amount;

        await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              credit_balance: newBalance,
              total_credits_spent: newTotalSpent,
              updated_at: new Date().toISOString()
            })
          }
        );

        await fetch(`${supabaseUrl}/rest/v1/investor_credit_transactions`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            transaction_type: 'debit',
            amount: -amount,
            description: description || 'Credit usage',
            reference_type,
            reference_id,
            balance_after: newBalance
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Credits used successfully',
          new_balance: newBalance,
          amount_used: amount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] use_credits error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== ADD CREDITS ====================
    if (action === 'add_credits') {
      const { investor_id, amount, description, reference_type, reference_id } = body;
      console.log('[v3.9] add_credits:', investor_id, amount);

      if (!investor_id || !amount || amount <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'investor_id and positive amount are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const invRes = await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}&select=credit_balance,total_credits_earned`,
          { method: 'GET', headers: apiHeaders }
        );
        const investor = (await invRes.json())?.[0];

        if (!investor) {
          throw new Error('Investor not found');
        }

        const newBalance = (investor.credit_balance || 0) + amount;
        const newTotalEarned = (investor.total_credits_earned || 0) + amount;

        await fetch(
          `${supabaseUrl}/rest/v1/investors?id=eq.${investor_id}`,
          {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              credit_balance: newBalance,
              total_credits_earned: newTotalEarned,
              updated_at: new Date().toISOString()
            })
          }
        );

        await fetch(`${supabaseUrl}/rest/v1/investor_credit_transactions`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            investor_id,
            transaction_type: 'credit',
            amount: amount,
            description: description || 'Credit added',
            reference_type,
            reference_id,
            balance_after: newBalance
          })
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Credits added successfully',
          new_balance: newBalance,
          amount_added: amount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (e: any) {
        console.error('[v3.9] add_credits error:', e.message);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== UNKNOWN ACTION ====================
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Unknown action: ${action}`,
      available_actions: [
        'set_acquisition_manager',
        'request_am_verification',
        'search_legacy_properties',
        'claim_legacy_property',
        'get_linked_staff',
        'switch_to_staff',
        'get_am_info',
        'submit_am_assignment',
        'request_am_change',
        'add_portfolio_property',
        'update_portfolio_property',
        'get_portfolio_properties',
        'delete_portfolio_property',
        'get_investor_credits',
        'use_credits',
        'add_credits'
      ]
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[v3.9] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

