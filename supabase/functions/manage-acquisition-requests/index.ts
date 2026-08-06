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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const headers = {
  'Content-Type': 'application/json',
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`
};

async function dbQuery(table: string, params: string = '') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers });
  return res.json();
}

async function dbInsert(table: string, data: any) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function dbUpdate(table: string, filter: string, data: any) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Helper to trigger email notifications
async function sendAcquisitionEmail(action: string, data: any) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-acquisition-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ action, ...data })
    });
    const result = await res.json();
    console.log(`Email notification (${action}):`, result);
    return result;
  } catch (error) {
    console.error(`Failed to send email (${action}):`, error);
    return { success: false, error: error.message };
  }
}

// Send notification email via Resend
async function sendNotificationEmail(to: string, subject: string, html: string) {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return { success: false, error: 'No API key' };

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
    return await res.json();
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
}

// Create in-app notification
async function createNotification(investorId: string, title: string, message: string, type: string = 'info') {
  try {
    await dbInsert('investor_notifications', {
      investor_id: investorId,
      title,
      message,
      notification_type: type,
      is_read: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Notification error:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, investor_id, request_id } = body;

    // INVESTOR ACTIONS

    // Get investor's reservations
    if (action === 'get_investor_reservations') {
      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const reservations = await dbQuery('deal_reservations', 
        `investor_id=eq.${investor_id}&order=created_at.desc`
      );

      return new Response(JSON.stringify({
        success: true,
        reservations: reservations || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Reserve deal when investor doesn't have AM
    if (action === 'reserve_deal_no_am') {
      const { 
        investor_name, investor_email, property_id, 
        property_title, property_city, property_state 
      } = body;

      if (!investor_id || !property_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and Property ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create reservation
      const reservation = await dbInsert('deal_reservations', {
        investor_id,
        investor_name,
        investor_email,
        property_id,
        property_title,
        property_city,
        property_state,
        status: 'reserved',
        am_permission_granted: false,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
        created_at: new Date().toISOString()
      });

      // Notify success team
      const successTeam = await dbQuery('staff', `department=in.(success_managers,acquisition_managers)&is_active=eq.true`);
      for (const staff of successTeam) {
        if (staff.email) {
          await sendNotificationEmail(
            staff.email,
            `URGENT: Deal Reserved - ${property_title}`,
            `<h2>Deal Reserved by Investor Without AM</h2>
            <p><strong>Investor:</strong> ${investor_name} (${investor_email})</p>
            <p><strong>Property:</strong> ${property_title}</p>
            <p><strong>Location:</strong> ${property_city}, ${property_state}</p>
            <p style="color: red;"><strong>Action Required:</strong> Contact investor within 2 hours to assign AM and complete purchase.</p>
            <p><a href="https://accessyourplace.com/staff/login">View in Dashboard</a></p>`
          );
        }
      }

      // Create notification for investor
      await createNotification(
        investor_id,
        'Deal Reserved!',
        `Your deal in ${property_city}, ${property_state} has been reserved. Our team will contact you within a couple of hours.`,
        'success'
      );

      return new Response(JSON.stringify({
        success: true,
        reservation: reservation[0],
        message: 'Deal reserved. Our team will contact you within a couple of hours.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Submit new acquisition request (from Penny AI search)
    if (action === 'submit_request') {
      const { 
        property_type, furnishing_status, city, state, zip_code,
        bedrooms, bathrooms, projected_monthly_revenue, projected_adr,
        projected_occupancy_rate, listed_price, photos, source_url, source_listing_id
      } = body;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check investor's weekly search limit
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      if (investors.length === 0) {
        return new Response(JSON.stringify({ error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investors[0];
      const now = new Date();
      const weekStart = investor.penny_search_week_start ? new Date(investor.penny_search_week_start) : null;
      let searchesThisWeek = investor.penny_searches_this_week || 0;

      // Reset if new week
      if (!weekStart || (now.getTime() - weekStart.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        searchesThisWeek = 0;
        await dbUpdate('investors', `id=eq.${investor_id}`, {
          penny_searches_this_week: 0,
          penny_search_week_start: now.toISOString()
        });
      }

      // Check limit (10 per week)
      if (searchesThisWeek >= 10) {
        return new Response(JSON.stringify({ 
          error: 'Weekly search limit reached',
          message: 'You have reached your limit of 10 property searches this week. Your limit resets weekly.',
          searches_remaining: 0
        }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create acquisition request
      const request = await dbInsert('acquisition_requests', {
        investor_id,
        property_type: property_type || 'str',
        furnishing_status: furnishing_status || 'unfurnished',
        city,
        state,
        zip_code,
        bedrooms,
        bathrooms,
        projected_monthly_revenue,
        projected_adr,
        projected_occupancy_rate,
        listed_price,
        photos: photos || [],
        source_url,
        source_listing_id,
        status: 'pending',
        first_refusal_investor_id: investor_id,
        created_at: now.toISOString()
      });

      // Increment search count
      await dbUpdate('investors', `id=eq.${investor_id}`, {
        penny_searches_this_week: searchesThisWeek + 1
      });

      return new Response(JSON.stringify({
        success: true,
        request: request[0],
        searches_remaining: 10 - (searchesThisWeek + 1),
        message: 'Your acquisition request has been submitted. Our team will research this property and contact you within 24-48 hours.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get investor's acquisition requests
    if (action === 'get_my_requests') {
      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const requests = await dbQuery('acquisition_requests', 
        `investor_id=eq.${investor_id}&order=created_at.desc`
      );

      // Get search limit info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      const investor = investors[0];
      const now = new Date();
      const weekStart = investor?.penny_search_week_start ? new Date(investor.penny_search_week_start) : null;
      let searchesThisWeek = investor?.penny_searches_this_week || 0;

      if (!weekStart || (now.getTime() - weekStart.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        searchesThisWeek = 0;
      }

      return new Response(JSON.stringify({
        success: true,
        requests,
        searches_remaining: Math.max(0, 10 - searchesThisWeek),
        searches_used: searchesThisWeek
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Accept first right of refusal
    if (action === 'accept_first_refusal') {
      if (!investor_id || !request_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and request ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const requests = await dbQuery('acquisition_requests', 
        `id=eq.${request_id}&first_refusal_investor_id=eq.${investor_id}&is_approved=eq.true`
      );

      if (requests.length === 0) {
        return new Response(JSON.stringify({ error: 'Request not found or not eligible' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const request = requests[0];
      
      // Check if still within 24-hour window
      if (request.first_refusal_expires_at && new Date(request.first_refusal_expires_at) < new Date()) {
        return new Response(JSON.stringify({ 
          error: 'First right of refusal has expired',
          message: 'The 24-hour window has passed. This deal may now be available to other investors.'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, {
        first_refusal_accepted: true,
        status: 'accepted',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'You have accepted this deal. Our team will contact you to proceed with the acquisition.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decline first right of refusal
    if (action === 'decline_first_refusal') {
      if (!investor_id || !request_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and request ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('acquisition_requests', `id=eq.${request_id}&first_refusal_investor_id=eq.${investor_id}`, {
        first_refusal_accepted: false,
        status: 'available',
        updated_at: new Date().toISOString()
      });

      // Send email to notify other investors about the newly available deal
      await sendAcquisitionEmail('deal_publicly_available', { request_id });

      return new Response(JSON.stringify({
        success: true,
        message: 'You have declined this deal. It will now be available to other investors.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STAFF/ADMIN ACTIONS

    // Get all pending acquisition requests (for admin dashboard)
    if (action === 'get_all_requests' || action === 'get_requests') {
      const { status: filterStatus, limit = 50, assigned_manager_id } = body;
      
      let query = `order=created_at.desc&limit=${limit}`;
      if (filterStatus) {
        query = `status=eq.${filterStatus}&${query}`;
      }

      const requests = await dbQuery('acquisition_requests', query);

      // Get investor details for each request
      const enrichedRequests = await Promise.all(requests.map(async (req: any) => {
        const investors = await dbQuery('investors', `id=eq.${req.investor_id}&select=full_name,email,phone`);
        return {
          ...req,
          investor: investors[0] || null,
          investor_name: investors[0]?.full_name,
          investor_email: investors[0]?.email
        };
      }));

      // Get counts by status
      const allRequests = await dbQuery('acquisition_requests', 'select=id,status');
      const counts = {
        pending: allRequests.filter((r: any) => r.status === 'pending').length,
        assigned: allRequests.filter((r: any) => r.status === 'assigned').length,
        researching: allRequests.filter((r: any) => r.status === 'researching').length,
        approved: allRequests.filter((r: any) => r.status === 'approved').length,
        declined: allRequests.filter((r: any) => r.status === 'declined').length,
        available: allRequests.filter((r: any) => r.status === 'available').length,
        total: allRequests.length
      };

      return new Response(JSON.stringify({
        success: true,
        requests: enrichedRequests,
        counts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get deal reservations (for staff)
    if (action === 'get_deal_reservations') {
      const { status: filterStatus, assigned_manager_id } = body;
      
      let query = `order=created_at.desc`;
      if (filterStatus) {
        query = `status=eq.${filterStatus}&${query}`;
      }

      const reservations = await dbQuery('deal_reservations', query);

      // Enrich with investor phone if available
      const enrichedReservations = await Promise.all(reservations.map(async (res: any) => {
        const investors = await dbQuery('investors', `id=eq.${res.investor_id}&select=phone,assigned_acquisition_manager_id,assigned_acquisition_manager_name`);
        const investor = investors[0];
        return {
          ...res,
          investor_phone: investor?.phone,
          assigned_am_id: investor?.assigned_acquisition_manager_id,
          assigned_am_name: investor?.assigned_acquisition_manager_name
        };
      }));

      return new Response(JSON.stringify({
        success: true,
        reservations: enrichedReservations
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update reservation AM
    if (action === 'update_reservation_am') {
      const { reservation_id, am_id, am_name } = body;

      if (!reservation_id) {
        return new Response(JSON.stringify({ error: 'Reservation ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('deal_reservations', `id=eq.${reservation_id}`, {
        assigned_am_id: am_id,
        assigned_am_name: am_name,
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Grant AM permission for reserved deal
    if (action === 'grant_am_permission') {
      const { reservation_id, staff_id, staff_name, notes } = body;

      if (!reservation_id) {
        return new Response(JSON.stringify({ error: 'Reservation ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      await dbUpdate('deal_reservations', `id=eq.${reservation_id}`, {
        am_permission_granted: true,
        am_permission_granted_by: staff_id,
        am_permission_granted_by_name: staff_name,
        am_permission_granted_at: now,
        am_permission_notes: notes,
        status: 'pending_payment',
        updated_at: now
      });

      // Get reservation details
      const reservations = await dbQuery('deal_reservations', `id=eq.${reservation_id}`);
      if (reservations.length > 0) {
        const reservation = reservations[0];
        
        // Notify investor
        await createNotification(
          reservation.investor_id,
          'Ready to Complete Purchase!',
          `Your acquisition manager has approved your deal for ${reservation.property_title}. You can now proceed with payment.`,
          'success'
        );

        // Send email
        if (reservation.investor_email) {
          await sendNotificationEmail(
            reservation.investor_email,
            'Your Deal is Ready for Purchase',
            `<h2>Great news, ${reservation.investor_name}!</h2>
            <p>Your acquisition manager has reviewed and approved your deal for <strong>${reservation.property_title}</strong>.</p>
            <p>You can now proceed with payment to complete your acquisition.</p>
            <p><a href="https://accessyourplace.com/investor/login" style="background-color: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 16px;">Complete Your Purchase</a></p>`
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Permission granted. Investor has been notified.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Assign acquisition manager to request
    if (action === 'assign_manager') {
      const { manager_name } = body;
      
      if (!request_id || !manager_name) {
        return new Response(JSON.stringify({ error: 'Request ID and manager name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, {
        assigned_manager_name: manager_name,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update request status (researching, etc.)
    if (action === 'update_status') {
      const { status: newStatus, manager_notes } = body;
      
      if (!request_id || !newStatus) {
        return new Response(JSON.stringify({ error: 'Request ID and status required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (manager_notes) {
        updateData.manager_notes = manager_notes;
      }

      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, updateData);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Approve request (creates 24-hour first right of refusal)
    if (action === 'approve_request') {
      const { negotiated_price, negotiated_terms, manager_notes, approved_by } = body;
      
      if (!request_id) {
        return new Response(JSON.stringify({ error: 'Request ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the request to find the investor
      const requests = await dbQuery('acquisition_requests', `id=eq.${request_id}`);
      if (requests.length === 0) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const request = requests[0];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, {
        is_approved: true,
        approved_at: now.toISOString(),
        approved_by: approved_by || 'Staff',
        status: 'approved',
        negotiated_price,
        negotiated_terms,
        manager_notes,
        first_refusal_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString()
      });

      // Send email notification to the investor about first right of refusal
      await sendAcquisitionEmail('first_refusal_approved', {
        investor_id: request.first_refusal_investor_id || request.investor_id,
        request_id
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Request approved. Investor has been notified and has 24 hours first right of refusal.',
        first_refusal_expires_at: expiresAt.toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decline request
    if (action === 'decline_request') {
      const { decline_reason } = body;
      
      if (!request_id) {
        return new Response(JSON.stringify({ error: 'Request ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, {
        is_approved: false,
        status: 'declined',
        decline_reason: decline_reason || 'Property does not meet our criteria for a viable arbitrage opportunity.',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Convert approved request to property listing
    if (action === 'convert_to_property') {
      if (!request_id) {
        return new Response(JSON.stringify({ error: 'Request ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const requests = await dbQuery('acquisition_requests', `id=eq.${request_id}`);
      if (requests.length === 0) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const request = requests[0];
      const { address, listing_title, acquisition_fee } = body;

      // Create property from request
      const property = await dbInsert('properties', {
        listing_title: listing_title || `${request.bedrooms}BR ${request.property_type?.toUpperCase()} Opportunity`,
        address,
        city: request.city,
        state: request.state,
        zip_code: request.zip_code,
        bedrooms: request.bedrooms,
        bathrooms: request.bathrooms,
        monthly_rent: request.negotiated_price || request.listed_price,
        acquisition_fee: acquisition_fee || 499,
        operation_type: request.property_type,
        photos: request.photos,
        status: 'published',
        is_verified: true,
        source: 'penny_ai',
        ayp_approved: true,
        sourced_by_investor_id: request.first_refusal_investor_id,
        created_at: new Date().toISOString()
      });

      // Update request with converted property ID
      await dbUpdate('acquisition_requests', `id=eq.${request_id}`, {
        converted_property_id: property[0]?.id,
        status: 'converted',
        updated_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success: true,
        property: property[0]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check and expire first right of refusals (can be called by cron)
    if (action === 'check_expirations') {
      const now = new Date().toISOString();
      
      // Find approved requests where first refusal has expired and wasn't accepted
      const expired = await dbQuery('acquisition_requests', 
        `is_approved=eq.true&first_refusal_expires_at=lt.${now}&first_refusal_accepted=is.null&status=eq.approved`
      );

      // Update them to available status and send notifications
      for (const req of expired) {
        await dbUpdate('acquisition_requests', `id=eq.${req.id}`, {
          status: 'available',
          updated_at: now
        });

        // Send email notifications about deal becoming publicly available
        await sendAcquisitionEmail('deal_publicly_available', { request_id: req.id });
      }

      return new Response(JSON.stringify({
        success: true,
        expired_count: expired.length,
        message: `${expired.length} deals are now publicly available`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Acquisition request error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
