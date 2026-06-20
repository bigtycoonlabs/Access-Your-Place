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

// Send email notification via Resend
async function sendEmailNotification(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Access Your Place <notifications@accessyourplace.com>',
        to: [to],
        subject,
        html
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email send failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email error:', err);
    return false;
  }
}

// Send SMS notification via Twilio
async function sendSMSNotification(to: string, message: string) {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('Twilio credentials not configured');
    return false;
  }

  // Format phone number
  let formattedPhone = to.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '1' + formattedPhone;
  }
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: TWILIO_PHONE_NUMBER,
          Body: message
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('SMS send failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('SMS error:', err);
    return false;
  }
}

// Get investor details for notifications
async function getInvestorDetails(investorId: string, supabaseUrl: string, headers: any) {
  const res = await fetch(`${supabaseUrl}/rest/v1/investors?id=eq.${investorId}&select=full_name,email,phone`, { headers });
  const investors = await res.json();
  return investors?.[0] || null;
}

// Send dispute notifications
async function sendDisputeNotification(
  type: 'created' | 'status_change' | 'staff_response',
  dispute: any,
  investor: any,
  additionalInfo?: any
) {
  if (!investor?.email) return;

  const portalUrl = 'https://accessyourplace.com/investor/portal';
  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    awaiting_response: 'Awaiting Your Response',
    resolved: 'Resolved',
    closed: 'Closed'
  };

  let emailSubject = '';
  let emailBody = '';
  let smsMessage = '';

  if (type === 'created') {
    emailSubject = `Dispute Received: ${dispute.subject}`;
    emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Access Your Place</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #1a365d;">Dispute Received</h2>
          <p>Hi ${investor.full_name},</p>
          <p>We've received your dispute and our team will review it shortly.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Subject:</strong> ${dispute.subject}</p>
            <p><strong>Category:</strong> ${dispute.category}</p>
            <p><strong>Status:</strong> ${statusLabels[dispute.status] || dispute.status}</p>
            <p><strong>Reference ID:</strong> #${dispute.id?.slice(0, 8).toUpperCase()}</p>
          </div>
          <p>You can track the status of your dispute in your investor portal.</p>
          <a href="${portalUrl}" style="display: inline-block; background: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Dispute</a>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">Our team typically responds within 24-48 business hours.</p>
        </div>
        <div style="background: #1a365d; padding: 15px; text-align: center;">
          <p style="color: #d4a574; margin: 0; font-size: 12px;">Â© 2026 Access Your Place. All rights reserved.</p>
        </div>
      </div>
    `;
    smsMessage = `Access Your Place: Your dispute "${dispute.subject}" has been received. Reference: #${dispute.id?.slice(0, 8).toUpperCase()}. We'll review it within 24-48 hours.`;
  } else if (type === 'status_change') {
    const newStatus = additionalInfo?.newStatus || dispute.status;
    emailSubject = `Dispute Update: Status Changed to ${statusLabels[newStatus] || newStatus}`;
    emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Access Your Place</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #1a365d;">Dispute Status Update</h2>
          <p>Hi ${investor.full_name},</p>
          <p>The status of your dispute has been updated.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Subject:</strong> ${dispute.subject}</p>
            <p><strong>New Status:</strong> <span style="background: #d4a574; color: white; padding: 4px 12px; border-radius: 4px;">${statusLabels[newStatus] || newStatus}</span></p>
            <p><strong>Reference ID:</strong> #${dispute.id?.slice(0, 8).toUpperCase()}</p>
            ${additionalInfo?.resolution_notes ? `<p><strong>Resolution Notes:</strong> ${additionalInfo.resolution_notes}</p>` : ''}
          </div>
          ${newStatus === 'awaiting_response' ? '<p style="color: #e53e3e;"><strong>Action Required:</strong> Please respond to continue the resolution process.</p>' : ''}
          <a href="${portalUrl}" style="display: inline-block; background: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Dispute</a>
        </div>
        <div style="background: #1a365d; padding: 15px; text-align: center;">
          <p style="color: #d4a574; margin: 0; font-size: 12px;">Â© 2026 Access Your Place. All rights reserved.</p>
        </div>
      </div>
    `;
    smsMessage = `Access Your Place: Your dispute #${dispute.id?.slice(0, 8).toUpperCase()} status changed to "${statusLabels[newStatus] || newStatus}". ${newStatus === 'awaiting_response' ? 'Your response is needed.' : ''} Check your portal for details.`;
  } else if (type === 'staff_response') {
    emailSubject = `New Response on Your Dispute: ${dispute.subject}`;
    emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Access Your Place</h1>
        </div>
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #1a365d;">New Response on Your Dispute</h2>
          <p>Hi ${investor.full_name},</p>
          <p>Our team has responded to your dispute.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Subject:</strong> ${dispute.subject}</p>
            <p><strong>Reference ID:</strong> #${dispute.id?.slice(0, 8).toUpperCase()}</p>
            ${additionalInfo?.message ? `<div style="background: #f0f0f0; padding: 15px; border-radius: 6px; margin-top: 10px;"><p style="margin: 0;">"${additionalInfo.message.substring(0, 200)}${additionalInfo.message.length > 200 ? '...' : ''}"</p></div>` : ''}
          </div>
          <p>Please log in to your portal to view the full response and reply if needed.</p>
          <a href="${portalUrl}" style="display: inline-block; background: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View & Respond</a>
        </div>
        <div style="background: #1a365d; padding: 15px; text-align: center;">
          <p style="color: #d4a574; margin: 0; font-size: 12px;">Â© 2026 Access Your Place. All rights reserved.</p>
        </div>
      </div>
    `;
    smsMessage = `Access Your Place: New response on dispute #${dispute.id?.slice(0, 8).toUpperCase()}. Log in to your portal to view and respond.`;
  }

  // Send email
  await sendEmailNotification(investor.email, emailSubject, emailBody);

  // Send SMS if phone available
  if (investor.phone) {
    await sendSMSNotification(investor.phone, smsMessage);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: 'Config error' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = await req.json();
    const { action } = body;
    const headers = { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${SUPABASE_KEY}`, 
      'Content-Type': 'application/json', 
      'Prefer': 'return=representation' 
    };

    // Create a new dispute
    if (action === 'create') {
      const { investor_id, category, subcategory, subject, description, priority } = body;
      
      if (!investor_id || !category || !subject || !description) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id,
          category,
          subcategory,
          subject,
          description,
          priority: priority || 'normal',
          status: 'submitted',
          created_at: new Date().toISOString()
        })
      });

      const dispute = await res.json();
      
      if (dispute.error) {
        return new Response(JSON.stringify({ error: dispute.error }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Send notification for new dispute
      const investor = await getInvestorDetails(investor_id, SUPABASE_URL, headers);
      if (investor && dispute[0]) {
        await sendDisputeNotification('created', dispute[0], investor);
      }

      return new Response(JSON.stringify({ success: true, dispute: dispute[0] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get disputes for investor
    if (action === 'get_investor_disputes') {
      const { investor_id, status } = body;
      
      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      let query = `investor_id=eq.${investor_id}&order=created_at.desc`;
      if (status && status !== 'all') {
        query += `&status=eq.${status}`;
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?${query}`, { headers });
      const disputes = await res.json();

      return new Response(JSON.stringify({ disputes }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get all disputes (for staff)
    if (action === 'get_all_disputes') {
      const { status, category, assigned_staff_id, page = 1, limit = 20 } = body;
      
      let query = `select=*,investors(full_name,email,phone),staff_users(first_name,last_name)&order=created_at.desc`;
      
      if (status && status !== 'all') {
        query += `&status=eq.${status}`;
      }
      if (category && category !== 'all') {
        query += `&category=eq.${category}`;
      }
      if (assigned_staff_id) {
        query += `&assigned_staff_id=eq.${assigned_staff_id}`;
      }

      const offset = (page - 1) * limit;
      query += `&offset=${offset}&limit=${limit}`;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?${query}`, { headers });
      const disputes = await res.json();

      // Get total count
      const countRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?select=count`, { 
        headers: { ...headers, 'Prefer': 'count=exact' }
      });
      const countHeader = countRes.headers.get('content-range');
      const total = countHeader ? parseInt(countHeader.split('/')[1]) : disputes.length;

      return new Response(JSON.stringify({ disputes, total, page, limit }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get dispute details with messages
    if (action === 'get_dispute_details') {
      const { dispute_id, include_internal } = body;
      
      if (!dispute_id) {
        return new Response(JSON.stringify({ error: 'Dispute ID required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get dispute
      const disputeRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?id=eq.${dispute_id}&select=*,investors(full_name,email,phone)`, { headers });
      const disputes = await disputeRes.json();
      
      if (!disputes?.length) {
        return new Response(JSON.stringify({ error: 'Dispute not found' }), { 
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get messages
      let messagesQuery = `dispute_id=eq.${dispute_id}&order=created_at.asc`;
      if (!include_internal) {
        messagesQuery += `&is_internal=eq.false`;
      }

      const messagesRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_dispute_messages?${messagesQuery}`, { headers });
      const messages = await messagesRes.json();

      return new Response(JSON.stringify({ dispute: disputes[0], messages }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Add message to dispute
    if (action === 'add_message') {
      const { dispute_id, sender_type, sender_id, sender_name, message, is_internal } = body;
      
      if (!dispute_id || !sender_type || !sender_id || !message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_dispute_messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dispute_id,
          sender_type,
          sender_id,
          sender_name,
          message,
          is_internal: is_internal || false,
          created_at: new Date().toISOString()
        })
      });

      const newMessage = await res.json();

      // Update dispute updated_at
      await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?id=eq.${dispute_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      });

      // Send notification if staff response (not internal)
      if (sender_type === 'staff' && !is_internal) {
        // Get dispute details for notification
        const disputeRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?id=eq.${dispute_id}&select=*`, { headers });
        const disputes = await disputeRes.json();
        
        if (disputes?.[0]) {
          const investor = await getInvestorDetails(disputes[0].investor_id, SUPABASE_URL, headers);
          if (investor) {
            await sendDisputeNotification('staff_response', disputes[0], investor, { message });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, message: newMessage[0] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update dispute status
    if (action === 'update_status') {
      const { dispute_id, status, resolution_notes, assigned_staff_id } = body;
      
      if (!dispute_id || !status) {
        return new Response(JSON.stringify({ error: 'Dispute ID and status required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get current dispute for comparison
      const currentRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?id=eq.${dispute_id}&select=*`, { headers });
      const currentDisputes = await currentRes.json();
      const currentDispute = currentDisputes?.[0];

      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      
      if (resolution_notes) updateData.resolution_notes = resolution_notes;
      if (assigned_staff_id !== undefined) updateData.assigned_staff_id = assigned_staff_id;
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?id=eq.${dispute_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      });

      const updated = await res.json();

      // Send notification if status changed
      if (currentDispute && currentDispute.status !== status) {
        const investor = await getInvestorDetails(currentDispute.investor_id, SUPABASE_URL, headers);
        if (investor) {
          await sendDisputeNotification('status_change', { ...currentDispute, ...updateData }, investor, { 
            newStatus: status, 
            resolution_notes 
          });
        }
      }

      return new Response(JSON.stringify({ success: true, dispute: updated[0] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Get dispute statistics
    if (action === 'get_stats') {
      const { start_date, end_date } = body;
      
      let dateFilter = '';
      if (start_date) {
        dateFilter = `&created_at=gte.${start_date}`;
      }
      if (end_date) {
        dateFilter += `&created_at=lte.${end_date}`;
      }

      // Get counts by status
      const statusRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?select=status${dateFilter}`, { headers });
      const allDisputes = await statusRes.json();

      const stats = {
        total: allDisputes.length,
        by_status: {} as Record<string, number>,
        by_category: {} as Record<string, number>
      };

      allDisputes.forEach((d: any) => {
        stats.by_status[d.status] = (stats.by_status[d.status] || 0) + 1;
      });

      // Get counts by category
      const categoryRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?select=category${dateFilter}`, { headers });
      const categoryData = await categoryRes.json();

      categoryData.forEach((d: any) => {
        stats.by_category[d.category] = (stats.by_category[d.category] || 0) + 1;
      });

      // Calculate average resolution time for resolved disputes
      const resolvedRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_disputes?select=created_at,resolved_at&status=in.(resolved,closed)${dateFilter}`, { headers });
      const resolvedDisputes = await resolvedRes.json();

      let totalResolutionTime = 0;
      let resolvedCount = 0;

      resolvedDisputes.forEach((d: any) => {
        if (d.resolved_at) {
          const created = new Date(d.created_at).getTime();
          const resolved = new Date(d.resolved_at).getTime();
          totalResolutionTime += (resolved - created);
          resolvedCount++;
        }
      });

      const avgResolutionHours = resolvedCount > 0 
        ? Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60)) 
        : 0;

      return new Response(JSON.stringify({ 
        ...stats, 
        avg_resolution_hours: avgResolutionHours,
        resolved_count: resolvedCount
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Dispute error:', error);
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

