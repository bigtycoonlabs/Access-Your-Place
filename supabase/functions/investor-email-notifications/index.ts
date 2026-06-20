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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Simple token generation using crypto
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash function for token storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    console.log('Email notification action:', action);

    // Helper to generate and store unsubscribe token
    async function createUnsubscribeToken(investorId: string, emailType: string): Promise<string> {
      const token = generateToken();
      const tokenHash = await hashToken(token);
      
      // Store token with 30-day expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await supabase.from('email_unsubscribe_tokens').insert({
        investor_id: investorId,
        token_hash: tokenHash,
        email_type: emailType,
        expires_at: expiresAt.toISOString()
      });
      
      return token;
    }

    // Helper function to send email
    async function sendEmail(to: string, subject: string, html: string, investorId?: string, emailType?: string) {
      if (!resendKey) {
        console.log('No Resend API key configured');
        return { success: false, error: 'No Resend key' };
      }

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${resendKey}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ 
            from: 'Access Your Place <notifications@accessyourplace.com>', 
            to: [to], 
            subject, 
            html 
          })
        });

        const result = await res.json();
        console.log('Resend response:', res.status, JSON.stringify(result));

        // Log the email
        if (investorId) {
          await supabase.from('email_notification_logs').insert({
            investor_id: investorId,
            email_type: emailType || 'general',
            subject,
            recipient_email: to,
            status: res.ok ? 'sent' : 'failed',
            resend_id: result.id,
            error_message: res.ok ? null : (result.message || 'Unknown error')
          });
        }

        return { success: res.ok, id: result.id, error: res.ok ? null : result.message };
      } catch (err: any) {
        console.error('Email send error:', err);
        return { success: false, error: err.message };
      }
    }

    // Helper to check if investor wants this email type
    async function checkEmailPreference(investorId: string, preferenceField: string): Promise<boolean> {
      const { data: prefs } = await supabase
        .from('investor_notification_preferences')
        .select('*')
        .eq('investor_id', investorId)
        .single();

      if (!prefs) return true; // Default to sending if no preferences set
      if (prefs.unsubscribed_all) return false;
      return prefs[preferenceField] !== false; // Default to true if not explicitly false
    }

    // Generate email header
    function emailHeader(title: string) {
      return `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
            <img src="https://accessyourplace.com/logo-white.png" alt="Access Your Place" style="height:40px;margin-bottom:15px" onerror="this.style.display='none'">
            <h1 style="margin:0;font-size:24px;">${title}</h1>
          </div>
          <div style="padding:30px;background:#fff;border:1px solid #e5e5e5;border-top:none">
      `;
    }

    // Generate email footer with unsubscribe link
    async function emailFooter(investorId?: string, emailType?: string) {
      let unsubscribeLink = '';
      if (investorId && emailType) {
        const token = await createUnsubscribeToken(investorId, emailType);
        unsubscribeLink = `
          <p style="margin:10px 0 0">
            <a href="https://accessyourplace.com/investor/unsubscribe?token=${token}&type=${emailType}" style="color:#666;text-decoration:underline">Unsubscribe from these emails</a>
            &nbsp;|&nbsp;
            <a href="https://accessyourplace.com/investor/unsubscribe?token=${token}&type=all" style="color:#666;text-decoration:underline">Unsubscribe from all</a>
          </p>
          <p style="margin:5px 0 0">
            <a href="https://accessyourplace.com/investor?tab=email" style="color:#888">Manage all email preferences</a>
          </p>
        `;
      }
      return `
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-radius:0 0 8px 8px;border:1px solid #e5e5e5;border-top:none">
            <p style="margin:0 0 10px">Access Your Place | 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126</p>
            ${unsubscribeLink}
          </div>
        </div>
      `;
    }

    // ============================================
    // ACTION: Verify Unsubscribe Token
    // ============================================
    if (action === 'verify_token') {
      const { token } = body;
      
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const tokenHash = await hashToken(token);
      
      const { data: tokenData, error } = await supabase
        .from('email_unsubscribe_tokens')
        .select('*, investors(id, email, full_name)')
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .eq('used', false)
        .single();

      if (error || !tokenData) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          expired: true 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Get current preferences
      const { data: prefs } = await supabase
        .from('investor_notification_preferences')
        .select('*')
        .eq('investor_id', tokenData.investor_id)
        .single();

      return new Response(JSON.stringify({ 
        success: true, 
        investor_id: tokenData.investor_id,
        investor_email: tokenData.investors?.email,
        investor_name: tokenData.investors?.full_name,
        email_type: tokenData.email_type,
        current_preferences: prefs || {}
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Process Unsubscribe Request
    // ============================================
    if (action === 'unsubscribe') {
      const { token, unsubscribe_type, specific_types } = body;
      
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const tokenHash = await hashToken(token);
      
      // Verify token
      const { data: tokenData, error: tokenError } = await supabase
        .from('email_unsubscribe_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .eq('used', false)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const investorId = tokenData.investor_id;
      let updateData: Record<string, any> = {
        investor_id: investorId,
        updated_at: new Date().toISOString()
      };

      // Handle different unsubscribe types
      if (unsubscribe_type === 'all') {
        updateData.unsubscribed_all = true;
        updateData.email_new_deals = false;
        updateData.email_deal_alerts = false;
        updateData.email_inquiry_updates = false;
        updateData.email_acquisition_milestones = false;
        updateData.email_document_updates = false;
        updateData.email_payment_confirmations = false;
        updateData.email_weekly_summary = false;
        updateData.email_monthly_report = false;
        updateData.email_market_reports = false;
        updateData.email_platform_updates = false;
      } else if (unsubscribe_type === 'specific' && specific_types) {
        // Unsubscribe from specific types
        const typeMapping: Record<string, string> = {
          'deal_alert': 'email_deal_alerts',
          'new_deals': 'email_new_deals',
          'inquiry_update': 'email_inquiry_updates',
          'acquisition_milestone': 'email_acquisition_milestones',
          'document_update': 'email_document_updates',
          'payment_confirmation': 'email_payment_confirmations',
          'weekly_summary': 'email_weekly_summary',
          'monthly_report': 'email_monthly_report',
          'market_report': 'email_market_reports',
          'platform_update': 'email_platform_updates'
        };
        
        for (const type of specific_types) {
          const field = typeMapping[type];
          if (field) {
            updateData[field] = false;
          }
        }
      } else if (unsubscribe_type === 'single') {
        // Unsubscribe from the email type that triggered this
        const typeMapping: Record<string, string> = {
          'deal_alert': 'email_deal_alerts',
          'new_deals': 'email_new_deals',
          'inquiry_update': 'email_inquiry_updates',
          'acquisition_milestone': 'email_acquisition_milestones',
          'document_update': 'email_document_updates',
          'payment_confirmation': 'email_payment_confirmations',
          'weekly_summary': 'email_weekly_summary',
          'monthly_report': 'email_monthly_report',
          'market_report': 'email_market_reports',
          'platform_update': 'email_platform_updates'
        };
        const field = typeMapping[tokenData.email_type];
        if (field) {
          updateData[field] = false;
        }
      }

      // Update preferences
      const { error: updateError } = await supabase
        .from('investor_notification_preferences')
        .upsert(updateData, { onConflict: 'investor_id' });

      if (updateError) {
        throw updateError;
      }

      // Mark token as used
      await supabase
        .from('email_unsubscribe_tokens')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      // Log the unsubscribe action
      await supabase.from('email_notification_logs').insert({
        investor_id: investorId,
        email_type: 'unsubscribe',
        subject: `Unsubscribed: ${unsubscribe_type}`,
        recipient_email: '',
        status: 'processed',
        metadata: { unsubscribe_type, specific_types, original_email_type: tokenData.email_type }
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: unsubscribe_type === 'all' 
          ? 'You have been unsubscribed from all emails' 
          : 'Your email preferences have been updated'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Resubscribe (re-enable emails)
    // ============================================
    if (action === 'resubscribe') {
      const { token, email_types } = body;
      
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const tokenHash = await hashToken(token);
      
      // Verify token (allow used tokens for resubscribe within 24 hours)
      const { data: tokenData, error: tokenError } = await supabase
        .from('email_unsubscribe_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const investorId = tokenData.investor_id;
      let updateData: Record<string, any> = {
        investor_id: investorId,
        unsubscribed_all: false,
        updated_at: new Date().toISOString()
      };

      // Re-enable specific types if provided
      if (email_types && email_types.length > 0) {
        const typeMapping: Record<string, string> = {
          'deal_alert': 'email_deal_alerts',
          'new_deals': 'email_new_deals',
          'inquiry_update': 'email_inquiry_updates',
          'acquisition_milestone': 'email_acquisition_milestones',
          'document_update': 'email_document_updates',
          'payment_confirmation': 'email_payment_confirmations',
          'weekly_summary': 'email_weekly_summary',
          'monthly_report': 'email_monthly_report',
          'market_report': 'email_market_reports',
          'platform_update': 'email_platform_updates'
        };
        
        for (const type of email_types) {
          const field = typeMapping[type];
          if (field) {
            updateData[field] = true;
          }
        }
      }

      const { error: updateError } = await supabase
        .from('investor_notification_preferences')
        .upsert(updateData, { onConflict: 'investor_id' });

      if (updateError) {
        throw updateError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'You have been resubscribed to emails'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Send New Deal Alert
    // ============================================
    if (action === 'deal_alert') {
      const { investor_id, property_data } = body;

      // Check preference
      const shouldSend = await checkEmailPreference(investor_id, 'email_new_deals');
      if (!shouldSend) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'preference_disabled' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      if (!investor) throw new Error('Investor not found');

      const footerHtml = await emailFooter(investor_id, 'deal_alert');
      const html = `
        ${emailHeader('New Investment Opportunity')}
        <p style="margin:0 0 15px;color:#333">Hi ${investor.full_name || 'Investor'},</p>
        <p style="margin:0 0 20px;color:#555">A new deal matching your investment criteria is now available!</p>
        
        <div style="background:linear-gradient(135deg,#f8f9fa,#e9ecef);padding:25px;border-radius:12px;margin:20px 0;border-left:4px solid #d4a574">
          <h3 style="margin:0 0 15px;color:#1e3a5f;font-size:20px">${property_data.property_type || 'Property'} in ${property_data.city}, ${property_data.state}</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px 0;color:#666;width:40%">Bedrooms</td>
              <td style="padding:8px 0;font-weight:bold;color:#333">${property_data.bedrooms || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666">Bathrooms</td>
              <td style="padding:8px 0;font-weight:bold;color:#333">${property_data.bathrooms || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666">Monthly Rent</td>
              <td style="padding:8px 0;font-weight:bold;color:#10b981">$${property_data.monthly_rent?.toLocaleString() || 'Contact for details'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666">Est. Revenue</td>
              <td style="padding:8px 0;font-weight:bold;color:#10b981">$${property_data.estimated_revenue?.toLocaleString() || 'Contact for details'}/mo</td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin:30px 0">
          <a href="https://accessyourplace.com/deals" style="display:inline-block;background:linear-gradient(135deg,#d4a574,#c49464);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">View Deal Details</a>
        </div>

        <p style="margin:20px 0 0;color:#888;font-size:13px;text-align:center">This deal was sent because it matches your saved preferences.</p>
        ${footerHtml}
      `;

      const result = await sendEmail(
        investor.email,
        `New Deal Alert: ${property_data.city}, ${property_data.state}`,
        html,
        investor_id,
        'deal_alert'
      );

      // Create in-app notification too
      await supabase.from('investor_notifications').insert({
        investor_id,
        notification_type: 'deals',
        title: `New Deal: ${property_data.city}, ${property_data.state}`,
        message: `A ${property_data.bedrooms}BR/${property_data.bathrooms}BA property matching your criteria is available.`,
        data: property_data
      });

      return new Response(JSON.stringify({ success: true, email: result }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Send Inquiry Status Update
    // ============================================
    if (action === 'inquiry_update') {
      const { investor_id, inquiry_data } = body;

      const shouldSend = await checkEmailPreference(investor_id, 'email_inquiry_updates');
      if (!shouldSend) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      if (!investor) throw new Error('Investor not found');

      const statusColors: Record<string, string> = {
        'pending': '#f59e0b',
        'reviewing': '#3b82f6',
        'contacted': '#8b5cf6',
        'scheduled': '#10b981',
        'converted': '#059669',
        'closed': '#6b7280'
      };

      const statusMessages: Record<string, string> = {
        'pending': 'Your inquiry has been received and is awaiting review.',
        'reviewing': 'Our team is actively reviewing your inquiry.',
        'contacted': 'An acquisition manager has reached out to you.',
        'scheduled': 'A viewing or call has been scheduled.',
        'converted': 'Congratulations! Your inquiry has been converted to an active acquisition.',
        'closed': 'This inquiry has been closed.'
      };

      const footerHtml = await emailFooter(investor_id, 'inquiry_update');
      const html = `
        ${emailHeader('Inquiry Status Update')}
        <p style="margin:0 0 15px;color:#333">Hi ${investor.full_name || 'Investor'},</p>
        <p style="margin:0 0 20px;color:#555">Your inquiry status has been updated.</p>
        
        <div style="background:#f8f9fa;padding:25px;border-radius:12px;margin:20px 0">
          <div style="display:flex;align-items:center;margin-bottom:15px">
            <span style="background:${statusColors[inquiry_data.status] || '#6b7280'};color:white;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:bold">${inquiry_data.status?.toUpperCase()}</span>
          </div>
          <h3 style="margin:0 0 10px;color:#1e3a5f">${inquiry_data.property_address || 'Property Inquiry'}</h3>
          <p style="margin:0;color:#666">${statusMessages[inquiry_data.status] || 'Your inquiry status has been updated.'}</p>
        </div>

        ${inquiry_data.notes ? `
          <div style="background:#fff3cd;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #f59e0b">
            <p style="margin:0;color:#856404;font-weight:bold">Note from our team:</p>
            <p style="margin:10px 0 0;color:#856404">${inquiry_data.notes}</p>
          </div>
        ` : ''}

        <div style="text-align:center;margin:30px 0">
          <a href="https://accessyourplace.com/investor?tab=inquiries" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold">View Inquiry Details</a>
        </div>
        ${footerHtml}
      `;

      const result = await sendEmail(
        investor.email,
        `Inquiry Update: ${inquiry_data.status?.charAt(0).toUpperCase() + inquiry_data.status?.slice(1)}`,
        html,
        investor_id,
        'inquiry_update'
      );

      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id,
        notification_type: 'account',
        title: `Inquiry Update: ${inquiry_data.status}`,
        message: statusMessages[inquiry_data.status] || 'Your inquiry status has been updated.',
        data: inquiry_data
      });

      return new Response(JSON.stringify({ success: true, email: result }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Send Acquisition Milestone Update
    // ============================================
    if (action === 'acquisition_milestone') {
      const { investor_id, acquisition_data } = body;

      const shouldSend = await checkEmailPreference(investor_id, 'email_acquisition_milestones');
      if (!shouldSend) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      if (!investor) throw new Error('Investor not found');

      const milestoneIcons: Record<string, string> = {
        'application_submitted': 'ðŸ“',
        'application_approved': 'âœ…',
        'lease_sent': 'ðŸ“„',
        'lease_signed': 'âœï¸',
        'deposit_paid': 'ðŸ’°',
        'keys_received': 'ðŸ”‘',
        'setup_started': 'ðŸ”§',
        'setup_complete': 'ðŸŽ‰',
        'live': 'ðŸš€'
      };

      const milestoneMessages: Record<string, string> = {
        'application_submitted': 'Your application has been submitted to the landlord.',
        'application_approved': 'Great news! Your application has been approved.',
        'lease_sent': 'The lease agreement has been sent for your review.',
        'lease_signed': 'The lease has been signed by all parties.',
        'deposit_paid': 'Your deposit payment has been processed.',
        'keys_received': 'Keys have been received - you now have access!',
        'setup_started': 'Property setup has begun.',
        'setup_complete': 'Setup is complete - your property is ready!',
        'live': 'Congratulations! Your property is now live and accepting bookings!'
      };

      const footerHtml = await emailFooter(investor_id, 'acquisition_milestone');
      const html = `
        ${emailHeader('Acquisition Milestone Reached!')}
        <p style="margin:0 0 15px;color:#333">Hi ${investor.full_name || 'Investor'},</p>
        <p style="margin:0 0 20px;color:#555">Your acquisition has reached a new milestone!</p>
        
        <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);padding:25px;border-radius:12px;margin:20px 0;border:2px solid #10b981">
          <div style="text-align:center;font-size:48px;margin-bottom:15px">${milestoneIcons[acquisition_data.milestone] || 'ðŸŽ¯'}</div>
          <h3 style="margin:0 0 10px;color:#065f46;text-align:center;font-size:22px">${acquisition_data.milestone?.replace(/_/g, ' ').toUpperCase()}</h3>
          <p style="margin:0;color:#047857;text-align:center">${milestoneMessages[acquisition_data.milestone] || 'A milestone has been reached.'}</p>
        </div>

        <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0">
          <h4 style="margin:0 0 10px;color:#1e3a5f">Property Details</h4>
          <p style="margin:0;color:#666"><strong>Address:</strong> ${acquisition_data.property_address || 'N/A'}</p>
          <p style="margin:5px 0 0;color:#666"><strong>Market:</strong> ${acquisition_data.city}, ${acquisition_data.state}</p>
        </div>

        ${acquisition_data.next_steps ? `
          <div style="background:#e0f2fe;padding:15px;border-radius:8px;margin:20px 0">
            <p style="margin:0;color:#0369a1;font-weight:bold">Next Steps:</p>
            <p style="margin:10px 0 0;color:#0369a1">${acquisition_data.next_steps}</p>
          </div>
        ` : ''}

        <div style="text-align:center;margin:30px 0">
          <a href="https://accessyourplace.com/investor?tab=acquisitions" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold">View Acquisition Progress</a>
        </div>
        ${footerHtml}
      `;

      const result = await sendEmail(
        investor.email,
        `Acquisition Milestone: ${acquisition_data.milestone?.replace(/_/g, ' ')}`,
        html,
        investor_id,
        'acquisition_milestone'
      );

      // Create in-app notification
      await supabase.from('investor_notifications').insert({
        investor_id,
        notification_type: 'account',
        title: `Milestone: ${acquisition_data.milestone?.replace(/_/g, ' ')}`,
        message: milestoneMessages[acquisition_data.milestone] || 'A milestone has been reached.',
        data: acquisition_data
      });

      return new Response(JSON.stringify({ success: true, email: result }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Send Weekly Portfolio Summary
    // ============================================
    if (action === 'weekly_summary') {
      const { investor_id } = body;

      const shouldSend = await checkEmailPreference(investor_id, 'email_weekly_summary');
      if (!shouldSend) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      if (!investor) throw new Error('Investor not found');

      // Get portfolio stats
      const { data: portfolio } = await supabase
        .from('investor_portfolio')
        .select('*')
        .eq('investor_id', investor_id);

      const { data: acquisitions } = await supabase
        .from('acquisition_requests')
        .select('*')
        .eq('investor_id', investor_id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: inquiries } = await supabase
        .from('deal_inquiries')
        .select('*')
        .eq('investor_email', investor.email)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Get new matching deals
      const { data: newDeals } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'available')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      const portfolioCount = portfolio?.length || 0;
      const activeAcquisitions = acquisitions?.filter(a => !['completed', 'cancelled'].includes(a.status))?.length || 0;
      const newInquiries = inquiries?.length || 0;
      const newDealsCount = newDeals?.length || 0;

      const footerHtml = await emailFooter(investor_id, 'weekly_summary');
      const html = `
        ${emailHeader('Your Weekly Portfolio Summary')}
        <p style="margin:0 0 15px;color:#333">Hi ${investor.full_name || 'Investor'},</p>
        <p style="margin:0 0 20px;color:#555">Here's your weekly investment summary for the week ending ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
        
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin:25px 0">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:20px;border-radius:12px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px">Portfolio Properties</p>
            <p style="margin:5px 0 0;color:white;font-size:32px;font-weight:bold">${portfolioCount}</p>
          </div>
          <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;border-radius:12px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px">Active Acquisitions</p>
            <p style="margin:5px 0 0;color:white;font-size:32px;font-weight:bold">${activeAcquisitions}</p>
          </div>
          <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:20px;border-radius:12px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px">New Inquiries</p>
            <p style="margin:5px 0 0;color:white;font-size:32px;font-weight:bold">${newInquiries}</p>
          </div>
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:20px;border-radius:12px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px">New Deals This Week</p>
            <p style="margin:5px 0 0;color:white;font-size:32px;font-weight:bold">${newDealsCount}</p>
          </div>
        </div>

        ${newDeals && newDeals.length > 0 ? `
          <div style="margin:30px 0">
            <h3 style="margin:0 0 15px;color:#1e3a5f">New Deals This Week</h3>
            ${newDeals.slice(0, 3).map(deal => `
              <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:10px;border-left:4px solid #d4a574">
                <p style="margin:0;font-weight:bold;color:#1e3a5f">${deal.city}, ${deal.state}</p>
                <p style="margin:5px 0 0;color:#666;font-size:14px">${deal.bedrooms || '?'} bed, ${deal.bathrooms || '?'} bath â€¢ $${deal.monthly_rent?.toLocaleString() || 'TBD'}/mo</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="text-align:center;margin:30px 0">
          <a href="https://accessyourplace.com/investor" style="display:inline-block;background:linear-gradient(135deg,#d4a574,#c49464);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;margin-right:10px">View Dashboard</a>
          <a href="https://accessyourplace.com/deals" style="display:inline-block;background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold">Browse Deals</a>
        </div>
        ${footerHtml}
      `;

      const result = await sendEmail(
        investor.email,
        `Weekly Portfolio Summary - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        html,
        investor_id,
        'weekly_summary'
      );

      // Update last summary sent timestamp
      await supabase
        .from('investor_notification_preferences')
        .upsert({
          investor_id,
          last_weekly_summary_sent: new Date().toISOString()
        }, { onConflict: 'investor_id' });

      return new Response(JSON.stringify({ success: true, email: result }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Process Weekly Summaries (Cron Job)
    // ============================================
    if (action === 'process_weekly_summaries') {
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'lowercase' });

      // Get all investors who want weekly summaries on this day
      const { data: preferences } = await supabase
        .from('investor_notification_preferences')
        .select('investor_id, weekly_summary_day')
        .eq('email_weekly_summary', true)
        .eq('weekly_summary_enabled', true)
        .neq('unsubscribed_all', true);

      const toProcess = preferences?.filter(p => 
        (p.weekly_summary_day || 'monday') === dayOfWeek
      ) || [];

      console.log(`Processing ${toProcess.length} weekly summaries for ${dayOfWeek}`);

      const results = [];
      for (const pref of toProcess) {
        try {
          const response = await fetch(req.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'weekly_summary', investor_id: pref.investor_id })
          });
          results.push({ investor_id: pref.investor_id, success: response.ok });
        } catch (err) {
          results.push({ investor_id: pref.investor_id, success: false, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Send Bulk Deal Alerts to Matching Investors
    // ============================================
    if (action === 'notify_matching_investors') {
      const { property_id } = body;

      // Get property details
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', property_id)
        .single();

      if (propError || !property) {
        throw new Error('Property not found');
      }

      // Get investors with deal alerts enabled for this market
      const { data: alerts } = await supabase
        .from('deal_alerts')
        .select('investor_id, markets, min_bedrooms, max_bedrooms, min_rent, max_rent, property_types')
        .eq('is_active', true);

      // Also get investor preferences
      const { data: investors } = await supabase
        .from('investors')
        .select('id, email, full_name, preferred_markets, investment_budget_min, investment_budget_max')
        .eq('status', 'active');

      const matchingInvestorIds = new Set<string>();

      // Check deal alerts
      alerts?.forEach(alert => {
        const marketsMatch = !alert.markets?.length || alert.markets.includes(property.city) || alert.markets.includes(property.state);
        const bedroomsMatch = (!alert.min_bedrooms || property.bedrooms >= alert.min_bedrooms) && 
                             (!alert.max_bedrooms || property.bedrooms <= alert.max_bedrooms);
        const rentMatch = (!alert.min_rent || property.monthly_rent >= alert.min_rent) &&
                         (!alert.max_rent || property.monthly_rent <= alert.max_rent);

        if (marketsMatch && bedroomsMatch && rentMatch) {
          matchingInvestorIds.add(alert.investor_id);
        }
      });

      // Check investor preferences
      investors?.forEach(inv => {
        if (inv.preferred_markets?.includes(property.city) || inv.preferred_markets?.includes(property.state)) {
          matchingInvestorIds.add(inv.id);
        }
      });

      console.log(`Found ${matchingInvestorIds.size} matching investors for property ${property_id}`);

      // Send notifications to matching investors
      const results = [];
      for (const investorId of matchingInvestorIds) {
        try {
          const response = await fetch(req.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'deal_alert',
              investor_id: investorId,
              property_data: {
                id: property.id,
                city: property.city,
                state: property.state,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                monthly_rent: property.monthly_rent,
                estimated_revenue: property.estimated_revenue,
                property_type: property.property_type
              }
            })
          });
          results.push({ investor_id: investorId, success: response.ok });
        } catch (err) {
          results.push({ investor_id: investorId, success: false });
        }
      }

      return new Response(JSON.stringify({ success: true, notified: results.length, results }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Get/Update Email Preferences
    // ============================================
    if (action === 'get_preferences') {
      const { investor_id } = body;

      const { data: prefs, error } = await supabase
        .from('investor_notification_preferences')
        .select('*')
        .eq('investor_id', investor_id)
        .single();

      return new Response(JSON.stringify({ success: true, preferences: prefs || {} }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (action === 'update_preferences') {
      const { investor_id, preferences } = body;

      const { error } = await supabase
        .from('investor_notification_preferences')
        .upsert({
          investor_id,
          ...preferences,
          updated_at: new Date().toISOString()
        }, { onConflict: 'investor_id' });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================
    // ACTION: Get Email History
    // ============================================
    if (action === 'get_email_history') {
      const { investor_id, limit = 50 } = body;

      const { data: logs, error } = await supabase
        .from('email_notification_logs')
        .select('*')
        .eq('investor_id', investor_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, logs: logs || [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('Email notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

