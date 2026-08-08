# Dead front-end actions — 6 August 2026

The Bible said "35 front-end actions call handlers that do not exist". The real number is
**155**, across **32 live edge functions** (plus 16 more in the four payment functions
tombstoned earlier today, which are correctly dead).

## How this was measured, and a correction to my own first attempt

My first pass used a loose 300-character lookahead from `invoke('fn'` to the `action:`
literal. That crossed into neighbouring code and I nearly reported it as fact. The second
pass brace-matches each `invoke()` call and reads the action **only from inside that call**.

It produced the same 171, so the first number happened to be right — but it was right by
luck, and I said so rather than quietly keeping the convenient answer.

**Verified against the deployed source, not the repo.** `manage-deal-marketplace` on
production handles 8 actions and ends with `default: throw new Error('Unknown action')`.
The repo is not stale; the handlers genuinely do not exist.

## Worst offenders

| Dead actions | Function | Handles |
|---|---|---|
| 25 | `manage-deal-marketplace` | 8 |
| 16 | `manage-email-templates` | 4 |
| 15 | `manage-landlord-portal` | 8 |
| 13 | `manage-staff` | 27 |
| 12 | `investor-auth` | 9 |
| 7 | `investor-login` | 6 |
| 6 | `manage-referrals` | 5 |
| 6 | `penny-deal-scoring` | **0** |
| 5 | `manage-investor-crm` | **0** |
| 5 | `manage-acquisitions` | **0** |
| 5 | `send-push-notification` | **0** |

**Four functions handle nothing at all.** Every button wired to them fails.

## What this means in practice

The third-party sale flow is the clearest example. The UI offers `submit_offer`,
`accept_offer`, `counter_offer`, `reject_offer`, `approve_listing`, `mark_as_sold` and
`release_funds`. **None exist.** A seller can create a listing and cancel it. Nothing else in
that flow works.

Landlord portal: `submit_property`, `upload_document`, `send_message`, `submit_application`
— all dead. This is the supply side.

`investor-login`: `change_password`, `verify_otp`, `update_profile`, `logout_all` — dead.

## One piece of good news

The failure is **loud, not silent**. These functions end with
`default: throw new Error('Unknown action: ...')` and return HTTP 400 with the message. A
user sees an error rather than a false success.

That matters on this platform, where the signature defect is the opposite. A button that
errors is a bug; a button that reports success and does nothing is a betrayal. These are
bugs.

## Recommendation

Do not fix 155 handlers. Decide, per feature, whether it should exist:

1. **The third-party sale flow** — the Bible describes it as a real product with an 80/20
   split. Either build the 25 handlers or remove the UI. Right now it half-exists, which is
   the worst state.
2. **Landlord portal writes** — `/list-your-property` already covers submission. Point the
   portal at that and delete the dead buttons.
3. **`investor-login` account management** — small and worth completing; these are basic
   expectations.
4. **The four zero-handler functions** — likely never written. Delete the UI or write them.

Every one of these is a button a person can press today and get an error from.
