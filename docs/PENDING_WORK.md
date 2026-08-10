# What is left to do

**Written 10 August 2026.** Every number below was read out of the live system today, not
remembered. Where something is a judgement rather than a fact, it says so.

There are three kinds of item here:

1. **Keys and settings only you can add** — I cannot do these, and some of them block real features.
2. **Decisions only you can make** — I have deliberately not guessed at these.
3. **Engineering work I can do without waiting for anything.**

---

# 1. Keys and settings only you can add

Everything in this section is done in a browser. None of it needs code.

## Already working — do not touch

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`. Email is sending, Penny is running, the database is live.

## Missing, and blocking a real feature

### `GOOGLE_API_KEY` and `GOOGLE_CX` — blocks Property Forge

**Impact: Property Forge has run zero searches in its entire life.** It also blocks
`research-zip-properties` and `staff-deal-search`.

Full steps are in `docs/ACTIVATE_PROPERTY_FORGE.md`. Short version: enable **Custom Search
API** in Google Cloud Console, create an API key restricted to that API, create a
Programmable Search Engine set to *search the entire web*, and add both values as Supabase
Edge Function secrets. First 100 searches a day are free.

### `GOOGLE_MAPS_API_KEY` — the key exists, the API is not enabled

`geocode-address` fails. The key is already in Supabase; **the Geocoding API is not enabled
on the Google Cloud project it belongs to.** That is one toggle in the Cloud Console, not a
new key.

### `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — decide before adding

Seven functions reference SMS. **All of them currently refuse honestly** rather than
pretending to send — I changed that today after finding SMS callbacks that reported success
while pointing at a dead host.

**Do not add these until you have decided you want SMS**, because your new Terms of Service
say client communication runs through the platform. SMS to *staff* for urgent alerts is a
reasonable exception; SMS to clients arguably contradicts the policy you just set.

### `APIFY_API_KEY` — blocks two non-critical features

`monitor-regulation-feeds` and `penny-property-photos`. Neither is load-bearing. Low priority.

### `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`

Social sign-in for clients. Optional — email and password work today. Adds friction removal
at signup, nothing more.

---

# 2. Decisions only you can make

I have left all of these alone on purpose. Each one would require me to guess at something
only you know, and guessing wrong would do real damage.

### The 12 unverified listings — highest value item on this list

**Every live listing carries the verified badge. Not one can prove it.** The evidence columns
behind "we spoke to the landlord" have never been filled in.

Per the Bible this is a record-keeping gap, not a fabrication — the calls were made, the
software never gave anyone anywhere to write them down. **I did not fill them in.** I was not
on those calls, and inventing evidence of a landlord conversation is the worst thing anyone
could do here, because that claim *is* the product.

The tool exists: ask Penny to record verification on a property. It records against the
staff member who made the call and refuses without one. **Twelve properties, done by whoever
made each call.** This is an hour of somebody's time and it is the single most valuable hour
available.

### The 6 credit balances

$10,440 across six clients, against $3,700 in the ledger. You said you would verify each one
personally. Written into the column comments so nobody reconciles them automatically.

### The 3 publish conflicts

322 Trappers Run Drive and 104 Bright Angel Drive in Cary NC, and the Tampa 33609 listing.
All three are `active`/`approved` but not published — **staff tools count them as live and no
client can see them.**

Either they were taken down and the status was never updated, or they were approved and never
published. **Opposite fixes.** Flipping the flag blind would either hide three real deals or
publish three somebody pulled on purpose.

### Recording on calls

Discussed below. It has consent implications in several states and needs deciding before it
is switched on, not after.

---

# 3. Operational backlog — people, not code

These are real people waiting.

| Item | Count | Oldest |
|---|---|---|
| Unanswered deal inquiries | 4 (one person, Suresh Bachu) | **58 days** |
| Unread client messages | 4 | **160 days** (Elena Barbeau) |
| Staff who cannot be paid | 6 of 6 | — |
| Client book unassigned | 475 of 475 | — |
| Landlord portal accounts | 0 | — |

**Suresh Bachu** enquired on four properties on 13 June and has never been contacted. His
phone number is on the alert. All four properties he asked about are unpublished, which is a
separate conversation for whoever calls him.

**Elena Barbeau** wrote on 4 March saying the unit numbers looked wrong, and again on 6 March
asking for her listing to be approved. Nobody has opened either.

**Nobody on the team has payout details on file**, so no commission can be paid. That
includes you.

---

# 4. Engineering work I can do without waiting

None of this is blocked on you.

- **18 dead front-end actions** remain, down from 155. Small one-offs now.
- **65 click handlers on plain `div`s** that keyboard and screen-reader users cannot reach.
  Given both owners use VoiceOver, this is the accessibility item that actually matters.
- **17 inputs with a placeholder and no label.**
- **The deploy verifier still reports failure on successful deploys.** I fixed one real bug
  in it (phantom captures from apostrophes) but it still fails and I cannot read the step log
  from my environment. **Somebody with Actions access reading one raw log would close this in
  minutes.**
- **Landlord password hashing is SHA-256 with a fixed salt, not bcrypt.** There are zero
  landlord accounts, so this can be fixed with no migration and nobody to lock out. **That
  window closes the moment the first landlord signs up.**
- **25 Dependabot vulnerabilities on main**, 14 high.
- **Five tombstoned function slugs** still need deleting from the Supabase dashboard.

---

# 5. Video calls with recording — the options

You asked for alternatives to what I wired in, specifically ones that can record, and easy to
integrate. **I have not wired any of these.**

What is running now is **Jitsi Meet on the free public service**: no account, no key, a unique
room per appointment, works in a browser. It does **not** record, and it is third-party
infrastructure you have no agreement with.

**A caveat on everything below:** my information has a cutoff and pricing and terms change.
Verify current pricing and, for anything with a free tier, whether that tier permits
commercial use, before committing.

### Daily.co — my recommendation for your case

REST API, one API key. Create a room with a single HTTP call, get a URL back. Cloud recording
is a documented feature, and recordings can be fetched and stored against the client file.
Prebuilt iframe UI so there is no video engineering, or a JS SDK if you want it embedded in
your own screens. Free tier historically generous, with recording on paid plans.

**Why it fits:** the integration shape is identical to what already exists — one secret, one
call, a link. Closest thing to a drop-in replacement that adds recording.

### Whereby Embedded

API key, create a room, embed it in your own UI. Recording available. Designed for embedding
in another product rather than being a destination, so it can carry your branding. Slightly
more UI work than Daily's prebuilt.

### 8x8 JaaS (Jitsi as a Service)

Same technology already running, on your own tenant. Adds recording, transcription, your
branding, no Jitsi logo. API key plus a JWT you sign per meeting — a little more than Daily
but not much. **Lowest-risk change**, because the meeting behaviour is already what your team
would be used to.

### Zoom

Recording, transcription, waiting rooms, and the brand everybody recognises. **The most
complex to wire**: a Server-to-Server OAuth app, three secrets, scope selection, and every
staff member holding a seat under a matching email. Documented in `docs/ACTIVATE_ZOOM.md` if
you decide the recognition is worth it.

### Worth knowing rather than recommending

- **Google Meet** — needs Google Workspace and the Calendar API; recording is a Workspace
  tier feature. Reasonable *if* you are already on Workspace.
- **LiveKit** — open source with a cloud option, recording supported, but meaningfully more
  engineering than the others.
- **Twilio Video** — Twilio announced it was winding this product down. **Do not build on it.**

### A recommendation, since you asked

**Daily.co if recording is the deciding factor**, or **8x8 JaaS if you want the least
disruption from what is running now.** Both are one key and one call.

**Decide the recording policy before the integration**, not after. Recording a client call
has consent requirements that differ by state, and your Terms of Service already commit you
to tracking communications — which makes it more likely you want this, and more important
that it is disclosed properly rather than switched on quietly.

---

# 6. If you only do three things

1. **Record the verification on the 12 listings.** One hour. It is the claim the whole
   marketplace rests on and right now the system cannot back it.
2. **Call Suresh Bachu and open Elena Barbeau's messages.** Real people, months late.
3. **Add `GOOGLE_API_KEY` and `GOOGLE_CX`.** Property Forge has never run, and it is the
   lead-generation tool for the constraint on this business.
