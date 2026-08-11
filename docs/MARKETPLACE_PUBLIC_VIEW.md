# The public marketplace view

`public.marketplace_public` is what an unauthenticated visitor may read about live deals.

## Absent by construction, not nulled downstream

- `address`
- `landlord_name`, `landlord_phone`, `landlord_email`
- `original_url`, `processed_url`, `source`

The first four are obvious. The last three are the ones people restore by accident: **a link
to the source listing is the address, one click later.** Withholding the address while
publishing where it came from is theatre.

A column that is not in the view cannot be selected however the caller asks. The previous
approach selected everything from `properties` and set `address = null` **in the browser**,
which left the real address on the wire for anyone who opened devtools or called the REST
endpoint with the publishable key.

## `is_verified` is derived, never stored

The view computes `is_verified` and `staff_verified` from `ayp_verification_tier(id)`, which
reads the evidence columns. It does **not** read `properties.is_verified`.

This is deliberate. Twelve listings once carried the stored badge with no recorded landlord
conversation behind any of them. A derived badge cannot outlive the evidence that justified
it.

## If you change this view, diff it against the pages

Repointing a query is **not** a like-for-like swap when the shapes differ. When the public
pages were first moved onto this view, it had `verification_tier` but not `is_verified` — so
the "verified only" filter silently matched nothing and the badge never rendered. Nothing
threw. The page just quietly stopped showing the one claim the marketplace rests on.

Before shipping a change here, list every field `src/pages/Deals.tsx` and
`src/pages/PropertyDetail.tsx` read, and confirm the view provides each one. Anything you
deliberately withhold should be in the list above with a reason.

## Known oddity

`PropertyDetail.tsx` reads `property.square_feet`. That column has never existed — the real
one is `sqft`. The read has always been undefined and nobody noticed, which is a small proof
that a silently missing field never announces itself.
