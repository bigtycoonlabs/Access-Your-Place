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

const GATEWAY_API_KEY = Deno.env.get('GATEWAY_API_KEY');
const GATEWAY_BASE_URL = 'https://stripe.gateway.fastrouter.io';

interface PaymentRequest {
  action: string;
  listing_id?: string;
  investor_id?: string;
  payment_type?: 'verification' | 'report' | 'full_transaction' | 'escrow_deposit';
  amount?: number;
  customer_email?: string;
  customer_name?: string;
  metadata?: Record<string, string>;
  transaction_id?: string;
}

// Fee structure
const FEES = {
  verification: 10000, // $100 in cents
  report: 9900, // $99 in cents
  transaction_percentage: 0.20 // 20%
};

async function makeGatewayRequest(endpoint: string, method: string, body?: any) {
  const response = await fetch(`${GATEWAY_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': GATEWAY_API_KEY || ''
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Gateway request failed: ${response.status}`);
  }
  return data;
}

async function getOrCreateCustomer(email: string, name?: string): Promise<string> {
  // Check if customer exists
  const customers = await makeGatewayRequest(`/payments/customers?email=${encodeURIComponent(email)}`, 'GET');
  
  if (customers.data?.length > 0) {
    return customers.data[0].id;
  }

  // Create new customer
  const newCustomer = await makeGatewayRequest('/payments/customers', 'POST', {
    email,
    name: name || email.split('@')[0],
    metadata: { source: 'deal_marketplace' }
  });

  return newCustomer.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: PaymentRequest = await req.json();
    const { action, listing_id, investor_id, payment_type, amount, customer_email, customer_name, metadata, transaction_id } = payload;

    if (!GATEWAY_API_KEY) {
      throw new Error('Payment gateway not configured');
    }

    // Create PaymentIntent for one-time fees (verification, report)
    if (action === 'create_payment_intent') {
      if (!payment_type || !customer_email) {
        throw new Error('Missing required fields: payment_type, customer_email');
      }

      let paymentAmount: number;
      let description: string;

      switch (payment_type) {
        case 'verification':
          paymentAmount = FEES.verification;
          description = 'Deal Verification Fee';
          break;
        case 'report':
          paymentAmount = FEES.report;
          description = 'Verification Report Release';
          break;
        case 'full_transaction':
          if (!amount) throw new Error('Amount required for full transaction');
          paymentAmount = Math.round(amount * FEES.transaction_percentage * 100); // Convert to cents
          description = 'Full Transaction Management Fee (20%)';
          break;
        case 'escrow_deposit':
          if (!amount) throw new Error('Amount required for escrow deposit');
          paymentAmount = amount * 100; // Full amount in cents
          description = 'Escrow Deposit for Deal Purchase';
          break;
        default:
          throw new Error('Invalid payment type');
      }

      // Get or create customer
      const customerId = await getOrCreateCustomer(customer_email, customer_name);

      // Create PaymentIntent
      const paymentIntent = await makeGatewayRequest('/payments/payment-intents', 'POST', {
        amount: paymentAmount,
        currency: 'usd',
        customer: customerId,
        description,
        metadata: {
          listing_id: listing_id || '',
          investor_id: investor_id || '',
          payment_type,
          transaction_id: transaction_id || '',
          ...metadata
        }
      });

      return new Response(JSON.stringify({
        success: true,
        client_secret: paymentIntent.clientSecret,
        payment_intent_id: paymentIntent.id,
        amount: paymentAmount,
        customer_id: customerId
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check payment status
    if (action === 'check_payment_status') {
      const { payment_intent_id } = payload;
      if (!payment_intent_id) {
        throw new Error('Missing payment_intent_id');
      }

      const paymentIntent = await makeGatewayRequest(`/payments/payment-intents/${payment_intent_id}`, 'GET');

      return new Response(JSON.stringify({
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        metadata: paymentIntent.metadata
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create escrow payment for full transaction management
    if (action === 'create_escrow_payment') {
      const { buyer_email, buyer_name, seller_id, sale_price } = payload;
      
      if (!buyer_email || !sale_price) {
        throw new Error('Missing required fields');
      }

      const customerId = await getOrCreateCustomer(buyer_email, buyer_name);

      // Create PaymentIntent for full sale price (held in escrow)
      const paymentIntent = await makeGatewayRequest('/payments/payment-intents', 'POST', {
        amount: sale_price * 100, // Convert to cents
        currency: 'usd',
        customer: customerId,
        capture_method: 'manual', // Hold funds, don't capture immediately
        description: `Escrow for Deal Purchase - Listing ${listing_id}`,
        metadata: {
          listing_id: listing_id || '',
          buyer_id: investor_id || '',
          seller_id: seller_id || '',
          payment_type: 'escrow',
          sale_price: sale_price.toString(),
          ayp_fee: Math.round(sale_price * FEES.transaction_percentage).toString()
        }
      });

      return new Response(JSON.stringify({
        success: true,
        client_secret: paymentIntent.clientSecret,
        payment_intent_id: paymentIntent.id,
        amount: sale_price * 100,
        escrow_amount: sale_price,
        ayp_fee: Math.round(sale_price * FEES.transaction_percentage),
        seller_receives: Math.round(sale_price * (1 - FEES.transaction_percentage))
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Release escrow funds to seller (after all documents signed)
    if (action === 'release_escrow') {
      const { payment_intent_id, release_amount } = payload;
      
      if (!payment_intent_id) {
        throw new Error('Missing payment_intent_id');
      }

      // Capture the payment (this releases funds from hold)
      // Note: In a real implementation, you'd transfer funds to the seller's connected account
      // For now, we capture and track the release
      
      const capture = await makeGatewayRequest(`/payments/payment-intents/${payment_intent_id}/capture`, 'POST', {
        amount_to_capture: release_amount ? release_amount * 100 : undefined
      });

      return new Response(JSON.stringify({
        success: true,
        status: 'released',
        captured_amount: capture.amount_captured,
        message: 'Funds released to seller'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Refund escrow to buyer (if transaction fails)
    if (action === 'refund_escrow') {
      const { payment_intent_id, reason } = payload;
      
      if (!payment_intent_id) {
        throw new Error('Missing payment_intent_id');
      }

      // Cancel the PaymentIntent (releases the hold without capturing)
      const cancel = await makeGatewayRequest(`/payments/payment-intents/${payment_intent_id}/cancel`, 'POST', {
        cancellation_reason: reason || 'requested_by_customer'
      });

      return new Response(JSON.stringify({
        success: true,
        status: 'refunded',
        message: 'Escrow funds returned to buyer'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Process refund for completed payment
    if (action === 'process_refund') {
      const { payment_intent_id, refund_amount, reason } = payload;
      
      if (!payment_intent_id) {
        throw new Error('Missing payment_intent_id');
      }

      const refund = await makeGatewayRequest('/payments/refunds', 'POST', {
        payment_intent: payment_intent_id,
        amount: refund_amount ? refund_amount * 100 : undefined,
        reason: reason || 'requested_by_customer'
      });

      return new Response(JSON.stringify({
        success: true,
        refund_id: refund.id,
        status: refund.status,
        amount: refund.amount
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get fee breakdown for a transaction
    if (action === 'calculate_fees') {
      const { sale_price } = payload;
      
      if (!sale_price) {
        throw new Error('Missing sale_price');
      }

      const aypFee = Math.round(sale_price * FEES.transaction_percentage);
      const sellerReceives = sale_price - aypFee;

      return new Response(JSON.stringify({
        success: true,
        sale_price,
        ayp_fee: aypFee,
        ayp_fee_percentage: FEES.transaction_percentage * 100,
        seller_receives: sellerReceives,
        verification_fee: FEES.verification / 100,
        report_fee: FEES.report / 100
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // List payments for an investor
    if (action === 'list_payments') {
      const charges = await makeGatewayRequest(`/payments/charges?limit=50`, 'GET');
      
      // Filter by investor_id in metadata if provided
      const filteredCharges = investor_id 
        ? charges.data?.filter((c: any) => 
            c.metadata?.investor_id === investor_id || 
            c.metadata?.buyer_id === investor_id ||
            c.metadata?.seller_id === investor_id
          )
        : charges.data;

      return new Response(JSON.stringify({
        success: true,
        payments: filteredCharges || []
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Payment error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
