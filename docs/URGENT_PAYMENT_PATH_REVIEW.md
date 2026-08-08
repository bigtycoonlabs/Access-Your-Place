# Live card-payment path still active — needs an owner decision

Found in a bug sweep, 6 August 2026. **Not changed. This is a live money path and the
decision is commercial, not technical.**

## What is live right now

The Bible records that **Stripe was removed by owner decision** and that the platform uses
**Zelle, wire transfer, Cash App and Bitcoin only — no card processing**.

The shipped front-end contradicts that.

**A live Stripe publishable key (`pk_live_51OJhJB…`) is hardcoded in five components**, and
four of them render on live investor screens:

| Component | Rendered by | Reachable by a client |
|---|---|---|
| `MarketplacePaymentCheckout` | `DealMarketplace` | yes |
| `PaymentCheckout` | `AcquisitionsTracker` | yes |
| `StartAcquisitionModal` | `MyDealsSection` | yes |
| `AccountCredits` | `InvestorPortal` | yes |
| `AccountFunding` | nothing | no |

So a client browsing the marketplace can still be shown a card form.

## Where the money actually goes

Not to `api.stripe.com`. Card charges are created against:

```
https://stripe.gateway.fastrouter.io/payments/payment-intents
```

authenticated with a `GATEWAY_API_KEY` secret, in both
`process-acquisition-payment` and `marketplace-payments`.

That is a **third-party gateway domain**, not Stripe directly.

`process-acquisition-payment` also carries a default charge of **`amount || 49900`** —
$499.00 — used when no amount is supplied.

## Why this is being raised rather than fixed

Three reasons, and they all point the same way:

1. **It contradicts a decision already made.** Card processing was retired; the code still
   offers it.
2. **The money does not go where the code's name implies.** Whether
   `stripe.gateway.fastrouter.io` is a gateway the owner set up deliberately, or something
   that should not be there, is a question only the owner can answer. I have no way to
   verify it from here and will not guess about a payment destination.
3. **Disabling four client-facing payment screens is not a bug fix.** It could interrupt a
   client mid-payment, and it has refund and reconciliation consequences.

## What is needed from the owner

1. **Is `stripe.gateway.fastrouter.io` yours?** If it is not, this is urgent and the
   `GATEWAY_API_KEY` should be rotated immediately.
2. If card processing is genuinely retired, the four screens should stop offering it and
   point at the payment-link flow Penny now generates instead.
3. The live Stripe account should be closed, as already noted in the Bible.

## What was verified while looking

- **No secret leaked into the shipped bundle.** The only JWT is the anon key, which is meant
  to be public. No service-role key, no OpenAI key, no Resend key, no GitHub token, no
  Supabase access token.
- A publishable Stripe key is *designed* to be public, so its presence is not itself a leak —
  the issue is that it is wired to a working payment path that was supposed to be retired.
