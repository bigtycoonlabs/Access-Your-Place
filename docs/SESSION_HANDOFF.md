# Session Handoff — Access Your Place

Written 5 August 2026 at the end of a long working session, so the next session
starts from fact rather than from scratch.

**Read this first, then read the last 14 commit messages** (`git log -14`).
Those messages carry the full reasoning deliberately — they are the real record,
not this summary.

---

## The one job to do first

Deploy `penny-staff-chat`. Everything built in the last session is inert until
this happens.

```
supabase functions deploy penny-staff-chat --project-ref adcbrclppmnguzkzwiys
```

**Why the CLI and not the Supabase MCP:** the MCP's `deploy_edge_function`
takes the file *contents* as a parameter, meaning the assistant must reproduce
76KB / 1,156 lines verbatim. A truncated call is harmless (invalid JSON, never
executes), but a *transcription slip* produces a valid call that deploys
subtly wrong code over a live function staff use daily. The CLI copies bytes
from disk. No transcription, no risk.

**If the CLI genuinely isn't available**, a fresh session may attempt the MCP
deploy, but must then verify rather than assume:
1. `deploy_edge_function` with the full file.
2. `get_edge_function` to read back what actually landed.
3. Diff the returned content against `supabase/functions/penny-staff-chat/index.ts`.
4. If they differ in any way, say so plainly and redeploy. Do not report success
   on an unverified deploy.

Local file reference: md5 `8d41eb282ef7b916e9cac68bcfb5a380`, parses clean with
`npx esbuild index.ts --outfile=/dev/null` (note: `--loader=ts` without an
extension silently does nothing — that produced a false pass once already).

**After deploying, verify behaviourally:** open Penny staff chat as Vission or
Rel and check she addresses you as an owner — leads with problems, doesn't
hand-hold. If she behaves as before, the deploy didn't take.

---

## Project facts

- Supabase project ref: `adcbrclppmnguzkzwiys`. Data schema: `prj_X-ZoVQv6LKXT`
  (281 tables). Every edge function carries a fetch shim setting
  Accept-Profile / Content-Profile to that schema.
- Repo: `bigtycoonlabs/Access-Your-Place`, deploys front-end via Railway on push.
- 163 function directories in repo; 161 were mirrored verbatim from live, plus
  `get-payment-methods` and `manage-payment-proofs` (new), minus `stripe-webhook`
  (deleted).
- `pg_cron` is **not installed**. Only `pg_net`. There is no scheduler, which is
  why several "dangerous scheduled job" findings turned out to have never run.
- The MCP has `deploy_edge_function` but **no delete**. Retiring a function means
  deploying a tombstone that returns HTTP 410.

---

## Scale — read this before assuming anything is big

21 properties. 34 investors. 1 resident. 154 property photos. 47 blog articles
(newest Dec 2025). 9 AM agreements, 5 signed. **9,544 investor invitations.**
Zero email campaigns, zero digital products, zero seller documents, zero draft
articles, zero SMS ever sent, zero completed payments.

The centre of gravity is deal flow and invitations. Most surrounding subsystems
have never been used. Do not size work by code volume.

---

## What is LIVE right now

- `get-payment-methods` (v1) — the only sanctioned read path for payment rails.
  Reads `company_payment_methods` where `is_active`. Fails loudly rather than
  returning a partial list.
- `manage-payment-proofs` (v1) — submit / list_mine / list_pending / review.
  Exactly-once, concurrency-safe claim, server-side staff verification,
  staff-verified amounts, honest partial-failure reporting.
- `PaymentMethodPanel` wired into the investor portal Payments tab (front-end;
  live once Railway deploys the push).
- Four tombstoned to HTTP 410: `weekly-market-data-refresh`,
  `scheduled-report-generation`, `submit-resident-request`,
  `manage-resident-portal`. Plus `env-probe`, already 410 previously.

## What is BUILT but NOT deployed

- `penny-staff-chat` — owner status threaded into the composed prompt. **The job above.**
- `upload-payment-proof` — private screenshot storage. Committed, esbuild-clean,
  small enough (~7KB) to deploy safely via MCP.
- The entire `_shared/penny/` spine — **78 tests passing**, imported by **zero**
  live functions.

---

## Penny: current reality

**The spine is not wired to anything.** `_shared/penny/` (capability, doctrine,
compose, executor, tools) is careful, tested work that no live function imports.
Every Penny function carries its own inline logic. This is good news: the design
is done, only the wiring is missing.

**What she can do today:** `penny-staff-chat` (1,136 lines, gpt-4o direct) has 21
working tools — find_client, check_account, get_client_activity,
get/list_opportunities, get/list_communities, list_escalations,
list_pending_emails, get_activity_report, add_opportunity_note,
update_opportunity_status, update_community, record_closing, resolve_escalation,
compose_client_email, send_client_email, send_account_invite, invite_staff.

`penny-public-chat` has **no tools at all** — pure conversation.
`penny-landlord-chat` is repo-only, not deployed (owner chose to keep it).

**Added last session, pending deploy/wiring:**
- `owner` role in `ROLES` and `STAFF_ROLES`; `isOwner()`; wider budgets
  (10 turns / 14 tool calls vs 6 / 8).
- `PENNY_OWNER_POSTURE` — don't withhold, lead with bad news, skip hand-holding.
  Tested to also assert confirmation is NOT removed, and that a request to skip
  confirmation is not authority to skip it.
- `PENNY_PAYMENT_DOCTRINE` — pushed on **every** surface including public.
- `containsPaymentDestination()` — enforceable guard catching both a correctly
  reproduced destination and a **corrupted** one. The corrupted case is the
  dangerous one; exact-match alone would wave through the address that loses
  the money.

**Next Penny step after the deploy:** repoint `penny-staff-chat` at
`_shared/penny/` instead of its inline prompt. That is what makes 78 tests
govern real behaviour.

---

## Payments — the model

Four rails, all active in `company_payment_methods` (owner-maintained; treat as
the single source of truth): **Zelle**, **wire**, **Cash App**, **Bitcoin**.
**No card processing. Stripe is out** — owner decision, and every Stripe-backed
table is empty, so nothing was ever processed.

Wires are received by **Cooper Family Inc**, parent of Set Up Your Place LLC,
which owns Access Your Place, YP Flow and YP Labs. Clients must be told this
*before* they send, not after.

**Flow:** client sends funds → attaches screenshot → Penny routes to staff →
staff confirm → credit balance updates. Penny **intakes and routes; she never
adjudicates**. She must never say a payment is confirmed or received.

**Credits may buy:** deals, property leads, other AYP platform services.
**Credits may not buy:** furniture, household supplies, property deposits,
application fees, landlord rent. Explain the line rather than just refusing —
clients reasonably assume these are covered.

**Hard rule:** never recite a Bitcoin address, Zelle tag, cashtag, or wire
account/routing number. Name the rail, point to the payment panel's copy button.
One wrong character sends money somewhere unrecoverable, and the owners are
blind and cannot visually catch it.

Bank details live **only** in `company_payment_methods` — deliberately never in
repo files or commit messages. Verified absent from the repo.

---

## Owner context

Vission Cooper and Rel Cooper. Both `is_owner = true` in `staff_users`. **Both
are blind VoiceOver users.** This is not a footnote — it drives real decisions:

- Output should be linear speakable prose. No tables, no dense formatting.
- Read numbers back aloud for verification when writing them somewhere the owner
  can't visually check.
- Honest uncertainty beats confident error, always. A confidently wrong answer
  cannot be caught by glancing at the screen.
- Copy buttons over recited strings, with `aria-live` announcements, 44px targets,
  and accessible names that say *what* is being copied.

Owner grants standing permission for coherent, safety-positive commits without
per-step confirmation. Owner prefers being told what can't be done over having
it attempted badly.

---

## Still open, owner-actioned

1. **Delete 5 tombstoned slugs** from the Supabase dashboard (MCP cannot delete):
   the four above plus `env-probe`. They are inert, not absent.
2. **Close the live Stripe account.** `PaymentCheckout.tsx` line 17 hardcodes a
   live publishable key (`pk_live_51OJhJB…`). Publishable keys are not secrets,
   but it confirms a live account exists — close it so no fees accrue.

## Still open, engineering

Ordered by value:

1. Repoint `penny-staff-chat` at the shared spine.
2. Client payment-submission UI + staff confirmation queue, against the two
   live functions.
3. **Fix `manage-setup-tasks`** — hardcodes `Zelle to admin@cooperfamilyinc.net`
   in the DFY/DIY client emails quoting $2,500 and $3,350. That is now the bank
   *fallback*; the primary is the tag `@payayp`. Clients are getting outdated
   payment instructions attached to a fee quote. Should read
   `company_payment_methods`.
4. **`process-followups` is a stub** — `process_all` returns "no pending
   followups" without reading anything, yet **5 rules exist** that staff built and
   believe are firing. Either build the executor or remove the UI tab. Ask the
   success team whether they've been relying on it.
5. **AM e-signature has no authentication.** `sign_agreement` in
   `send-investor-invitation`: anyone with an `agreement_id` can sign, and
   `signature_ip`/`user_agent` come from the request body then get hashed — the
   hash certifies attacker-controlled data. **9 agreements, 5 signed.**
6. **Staff can self-promote to 100% commission.** `update_trainee_progress`
   accepts pillar counts from the body with no identity check, then auto-flips
   `yp_certified` and `commission_split: 100`.
7. **Wrong legal entity on receipts.** `process-acquisition-payment` sends
   receipts with the wrong entity, address, and a dead-domain support email. The
   correct block already exists inside `send-acquisition-emails` — copy it,
   don't write a third version.
8. Remove Stripe from `PaymentCheckout.tsx`, then from `process-acquisition-payment`,
   `manage-invoices`, `manage-payments`, `marketplace-payments`,
   `process-account-funding`. **Only after** the new payment flow is complete —
   the current checkout is 100% Stripe, so cutting the backend first leaves
   clients with no way to pay.
9. Consolidation: five property-write paths, four `blog_articles` writers, two
   investor tables (`investors` vs `investor_profiles`), eight sender addresses,
   two AI stacks (Penny on OpenAI gpt-4o; four functions on gemini via
   `fastrouter.io`).

---

## The pattern worth carrying forward

The most common defect on this platform is not a crash — it is **a function that
reports success while doing nothing**. Confirmed instances: a follow-up executor
that reads nothing, SMS delivery callbacks pointed at a dead host
(`databasepad.com`, the previous backend), invitations marked "delivered" on API
acceptance, photos marked "processed" that were never modified, and four
separate places that invent numbers rather than admit they have none.

This matters more here than elsewhere because the owners cannot glance at a
screen and notice that a green checkmark is lying.

**Two in-house functions get it right and are the pattern to copy:**
`notify-matching-investors` (counts only sends that actually returned OK; reports
matched / notified / emailed / excluded separately) and `submit-deal-inquiry`
(records "notified" or "NOT notified (email failed)" — the truth either way).

**Rule going forward: no function becomes a Penny tool until it reports what
actually happened.**
