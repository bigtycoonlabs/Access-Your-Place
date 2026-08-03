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

    // Helper to send email
    const sendEmail = async (to: string, subject: string, html: string) => {
      if (!RESEND_API_KEY) return { success: false };
      try {
        const res = await fetch('https://api.resend.com/emails', {
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
        return { success: res.ok };
      } catch (e) {
        return { success: false };
      }
    };

    // Get investor's funding status
    if (action === 'get_funding_status') {
      const { investor_id } = body;

      if (!investor_id) {
        return new Response(JSON.stringify({ error: 'Investor ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor details
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=id,full_name,email,account_funded,funding_amount,funding_date,funding_tier,addresses_unlocked,priority_investor`,
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

      // Get funding history
      const historyRes = await fetch(
        `${SUPABASE_URL}/rest/v1/account_funding_transactions?investor_id=eq.${investor_id}&select=*&order=created_at.desc`,
        { headers }
      );
      const history = await historyRes.json() || [];

      // Get available credits
      const creditsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_credits?investor_id=eq.${investor_id}&credit_status=eq.active&select=id,amount,credit_type,source_description,expires_at`,
        { headers }
      );
      const credits = await creditsRes.json() || [];

      const totalCredits = credits.reduce((sum: number, c: any) => sum + parseFloat(c.amount || 0), 0);

      // Get pending invoices
      const invoicesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?investor_id=eq.${investor_id}&status=in.(pending,sent)&select=*&order=created_at.desc`,
        { headers }
      );
      const pendingInvoices = await invoicesRes.json() || [];

      return new Response(JSON.stringify({
        funding_status: {
          is_funded: investor.account_funded || false,
          funding_amount: investor.funding_amount || 0,
          funding_date: investor.funding_date,
          funding_tier: investor.funding_tier || 'standard',
          addresses_unlocked: investor.addresses_unlocked || 0,
          is_priority: investor.priority_investor || false
        },
        credits: {
          total_available: totalCredits,
          items: credits
        },
        pending_invoices: pendingInvoices,
        history
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create payment intent for account funding
    if (action === 'create_funding_payment') {
      const { investor_id, amount, funding_type, property_id, invoice_number } = body;

      if (!investor_id || !amount) {
        return new Response(JSON.stringify({ error: 'Investor ID and amount required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!GATEWAY_API_KEY) {
        return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), {
          status: 500,
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

      // Determine funding tier based on amount
      let fundingTier = 'standard';
      let addressesUnlocked = 1;
      if (amount >= 2500) {
        fundingTier = 'premium';
        addressesUnlocked = 5;
      } else if (amount >= 1500) {
        fundingTier = 'plus';
        addressesUnlocked = 3;
      }

      // Create payment intent via gateway
      const paymentRes = await fetch('https://stripe.gateway.fastrouter.io/payments/payment-intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': GATEWAY_API_KEY
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            investor_id,
            investor_email: investor.email,
            funding_type: funding_type || 'account_activation',
            property_id: property_id || null,
            funding_tier: fundingTier,
            addresses_unlocked: addressesUnlocked,
            invoice_number: invoice_number || null
          }
        })
      });

      const paymentData = await paymentRes.json();

      if (!paymentRes.ok) {
        return new Response(JSON.stringify({ error: paymentData.error || 'Failed to create payment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create pending transaction record
      await fetch(`${SUPABASE_URL}/rest/v1/account_funding_transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id,
          payment_intent_id: paymentData.id,
          amount,
          funding_type: funding_type || 'account_activation',
          funding_tier: fundingTier,
          addresses_unlocked: addressesUnlocked,
          property_id: property_id || null,
          invoice_number: invoice_number || null,
          status: 'pending',
          created_at: new Date().toISOString()
        })
      });

      return new Response(JSON.stringify({
        clientSecret: paymentData.clientSecret,
        paymentIntentId: paymentData.id,
        funding_tier: fundingTier,
        addresses_unlocked: addressesUnlocked
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Confirm funding payment and unlock addresses (called by webhook or manually)
    if (action === 'confirm_funding') {
      const { investor_id, payment_intent_id } = body;

      if (!investor_id || !payment_intent_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and payment intent ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get transaction record
      const txRes = await fetch(
        `${SUPABASE_URL}/rest/v1/account_funding_transactions?investor_id=eq.${investor_id}&payment_intent_id=eq.${payment_intent_id}&select=*`,
        { headers }
      );
      const transactions = await txRes.json();

      if (!transactions?.length) {
        // Try to find by payment_intent_id only (webhook might not have investor_id)
        const txRes2 = await fetch(
          `${SUPABASE_URL}/rest/v1/account_funding_transactions?payment_intent_id=eq.${payment_intent_id}&select=*`,
          { headers }
        );
        const transactions2 = await txRes2.json();
        
        if (!transactions2?.length) {
          return new Response(JSON.stringify({ error: 'Transaction not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        transactions.push(...transactions2);
      }

      const tx = transactions[0];

      if (tx.status === 'completed') {
        return new Response(JSON.stringify({ success: true, message: 'Payment already processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get investor current status
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${tx.investor_id}&select=*`,
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

      const currentUnlocked = investor.addresses_unlocked || 0;
      const newUnlocked = currentUnlocked + (tx.addresses_unlocked || 1);
      const totalFunding = (investor.funding_amount || 0) + tx.amount;

      // Determine if this makes them a priority investor (closed at least one deal)
      const dealsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/acquisition_requests?investor_id=eq.${tx.investor_id}&status=eq.completed&select=id`,
        { headers }
      );
      const completedDeals = await dealsRes.json() || [];
      const isPriority = completedDeals.length > 0;

      // Update investor account
      await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${tx.investor_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          account_funded: true,
          funding_amount: totalFunding,
          funding_date: new Date().toISOString(),
          funding_tier: tx.funding_tier || 'standard',
          addresses_unlocked: newUnlocked,
          priority_investor: isPriority
        })
      });

      // Update transaction status
      await fetch(`${SUPABASE_URL}/rest/v1/account_funding_transactions?id=eq.${tx.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
      });

      // If property_id was specified, unlock that specific property address
      if (tx.property_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/investor_property_access`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            investor_id: tx.investor_id,
            property_id: tx.property_id,
            access_granted_at: new Date().toISOString(),
            funding_transaction_id: tx.id
          })
        });
      }

      // Update related invoice if exists
      if (tx.invoice_number) {
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${tx.invoice_number}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_amount: tx.amount,
            updated_at: new Date().toISOString()
          })
        });
      }

      // Send confirmation email
      if (investor.email) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #f59e0b; margin: 0; font-size: 24px;">Access Your Place</h1>
              <p style="color: #94a3b8; margin: 10px 0 0;">Account Funding Confirmed</p>
            </div>
            <div style="padding: 30px; background: #ffffff; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px;">Payment Confirmed!</h2>
              <p style="color: #475569; line-height: 1.8;">Hi ${investor.full_name || 'Investor'},</p>
              <p style="color: #475569; line-height: 1.8;">Your account funding of <strong>$${tx.amount.toLocaleString()}</strong> has been successfully processed.</p>
              
              <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #166534; margin: 0 0 10px;">What's Unlocked:</h3>
                <ul style="color: #166534; margin: 0; padding-left: 20px;">
                  <li><strong>${tx.addresses_unlocked || 1}</strong> property address${(tx.addresses_unlocked || 1) > 1 ? 'es' : ''} unlocked</li>
                  <li>Full Penny AI market analysis access</li>
                  <li>Priority Success Team support</li>
                  ${tx.funding_tier === 'premium' ? '<li>Expedited application processing</li>' : ''}
                </ul>
              </div>
              
              <p style="color: #475569; line-height: 1.8;">Your Success Team will reach out within 24 hours to begin the evaluation process.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://accessyourplace.com/investor" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Your Portal</a>
              </div>
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">Â© ${new Date().getFullYear()} Access Your Place. All rights reserved.</p>
            </div>
          </div>
        `;
        await sendEmail(investor.email, 'Account Funding Confirmed - Access Your Place', emailHtml);
      }

      // Notify success managers
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/manage-staff`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'notify_success_managers',
            notification_type: 'account_funding',
            data: {
              investor_name: investor.full_name,
              investor_email: investor.email,
              amount: tx.amount,
              funding_tier: tx.funding_tier
            }
          })
        });
      } catch (e) {
        console.error('Failed to notify success managers:', e);
      }

      return new Response(JSON.stringify({
        success: true,
        funding_tier: tx.funding_tier,
        addresses_unlocked: newUnlocked,
        is_priority: isPriority
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if investor has access to a specific property address
    if (action === 'check_property_access') {
      const { investor_id, property_id } = body;

      if (!investor_id || !property_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and property ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if investor has funded account
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=account_funded,addresses_unlocked,priority_investor`,
        { headers }
      );
      const investors = await invRes.json();

      if (!investors?.length) {
        return new Response(JSON.stringify({ has_access: false, reason: 'investor_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const investor = investors[0];

      if (!investor.account_funded) {
        return new Response(JSON.stringify({ 
          has_access: false, 
          reason: 'account_not_funded',
          message: 'Fund your account to unlock property addresses'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check specific property access
      const accessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_property_access?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`,
        { headers }
      );
      const access = await accessRes.json();

      if (access?.length > 0) {
        return new Response(JSON.stringify({ 
          has_access: true, 
          is_priority: investor.priority_investor 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if they have remaining unlocks
      const usedAccessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_property_access?investor_id=eq.${investor_id}&select=id`,
        { headers }
      );
      const usedAccess = await usedAccessRes.json() || [];

      const remainingUnlocks = (investor.addresses_unlocked || 0) - usedAccess.length;

      return new Response(JSON.stringify({
        has_access: false,
        reason: remainingUnlocks > 0 ? 'can_unlock' : 'no_unlocks_remaining',
        remaining_unlocks: remainingUnlocks,
        is_priority: investor.priority_investor
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Unlock a specific property address
    if (action === 'unlock_property_address') {
      const { investor_id, property_id } = body;

      if (!investor_id || !property_id) {
        return new Response(JSON.stringify({ error: 'Investor ID and property ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify investor has unlocks available
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investors?id=eq.${investor_id}&select=account_funded,addresses_unlocked`,
        { headers }
      );
      const investors = await invRes.json();

      if (!investors?.length || !investors[0].account_funded) {
        return new Response(JSON.stringify({ error: 'Account not funded' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const usedAccessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_property_access?investor_id=eq.${investor_id}&select=id`,
        { headers }
      );
      const usedAccess = await usedAccessRes.json() || [];

      const remainingUnlocks = (investors[0].addresses_unlocked || 0) - usedAccess.length;

      if (remainingUnlocks <= 0) {
        return new Response(JSON.stringify({ error: 'No address unlocks remaining. Please fund your account for more.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if already unlocked
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/investor_property_access?investor_id=eq.${investor_id}&property_id=eq.${property_id}&select=id`,
        { headers }
      );
      const existing = await existingRes.json();

      if (existing?.length > 0) {
        return new Response(JSON.stringify({ success: true, message: 'Property already unlocked' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create access record
      await fetch(`${SUPABASE_URL}/rest/v1/investor_property_access`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investor_id,
          property_id,
          access_granted_at: new Date().toISOString()
        })
      });

      // Get property details for response
      const propRes = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=address,city,state,zip_code`,
        { headers }
      );
      const properties = await propRes.json();

      return new Response(JSON.stringify({
        success: true,
        remaining_unlocks: remainingUnlocks - 1,
        property: properties?.[0] || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get funding tiers and pricing
    if (action === 'get_funding_tiers') {
      const tiers = [
        {
          id: 'standard',
          name: 'Standard Activation',
          amount: 499,
          addresses_unlocked: 1,
          features: [
            '1 property address unlock',
            'Penny AI market analysis',
            'Success Team support',
            'Standard application processing'
          ]
        },
        {
          id: 'plus',
          name: 'Plus Activation',
          amount: 1500,
          addresses_unlocked: 3,
          features: [
            '3 property address unlocks',
            'Penny AI market analysis',
            'Priority Success Team support',
            'Faster application processing',
            'Dedicated acquisition manager'
          ],
          popular: true
        },
        {
          id: 'premium',
          name: 'Premium Activation',
          amount: 2500,
          addresses_unlocked: 5,
          features: [
            '5 property address unlocks',
            'Penny AI market analysis',
            'VIP Success Team support',
            'Expedited application processing',
            'Dedicated acquisition manager',
            'Priority deal access',
            'Custom SOP consultation'
          ]
        }
      ];

      return new Response(JSON.stringify({ tiers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('process-account-funding error:', error);
    return new Response(JSON.stringify({ error: 'Server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
