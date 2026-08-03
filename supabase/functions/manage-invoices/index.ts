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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GATEWAY_API_KEY = Deno.env.get('GATEWAY_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const body = await req.json();
    const { action } = body;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Generate invoice number
    const generateInvoiceNumber = () => {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `INV-${year}${month}-${random}`;
    };

    // Send email helper
    const sendEmail = async (to: string, subject: string, html: string) => {
      if (!RESEND_API_KEY) return { success: false, error: 'Email not configured' };
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Access Your Place <billing@accessyourplace.com>',
            to: [to],
            subject,
            html
          })
        });
        const data = await res.json();
        return { success: res.ok, data };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    };

    // Generate professional invoice HTML email
    const generateInvoiceEmail = (invoice: any, paymentLink: string) => {
      const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      }) : 'Upon Receipt';
      
      const invoiceTypeLabels: Record<string, string> = {
        'acquisition_fee': 'Acquisition Fee',
        'account_funding': 'Account Funding',
        'setup_fee': 'Setup Fee',
        'custom': 'Custom Invoice'
      };

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 40px; text-align: center;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 28px; font-weight: 700;">Access Your Place</h1>
              <p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px;">Professional Invoice</p>
            </td>
          </tr>
          
          <!-- Invoice Details -->
          <tr>
            <td style="padding: 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h2 style="color: #1a365d; margin: 0 0 5px; font-size: 24px;">Invoice #${invoice.invoice_number}</h2>
                    <p style="color: #64748b; margin: 0; font-size: 14px;">Issued: ${new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </td>
                  <td align="right">
                    <span style="background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">PENDING</span>
                  </td>
                </tr>
              </table>
              
              <!-- Bill To -->
              <div style="margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
                <p style="color: #64748b; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Bill To</p>
                <p style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 600;">${invoice.investor_name}</p>
                <p style="color: #64748b; margin: 5px 0 0; font-size: 14px;">${invoice.investor_email}</p>
              </div>
              
              <!-- Invoice Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Description</td>
                  <td align="right" style="padding: 12px 0; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Amount</td>
                </tr>
                <tr>
                  <td style="padding: 20px 0; border-bottom: 1px solid #f1f5f9;">
                    <p style="color: #1e293b; margin: 0; font-size: 16px; font-weight: 500;">${invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type}</p>
                    ${invoice.description ? `<p style="color: #64748b; margin: 8px 0 0; font-size: 14px;">${invoice.description}</p>` : ''}
                    ${invoice.property_address ? `<p style="color: #64748b; margin: 8px 0 0; font-size: 14px;">Property: ${invoice.property_address}</p>` : ''}
                  </td>
                  <td align="right" style="padding: 20px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 16px; font-weight: 500;">$${parseFloat(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 20px 0;">
                    <p style="color: #1e293b; margin: 0; font-size: 18px; font-weight: 700;">Total Due</p>
                    <p style="color: #64748b; margin: 5px 0 0; font-size: 14px;">Due: ${dueDate}</p>
                  </td>
                  <td align="right" style="padding: 20px 0;">
                    <p style="color: #1a365d; margin: 0; font-size: 28px; font-weight: 700;">$${parseFloat(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Pay Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">Pay Now - $${parseFloat(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; text-align: center; margin: 20px 0 0;">Secure payment powered by Stripe</p>
              
              ${invoice.notes ? `
              <div style="margin: 30px 0; padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Note:</strong> ${invoice.notes}</p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0 0 10px; font-size: 14px;">Questions about this invoice?</p>
              <p style="color: #1a365d; margin: 0; font-size: 14px;">Contact your Success Team at <a href="mailto:success@accessyourplace.com" style="color: #f59e0b; text-decoration: none;">success@accessyourplace.com</a></p>
              <p style="color: #94a3b8; margin: 20px 0 0; font-size: 12px;">Â© ${new Date().getFullYear()} Access Your Place. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    };

    // Create and send invoice
    if (action === 'create_invoice') {
      const { 
        investor_id, 
        amount, 
        invoice_type, 
        description, 
        property_id, 
        due_date,
        notes,
        sent_by,
        send_email: shouldSendEmail = true
      } = body;

      if (!investor_id || !amount || !invoice_type) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor details
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,full_name,email`,
        { headers }
      );
      const investors = await invRes.json();

      if (!investors?.length) {
        return new Response(JSON.stringify({ error: 'Investor not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investors[0];

      // Get property details if provided
      let propertyAddress = null;
      if (property_id) {
        const propRes = await fetch(
          `${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=address,city,state`,
          { headers }
        );
        const properties = await propRes.json();
        if (properties?.length) {
          propertyAddress = `${properties[0].address}, ${properties[0].city}, ${properties[0].state}`;
        }
      }

      // Get staff details
      let sentByName = 'Access Your Place Team';
      if (sent_by) {
        const staffRes = await fetch(
          `${SUPABASE_URL}/rest/v1/staff_users?id=eq.${sent_by}&select=first_name,last_name`,
          { headers }
        );
        const staff = await staffRes.json();
        if (staff?.length) {
          sentByName = `${staff[0].first_name} ${staff[0].last_name}`;
        }
      }

      // Generate invoice number
      const invoiceNumber = generateInvoiceNumber();

      // Create payment intent for the invoice
      let paymentIntentId = null;
      let paymentLink = `https://accessyourplace.com/investor?pay=${invoiceNumber}`;

      if (GATEWAY_API_KEY) {
        try {
          const paymentRes = await fetch('https://stripe.gateway.fastrouter.io/payments/payment-intents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': GATEWAY_API_KEY
            },
            body: JSON.stringify({
              amount: Math.round(parseFloat(amount) * 100),
              currency: 'usd',
              metadata: {
                invoice_number: invoiceNumber,
                investor_id,
                investor_email: investor.email,
                invoice_type,
                property_id: property_id || null
              }
            })
          });

          const paymentData = await paymentRes.json();
          if (paymentRes.ok) {
            paymentIntentId = paymentData.id;
            paymentLink = `https://accessyourplace.com/investor?pay=${invoiceNumber}&pi=${paymentData.id}`;
          }
        } catch (e) {
          console.error('Failed to create payment intent:', e);
        }
      }

      // Calculate due date (default 7 days from now)
      const calculatedDueDate = due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Create invoice record
      const invoiceData = {
        invoice_number: invoiceNumber,
        investor_id,
        investor_name: investor.full_name,
        investor_email: investor.email,
        amount: parseFloat(amount),
        invoice_type,
        description,
        property_id,
        property_address: propertyAddress,
        due_date: calculatedDueDate,
        status: 'pending',
        payment_intent_id: paymentIntentId,
        payment_link: paymentLink,
        sent_by,
        sent_by_name: sentByName,
        notes,
        created_at: new Date().toISOString()
      };

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invoiceData)
      });

      const newInvoice = await createRes.json();

      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to create invoice', details: newInvoice }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Send email if requested
      let emailResult = { success: false };
      if (shouldSendEmail && investor.email) {
        const emailHtml = generateInvoiceEmail(newInvoice[0] || invoiceData, paymentLink);
        emailResult = await sendEmail(
          investor.email,
          `Invoice #${invoiceNumber} from Access Your Place - $${parseFloat(amount).toLocaleString()}`,
          emailHtml
        );

        if (emailResult.success) {
          // Update invoice as sent
          await fetch(`${SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${invoiceNumber}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        invoice: newInvoice[0] || invoiceData,
        email_sent: emailResult.success,
        payment_link: paymentLink
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get invoices
    if (action === 'get_invoices') {
      const { investor_id, status, sent_by, limit = 50 } = body;

      let query = `${SUPABASE_URL}/rest/v1/invoices?select=*&order=created_at.desc&limit=${limit}`;
      
      if (investor_id) {
        query += `&investor_id=eq.${investor_id}`;
      }
      if (status) {
        query += `&status=eq.${status}`;
      }
      if (sent_by) {
        query += `&sent_by=eq.${sent_by}`;
      }

      const res = await fetch(query, { headers });
      const invoices = await res.json();

      return new Response(JSON.stringify({ invoices }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get single invoice
    if (action === 'get_invoice') {
      const { invoice_id, invoice_number } = body;

      let query = `${SUPABASE_URL}/rest/v1/invoices?select=*`;
      if (invoice_id) {
        query += `&id=eq.${invoice_id}`;
      } else if (invoice_number) {
        query += `&invoice_number=eq.${invoice_number}`;
      } else {
        return new Response(JSON.stringify({ error: 'Invoice ID or number required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const res = await fetch(query, { headers });
      const invoices = await res.json();

      if (!invoices?.length) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Mark as viewed if not already
      const invoice = invoices[0];
      if (!invoice.viewed_at && invoice.status === 'sent') {
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            viewed_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({ invoice }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update invoice status
    if (action === 'update_invoice_status') {
      const { invoice_id, status, payment_intent_id, paid_amount } = body;

      if (!invoice_id || !status) {
        return new Response(JSON.stringify({ error: 'Invoice ID and status required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        if (paid_amount) updateData.paid_amount = paid_amount;
        if (payment_intent_id) updateData.payment_intent_id = payment_intent_id;
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Failed to update invoice' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark invoice as paid (from webhook or manual)
    if (action === 'mark_paid') {
      const { payment_intent_id, invoice_number, paid_amount } = body;

      if (!payment_intent_id && !invoice_number) {
        return new Response(JSON.stringify({ error: 'Payment intent ID or invoice number required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find invoice
      let query = `${SUPABASE_URL}/rest/v1/invoices?select=*`;
      if (payment_intent_id) {
        query += `&payment_intent_id=eq.${payment_intent_id}`;
      } else {
        query += `&invoice_number=eq.${invoice_number}`;
      }

      const invRes = await fetch(query, { headers });
      const invoices = await invRes.json();

      if (!invoices?.length) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const invoice = invoices[0];

      if (invoice.status === 'paid') {
        return new Response(JSON.stringify({ success: true, message: 'Invoice already paid' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update invoice as paid
      await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_amount: paid_amount || invoice.amount,
          updated_at: new Date().toISOString()
        })
      });

      // Send payment confirmation email
      if (invoice.investor_email) {
        const confirmationHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #f59e0b; margin: 0;">Access Your Place</h1>
            </div>
            <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e5e5;">
              <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <h2 style="color: #166534; margin: 0;">Payment Received!</h2>
              </div>
              <p style="color: #475569;">Hi ${invoice.investor_name},</p>
              <p style="color: #475569;">We've received your payment of <strong>$${parseFloat(invoice.amount).toLocaleString()}</strong> for Invoice #${invoice.invoice_number}.</p>
              <p style="color: #475569;">Thank you for your payment. Your Success Team will be in touch shortly.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: #f59e0b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Your Portal</a>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">Â© ${new Date().getFullYear()} Access Your Place</p>
            </div>
          </div>
        `;
        await sendEmail(invoice.investor_email, `Payment Received - Invoice #${invoice.invoice_number}`, confirmationHtml);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        invoice_id: invoice.id,
        investor_id: invoice.investor_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resend invoice email
    if (action === 'resend_invoice') {
      const { invoice_id } = body;

      if (!invoice_id) {
        return new Response(JSON.stringify({ error: 'Invoice ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}&select=*`,
        { headers }
      );
      const invoices = await invRes.json();

      if (!invoices?.length) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const invoice = invoices[0];

      if (invoice.status === 'paid') {
        return new Response(JSON.stringify({ error: 'Cannot resend paid invoice' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const emailHtml = generateInvoiceEmail(invoice, invoice.payment_link);
      const emailResult = await sendEmail(
        invoice.investor_email,
        `Reminder: Invoice #${invoice.invoice_number} from Access Your Place - $${parseFloat(invoice.amount).toLocaleString()}`,
        emailHtml
      );

      if (emailResult.success) {
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
      }

      return new Response(JSON.stringify({ 
        success: emailResult.success,
        error: emailResult.success ? null : 'Failed to send email'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cancel invoice
    if (action === 'cancel_invoice') {
      const { invoice_id, cancelled_by } = body;

      if (!invoice_id) {
        return new Response(JSON.stringify({ error: 'Invoice ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by,
          updated_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({ success: res.ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get invoice stats
    if (action === 'get_stats') {
      const { sent_by } = body;

      let baseQuery = `${SUPABASE_URL}/rest/v1/invoices?select=id,amount,status`;
      if (sent_by) {
        baseQuery += `&sent_by=eq.${sent_by}`;
      }

      const res = await fetch(baseQuery, { headers });
      const invoices = await res.json() || [];

      const stats = {
        total_invoices: invoices.length,
        pending: invoices.filter((i: any) => i.status === 'pending' || i.status === 'sent').length,
        paid: invoices.filter((i: any) => i.status === 'paid').length,
        cancelled: invoices.filter((i: any) => i.status === 'cancelled').length,
        total_amount: invoices.reduce((sum: number, i: any) => sum + parseFloat(i.amount || 0), 0),
        paid_amount: invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + parseFloat(i.amount || 0), 0)
      };

      return new Response(JSON.stringify({ stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('manage-invoices error:', error);
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
