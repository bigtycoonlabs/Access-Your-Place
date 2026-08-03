# Penny — Capability Map & Roadmap

_Living document. Purpose: remember where Penny is and where we're taking her next, across sessions._
_Last updated: 2026-08-03 (session: repo-sync + Penny planning)._

---

## North Star

Penny is an **always-on operational partner** for furnished / flexible-housing operators
(short-term rental, corporate housing, shared / sober living) on Access Your Place.

She helps operators **run, scale, and manage the day-to-day of their operation** by advising,
planning, researching, tracking, and running numbers — sticking with the user throughout their day.

## The hard guardrail (never cross this)

The company does **not** offer management services. Penny is an operational **partner and analyst**,
never a manager. Every capability must be **advise / plan / research / track / surface** — never
"we do it for you."

- She **reads** the operator's calendar to help plan — she does **not** run bookings.
- She **surfaces** leads — she does **not** run outreach as a managed service.
- She **helps track** expenses/budgets — she does **not** keep the books for them.
- She gives **operational advice** — she never takes an operational action on the property.
- **No guest communication.** Ever.

Honesty spine (non-negotiable, founder is blind): Penny only states what a tool actually returned,
and never claims an action was completed unless a tool truly did it this turn. See `penny_truth.ts`.

---

## Where Penny is today (2026-08-03)

**By audience:**
- **Staff:** Functional. Real 14-tool agent (`penny-staff-chat` v16), proven end-to-end on the
  money path (closing intake → P&L record).
- **Investors/operators:** Partial. A live investor chat exists (`ai-investor-chat` v31) but its
  toolset has NOT been re-audited recently, and it is NOT yet the operational partner described here.
- **Landlords:** None. No Penny assistant for landlords. They have a portal + login only; staff-Penny
  can onboard/look them up, but landlords have no Penny to talk to.

**Live Penny surfaces (functions):**
- `penny-staff-chat` v16 — staff agent (tools below)
- `penny-public-chat` v18 — public website chat
- `ai-investor-chat` v31 — investor-facing chat
- Supporting: `penny-onboard-contact`, `penny-deal-intake`, `penny-client-outreach`,
  `penny-escalation-alert`, `penny-staff-brief`, `penny-new-account-alert`,
  `penny-deal-scoring`, `penny-score-monitoring`, `penny-property-photos`,
  `penny-generate-description`, `penny-portfolio-analysis`, `nightly-penny-score-refresh`

### Penny's current STAFF tools (14) — `penny-staff-chat` v16

1. `find_client` — look up a client by name/email/company
2. `get_client_activity` — full activity picture (signup, logins, live session, messages, past Penny
   chats, deals browsed, inquiries, status, managers, credit balance)
3. `check_account` — is this person already here (investor OR landlord) + correct create/login links
4. `send_account_invite` — official onboarding to someone new (confirmed write)
5. `list_opportunities` — open buyer inquiries on live deals
6. `get_opportunity` — full detail + notes for one inquiry
7. `update_opportunity_status` — change inquiry status (confirmed write)
8. `add_opportunity_note` — add internal note (confirmed write)
9. `list_pending_emails` — client email drafts waiting to send
10. `get_client_email` — full draft detail
11. `compose_client_email` — save a client email draft in Penny's voice (confirmed write)
12. `send_client_email` — send a draft now from Penny; replies route to success@ (confirmed, irreversible)
13. `get_activity_report` — platform traffic + new signups over N days
14. `record_closing` — enter a completed deal into ledger + P&L, reading every number back first
    (confirmed write, admin-gated via `manage-hr-commissions`)

All writes ask first; the truth spine blocks any completion claim a tool didn't back.

---

## Roadmap — tools to ADD (to become the operational partner)

Grouped by effort. "WIRE" = the backend function already exists; it just needs to be exposed to
Penny as a tool. "NEW" = build from scratch.

### Wire existing backends into Penny (fastest wins)
- **Property + market search by ZIP/city** — WIRE `research-zip-properties` + `apollo-leadforge`
  (the "lead force"). Lets Penny pull properties and leads for a ZIP or city on request.
- **Portfolio + run-the-numbers** — WIRE `manage-portfolio-performance` + `revenue-forecasting`.
  Pull a portfolio, run projections.
- **Budget + expense tracking** — WIRE `manage-property-expenses` (+ a budget helper). Help an
  operator see/plan spend (help track — not keep books).
- **Market trend tracking** — WIRE `manage-market-reports` / `generate-market-report`
  (+ `weekly-market-data-refresh`). Surface up-and-down trends.

> Note: confirm each backend's exact I/O when wiring (names captured from the live inventory;
> not yet individually audited).

### Net-new capabilities
- **Deep market research** — NEW. Penny has no live web access today. Add a research tool
  (web search / market-data feed) so she can do genuine market research.
- **Calendar sync** — NEW, biggest piece. Connect the operator's calendar (Google / iCal / Calendly)
  so Penny can SEE their bookings/occupancy and help plan around them (read-only; never manages the calendar).
- **Operator memory** — NEW. Per-operator memory so Penny remembers each operator's portfolio, goals,
  and budgets across sessions and "sticks with them" instead of starting cold.
- **Dedicated investor/operator Penny surface** — so operators get this partner directly, not only staff.

### Sequencing (proposed)
1. **Finish code cleanup first** (pull all live functions into the repo → full understanding). ← in progress
2. Wire the existing backends (ZIP/lead, portfolio, expenses, market) into Penny.
3. Build net-new: operator memory → calendar sync → deep research.
4. Stand up / upgrade the dedicated operator-facing Penny.
5. Extend to landlords if desired.

---

## Open platform items (context for Penny work)
- **P0 (security, OPEN):** `ayp-db` backdoor — fail-closed fix staged on `main`; waiting on the owner
  to set `AYP_DB_SECRET` (>=16 chars) in BOTH Supabase and the Railway backend, then deploy.
- **P1 (security, CLOSED 2026-08-03):** investor passwords now all bcrypt (43/43, verified).
- **Code hygiene (in progress):** only ~33 of ~130 live functions were in the repo; pulling all live
  sources into git so `main` is the true source of truth.
- Minor: `security-alerts` IDOR (P3); ~2 dozen front-end dependency vulnerabilities.
