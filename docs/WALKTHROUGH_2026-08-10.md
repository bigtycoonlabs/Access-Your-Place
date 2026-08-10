# Walking all three surfaces, 10 August 2026

## Homepage and routes
All eight public routes serve. The deployed bundle carries the Operator Portal rename, the
landlord nav login, and the new landlord landing view. No PII and no service-role key in the
public JavaScript.

## Staff — Tania signs in tomorrow to a thin console
Setup had **one** SOP section against acquisition's three, and it covered responsibilities
without covering **how to run a launch** — which is the part a new setup manager actually
needs on day one. She was invited today.

Added: how a launch runs start to finish (read the file before calling, agree the budget out
loud, watch the deliveries, log the outcome not the intention, flag a slip the same day), and
how to promote setup without pitching. Admin got a procedure for handling an issue.

Setup and admin now have 3 and 2 sections; owners see all 9.

## Operator — 3 live properties are invisible to clients
A client can browse **12** deals while the staff console says **15** are live.

`is_published` and `status` disagree on exactly three: 322 Trappers Run Drive and 104 Bright
Angel Drive in Cary NC, and the Tampa FL 33609 listing. All three are `active`/`approved`
with `is_published = false`, so staff tools count them and no client can see them.

**Not fixed by guessing.** Either they were taken down and the status was never updated, or
they were approved and never published — opposite fixes. Flipping the flag would either hide
three real deals or publish three somebody pulled on purpose. `ayp_publish_conflicts()`
reports it and an alert is on the acquisition desk.

## Landlord — walked with a real record, found my own contradiction
Zero landlord accounts exist, so the portal had never been exercised. Created a throwaway
landlord and property, walked it, deleted both.

The card said **"Nothing is needed from you yet"** and then listed **four things needed**, on
the same card. The stage line was hardcoded per stage; the needs list is computed; nobody
checked them against each other.

Now the "nothing needed" claim is derived from the same list it appears beside, so the screen
cannot contradict itself.
