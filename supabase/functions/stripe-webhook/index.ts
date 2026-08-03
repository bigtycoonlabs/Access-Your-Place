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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Get the raw body for signature verification
    const rawBody = await req.text();
    let event;

    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      console.error('Failed to parse webhook body:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Received Stripe webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);

        const metadata = paymentIntent.metadata || {};
        const amountReceived = paymentIntent.amount_received / 100; // Convert from cents

        // Check if this is an account funding payment
        if (metadata.investor_id && (metadata.funding_type || metadata.invoice_number)) {
          console.log('Processing account funding for investor:', metadata.investor_id);

          // Call process-account-funding to confirm the payment
          try {
            const confirmRes = await fetch(`${SUPABASE_URL}/functions/v1/process-account-funding`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'confirm_funding',
                investor_id: metadata.investor_id,
                payment_intent_id: paymentIntent.id
              })
            });

            const confirmData = await confirmRes.json();
            console.log('Account funding confirmation result:', confirmData);
          } catch (e) {
            console.error('Failed to confirm account funding:', e);
          }
        }

        // Check if this is an invoice payment
        if (metadata.invoice_number) {
          console.log('Processing invoice payment:', metadata.invoice_number);

          try {
            const invoiceRes = await fetch(`${SUPABASE_URL}/functions/v1/manage-invoices`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'mark_paid',
                payment_intent_id: paymentIntent.id,
                invoice_number: metadata.invoice_number,
                paid_amount: amountReceived
              })
            });

            const invoiceData = await invoiceRes.json();
            console.log('Invoice payment result:', invoiceData);

            // If invoice was for account funding, also process that
            if (invoiceData.investor_id && metadata.invoice_type === 'account_funding') {
              await fetch(`${SUPABASE_URL}/functions/v1/process-account-funding`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'confirm_funding',
                  investor_id: invoiceData.investor_id,
                  payment_intent_id: paymentIntent.id
                })
              });
            }
          } catch (e) {
            console.error('Failed to mark invoice as paid:', e);
          }
        }

        // Log the successful payment
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/payment_webhook_logs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              event_type: event.type,
              event_id: event.id,
              payment_intent_id: paymentIntent.id,
              amount: amountReceived,
              currency: paymentIntent.currency,
              metadata: metadata,
              status: 'processed',
              processed_at: new Date().toISOString()
            })
          });
        } catch (e) {
          // Log table might not exist, that's okay
          console.log('Could not log webhook event (table may not exist)');
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('Payment failed:', paymentIntent.id);

        const metadata = paymentIntent.metadata || {};

        // Update transaction status if exists
        if (metadata.investor_id) {
          try {
            await fetch(
              `${SUPABASE_URL}/rest/v1/account_funding_transactions?payment_intent_id=eq.${paymentIntent.id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  status: 'failed',
                  updated_at: new Date().toISOString()
                })
              }
            );
          } catch (e) {
            console.error('Failed to update transaction status:', e);
          }
        }

        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object;
        console.log('Charge succeeded:', charge.id);

        // If charge has payment_intent, the payment_intent.succeeded event will handle it
        if (!charge.payment_intent) {
          // Handle direct charges without payment intent
          const metadata = charge.metadata || {};
          if (metadata.invoice_number) {
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/manage-invoices`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'mark_paid',
                  invoice_number: metadata.invoice_number,
                  paid_amount: charge.amount / 100
                })
              });
            } catch (e) {
              console.error('Failed to mark invoice as paid:', e);
            }
          }
        }

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('Charge refunded:', charge.id);

        // Update invoice status if applicable
        const metadata = charge.metadata || {};
        if (metadata.invoice_number) {
          try {
            await fetch(
              `${SUPABASE_URL}/rest/v1/invoices?invoice_number=eq.${metadata.invoice_number}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  status: 'refunded',
                  updated_at: new Date().toISOString()
                })
              }
            );
          } catch (e) {
            console.error('Failed to update invoice status:', e);
          }
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Subscription event:', event.type, subscription.id);

        // Handle subscription events if needed
        const metadata = subscription.metadata || {};
        if (metadata.investor_id) {
          try {
            await fetch(
              `${SUPABASE_URL}/rest/v1/investors?id=eq.${metadata.investor_id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  subscription_id: subscription.id,
                  subscription_status: subscription.status,
                  updated_at: new Date().toISOString()
                })
              }
            );
          } catch (e) {
            console.error('Failed to update investor subscription:', e);
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('Subscription cancelled:', subscription.id);

        const metadata = subscription.metadata || {};
        if (metadata.investor_id) {
          try {
            await fetch(
              `${SUPABASE_URL}/rest/v1/investors?id=eq.${metadata.investor_id}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  subscription_status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
              }
            );
          } catch (e) {
            console.error('Failed to update investor subscription:', e);
          }
        }

        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Return success response
    return new Response(JSON.stringify({ received: true, event_type: event.type }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
