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
