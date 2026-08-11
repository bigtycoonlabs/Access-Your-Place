// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
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

// Send notification email
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
        from: 'Penny <penny@accessyourplace.com>', reply_to: ['success@accessyourplace.com'],
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
    const { action } = body;

    // INVESTOR ACTIONS

    // Request an Acquisition Manager
    if (action === 'request_am') {
      const { 
        investor_id, investor_name, investor_email,
        investment_goals, preferred_markets, notes, existing_am_name
      } = body;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check for existing pending request
      const existingRequests = await dbQuery('am_assignment_requests', 
        `investor_id=eq.${investor_id}&status=eq.pending&request_type=eq.acquisition_manager`
      );

      if (existingRequests.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'You already have a pending AM request',
          existing_request: existingRequests[0]
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create the request
      const request = await dbInsert('am_assignment_requests', {
        investor_id,
        investor_name,
        investor_email,
        request_type: 'acquisition_manager',
        investment_goals,
        preferred_markets,
        notes,
        existing_am_name,
        status: 'pending',
        created_at: new Date().toISOString()
      });

      // Notify success team (staff with role 'success_manager' or 'admin')
      const successTeam = await dbQuery('staff', `role=in.(success_manager,admin)&is_active=eq.true`);
      for (const staff of successTeam) {
        if (staff.email) {
          await sendNotificationEmail(
            staff.email,
            `New AM Request from ${investor_name}`,
            `<h2>New Acquisition Manager Request</h2>
            <p><strong>Investor:</strong> ${investor_name} (${investor_email})</p>
            <p><strong>Investment Goals:</strong> ${investment_goals || 'Not specified'}</p>
            <p><strong>Preferred Markets:</strong> ${preferred_markets || 'Not specified'}</p>
            ${existing_am_name ? `<p><strong>Previously working with:</strong> ${existing_am_name}</p>` : ''}
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p><a href="https://accessyourplace.com/staff/login">View in Dashboard</a></p>`
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        request: request[0],
        message: 'Your request has been submitted. Our Success Team will match you with an acquisition manager within 24-48 hours.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Request a Setup Manager
    if (action === 'request_sm') {
      const { 
        investor_id, investor_name, investor_email,
        setup_needs, property_count, preferred_timeline, notes
      } = body;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check for existing pending request
      const existingRequests = await dbQuery('am_assignment_requests', 
        `investor_id=eq.${investor_id}&status=eq.pending&request_type=eq.setup_manager`
      );

      if (existingRequests.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'You already have a pending SM request',
          existing_request: existingRequests[0]
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create the request
      const request = await dbInsert('am_assignment_requests', {
        investor_id,
        investor_name,
        investor_email,
        request_type: 'setup_manager',
        setup_needs,
        property_count,
        preferred_timeline,
        notes,
        status: 'pending',
        created_at: new Date().toISOString()
      });

      // Notify success team
      const successTeam = await dbQuery('staff', `role=in.(success_manager,admin,setup_manager)&is_active=eq.true`);
      for (const staff of successTeam) {
        if (staff.email) {
          await sendNotificationEmail(
            staff.email,
            `New SM Request from ${investor_name}`,
            `<h2>New Setup Manager Request</h2>
            <p><strong>Investor:</strong> ${investor_name} (${investor_email})</p>
            <p><strong>Setup Needs:</strong> ${setup_needs || 'Not specified'}</p>
            <p><strong>Property Count:</strong> ${property_count || 'Not specified'}</p>
            <p><strong>Timeline:</strong> ${preferred_timeline || 'Not specified'}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p><a href="https://accessyourplace.com/staff/login">View in Dashboard</a></p>`
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        request: request[0],
        message: 'Your request has been submitted. Our Success Team will match you with a setup manager within 24-48 hours.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // STAFF ACTIONS

    // Get all pending AM/SM requests
    if (action === 'get_pending_requests') {
      const { request_type, status = 'pending' } = body;
      
      let query = `status=eq.${status}&order=created_at.desc`;
      if (request_type) {
        query = `request_type=eq.${request_type}&${query}`;
      }

      const requests = await dbQuery('am_assignment_requests', query);

      return new Response(JSON.stringify({
        success: true,
        requests
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Assign AM to investor (from request)
    if (action === 'assign_am_from_request') {
      const { request_id, staff_id, staff_name, staff_email, staff_phone } = body;

      if (!request_id || !staff_id) {
        return new Response(JSON.stringify({ error: 'Request ID and Staff ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the request
      const requests = await dbQuery('am_assignment_requests', `id=eq.${request_id}`);
      if (requests.length === 0) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const request = requests[0];
      const now = new Date().toISOString();

      // Update the investor record
      await dbUpdate('investors', `id=eq.${request.investor_id}`, {
        assigned_am_id: staff_id,
        assigned_am_name: staff_name,
        am_assigned_at: now
      });

      // Update the request status
      await dbUpdate('am_assignment_requests', `id=eq.${request_id}`, {
        status: 'completed',
        assigned_staff_id: staff_id,
        assigned_staff_name: staff_name,
        completed_at: now
      });

      // Notify the investor
      await createNotification(
        request.investor_id,
        'Acquisition Manager Assigned!',
        `${staff_name} has been assigned as your acquisition manager. They will be reaching out to you shortly.`,
        'success'
      );

      // Send email to investor
      if (request.investor_email) {
        await sendNotificationEmail(
          request.investor_email,
          'Your Acquisition Manager Has Been Assigned',
          `<h2>Great news, ${request.investor_name}!</h2>
          <p>We've matched you with an acquisition manager who will help you find and secure your next investment property.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Acquisition Manager</h3>
            <p><strong>Name:</strong> ${staff_name}</p>
            ${staff_email ? `<p><strong>Email:</strong> ${staff_email}</p>` : ''}
            ${staff_phone ? `<p><strong>Phone:</strong> ${staff_phone}</p>` : ''}
          </div>
          <p>${staff_name} will be reaching out to you within the next 24 hours to discuss your investment goals and get started.</p>
          <p><a href="https://accessyourplace.com/investor/login">Log in to your dashboard</a></p>`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'AM assigned successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Assign SM to investor (from request)
    if (action === 'assign_sm_from_request') {
      const { request_id, staff_id, staff_name, staff_email, staff_phone } = body;

      if (!request_id || !staff_id) {
        return new Response(JSON.stringify({ error: 'Request ID and Staff ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the request
      const requests = await dbQuery('am_assignment_requests', `id=eq.${request_id}`);
      if (requests.length === 0) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const request = requests[0];
      const now = new Date().toISOString();

      // Update the investor record
      await dbUpdate('investors', `id=eq.${request.investor_id}`, {
        assigned_setup_manager_id: staff_id,
        assigned_setup_manager_name: staff_name,
        setup_manager_assigned_at: now
      });

      // Update the request status
      await dbUpdate('am_assignment_requests', `id=eq.${request_id}`, {
        status: 'completed',
        assigned_staff_id: staff_id,
        assigned_staff_name: staff_name,
        completed_at: now
      });

      // Notify the investor
      await createNotification(
        request.investor_id,
        'Setup Manager Assigned!',
        `${staff_name} has been assigned as your setup manager. They will be reaching out to you shortly.`,
        'success'
      );

      // Send email to investor
      if (request.investor_email) {
        await sendNotificationEmail(
          request.investor_email,
          'Your Setup Manager Has Been Assigned',
          `<h2>Great news, ${request.investor_name}!</h2>
          <p>We've matched you with a setup manager who will help you get your properties ready for guests.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your Setup Manager</h3>
            <p><strong>Name:</strong> ${staff_name}</p>
            ${staff_email ? `<p><strong>Email:</strong> ${staff_email}</p>` : ''}
            ${staff_phone ? `<p><strong>Phone:</strong> ${staff_phone}</p>` : ''}
          </div>
          <p>${staff_name} will be reaching out to you within the next 24 hours to discuss your setup needs.</p>
          <p><a href="https://accessyourplace.com/investor/login">Log in to your dashboard</a></p>`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'SM assigned successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Direct AM assignment (not from request)
    if (action === 'assign_am') {
      const { investor_id, staff_id, staff_name, staff_email, staff_phone, assigned_by } = body;

      if (!investor_id || !staff_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and Staff ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      // Get investor info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      if (investors.length === 0) {
        return new Response(JSON.stringify({ error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investors[0];

      // Update the investor record
      await dbUpdate('investors', `id=eq.${investor_id}`, {
        assigned_am_id: staff_id,
        assigned_am_name: staff_name,
        am_assigned_at: now
      });

      // Notify the investor
      await createNotification(
        investor_id,
        'Acquisition Manager Assigned!',
        `${staff_name} has been assigned as your acquisition manager.`,
        'success'
      );

      // Send email
      if (investor.email) {
        await sendNotificationEmail(
          investor.email,
          'Your Acquisition Manager Has Been Assigned',
          `<h2>Hello ${investor.full_name}!</h2>
          <p>${staff_name} has been assigned as your acquisition manager.</p>
          ${staff_email ? `<p><strong>Email:</strong> ${staff_email}</p>` : ''}
          ${staff_phone ? `<p><strong>Phone:</strong> ${staff_phone}</p>` : ''}
          <p><a href="https://accessyourplace.com/investor/login">Log in to your dashboard</a></p>`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Direct SM assignment
    if (action === 'assign_sm') {
      const { investor_id, staff_id, staff_name, staff_email, staff_phone } = body;

      if (!investor_id || !staff_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and Staff ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      // Get investor info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      if (investors.length === 0) {
        return new Response(JSON.stringify({ error: 'Investor not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investors[0];

      // Update the investor record
      await dbUpdate('investors', `id=eq.${investor_id}`, {
        assigned_setup_manager_id: staff_id,
        assigned_setup_manager_name: staff_name,
        setup_manager_assigned_at: now
      });

      // Notify the investor
      await createNotification(
        investor_id,
        'Setup Manager Assigned!',
        `${staff_name} has been assigned as your setup manager.`,
        'success'
      );

      // Send email
      if (investor.email) {
        await sendNotificationEmail(
          investor.email,
          'Your Setup Manager Has Been Assigned',
          `<h2>Hello ${investor.full_name}!</h2>
          <p>${staff_name} has been assigned as your setup manager.</p>
          ${staff_email ? `<p><strong>Email:</strong> ${staff_email}</p>` : ''}
          ${staff_phone ? `<p><strong>Phone:</strong> ${staff_phone}</p>` : ''}
          <p><a href="https://accessyourplace.com/investor/login">Log in to your dashboard</a></p>`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get investors without AM
    if (action === 'get_investors_without_am') {
      const investors = await dbQuery('investors', 
        `assigned_am_id=is.null&order=created_at.desc&select=id,full_name,email,phone,created_at,investment_goals,preferred_markets`
      );

      return new Response(JSON.stringify({
        success: true,
        investors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get investors without SM
    if (action === 'get_investors_without_sm') {
      const investors = await dbQuery('investors', 
        `assigned_setup_manager_id=is.null&order=created_at.desc&select=id,full_name,email,phone,created_at`
      );

      return new Response(JSON.stringify({
        success: true,
        investors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('AM Assignment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
