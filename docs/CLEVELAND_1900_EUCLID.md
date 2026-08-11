# 1900 Euclid Ave, Cleveland OH — three operations for sale

Recorded 10 August 2026. All three are `pending_review`, **not live**.

| Unit | Type | Asking | Rent | Peak | Slow | Photos |
|---|---|---|---|---|---|---|
| **801** | sleeps 8 | $8,000 | $1,900 | $5,200 | $3,400 | 9 |
| **406** | 2 bed / 2 bath | $8,300 | — | — | — | 6 |
| **601** | 1 bed / 1 bath | $7,150 | $1,600 | $5,000 | $3,200 | 4 |

All three: third-party sales, fully furnished with supplies in place, currently running with
upcoming bookings included.

Unit 601's average projected monthly revenue is $4,300, verified from two years of operating
data.

## Photos

19 images at `https://accessyourplace.com/property-photos/1900-euclid/euclid-NN.jpeg`,
committed to `public/property-photos/1900-euclid` and served by the existing deploy.

**Verified live:** all 19 return HTTP 200 with content type `image/jpeg`, checked against the
running site rather than assumed.

**The grouping is a guess and needs confirming.** Photos were assigned by how the rooms look,
not by anything stated:

- **801** — euclid-01 to 09: grey sofa bed (shown made up as a bed), red accent chairs, two
  navy beds, vanity with lit mirror, black-counter bathroom
- **406** — euclid-10 to 15: black velvet sectional, fireplace, dining for six, wood-cabinet
  kitchen with breakfast bar
- **601** — euclid-16 to 19: grey sofa with yellow pillows, round black dining table, beige
  bathroom, beige bedroom with green curtains

Somebody who knows these units should check the photos match before any of them is published.

## Still missing before these can go live

- **Unit 406 has no rent and no revenue figures.** They were never given, and 801's numbers
  were deliberately not borrowed. A buyer would otherwise be underwriting on figures nobody
  stated.
- **Unit 801 has no bedroom or bathroom count.** It sleeps 8; the room count was not given.
- **Verification evidence** on all three. They are third-party sales, so the tier needs the
  operation, supplies, furniture and vendors evaluated and recorded — not a landlord call.

## Note on photo storage

These are served from the repo rather than Supabase storage. The Supabase MCP connection has
no file-upload capability, and the storage host is not reachable from the build environment,
so uploading was not possible from here. The repo route works, is on our own domain, and
costs nothing. If photos should live in Supabase storage instead, that is a task for whoever
sets up the storage keys.
