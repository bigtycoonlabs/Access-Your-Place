# Deal scoring — the method, and the data behind it

## The method

80% raw market research. 20% aggregator cross-reference.

The 20% cannot stand alone. Aggregators only see OTA listings. They miss the hotel
market and they miss direct-booking operators, which is the whole reason this company's
numbers beat theirs. A score built on aggregator data alone would be the thing it is
meant to replace.

## Where the data comes from, and what it costs

### The 80% — free, and it is the differentiator

**Lodging and tourist development tax collections.** Published as government open data.
Austin publishes hotel occupancy tax on data.austintexas.gov; Florida counties publish
tourist development tax monthly. More than 120 of the 150 largest US cities impose a
dedicated lodging tax.

This is the strongest source we have and it is free. Tax revenue is a direct function of
rooms sold multiplied by room rate, so it measures the ENTIRE lodging market — hotels,
direct bookings, everything — not the OTA slice an aggregator can see. AirDNA
structurally cannot know this number.

**Hotel occupancy and ADR.** Convention and visitor bureaus publish monthly lodging
reports for most major markets, free. Where a market has none, an acquisition manager
records the figure and its source by hand.

**Travel demand.** Airport passenger statistics and the tax trend above.

**Regulation and zoning.** City code. Free, and it is a gate rather than a score.

### The 20% — cheap

**AirROI** is the recommended cross-reference: about $0.01 per call, self-serve API keys,
no contract. Roughly $100/month for 100 markets.

For comparison: AirDNA's enterprise API is reported at $50,000+/year, their standard API
starts around $129/month, and their free Explorer tier is fine for a sanity check.
Mashvisor and AllTheRooms are alternatives at similar subscription cost.

**Recommendation: start on free sources plus AirDNA's free tier. Add AirROI when volume
justifies it.** Nothing here requires a paid source to produce a defensible score.

## Infrastructure

`pg_cron` is NOT installed on this project and there is no scheduler. The GitHub Actions
workflow at `.github/workflows/deploy-edge-function.yml` proves scheduled jobs work from
Actions, which is free. Use a scheduled workflow to pull tax and CVB data, not pg_cron.

Anything written must also be exposed on the matching `public` view. PostgREST here
serves only the `public` schema (`authenticator: pgrst.db_schemas = public`). Adding a
column or a table is not enough.

## The scorer

`public.ayp_deal_score(research_id)`.

**It refuses.** With inputs missing it returns `scored: false` and names exactly what is
missing, rather than producing a number. That is deliberate: 42 of the 43 previous scores
were produced with none of the required inputs, and rated deals HIGHER and with MORE
confidence than the single researched one.

Penny saying "we have not scored this one yet" is true. A confident number from nothing
is not, and this company's clients buy because they trust the data.

**Regulation is a gate.** `prohibited` returns 0 and `pass`, whatever the other numbers say.

**It shows its working.** Every result carries blended ADR, blended occupancy, projected
monthly revenue, how many aggregator sources were used, the method, and whether a human
has confirmed it.

Hotel ADR is weighted 60/40 against the aggregator average on purpose, because it
reflects the whole market. In testing on a Tampa deal, hotel ADR was $189 and the three
aggregators averaged $172 — they read the market about 4% low. That gap is the product.

## Score does not equal verified

`ayp_deal_score` produces a number. It does NOT make a deal AYP approved.

See `DEAL_VERIFICATION_TIERS.md`. A score with no human confirmation is `penny_scan`.
Only a human who has spoken to the landlord makes it `ayp_verified`, and only
`ayp_verified` belongs in the marketplace.

---

## How an acquisition manager uses this

Penny does the research. The AM checks her work and confirms. No data entry form.

1. Penny drafts the research for a market and writes it to `penny_draft` on the
   `deal_research` row. Every figure carries a source.
2. The AM reads each figure against its source and confirms the ones that check out,
   one at a time, via `confirm_research_field(research_id, field, staff_id)`.
3. Only confirmed fields land in the real columns. `ayp_deal_score` reads only those.

### Why Penny's draft is kept separate

This is the most important design decision in the scoring system.

An LLM asked for a hotel occupancy figure will almost always produce one, with a
plausible-looking source attached. If Penny wrote straight into the scored columns, an
invented number would become a score, and that is precisely the failure that put 42
fabricated scores in front of clients.

So Penny cannot cause a score to exist. She can only propose one. The scorer reads the
real columns; the real columns are only written by
`confirm_research_field`; and that function requires a staff id.

Confirmation is deliberately one field at a time. A single "confirm all" button is how a
human rubber-stamps six numbers they actually checked two of.

### Verified behaviour

- Confirming a drafted number lands it as a number, with its source, and records who
  confirmed it.
- Confirming a field Penny has not drafted is refused.
- Confirming an unknown field name is refused by name rather than silently doing nothing.
- A regulation status outside allowed / restricted / prohibited / unclear is refused.
- **A partly-confirmed deal still refuses to score, and lists what remains** — even when
  Penny has already drafted those fields.

---

## Approved sources only

Penny may cite from `research_sources` and nowhere else.

The alternative — letting her search broadly and cite whatever she finds — is faster to
set up and much easier to fool. This tool is free to the public AND the thing the
acquisition team relies on, so one fabricated citation in front of a client costs more
than the extra market coverage is worth.

Where a market has no approved source for a field, Penny leaves it empty and says so.
Same rule the scorer enforces: name the gap, do not fill it.

Seeded national sources, all free:

- Local lodging / tourist development tax collections (government open data)
- Convention and visitor bureau monthly lodging reports (occupancy and ADR)
- Airport passenger statistics (travel demand)
- City or county zoning code and STR ordinance (regulation — always primary, never a
  secondary summary)
- City of Austin hotel occupancy tax open data

Adding a market means adding its sources. That is deliberate friction.

## Telling users what a scan is

`public.ayp_scan_disclosure(tier)` returns the wording. One function, used on every
surface, so the language cannot drift until one screen overclaims.

For a **Penny scan** it says the numbers come from real market research, and that what
has not happened is the human step — nobody has spoken to the landlord yet — and that an
acquisition manager will do that on a **free call** if they want it.

The tone is deliberate. A scan is real work and it is free; the disclosure is not an
apology for Penny. It tells the user what they have, what they do not have yet, and that
the missing part is available at no cost.

For an **ayp_verified** deal it says we have spoken to the landlord, validated the
numbers, and terms are pre-negotiated. No call is offered because the work is done.

## The verification call is a lead

`capture-lead` accepts `verify_scan`. It is the warmest lead the platform produces —
the person has already found a property they like and is asking for a human.

---

## Three scan types, three different markets

Penny asks which scan the user wants before showing anything: **STR, shared living, MTR,
or all three.** She does not dump a wall of numbers at an address — especially not read
aloud.

That is not interface polish. These are three different businesses in the same building,
and they do not share a data source or a number.

### STR — nightly

Hotel occupancy and hotel ADR as the 80%, aggregators as the 20%.
`public.ayp_deal_score(research_id)`.

### MTR — monthly furnished, 30+ days

Rate comps from Furnished Finder.

**In Virginia and Massachusetts a stay of 30+ days falls outside the lodging tax
entirely.** So MTR can beat STR on net while losing on gross. Always compare net in those
markets.

### Shared living — per room, in a house the operator controls

`public.ayp_shared_living_projection(research_id, rooms)`.

Priced **monthly or weekly, never nightly**. Not by the bed — per-bed is a sober-living
model and is not what rental arbitrage acquisition does.

Four tiers: **budget, median, average, luxury.** The spread is the point. It shows an
operator what a room earns depending on how much they put into setting it up, which is
the actual decision they are making. A five-room Houston house at test rates grossed
$3,250 budget against $5,750 luxury — a $2,500 monthly swing on furnishing effort alone.

**Weekly quotes convert at 52/12, not times four.** Four weeks a month undercounts by
about 8% and would understate every weekly market by roughly a month's rent a year.

### Room rate sources

PadSplit is the closest public comp — individual rooms in a house, priced weekly.
Furnished Finder covers the monthly and upper end. The budget tier lives on Marketplace,
Craigslist and SpareRoom, which are not citable as a single URL, so an acquisition
manager records the observed range and the date. Judgement recorded honestly beats a
scraped number that looks precise and is not.

### Same refusal rule

Each projection refuses independently and names what is missing. A market with hotel data
but no room comps can produce an STR score and no shared-living projection, and it says
so rather than borrowing one number for the other.
