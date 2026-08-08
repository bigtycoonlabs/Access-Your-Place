# Knowledge library — legal accuracy audit

Started 6 August 2026. Live status is in the database, not this file:
`blog_articles.legal_verified_at`, `legal_verified_by`, `legal_sources`,
`legal_review_note`.

## A correction to the previous audit note

An earlier pass called the per-city launch numbers "fabricated" because the database holds
21 properties. **That inference was wrong.** The database is the platform, which only
recently began recording work — it is not the record of five years of business done off it.
The right description was "unverifiable from here". The claims are removed at the owner's
instruction, but the reasoning in that commit overstated what the data proved.

## Verified and corrected

### Houston (`houston-tx-str-coliving`)

| Claimed | Actual |
|---|---|
| "$334 annually" | **$275** + **$33.10** admin fee |
| "Owner must live on-site OR within 200 miles" | **No such rule** |
| "Maximum 3 STRs per owner" | **No cap** — each unit needs its own certificate |

Also omitted: the **$1M liability insurance** requirement, and that the ordinance
(Ord. 2025-322) only took effect **1 January 2026**. Rewritten from 606 to 2,544 characters.

Sources: houstontx.gov STR FAQ, the adopted ordinance PDF, Avalara MyLodgeTax.

### Nashville (`nashville-tn-str-permit-requirements`)

| Claimed | Actual |
|---|---|
| "$50 owner-occupied / $200 non-owner-occupied" | **$313**, one fee, both types |
| Non-owner-occupied "capped, waitlist may apply" | **New NOO permits in residential districts have been phased out** — commercial, mixed-use and grandfathered zones only |

The second is the dangerous one. The article told an arbitrage operator that persistence
would get them a permit in a residential neighbourhood. It will not.

Sources: nashville.gov Codes STR FAQ and permit-types pages.

## The other 33 — marked, not silently left

Two checked, two materially wrong. That is not a sample that justifies trusting the rest.

Every remaining guide that states fees, taxes or zoning now ends with a dated notice: it
has not been re-verified, confirm with the city before signing or spending, and **we will
do that verification with you at no charge.** It names the two real errors found, because a
generic warning is one nobody reads.

This is the covenant working as designed — checking this properly *is* the product, and we
do not charge for knowledge.

## Method note

A regex audit only finds the phrasing you thought of. The first pass matched
"Access Your Place has…" and reported zero remaining. A broader re-query found
**"Our team has successfully helped clients launch 110+ properties in Atlanta"**, the same
for Asheville, and "relationships with 200+ landlords across 64 cities". **Never trust the
first zero.**

## Deliberately left alone

"The exact process we use to help clients grow portfolios from 1 to 10+ properties in 12-18
months" describes the guide's **method**, not a count of work done. Over-removing is its own
error; stripping every confident sentence leaves a library that says nothing.

## Remaining

- **33 city guides need verification against primary sources.** One city per session is
  realistic if done properly. Highest value first: Austin, Miami, Tampa, Orlando, Dallas.
- `seo_title` empty on all articles (falls back to H1 — acceptable, not optimal).
- `research_sources` still empty on every article.
