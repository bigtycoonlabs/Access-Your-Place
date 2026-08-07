# Credits, acquisition cost, and Property Forge

The money rules, as the owner described them on 6 August 2026.

## Who can pay with what

**An Access Your Place approved deal can be covered entirely by credits.** If the client
holds enough, there is nothing to pay.

**A third-party sale is 80% seller, 20% platform. Credits may only be applied to our
20%.** The seller's 80% must be cash. Credits are not money we can hand to a seller — they
are a balance on our own books.

Encoded once in `public.ayp_acquisition_quote(property_id, investor_id)`. One function, so
a chat surface, a payment screen and a receipt cannot arrive at three different figures for
the same deal.

Worked example, a $5,000 deal and a client holding $6,000 in credits:

- **AYP approved:** credits cover all $5,000. Cash due $0.
- **Third-party:** seller takes $4,000 cash, our share is $1,000, credits cover that
  $1,000. **Cash due $4,000** — even though the client holds more credits than the deal
  costs.

**If no acquisition cost is recorded, the quote REFUSES.** It says a staff member must set
the price. A quote with an invented number is worse than no quote.

## Property Forge

- Fund **$1,250** to use it. That grants **up to 20 property releases**.
- Searching is free and shows **soft data only**.
- A **release** shows full detail and landlord contact, and burns one of the 20. The
  client's balance updates on each release they agree to.
- The client can keep searching without releasing.

## The negotiation balance

When a client wants AYP to negotiate on their behalf, they pay the remaining **$1,250** —
**$2,500 total**. They may instead negotiate themselves.

Pricing lives in `ayp_pricing` rather than in code, so a rate change is a row and not a
deploy.

## The two payments, settled

**First $1,250 — funding.** The minimum to start with Access Your Place. It buys up to 20
property releases, each opening full detail AND the landlord's contact.

It does two things beyond paying for releases, and both are the point:

- It verifies the person actually has capital for an opportunity, before our time goes
  into them.
- The remaining balance is what keeps a client engaged — they either want to finish it out,
  or they come back when a negotiation stalls.

**A self-negotiating client needs nothing more.** Twenty addresses, contacts included, and
they can approach every landlord themselves.

**Second $1,250 — negotiation, and only after it worked.** Due when an acquisition manager
has actually negotiated, we have verified the landlord is willing to sign a corporate
lease, and the client wants our team to finalise paperwork and get them keys. Especially on
a master lease.

$2,500 total.

**The timing is enforced, not incidental.** It becomes due AFTER the AM succeeded, never
before. Charging it up front would be selling an outcome we have not delivered, and this
company's whole position is that it does not do that.

## Implemented

- `ayp_forge_status(investor_id)` — funded or not, releases used, releases left, in words.
- `ayp_release_property(investor_id, property_id, staff_id, idempotency_key)` — opens full
  detail and landlord contact, burns one release.

Verified by calling:

- An unfunded client is refused, and told searching stays free until they fund.
- A funded client releases, sees the landlord contact, and is told 19 remain and that they
  can negotiate it themselves at no further cost.
- **Releasing the same property twice does NOT burn a second release.** Still 1 used, 19
  left. Charging twice for the same address would be theft by bookkeeping.
- All test data removed and funding restored to 0.
