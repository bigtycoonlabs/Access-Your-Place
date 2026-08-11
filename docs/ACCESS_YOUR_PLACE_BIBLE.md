# The Access Your Place Bible

**Rewritten 11 August 2026.** Everything here was read out of the running system, not
remembered. Where something is broken it says so. Where something is unfinished it says that
too. A reference that flatters this codebase is worse than none, because the platform's
signature defect is reporting success while doing nothing.

---

## 1. What the company is

Access Your Place is a rental arbitrage acquisition practice. It finds furnished and flexible
rental opportunities, vets them personally, negotiates with the landlord, and hands an
operator a deal ready to sign. It also buys and sells existing operations.

It is not a property manager. The operator runs their own operation.

### The team

Called the Success Team.

**Admin** — compliance, legal, issue resolution, customer support, documents out on time.
15% per deal.

**Setup Manager** — sources furniture and supplies, matches clients with vendors on the
ground, manages the pros at each launch, takes inventory as product arrives, keeps the client
file current. 15% on an already-furnished deal, flat $1,500 on a full project launch.

**Acquisition Manager** — finds deals, contacts landlords, runs the numbers, negotiates, runs
discovery and closing calls. 15% for closing the client, 15% for finding the property, up to
30%.

**The constraint is leads.** Acquisition managers leave because there are not enough to feed
them. Judge everything against whether it brings leads in or frees the owner to train.

### Client referrals
$300 cash or credit when a referral closes.

### Third-party sales
Seller takes 80%, platform takes 20% of the acquisition listing cost. Half the seller payout
is held until the lease is signed with the new operator.

---

## 2. Verification tiers — the most important concept here

Two tiers. Never present them as the same thing.

**`penny_scan`** — calculated from an address. Nobody has spoken to the landlord. This is what
Property Forge returns when a user sources their own deal. **It is a lead, not an Access Your
Place deal.**

**`ayp_verified`** — a human has spoken to the landlord, validated the numbers, confirmed the
landlord consents to marketing, and pre-negotiated terms. **For a third-party operation being
sold, the test is different:** the operation, the supplies, the furniture and which vendors
stay have all been evaluated.

Computed by `public.ayp_verification_tier(property_id)` from evidence columns. One definition,
one place.

**Recording evidence:** `ayp_record_verification(property_id, staff_id, ...)`. It requires an
active staff member — the claim needs a name against it. It refuses to round up: if a property
still falls short it says so rather than claiming the tier.

**Current state: both live properties genuinely compute as `ayp_verified`.** That is new. For
most of this platform's life, listings carried an `is_verified` badge with no evidence behind
it — twelve at once, at one point. The public view now **derives** the badge from the evidence
rather than reading the stored flag, so a badge cannot outlive what justified it.

---

## 3. The three publish signals

**Read this before changing what is listed.** A property is "live" according to three columns
that can and do disagree:

- `is_published` — boolean
- `status` — `published` / `active` / `approved` versus `unpublished` / `sold`
- `workflow_stage` — `published` / `discovery` / `new_lead` / `approved`

**The public deals page trusts `workflow_stage`.** When the marketplace was emptied on the
owner's instruction, the first two were cleared, the result verified through two functions,
and it was reported done. Eighteen listings stayed up because `workflow_stage` was untouched.

`public.ayp_publish_signal_conflicts()` reports disagreement in words. Run it after any change.

---

## 4. Public data — what a stranger may see

**`public.marketplace_public`** is the only thing public pages read. Absent **by
construction**, not nulled downstream:

`address`, `landlord_name`, `landlord_phone`, `landlord_email`, `original_url`,
`processed_url`, `source`

The last three matter and get restored by accident: **a link to the source listing is the
address, one click later.**

Nulling a field in the browser is not privacy. The value is already on the wire for anyone who
opens devtools. Addresses leaked on **three separate fetch paths** before this was closed, and
each was fixed a round apart because "I fixed the leak" was true of one query and not the page.

**`get-properties`** strips the same six fields server-side for any non-staff caller, on both
its list and by-id branches.

**Still open:** `anon` can SELECT `public.properties` directly. 62 browser call sites read it
and staff screens act as `anon`, so revoking needs a walk-every-caller sweep first.

---

## 5. Penny

One Penny across every surface. Aware everywhere, gated per surface. Awareness is prompt-level;
permission is code-level. Telling her a tool exists cannot grant her the ability to run it.

**Surfaces:** `penny-staff-chat` (75 tools), `ai-investor-chat` (operator), `penny-public-chat`,
`penny-landlord-chat`, `penny-market-scan`, `penny-research-market`.

### Tool schemas have hard limits
Description ≤ 1024 chars, name ≤ 64, ≤ 128 tools. **One over-long description rejects the
entire tools payload with a 400** — Penny then answers with no tools at all and says they are
unavailable. This happened and took three rounds to find because the 400 body was never
logged. `scripts/check-tool-schemas.mjs` guards it; run it after touching any schema.

### Tools are gated by seat
A setup manager does not approve listings, invite staff or publish articles. Sending those
schemas spends the token budget describing work they cannot do — and a real 429 followed
(30,000 tokens/minute; all 75 schemas are ~10,700 on their own). Owners are never restricted.

### Doctrine that exists because it was violated

**Agreeing is not doing.** Asked to remove a test lead, she said "got it, we'll skip the
email" and changed nothing.

**Never describe a record you did not write.** She reported an $8,000 deal listed with all
figures. Nothing was written — the tool had no field for asking price, so she dropped it
silently and confirmed anyway. Report what the tool says it saved, not what you were told.

**Do not send somebody to a tab for something you can do.** She redirected a colleague to
"List a Deal" while holding the tool that needed three fields.

**Never raise payment destinations unprompted.** She volunteered a payment refusal to a
marketplace question. Phone numbers are now stripped before any destination shape is tested —
a phone number is not a payment destination.

**Never recite a payment destination.** Not a Bitcoin address, Zelle tag, cashtag, wire or
routing number. Name the rail, point at the Payments tab. One wrong character sends money
somewhere unrecoverable.

---

## 6. Platform facts that bite

**PostgREST serves only the `public` schema.** Any request sending
`Accept-Profile: prj_X-ZoVQv6LKXT` is rejected.

**Adding a column is not enough** — the matching public view must expose it or nothing can
read or write it.

**A new view is invisible to PostgREST until its schema cache reloads.** It exists, it is
granted, it returns rows, and the REST API 404s it. `notify pgrst, 'reload schema';`

**Creating a Postgres function only proves it parses.** Wrong column names, violated check
constraints and bad foreign keys all survive creation and fail on the first call.
`ayp_record_verification` wrote to `verification_note` (the column is `verification_notes`)
and threw weeks after being declared ready.

**Ask what a table defaults to when a tool does not set it.** The Cleveland units listed as
single-family homes because `add_property` had no property-type field. Same shape as a missing
asking price. Both silent.

**No scheduler.** `pg_cron` is not installed. The GitHub Actions workflow is the scheduler.

**Deploy:** `gh workflow run deploy-edge-function.yml -f slug=<name>`. The run often reports
failure on a successful deploy — check the `Deploy` step, not the run.

**`supabase functions download` returns transpiled output**, not the TypeScript. A byte diff
can never pass.

---

## 7. What is live

173 edge functions. 24 properties, 2 live and both genuinely verified. 35 investors holding
$17,440 credit. 475 client book records. 6 active staff. 46 library articles.

Working and walked: staff login and reset, Penny identifying staff and owners, lead capture,
landlord property submission, market scan and research, the operator portal, the landlord
portal, unified messaging across staff/client/landlord with email notification, setup boards
with a pro portal, appointment booking with a per-appointment video room, client onboarding
with credit and portfolio.

---

## 8. Known broken or unfinished

- **`anon` SELECT on `public.properties`** — pages are closed, the grant is not.
- **Property Forge has never run.** `GOOGLE_API_KEY` and `GOOGLE_CX` are not set.
- **Geocoding** — key exists, API not enabled on its GCP project.
- **18 dead front-end actions.**
- **65 click handlers on plain `div`s** keyboard and screen-reader users cannot reach.
- **17 inputs with a placeholder and no label.**
- **Landlord passwords are SHA-256 with a fixed salt.** Zero accounts, so free to fix now.
  That window closes at the first landlord signup.
- **25 Dependabot advisories**, 14 high.
- **No staff member has payout details on file**, so no commission can be paid.
- **`PropertyDetail.tsx` reads `property.square_feet`**, which has never existed. The column
  is `sqft`. Undefined for the life of the page and nobody noticed.

---

## 9. Scale — read before assuming anything is big

24 properties. 35 investors. 4 deal inquiries. 475 book records. **0 landlord portal accounts.
0 setup projects. 0 Property Forge searches ever.** Most of the schema describes work that has
never happened. Do not size work by code volume.

---

## 10. How to work on this platform

**Look at the site after every push.** `python3 scripts/look-at-site.py /deals` renders the
real page and prints what shows, what the page logged, and what failed. HTTP 200s, bundle
greps and self-written verification functions all passed while the marketplace was wrong twice
in a row. The owner found both by opening the page.

**Never claim success when nothing happened.** This is the dominant defect and it matters most
because both owners are blind and cannot catch a lying green checkmark by glancing at a screen.

**Verify by exercising, not by deploying.** Insert the row. Call the function. Check the
permission afterwards.

**Empty and broken are not the same thing.** A failed read returning zero is not "no results".
Say which.

**Lead with problems.** Say plainly what could not be done rather than attempting it badly.

**Accessibility is not decoration.** Linear speakable prose, real labels bound to inputs, live
regions for status, 44px targets, and `autoCapitalize="none"` on password fields.
