# Credit lives in two places that were never connected

**Found 9 August 2026, by testing a credit approval end to end.**

## The problem

- `penny_grant_credit` writes rows to the **`investor_credits` ledger**.
- `ayp_acquisition_quote` and `penny_release_deal_address` read **`investors.credit_balance`**.

**They are not connected.** Granting a client credit through `penny_grant_credit` does not
make that credit spendable on a deal, and nothing anywhere says so.

## Today's figures

| | Amount | People |
|---|---|---|
| `investors.credit_balance` (spendable) | **$10,440** | 6 |
| `investor_credits` ledger (active, unused) | **$3,700** | 1 |

## What I changed, and what I did not

**Changed:** credit approval now writes to **both** — the ledger for the audit trail, and the
balance because that is what a deal release actually spends from. Without the second write a
client is told they have credit and then cannot use it.

**Not changed:** the historic $10,440 vs $3,700 gap. **I do not know which figure is true for
any given client**, and guessing at somebody's credit balance is worse than leaving a
discrepancy visible. That needs the owner with the history in front of him.

`ayp_credit_discrepancy()` reports both totals so this is visible rather than discovered by
a client who cannot spend credit they were told they have.

## How it was found, and a mistake I made

Testing an approval, I granted 750 to a client, saw the balance read 2,800 afterwards, and
subtracted 750 to undo it — **which took 750 of real credit off her**, because the grant had
never touched the balance in the first place.

Caught within a minute by checking the platform-wide total against what it had been before
the test, restored immediately, and verified: **$10,440 total, Elizabeth back to $2,800,
ledger back to its original single row.**

The lesson is not "be careful with test data". It is **capture the before value in the same
breath as the change** — I had assumed the balance I read after the grant was the balance
before it, and that assumption is what made the reversal wrong.
