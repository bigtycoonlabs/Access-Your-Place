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

## OPEN QUESTION — not built, deliberately

There is one ambiguity in the spec and it concerns money, so it has not been guessed at.

The owner said both of these:

1. "Only if the user wants full details and contact details for the landlord should the
   property be released and their credit amount updated."
2. "When they confirm that they would like contact details to make outreach... they will
   need to pay the remainder $1,250."

These can be read two ways:

- **(a)** A release burns one of the 20 AND shows contact details. The second $1,250 is
  only for AYP negotiating on their behalf.
- **(b)** A release burns one of the 20 and shows full detail, but contact details are a
  separate gate that costs the second $1,250 whether or not AYP negotiates.

The difference decides whether a funded client can contact landlords themselves for
$1,250 or $2,500. That is the client's core economics, and getting it wrong either
undercharges every self-negotiating client or overcharges them.

**Answer needed before the release flow is built.**
