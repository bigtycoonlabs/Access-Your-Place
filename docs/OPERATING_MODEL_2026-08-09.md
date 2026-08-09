# The operating model — 9 August 2026

Built to the owner's description: stop relying on phone calls, and let the platform carry
the work until somebody is ready to spend money or genuinely needs a person.

## A client can have two managers

`assigned_to` could hold one person. A client typically has **both** an acquisition manager
and a setup manager, and forcing that into one column means one of the two stops seeing
their own client.

`client_files` now carries `acquisition_manager_id` and `setup_manager_id` separately, each
with its own assignment timestamp. `penny_assign_manager(file, staff, role)` assigns by
role and refuses anyone who is not an active Success Team member.

So Tonya can be set up manager on Elizabeth's file while an acquisition manager holds the
same file for sourcing.

## The deal mechanic — everything except the address

An acquisition manager finds a deal and sends it through Penny. The client sees the market,
bedrooms, rent, condition, terms, why this one, and the acquisition cost. **They do not see
the address.**

That is not a paywall on information. It is the one piece of the work we are actually paid
for: finding the door.

`penny_deal_card` **omits the address from the payload entirely** rather than returning it
for the interface to hide. A field that never leaves the database cannot be leaked by a
screen that forgets to mask it.

Release is by credits or cash, through `penny_release_deal_address`. Releasing twice is
free — no charge for looking at something you already bought.

### A bug caught by calling it, not reading it

The first version's **refusal leaked the address**:

> "7710 Main Street is an Access Your Place deal at 2,500.00. Your credits cover 0.00 of it."

`ayp_acquisition_quote`'s explain names the property, because it was written for staff where
naming it is helpful. Passed through the release refusal it handed the client the exact
thing they had not paid for — **in the message telling them they had not paid for it**.

The happy path was correct. The failure path gave the deal away. The refusal now carries
numbers only.

Presenting a deal with **no acquisition cost is refused**, because the client could never
release it and the presentation would be a dead end.

## Still to build

- Penny emailing a client file directly, so engagement does not need a call
- Notifying the assigned manager when that person replies or creates an account
- A pending-task queue per staff member — this business is commission-based, so a task
  sitting unseen is somebody's income sitting unseen
- Notifying acquisition managers when a new client joins so they can claim the file
