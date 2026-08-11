# Handoff — Access Your Place

**Written 11 August 2026, end of session.** Every figure read from production, not memory.

---

## First thing to do in the new chat

**Look at https://accessyourplace.com/deals in a browser.** The marketplace should show two
Cleveland deals — Unit 801 and Unit 601. It has been showing the wrong thing three times in a
row and the last fix was deployed but never visually confirmed.

Run `python3 scripts/look-at-site.py /deals` from the repo. Playwright is in the environment;
if the browser is missing, `python3 -m playwright install chromium`.

**Network egress is now set to all domains**, so the Supabase host should be reachable from
the new session and the page's data calls will actually resolve. That was not true in this
session and it is why so much went unverified.

---

## Access

**Repo:** `bigtycoonlabs/Access-Your-Place`

**GitHub token:** NOT IN THIS REPO. It is in the handoff copy the owner holds in chat.

Write it to `/home/claude/.ght_ok` and reset the remote before every push, because it does not
persist and the remote goes stale:

```bash
printf '%s' '<TOKEN FROM THE OWNER>' > /home/claude/.ght_ok
chmod 600 /home/claude/.ght_ok
export GH_TOKEN=$(cat /home/claude/.ght_ok)
git remote set-url origin "https://${GH_TOKEN}@github.com/bigtycoonlabs/Access-Your-Place.git"
```

**This token is not in the repo and must not be committed.** It is in this handoff only so the
next session can work. If it ever lands in a commit, rotate it.

**Supabase project:** `adcbrclppmnguzkzwiys`
Schema `"prj_X-ZoVQv6LKXT"` — required as a prefix on every table reference.
PostgREST serves **only** the `public` schema.

**Deploying an edge function:**
```bash
gh workflow run deploy-edge-function.yml -f slug=<name>
```
Workflow id `328258223`, input `slug`. The overall run often reports failure on a successful
deploy — **check the `Deploy` step conclusion, not the run.** Retry once on a genuine failure;
it is flaky roughly one time in four.

---

## Where the platform actually is

| | |
|---|---|
| Properties | 24 total, **2 live**, both Cleveland, both genuinely `ayp_verified` |
| Publish signal conflicts | 0 |
| Investors | 35, holding **$17,440** credit |
| Client book | 475 records |
| Active staff | 6, **0 with payout details on file** |
| Unread client messages | 4, oldest **160 days** |
| Unanswered inquiries | 4, one person, **58 days** |
| Library articles | 46 published |
| Landlord accounts | 0 |
| Penny staff tools | 75 |
| Edge functions | 173 |

---

## The three publish signals — read this before touching listings

A property is "live" according to **three separate columns** that can disagree:

- `is_published` (boolean)
- `status` (`published` / `active` / `approved` vs `unpublished` / `sold`)
- `workflow_stage` (`published` / `discovery` / `new_lead` / `approved`)

**The public deals page trusts `workflow_stage`.** When the owner asked for the marketplace to
be emptied, I cleared the first two, verified through functions I had written myself, and
reported it done. Eighteen listings stayed on the marketplace because `workflow_stage` was
still `published`.

`public.ayp_publish_signal_conflicts()` reports any disagreement in plain words. Run it after
any change to what is listed.

---

## Cleveland, 1900 The Loft — the live inventory

| Unit | Type | Sleeps | Asking | Rent | Peak | Slow | Status |
|---|---|---|---|---|---|---|---|
| 801 | 2/2 | 8 | $8,000 | $1,900 | $5,800 | $3,400 | **live** |
| 601 | 1/1 | — | $7,150 | $1,600 | $5,000 | $3,200 | **live** |
| 406 | 2/2 | 10 | $8,000 | $1,900 | $6,500 | — | **sold** to Myles Prince |

Third-party resales. Furnished, supplies in place, housekeeper continuing, upcoming bookings
included. Photos at `/property-photos/1900-euclid/euclid-NN.jpeg`, served from the repo
because Supabase storage was unreachable.

**The photo grouping is a guess.** Assigned by how the rooms look, not by anything stated.
Somebody who has seen these units should confirm before relying on it.

**406 has no slow-season figure.** It was never given, and 801's was deliberately not
borrowed.

---

## Myles Prince — live client, two open items

Vasu Select LLC, `vasu.select.stays@gmail.com`. Closed Unit 406 for $8,000 on 22 July, signed
document returned. Holds **$7,000 credit** toward a Mexico property. Onboarded, invite sent,
**has not set a password yet**.

**Open:** the Unit 406 lease is still being worked through with the property manager and the
community. His portfolio shows the unit as `pending` for that reason.

**Open and clock-driven:** he has a **1 September start date** for Mexico and cannot choose a
unit until the development partner sends the Yucatán and San Pedro Nuevo details. Known:
high-rise and mid-rise across both, monthly housekeeping included, projected revenue $4,000,
rent from $1,700, premium high-rise $2,500.

Both are on the staff alert desk.

---

## Blocked on the owner

- **`GOOGLE_API_KEY` and `GOOGLE_CX`** — Property Forge has run **zero** searches in its life.
  Steps in `docs/ACTIVATE_PROPERTY_FORGE.md`.
- **Geocoding API** — the Maps key exists; the API is not enabled on its GCP project.
- **Video with recording** — Daily.co recommended. Currently using Jitsi with a unique room per
  appointment, no recording. `docs/ACTIVATE_ZOOM.md`.
- **The 6 credit balances** — owner is verifying personally. Do not reconcile programmatically.

---

## Not finished, and not to be reported as finished

**`anon` can still SELECT `public.properties` directly**, which carries address and landlord
contact details. The public *pages* are closed — they read `marketplace_public`, which cannot
return those columns. The underlying grant is open because **62 browser call sites read that
view and staff screens act as `anon`**, so revoking it would take the staff console down. It
needs the same walk-every-caller sweep the portfolio got.

Also open: 18 dead front-end actions, 65 click handlers on plain `div`s that keyboard and
screen-reader users cannot reach, 17 unlabelled inputs, landlord passwords still SHA-256 with
a fixed salt (zero accounts, so free to fix now — that window closes at the first signup), 25
Dependabot advisories.

---

## How this session went wrong, so it does not repeat

**Verify by looking, not by inferring.** I checked HTTP 200s, grepped the deployed bundle, and
called database functions I had written myself. All three passed while the marketplace was
showing 24 deals that should have been gone, and again while it was showing none. The owner
found both by opening the page.

**"I fixed the leak" was true of one query, not the page.** Addresses leaked on three separate
fetch paths. I fixed one, said it was done, and it took two more rounds. Enumerate every path
before claiming a class of bug is closed.

**Creating a function proves it parses and nothing else.** `ayp_record_verification` wrote to
`verification_note`; the column is `verification_notes`. It threw on its first real call, weeks
after I told the owner it was ready. Same for `crm_appointments` — I guessed its shape three
times.

**Ask what a table defaults to when a tool does not set it.** The Cleveland units listed as
"Single Family" homes because `add_property` had no property-type field. Same shape as the
missing asking price. Both were silent.
