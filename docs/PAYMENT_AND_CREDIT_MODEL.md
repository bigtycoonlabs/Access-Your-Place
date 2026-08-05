# Payment & Credit Model — Specification

Source: owner (Vission Cooper), 5 August 2026.
Status: **specification only. None of this flow is built yet.**

No account or routing numbers appear in this document by design. The single
canonical source for payment details is the database table
`"prj_X-ZoVQv6LKXT".company_payment_methods`, which is owner-maintained.
Every surface must read from that table rather than carry its own copy.

---

## Accepted payment rails

Four, all active as of 5 August 2026:

- **Zelle** — primary target is a tag; a bank email fallback exists for banks that reject tags.
- **Wire transfer** — received by the holding company (see corporate structure below).
- **Cash App** — a cashtag.
- **Bitcoin** — mainnet, a single wallet address.

Card processing is **not** used. Stripe has been removed from the platform.
The reason is deliberate and should be stated plainly when asked: transaction
sizes are large, and these rails keep payouts fast and funds unlocked rather
than tied up in processor holds.

---

## Corporate structure — why the wire recipient name differs

Clients wiring funds will see the account name **Cooper Family Inc**, not
Access Your Place. This must be explained proactively, not left to surprise
the client mid-transfer.

Cooper Family Inc is the parent company of **Set Up Your Place LLC**, the
enterprise that owns three platforms: **Access Your Place**, **YP Flow**, and
**YP Labs**. Wires are received by the holding company. That is the whole
explanation, and it should be available on the payment page and from Penny on
request.

---

## Payment confirmation workflow

Because none of these rails posts back automatically, confirmation is
human-in-the-loop by design:

1. Client selects a rail on the payment page and sends funds.
2. Client **attaches a screenshot** of the completed payment to Penny.
3. Penny forwards the submission to staff for confirmation. Penny does not
   confirm payments herself.
4. Staff confirm or reject.
5. On confirmation, the client's **credit balance updates** in their account.

Design consequences:

- Penny's role is intake and routing, never adjudication. She must never tell
  a client their payment is confirmed, credited, or received — only that it
  has been submitted for staff review.
- The submission record must show real state at every step: submitted,
  under review, confirmed, rejected. No optimistic "confirmed" on upload.
- Rejections need a reason the client can act on.

---

## What credits may be spent on

**Allowed:**
- Purchasing deals
- Purchasing property leads
- Other Access Your Place platform services

**Not allowed:**
- Furniture
- Household supplies
- Property deposits
- Application fees
- Landlord rent

The exclusions are the important half. They are all real-world costs that sit
outside the platform, and a client trying to apply credit to them should get a
clear explanation rather than a generic failure. Penny should be able to state
both lists accurately.

---

## Bitcoin address safety rule

**Penny must never recite the Bitcoin wallet address, the Zelle tag, the
cashtag, or the wire account and routing numbers.**

The stored Bitcoin instruction says the address must be copied
character-for-character with nothing altered — and it is right. A language
model reproducing a long address and dropping a single character sends client
funds somewhere unrecoverable. The same class of error on a routing or account
number misdirects a wire.

The rule: Penny may name **which** rails are active, and explain **why** the
company uses them and why the wire recipient is Cooper Family Inc. For any
actual address, tag, wallet, or account number she routes the client to the
payment panel, which renders the value directly from
`company_payment_methods` with copy-to-clipboard.

She states the rail. She never dictates the string.

This matters especially because the platform's owners are blind VoiceOver
users and cannot visually catch a corrupted address in generated text.

---

## Build order

1. Payment method selection surface, reading `company_payment_methods`, with
   copy-to-clipboard per method and the Cooper Family Inc explanation shown on
   the wire option.
2. Screenshot submission and the staff confirmation queue.
3. Credit ledger with the allowed/excluded spend rules enforced server-side.
4. Penny tools: submit a payment proof, check submission status, explain the
   rails and the credit rules — with the recitation rule above enforced in her
   doctrine, not merely in the prompt.
5. Remove Stripe from `PaymentCheckout.tsx`, then from
   `process-acquisition-payment`, `manage-invoices`, `manage-payments`,
   `marketplace-payments`, `process-account-funding`.

Step 5 comes last on purpose: the current checkout is entirely Stripe, so
removing the backend first would leave clients with no way to pay at all.

---

## Known defect to fix alongside this

`manage-setup-tasks` hardcodes a Zelle destination in both the DFY and DIY
client recap emails — the ones quoting the $2,500 and $3,350 fees. That
destination is now the **bank fallback**, not the primary Zelle target.
Clients are receiving outdated payment instructions attached to a fee quote.
Fix by reading `company_payment_methods`.
