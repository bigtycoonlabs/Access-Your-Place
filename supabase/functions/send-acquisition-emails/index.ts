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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Full Terms of Service HTML for email
function getTermsOfServiceHTML(): string {
  return `
    <div style="background:#f8fafc;padding:30px;border-radius:8px;margin:30px 0;border:1px solid #e2e8f0;">
      <h2 style="color:#1a365d;margin:0 0 20px 0;font-size:24px;border-bottom:2px solid #d4a574;padding-bottom:10px;">Terms of Service</h2>
      <p style="color:#64748b;font-size:12px;margin-bottom:20px;">
        <strong>Effective Date:</strong> January 23, 2026<br>
        <strong>Entity:</strong> Set Up Your Place LLC d/b/a Access Your Place (a Cooper Family Inc. Company)<br>
        <strong>Corporate Address:</strong> 1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126<br>
        <strong>Email:</strong> success@accessyourplace.com
      </p>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">1. Scope of Service: The Acquisition Engine</h3>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:10px;">
        Access Your Place ("AYP," "we," or the "Company") operates strictly as an acquisition and launch engine for the rental arbitrage and corporate housing industry.
      </p>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">2. Communication Protocol & Landlord Outreach</h3>
      <div style="background:#fef3c7;border:1px solid #f59e0b;padding:15px;border-radius:8px;margin:10px 0;">
        <p style="color:#92400e;font-size:13px;margin:0;"><strong>Important:</strong> Unauthorized contact with landlords can jeopardize deals for you and other investors.</p>
      </div>
      
      <h3 style="color:#1a365d;font-size:16px;margin:20px 0 10px 0;">3. Payment Terms & Refund Policy</h3>
      <ul style="color:#475569;font-size:14px;line-height:1.8;margin:10px 0;padding-left:20px;">
        <li><strong>Non-Refundable:</strong> Acquisition fees are non-refundable once the Acquisition Agreement has been signed and the property address has been revealed.</li>
        <li><strong>Deal Replacement:</strong> If a deal falls through due to landlord rejection, AYP will work to find a replacement property at no additional fee.</li>
      </ul>
      
      <div style="background:#1a365d;color:white;padding:20px;border-radius:8px;margin-top:20px;text-align:center;">
        <p style="margin:0;font-size:14px;">
          By proceeding with this acquisition, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
        </p>
        <p style="margin:10px 0 0 0;font-size:12px;opacity:0.8;">
          Full Terms of Service: <a href="https://accessyourplace.com/terms-of-service" style="color:#d4a574;">accessyourplace.com/terms-of-service</a>
        </p>
      </div>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.error('No Resend API key configured');
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
        to, 
        subject, 
        html 
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Resend error:', errorText);
      return { success: false, error: errorText };
    }
    
    const data = await res.json();
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Send SMS via Twilio
async function sendSMS(investorId: string, notificationType: string, templateKey: string, templateData: Record<string, any>) {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'send',
        investor_id: investorId,
        notification_type: notificationType,
        template_key: templateKey,
        template_data: templateData
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: error.message };
  }
}

// Get template from database
async function getEmailTemplate(templateKey: string) {
  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();
  
  return template;
}

// Replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// Check notification preferences
async function shouldSendEmail(investorId: string, emailType: string): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('investor_notification_preferences')
    .select('*')
    .eq('investor_id', investorId)
    .single();

  if (!prefs) return true;

  const prefMap: Record<string, string> = {
    'first_refusal_approved': 'email_first_refusal',
    'deal_publicly_available': 'email_deal_available',
    'payment_success': 'email_payment_success',
    'manager_assigned': 'email_manager_assigned',
    'refusal_expired': 'email_first_refusal'
  };

  const prefKey = prefMap[emailType];
  return prefKey ? prefs[prefKey] !== false : true;
}

// Default email templates
function getDefaultFirstRefusalEmail(investor: any, request: any, expiresAt: Date) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1>Deal Approved!</h1>
        <p>You have 24 hours first right of refusal</p>
      </div>
      <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb">
        <p>Hi ${investor.full_name || 'Investor'},</p>
        <div style="background:#fef3c7;border:1px solid #f59e0b;padding:15px;border-radius:8px;margin:20px 0">
          <strong>24-Hour First Right of Refusal</strong>
          <p>You have until ${expiresAt.toLocaleString()} to secure this deal.</p>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;margin:20px 0">
          <h3>Property Details</h3>
          <p><strong>Location:</strong> ${request.city}, ${request.state} ${request.zip_code}</p>
          <p><strong>Property Type:</strong> ${request.property_type?.toUpperCase() || 'STR'}</p>
          <p><strong>Monthly Revenue:</strong> $${request.projected_monthly_revenue?.toLocaleString() || 'N/A'}</p>
        </div>
        <a href="https://accessyourplace.com/investor-portal" style="display:inline-block;background:#10b981;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">View Deal and Secure Now</a>
      </div>
    </div>
  `;
}

function getDefaultPaymentSuccessEmail(investor: any, property: any, receipt: any) {
  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip_code}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1>Payment Successful!</h1>
      </div>
      <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb">
        <p>Hi ${investor.full_name || 'Investor'},</p>
        <div style="background:#10b981;color:white;padding:25px;border-radius:8px;text-align:center;margin:20px 0">
          <p style="margin:0 0 10px 0;opacity:0.9">Your Property Address:</p>
          <h2 style="margin:0">${fullAddress}</h2>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb">
          <h3>Payment Receipt</h3>
          <p><strong>Transaction ID:</strong> ${receipt.payment_intent_id || receipt.transaction_id}</p>
          <p><strong>Amount Paid:</strong> $${((receipt.amount || 0) / 100).toFixed(2)}</p>
        </div>
        ${getTermsOfServiceHTML()}
      </div>
    </div>
  `;
}

function getDefaultManagerAssignedEmail(investor: any, managerName: string) {
  const initials = managerName.split(' ').map(n => n[0]).join('').toUpperCase();
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
        <h1>You Have Been Upgraded!</h1>
      </div>
      <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb">
        <div style="background:#fff;padding:25px;border-radius:8px;text-align:center;margin:20px 0">
          <div style="width:80px;height:80px;background:linear-gradient(135deg,#1e3a5f 0%,#2d5a87 100%);border-radius:50%;margin:0 auto 15px;display:flex;align-items:center;justify-content:center;color:white;font-size:32px;font-weight:bold">${initials}</div>
          <h2>${managerName}</h2>
          <p style="color:#6b7280">Your Dedicated Acquisition Manager</p>
        </div>
        <a href="https://accessyourplace.com/investor" style="display:inline-block;background:#7c3aed;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Go to Your Portal</a>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      action, 
      investor_id, 
      request_id, 
      property_id, 
      assignment_id, 
      manager_name, 
      receipt_data, 
      property_data,
      document_name,
      signing_link,
      property_address,
      // Invoice-specific fields
      amount,
      description,
      invoice_type,
      notes,
      sent_by
    } = body;

    // SEND INVOICE - Integrates with manage-invoices function
    if (action === 'send_invoice') {
      if (!investor_id || !amount) {
        throw new Error('Investor ID and amount required');
      }

      // Call manage-invoices function to create and send invoice
      const invoiceResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/manage-invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_invoice',
          investor_id,
          amount,
          invoice_type: invoice_type || 'acquisition_fee',
          description: description || '',
          property_id: property_id || null,
          notes: notes || '',
          sent_by,
          send_email: true
        })
      });

      const invoiceResult = await invoiceResponse.json();

      if (!invoiceResponse.ok || invoiceResult.error) {
        throw new Error(invoiceResult.error || 'Failed to create invoice');
      }

      // Create in-app notification
      const { data: investor } = await supabase
        .from('investors')
        .select('full_name')
        .eq('id', investor_id)
        .single();

      await supabase.from('investor_notifications').insert({
        investor_id,
        type: 'invoice',
        notification_type: 'payments',
        title: 'New Invoice Received',
        message: `You have a new invoice for $${parseFloat(amount).toLocaleString()}. Please review and complete payment.`,
        data: { 
          invoice_number: invoiceResult.invoice?.invoice_number,
          amount,
          invoice_type
        },
        is_read: false
      });

      // Send SMS notification
      await sendSMS(investor_id, 'invoice_received', 'invoice_received', {
        amount: parseFloat(amount).toLocaleString(),
        invoice_type: invoice_type || 'acquisition_fee',
        portal_link: 'https://accessyourplace.com/investor'
      });

      return new Response(JSON.stringify({ 
        success: true, 
        invoice: invoiceResult.invoice,
        email_sent: invoiceResult.email_sent,
        payment_link: invoiceResult.payment_link
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send first right of refusal email
    if (action === 'first_refusal_approved') {
      if (!investor_id || !request_id) {
        throw new Error('Investor ID and request ID required');
      }

      const shouldSend = await shouldSendEmail(investor_id, 'first_refusal_approved');
      if (!shouldSend) {
        return new Response(JSON.stringify({ 
          success: true, 
          email_sent: false,
          reason: 'User opted out'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      const { data: request } = await supabase
        .from('acquisition_requests')
        .select('*')
        .eq('id', request_id)
        .single();

      if (!investor || !request) {
        throw new Error('Investor or request not found');
      }

      const expiresAt = new Date(request.first_refusal_expires_at);
      const emailHtml = getDefaultFirstRefusalEmail(investor, request, expiresAt);
      const emailResult = await sendEmail(investor.email, 'Deal Approved! You Have 24 Hours First Right of Refusal', emailHtml);

      await supabase.from('investor_notifications').insert({
        investor_id: investor.id,
        type: 'first_refusal',
        notification_type: 'deals',
        title: 'Deal Approved - 24 Hour First Right of Refusal',
        message: `Your acquisition request for ${request.city}, ${request.state} has been approved!`,
        data: { request_id, expires_at: request.first_refusal_expires_at },
        is_read: false
      });

      return new Response(JSON.stringify({ 
        success: true, 
        email_sent: emailResult.success
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send payment success email
    if (action === 'payment_success') {
      if (!investor_id || !assignment_id) {
        throw new Error('Investor ID and assignment ID required');
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      const { data: assignment } = await supabase
        .from('property_assignments')
        .select('*, properties(*)')
        .eq('id', assignment_id)
        .single();

      if (!investor || !assignment) {
        throw new Error('Investor or assignment not found');
      }

      const property = property_data || assignment.properties;
      const receipt = receipt_data || {
        payment_intent_id: assignment.payment_intent_id,
        amount: (property?.acquisition_fee || 499) * 100,
        paid_at: assignment.paid_at
      };

      const emailHtml = getDefaultPaymentSuccessEmail(investor, property, receipt);
      const emailResult = await sendEmail(investor.email, 'Payment Successful - Property Address Revealed', emailHtml);

      await supabase.from('investor_notifications').insert({
        investor_id: investor.id,
        type: 'payment_success',
        notification_type: 'payments',
        title: 'Payment Successful - Address Revealed',
        message: `Your payment for ${property.city}, ${property.state} was successful.`,
        data: { assignment_id, property_id: property.id, address: property.address },
        is_read: false
      });

      return new Response(JSON.stringify({ 
        success: true, 
        email_sent: emailResult.success
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send manager assigned email
    if (action === 'manager_assigned') {
      if (!investor_id || !manager_name) {
        throw new Error('Investor ID and manager name required');
      }

      const { data: investor } = await supabase
        .from('investors')
        .select('*')
        .eq('id', investor_id)
        .single();

      if (!investor) {
        throw new Error('Investor not found');
      }

      const emailHtml = getDefaultManagerAssignedEmail(investor, manager_name);
      const emailResult = await sendEmail(investor.email, `Welcome! ${manager_name} is Your New Acquisition Manager`, emailHtml);

      await supabase.from('investor_notifications').insert({
        investor_id: investor.id,
        type: 'manager_assigned',
        notification_type: 'account',
        title: 'Acquisition Manager Assigned',
        message: `${manager_name} has been assigned as your dedicated acquisition manager.`,
        data: { manager_name },
        is_read: false
      });

      return new Response(JSON.stringify({ 
        success: true, 
        email_sent: emailResult.success
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deal publicly available
    if (action === 'deal_publicly_available') {
      if (!request_id) {
        throw new Error('Request ID required');
      }

      const { data: request } = await supabase
        .from('acquisition_requests')
        .select('*')
        .eq('id', request_id)
        .single();

      if (!request) {
        throw new Error('Request not found');
      }

      const { data: investors } = await supabase
        .from('investors')
        .select('*')
        .eq('status', 'active')
        .eq('discovery_call_completed', true)
        .neq('id', request.first_refusal_investor_id || '');

      let emailsSent = 0;
      for (const investor of (investors || [])) {
        const shouldSend = await shouldSendEmail(investor.id, 'deal_publicly_available');
        if (!shouldSend) continue;

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">
              <h1>New Deal Available!</h1>
            </div>
            <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb">
              <p>Hi ${investor.full_name || 'Investor'},</p>
              <p>A verified deal in <strong>${request.city}, ${request.state}</strong> is now available.</p>
              <a href="https://accessyourplace.com/deals" style="display:inline-block;background:#1e3a5f;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">View Deal</a>
            </div>
          </div>
        `;
        const result = await sendEmail(investor.email, `New Deal Available: ${request.city}, ${request.state}`, emailHtml);
        if (result.success) emailsSent++;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        emails_sent: emailsSent
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
