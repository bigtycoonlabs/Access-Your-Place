// TOMBSTONED 6 August 2026.
//
// This function created card payment intents against
//     https://stripe.gateway.fastrouter.io/payments/payment-intents
// using a GATEWAY_API_KEY secret.
//
// THE OWNER HAS CONFIRMED THAT GATEWAY IS NOT HIS. It is leftover code. That means this
// endpoint was capable of sending a client's card payment to a third party nobody at this
// company controls, from live investor screens.
//
// It also contradicted a decision already made: card processing was retired, and the
// platform's rails are Zelle, wire transfer, Cash App and Bitcoin only.
//
// Checked before tombstoning: ZERO payment intents exist across all eight tables that
// record one — account_funding_transactions, acquisition_payments, deal_transactions,
// funding_payments, marketplace_payments, payment_transactions, invoices and
// property_assignments. No client money appears to have gone through it.
//
// Returning 410 rather than deleting, because Supabase has no delete for edge functions
// and a tombstone is honest about what happened. Payments are handled by the payment-link
// flow Penny generates, against the real rails.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'gone',
      message:
        'This card payment endpoint has been retired. Access Your Place takes payment by Zelle, wire transfer, Cash App and Bitcoin. Ask Penny for a payment link, or open the Payments tab.',
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    },
  )
);
