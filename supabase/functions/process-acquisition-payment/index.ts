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
const gatewayApiKey = Deno.env.get('GATEWAY_API_KEY')!;

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
        from: 'Your Places <notifications@yourplaces.com>',
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
    const { action, investor_id } = body;

    // Create acquisition payment with AM notification
    if (action === 'create_acquisition_payment') {
      const { property_id, amount, notify_am, am_name } = body;

      if (!investor_id || !property_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and Property ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      const investor = investors[0];

      // Create PaymentIntent through the Payment Gateway
      const response = await fetch('https://stripe.gateway.fastrouter.io/payments/payment-intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayApiKey
        },
        body: JSON.stringify({
          amount: amount || 49900,
          currency: 'usd',
          metadata: {
            investor_id,
            property_id,
            type: 'acquisition_fee'
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      // Notify AM if requested
      if (notify_am && investor?.assigned_am_id) {
        const staff = await dbQuery('staff', `id=eq.${investor.assigned_am_id}`);
        if (staff[0]?.email) {
          await sendNotificationEmail(
            staff[0].email,
            `Acquisition Started - ${investor.full_name}`,
            `<h2>Client Started Acquisition</h2>
            <p><strong>Investor:</strong> ${investor.full_name} (${investor.email})</p>
            <p><strong>Property ID:</strong> ${property_id}</p>
            <p>Your client has started the acquisition process and is proceeding with payment.</p>
            <p><a href="https://app.yourplaces.com/staff/dashboard">View in Dashboard</a></p>`
          );
        }
      }

      return new Response(JSON.stringify({
        clientSecret: data.clientSecret,
        paymentIntentId: data.id,
        amount: data.amount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Submit manual payment proof (Zelle/Wire)
    if (action === 'submit_manual_payment_proof') {
      const { property_id, payment_method, proof_url, amount, notify_am, am_name } = body;

      if (!investor_id || !property_id || !proof_url) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      const investor = investors[0];

      // Create payment record
      const payment = await dbInsert('acquisition_payments', {
        investor_id,
        property_id,
        payment_method,
        amount,
        status: 'pending_verification',
        proof_url,
        created_at: new Date().toISOString()
      });

      // Notify AM and success team
      const successTeam = await dbQuery('staff', `role=in.(success_manager,admin,acquisition_manager)&is_active=eq.true`);
      for (const staff of successTeam) {
        if (staff.email) {
          await sendNotificationEmail(
            staff.email,
            `Payment Proof Submitted - ${investor?.full_name || 'Investor'}`,
            `<h2>Manual Payment Proof Submitted</h2>
            <p><strong>Investor:</strong> ${investor?.full_name || 'Unknown'} (${investor?.email || 'N/A'})</p>
            <p><strong>Payment Method:</strong> ${payment_method.toUpperCase()}</p>
            <p><strong>Amount:</strong> $${amount}</p>
            <p><strong>Action Required:</strong> Verify payment and approve in dashboard.</p>
            <p><a href="https://app.yourplaces.com/staff/dashboard">Review Payment</a></p>`
          );
        }
      }

      // Notify investor
      await createNotification(
        investor_id,
        'Payment Proof Submitted',
        `Your ${payment_method.toUpperCase()} payment proof has been submitted. Our team will verify it within 24 hours.`,
        'info'
      );

      return new Response(JSON.stringify({
        success: true,
        payment: payment[0],
        message: 'Payment proof submitted for verification'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Approve manual payment (staff action)
    if (action === 'approve_manual_payment') {
      const { payment_id, staff_id, staff_name } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date().toISOString();

      // Update payment status
      await dbUpdate('acquisition_payments', `id=eq.${payment_id}`, {
        status: 'approved',
        approved_by: staff_id,
        approved_by_name: staff_name,
        approved_at: now,
        updated_at: now
      });

      // Get payment details
      const payments = await dbQuery('acquisition_payments', `id=eq.${payment_id}`);
      if (payments.length > 0) {
        const payment = payments[0];
        
        // Update property assignment status
        await dbUpdate('property_assignments', 
          `investor_id=eq.${payment.investor_id}&property_id=eq.${payment.property_id}`,
          { payment_status: 'paid', paid_at: now }
        );

        // Update deal reservation if exists
        await dbUpdate('deal_reservations',
          `investor_id=eq.${payment.investor_id}&property_id=eq.${payment.property_id}`,
          { status: 'payment_approved', payment_id, updated_at: now }
        );

        // Notify investor
        await createNotification(
          payment.investor_id,
          'Payment Approved!',
          'Your payment has been verified and approved. Full property details are now available in your dashboard.',
          'success'
        );

        // Get investor for email
        const investors = await dbQuery('investors', `id=eq.${payment.investor_id}`);
        if (investors[0]?.email) {
          await sendNotificationEmail(
            investors[0].email,
            'Payment Approved - Property Details Released',
            `<h2>Great news!</h2>
            <p>Your payment has been verified and approved.</p>
            <p>Full property details including the exact address and landlord contact information are now available in your dashboard.</p>
            <p><a href="https://app.yourplaces.com/investor/portal">View Property Details</a></p>`
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Payment approved'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Reject manual payment (staff action)
    if (action === 'reject_manual_payment') {
      const { payment_id, rejection_reason, staff_id } = body;

      if (!payment_id) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await dbUpdate('acquisition_payments', `id=eq.${payment_id}`, {
        status: 'rejected',
        rejection_reason,
        updated_at: new Date().toISOString()
      });

      // Get payment details for notification
      const payments = await dbQuery('acquisition_payments', `id=eq.${payment_id}`);
      if (payments.length > 0) {
        const payment = payments[0];
        
        await createNotification(
          payment.investor_id,
          'Payment Verification Issue',
          `There was an issue verifying your payment: ${rejection_reason}. Please contact support or resubmit.`,
          'warning'
        );
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Payment rejected'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending manual payments (for staff)
    if (action === 'get_pending_payments') {
      const payments = await dbQuery('acquisition_payments', 
        `status=eq.pending_verification&order=created_at.desc`
      );

      // Enrich with investor info
      const enrichedPayments = await Promise.all(payments.map(async (p: any) => {
        const investors = await dbQuery('investors', `id=eq.${p.investor_id}&select=full_name,email,phone`);
        return { ...p, investor: investors[0] || null };
      }));

      return new Response(JSON.stringify({
        success: true,
        payments: enrichedPayments
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get available credits
    if (action === 'get_available_credits') {
      const credits = await dbQuery('investor_credits', 
        `investor_id=eq.${investor_id}&credit_status=eq.active&expires_at=gt.${new Date().toISOString()}&order=expires_at.asc`
      );

      return new Response(JSON.stringify({
        success: true,
        credits
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create payment intent with credits
    if (action === 'create_payment_intent') {
      const { assignment_id, applied_credits, credit_ids } = body;

      if (!investor_id || !assignment_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and Assignment ID required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const originalAmount = 49900; // $499 in cents
      const creditsInCents = Math.min(applied_credits || 0, originalAmount);
      const finalAmount = originalAmount - creditsInCents;

      // If fully covered by credits
      if (finalAmount <= 0 && credit_ids?.length > 0) {
        // Mark credits as used
        for (const creditId of credit_ids) {
          await dbUpdate('investor_credits', `id=eq.${creditId}`, {
            credit_status: 'used',
            used_at: new Date().toISOString()
          });
        }

        // Update assignment
        await dbUpdate('property_assignments', `id=eq.${assignment_id}`, {
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          credits_applied: creditsInCents / 100
        });

        return new Response(JSON.stringify({
          paid_with_credits: true,
          credits_applied: creditsInCents / 100,
          message: 'Payment completed with credits'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create PaymentIntent for remaining amount
      const response = await fetch('https://stripe.gateway.fastrouter.io/payments/payment-intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayApiKey
        },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'usd',
          metadata: {
            investor_id,
            assignment_id,
            original_amount: originalAmount,
            credits_applied: creditsInCents,
            credit_ids: credit_ids?.join(',') || ''
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      return new Response(JSON.stringify({
        clientSecret: data.clientSecret,
        paymentIntentId: data.id,
        amount: finalAmount,
        original_amount: originalAmount,
        credits_applied: creditsInCents / 100
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Confirm payment
    if (action === 'confirm_payment') {
      const { payment_intent_id } = body;

      // Get payment intent details from gateway
      const response = await fetch(`https://stripe.gateway.fastrouter.io/payments/payment-intents/${payment_intent_id}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayApiKey
        }
      });

      const paymentIntent = await response.json();
      
      if (paymentIntent.status === 'succeeded') {
        const metadata = paymentIntent.metadata || {};
        const assignmentId = metadata.assignment_id;
        const creditIds = metadata.credit_ids?.split(',').filter(Boolean) || [];

        // Mark credits as used
        for (const creditId of creditIds) {
          await dbUpdate('investor_credits', `id=eq.${creditId}`, {
            credit_status: 'used',
            used_at: new Date().toISOString()
          });
        }

        // Update assignment
        if (assignmentId) {
          await dbUpdate('property_assignments', `id=eq.${assignmentId}`, {
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: payment_intent_id,
            credits_applied: (metadata.credits_applied || 0) / 100
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Payment confirmed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        status: paymentIntent.status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate receipt
    if (action === 'generate_receipt') {
      const { payment_intent_id } = body;

      // Get payment details
      const response = await fetch(`https://stripe.gateway.fastrouter.io/payments/payment-intents/${payment_intent_id}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayApiKey
        }
      });

      const paymentIntent = await response.json();
      const metadata = paymentIntent.metadata || {};

      // Get investor and property info
      const investors = await dbQuery('investors', `id=eq.${investor_id}`);
      const investor = investors[0] || {};

      const receipt = {
        receipt_number: `RCP-${Date.now().toString(36).toUpperCase()}`,
        payment_date: new Date().toISOString(),
        amount: paymentIntent.amount,
        original_amount: metadata.original_amount || paymentIntent.amount,
        credits_applied: metadata.credits_applied || 0,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method: 'Card',
        description: 'Property Acquisition Fee',
        investor: {
          name: investor.full_name,
          email: investor.email,
          company: investor.company_name
        },
        property: {
          title: 'Investment Property',
          city: metadata.property_city || 'N/A',
          state: metadata.property_state || 'N/A',
          zip_code: metadata.property_zip || ''
        },
        company: {
          name: 'Your Places LLC',
          address: '123 Business Ave, Suite 100, Austin, TX 78701',
          support_email: 'support@yourplaces.com'
        }
      };

      return new Response(JSON.stringify({
        success: true,
        receipt
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get payment history
    if (action === 'get_payment_history') {
      const payments = await dbQuery('acquisition_payments', 
        `investor_id=eq.${investor_id}&status=eq.approved&order=created_at.desc`
      );

      return new Response(JSON.stringify({
        success: true,
        payments
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Payment error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
