# Deal verification tiers

Two tiers. They must never be presented as the same thing.

## penny_scan

Penny calculated the numbers from an address. No human has spoken to the landlord and
nobody has cross-checked the research.

This is **not** an Access Your Place approved deal. A user who searches a property they
found themselves gets this. It must never appear in the marketplace and must never carry
verified language.

## ayp_verified

A human has:

- spoken to the landlord personally
- validated the numbers Penny is showing
- confirmed the landlord consents to the property being marketed
- pre-negotiated terms so the landlord is ready to sign

For a third-party operation being sold, instead:

- the operation has been fully evaluated
- supplies and furniture have been verified
- which vendors stay with the operation is confirmed

**Everything in the deal marketplace is ayp_verified by definition.** That claim is the
product. It is why clients buy even when the website is not working.

## Where the tier comes from

`public.ayp_verification_tier(property_id)` computes it from evidence columns on
`properties`. One definition, one place, so no screen can invent its own.

Evidence columns: `landlord_spoken_to`, `landlord_spoken_to_by`, `landlord_spoken_to_at`,
`landlord_marketing_consent`, `landlord_ready_to_sign`, `terms_pre_negotiated`,
`numbers_validated_by`, `numbers_validated_at`, and for third-party sales
`operation_evaluated`, `inventory_verified`, `vendors_confirmed`.

## Third-party listing economics

Seller receives 80% of the acquisition listing cost. The platform keeps 20%.
Stored per property as `seller_payout_pct` and `platform_fee_pct`.

Half the seller payout is held until the lease is signed with the new operator, or until
it goes through the master lease programme.

## Current state, 6 August 2026

All 21 properties compute as `penny_scan`, because none of the evidence columns are
populated yet. 19 carry the older `is_verified` flag with zero `staff_verified`, zero
`approved_by_staff_id` and one checklist.

**This is a record-keeping gap, not a fabrication.** The team did speak to these
landlords; the system was never given anywhere to write that down. Nothing was
unpublished and no badge was removed on the strength of it.

What is needed: whoever spoke to each landlord records it once. After that the tier
computes itself and the marketplace can enforce it.
