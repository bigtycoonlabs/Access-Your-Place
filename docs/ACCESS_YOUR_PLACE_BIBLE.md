# The Access Your Place Bible

Reference for the platform. Written 6 August 2026.

**Rule for this document: everything here was verified, not assumed.** Where something is
believed but unproven it says so. Where something is broken it says that too. A reference
that flatters the codebase is worse than none, because this platform's signature defect is
reporting success while doing nothing.

---

## 1. What the company actually is

Access Your Place is a **rental arbitrage acquisition practice**. It finds furnished and
flexible rental opportunities, vets them personally, negotiates with the landlord, and
hands an operator a deal that is ready to sign. It also buys and sells existing
operations.

It is **not** a property manager. Terms of service say the operator runs their own
operation and is responsible for the properties they take on.

The business runs today largely outside the software: deals come from Facebook posts,
phone calls and socials, and clients buy after someone explains the model. That works.
The platform's job is to make that loop faster, not replace it.

### The team, and what each role does

Called the **Success Team**.

**Admin** — compliance, legal, issue resolution across clients, landlords, client to
client and client to company. The customer support function. Also makes sure documents go
out on time. **15% per deal.**

**Setup Manager** — sources furniture and supplies, matches clients with on-the-ground
vendors, manages the pros sent to each launch, takes inventory as product arrives, keeps
the client file current. **15% on an already-furnished deal, flat $1,500 on a full project
launch.**

**Acquisition Manager** — finds deals, contacts landlords and apartment communities, runs
the numbers before a deal is posted, negotiates with landlords, and runs discovery and
closing calls with clients. **15% for closing the client, 15% for finding the
landlord/property — up to 30%.**

Everyone promotes on Facebook and other channels for leads.

The company keeps the remainder. The team is designed to cover the launch cycle of a
client.

### The constraint

**Leads.** Acquisition managers leave because there are not enough to feed them, and the
owner cannot train fast enough while also writing code. Everything should be judged
against whether it brings landlord leads and client leads in, or frees the owner to train.

### Client referrals

$300 cash or credit when a client's referral closes a deal.

### Third-party sales

When someone sells an existing operation through the platform: **seller takes 80%, the
platform takes 20%** of the acquisition listing cost. **Half the seller payout is held
until the lease is signed** with the new operator, or through the master lease programme.

---

## 2. Verification tiers — the most important concept in the platform

Two tiers. They must never be presented as the same thing.

### penny_scan

Penny calculated from an address. **Nobody has spoken to the landlord** and no human has
cross-checked the research. This is what a user gets from Property Forge when they find a
property themselves.

It is **not** an Access Your Place approved deal and must never be shown as one.

### ayp_verified

A human has:

- spoken to the landlord personally
- validated the numbers Penny is showing
- confirmed the landlord consents to the property being marketed
- pre-negotiated terms so the landlord is ready to sign

For a third-party operation being sold, instead: the operation, supplies, furniture and
which vendors stay have all been evaluated.

**Everything in the deal marketplace is ayp_verified by definition.** That claim is the
product. It is why clients buy when the website is not working.

Computed by `public.ayp_verification_tier(property_id)` from evidence columns on
`properties`. One definition in one place.

**Current state:** all 21 properties compute as `penny_scan` because the evidence columns
are not populated yet. 19 carry the older `is_verified` flag with zero `staff_verified`
and zero `approved_by_staff_id`. **This is a record-keeping gap, not a fabrication** — the
team did speak to these landlords, the system never gave them anywhere to write it down.
Nothing was unpublished on the strength of it. It needs a backfill by the people who made
the calls.

---

## 3. Deal scoring

### The method

**80% raw market research, 20% aggregator cross-reference.**

The 20% cannot stand alone. Aggregators only see OTA listings — they miss the hotel market
and direct-booking operators. That is precisely why this company's numbers beat theirs,
and why a score built on aggregator data alone would be the thing it is meant to replace.

Raw market means: hotel occupancy, hotel ADR, lodging tax collections and their trend,
travel demand, peak and slow season, where traffic spikes in a city, and regulation and
zoning.

### The scorer refuses

`public.ayp_deal_score(research_id)` returns `scored: false` and **names what is missing**
rather than producing a number. Regulation is a **gate**: `prohibited` returns 0 and
`pass` regardless of how good everything else looks.

This is the whole design, and it exists because of what was found on 6 August 2026:
**43 score rows existed and exactly ONE had the research behind it.** The other 42 were
generated with no hotel occupancy, no ADR, no regulation check and no competition
analysis — and rated deals **higher and with more confidence** than the genuine one.
Houston scored 77 "buy" at 80% confidence with no research; one Tampa row claimed **90%
confidence on nothing**. All 21 live properties carried one, shown to investors in five
places.

Those 42 are now suppressed. Nothing was deleted; the rows are flagged
`research_complete = false` so the history stays auditable. One property keeps its score:
Tampa, 76, "buy" — the only one that earned it.

### Penny drafts, a human confirms

Penny writes research into `penny_draft` **and nowhere else**. The scorer reads only the
real columns, which are written only by `confirm_research_field`, which requires a staff
id and is callable only by `service_role` through `staff-confirm-research`.

**Penny cannot cause a score to exist. She can only propose one.**

Confirmation is one field at a time. There is no confirm-all button, deliberately: one
button is how somebody rubber-stamps six numbers they checked two of.

### Three scan types

Penny **asks** which scan before answering — short-term, shared living, mid-term, or all
three. These are three different businesses in the same building and blending them
produces a number that describes nothing. It matters twice over for output read aloud.

**STR** — nightly. `ayp_deal_score`.

**MTR** — furnished stays of a month or more. `ayp_mtr_projection`. Carries the
lodging-tax threshold, which is **not the same everywhere**: Virginia 30 days,
Massachusetts 31, Michigan 30, **New Jersey 90**. Where a stay clears the threshold the
lodging tax drops away, so **compare MTR against STR on net, not gross.**

**Shared living** — `ayp_shared_living_projection`. **Per room, in a house the operator
controls. Monthly or weekly, never nightly.** Not per bed — per bed is a sober-living
model and is not what this business does. Four tiers: budget, median, average, luxury.
**The spread is the product** — it shows what a room earns depending on how much the
operator puts into it. Weekly converts at **52/12, not times four**; four weeks a month
undercounts by ~8%.

Each refuses independently. A market with hotel data but no room comps returns an STR
score and an explicit refusal for shared living.

---

## 4. Data sources

**41 verified sources across 18 states, covering all 36 markets.** Registry:
`research_sources`. Penny may cite from it **and nowhere else** — broad search is easier
to fool, and this tool is both free to the public and what the acquisition team relies on.

### The best source is also the cheapest

**Lodging and tourist development tax collections**, published as government open data.
Revenue is rooms sold multiplied by room rate, so it measures the **entire** lodging
market including direct bookings — the data AirDNA structurally cannot see. Over 120 of
the 150 largest US cities levy one.

Texas publishes all cities in one machine-readable portal. North Carolina publishes all
counties in one monthly fact sheet. Georgia requires every jurisdiction to file annually
as a condition of keeping the tax. Nevada's LVCVA is the single best source found —
monthly occupancy, ADR, RevPAR, visitor volume, convention attendance, airport and
highway traffic.

### Paid cross-reference

**AirROI, about $0.01 per call**, self-serve, no contract — roughly $100/month for 100
markets, against AirDNA enterprise reported at $50,000+/year. **Free sources are enough to
ship. Add AirROI when volume justifies it.**

### Caveats recorded, because they would otherwise mislead

- Texas HOT data is **self-reported and not verified by the Comptroller**
- LVCVA figures come from a **75% survey sample**, so month-on-month carries noise
- Georgia figures from **2021 onward include Airbnb** (HB317) and are not comparable to earlier years
- Nashville's rate rose 1% on **1 July 2023**
- Kent County Michigan went 5% to 8% on **1 Jan 2025**
- Santa Fe County extended to STRs in **2023**
- North Carolina rates differ by county — Mecklenburg 8%, Wake 6%, New Hanover 3%
- **Alabama: Vrbo does not collect lodging tax**, so Vrbo-heavy operators carry it themselves
- Maryland has **no statewide publication** — county by county
- Washington DC is **15.95%** through Sept 2027, high enough to flip STR against MTR on net

**Mexico has no equivalent open lodging-tax regime** and needs a different approach.

---

## 5. Penny

### What she is

One Penny across every surface. **Aware everywhere, gated per surface.** Every surface is
told her full capability set; each is told what it may execute there; and where the rest
lives, so she routes a person instead of dead-ending them.

Awareness is prompt-level. Permission is code-level, enforced in `planToolInvocation`,
which rejects any tool absent from `toolsForContext` before reading a parameter. **Telling
her a tool exists cannot grant her the ability to run it.** There is a test for this:
*"MERGE INVARIANT: awareness never grants execution."*

### Shared spine

`supabase/functions/_shared/penny/` — capability, doctrine, compose, executor, tools.
**79 tests passing**, run with `deno test --no-check`.

### Surfaces

- `penny-staff-chat` — the staff desk. 21 inline tools. Identity, owner posture, payment doctrine and the destination guard are wired.
- `penny-public-chat` — public. No tools by design, but she reads real live deals through `penny_live_deals()` and library articles.
- `penny-market-scan` — asks which scan, then runs it. Refuses honestly.
- `penny-research-market` — assembles the research pack from approved sources.

### Hard rules

**Never recite a payment destination.** Not a Bitcoin address, Zelle tag, cashtag, wire
account or routing number. Name the rail, point at the Payments tab copy button. One wrong
character sends money somewhere unrecoverable and the owners are blind and cannot catch it
by looking. Enforced by `containsPaymentDestination` on **all three** outgoing paths in
staff chat, and it **replaces** the reply rather than appending to it.

**Never say a payment is confirmed or received.** Penny intakes and routes; staff
adjudicate.

**Credits may buy** deals, property leads and platform services. **They may not buy**
furniture, household supplies, property deposits, application fees or landlord rent.
Explain the line rather than just refusing.

---

## 6. Platform facts that bite

### PostgREST serves ONLY the public schema

`authenticator: pgrst.db_schemas = public`. Confirmed from `pg_db_role_setting`.

**Any request sending `Accept-Profile: prj_X-ZoVQv6LKXT` is rejected.** This silently broke
Penny's identity lookup for her entire existence — she could never identify anyone, and
everything else about the request was correct.

**Adding a column to a table is not enough.** The matching `public` view must expose it or
nothing can read or write it. This has now bitten three times: `is_owner` missing from
`staff_users` (Penny blind), the triage columns missing from `leads` (lead capture failed),
and it is the first thing to check when a write is rejected.

### No scheduler

`pg_cron` is **not installed** and there are no scheduled jobs. The GitHub Actions
workflow at `.github/workflows/deploy-edge-function.yml` is the scheduler — free, and
proven working.

### Deploying

`gh workflow run deploy-edge-function.yml -f slug=<name>` or the Actions tab. The runner
deploys from disk, so bytes go repo → runner → Supabase with no transcription. It then
verifies by checking that distinctive string literals from the commit are present in what
is deployed.

**`supabase functions download` returns TRANSPILED output**, not the TypeScript. Types are
stripped, trailing commas dropped. A byte diff can never pass — do not build one.

The Supabase MCP's `deploy_edge_function` takes file contents as a parameter, so using it
means retyping the whole file. Acceptable for a small new function; **not** for a large
live one.

### Verify by calling, not by creating

Creating a Postgres function only checks that it **parses**. Three real bugs on 6 August
were found only by calling the thing: an array-append type error, a jsonb-into-numeric
assignment, and a permission revoke that silently did nothing because Postgres grants
EXECUTE to `PUBLIC` by default.

A successful migration is not evidence.

---

## 7. What is live and working

**169 edge functions**, 36 pages.

Verified working on 6 August 2026:

- Staff login and password reset, end to end
- Penny identifying staff and owners correctly
- `capture-lead` and `/start` — the front door, four lead types
- `submit-landlord-property` and `/list-your-property` — supply side
- `penny-market-scan`, `penny-research-market`, `staff-confirm-research`
- `/staff/research-review` — the AM confirmation screen
- Public Penny returning 18 real live deals through `penny_live_deals()`
- All email now sending from owned domains, Penny as sender, with a working reply-to

### Property Forge

**Property Forge is the lead-generation system** where an operator sources their own
deals. Code identifiers still say `leadforge` — `leadforge_balance`,
`leadforge_search_cache`, `leadforge_release`, the `leadforge` and `apollo-leadforge`
functions, and `/staff/leadforge`. **Those are live database objects and deployed function
slugs and were deliberately left alone**; only user-visible text was renamed.

A deal a user sources themselves through Property Forge is `penny_scan`, never
`ayp_verified`, because no human has spoken to the landlord.

---

## 8. Known broken or unfinished

- **35 front-end actions call handlers that do not exist** — `change_password`,
  `update_profile`, `verify_otp`, `resend_verification`, `revoke_session`,
  `get_login_history`, `delete_account`, `refresh_session` and more. Buttons that silently
  do nothing.
- **The Accept-Profile shim sits in ~117 functions doing nothing useful.** They work only
  because public views happen to mirror their tables. Any function selecting a column its
  view omits is silently broken. Not yet audited.
- **Landlord passwords use SHA-256 with a fixed salt**, not bcrypt. `landlord_contacts`
  has **zero rows**, so this can be fixed with no migration and nobody to lock out. That
  window closes at the first landlord signup.
- `LandlordPortal` has **no property submission form** — `/list-your-property` covers it
  for now.
- 97 inputs with a placeholder and no detectable label; 22 `img` tags with no alt; 16
  click handlers on plain divs that keyboard and screen readers cannot reach.
- 25 Dependabot vulnerabilities on main (14 high).
- `login_count` is never incremented — all 34 investors read 0 while 13 have a real
  `last_login`.
- Five tombstoned function slugs still need deleting from the Supabase dashboard.
- `PaymentCheckout.tsx` hardcodes a live Stripe publishable key; the Stripe account should
  be closed.

---

## 9. Scale — read before assuming anything is big

21 properties. 34 investors. 13 who ever logged in. 4 deal inquiries. 9 portfolio
holdings. 9 AM agreements, 5 signed. 9,544 investor invitations. Zero landlords with
portal accounts. Zero setup projects. Zero commissions recorded. Zero referrals tracked.

**283 tables. 211 completely empty. 47 with fewer than ten rows. 25 with real data.**

About nine tenths of the schema describes work that has never happened. **Do not size work
by code volume.**

---

## 10. How to work on this platform

**Never claim success when nothing happened.** This is the dominant defect here and the
one that matters most, because the owners are blind and cannot catch a lying green
checkmark by glancing at a screen.

Confirmed instances: a follow-up executor that read nothing, SMS callbacks pointed at a
dead host, invitations marked delivered on API acceptance, photos marked processed that
were never modified, 42 scores invented from no inputs, a password reset that reported
success and changed nothing, and a login page reporting an outage when the password was
simply wrong.

**Report the failure.** A rejected form beats a silent lead. "I have not researched this
market yet" beats a number nobody can stand behind.

**Verify by exercising, not by deploying.** Insert the test row. Call the function. Check
the permission afterwards.

**Accessibility is not decoration.** Both owners use VoiceOver. Linear speakable prose, no
dense tables, real labels bound to inputs, live regions for status, 44px targets, and
`autoCapitalize="none"` on password fields — iOS will otherwise capitalise a revealed
password and silently corrupt it.

**Lead with problems.** Say plainly what cannot be done rather than attempting it badly.
