# Penny Capability Evaluation

Prepared for Vission Cooper, Set Up Your Place LLC.
Basis: all 161 live edge functions, mirrored verbatim into the repo, plus live database counts taken the same day.
Nothing in this document was changed in production. This is findings only.

---

## The headline

**The Penny truth spine is not wired into anything.**

The folder `supabase/functions/_shared/penny/` contains five modules — `capability.ts`, `doctrine.ts`, `compose.ts`, `executor.ts`, `tools.ts` — with full test suites beside each one. It is careful, well-structured work. It defines who Penny is talking to, what stays sealed until money is down, which tools exist, and how results get interpreted honestly.

No live edge function imports any of it. Not one. I checked every import path form across all 161 functions and found zero references.

Every Penny function in production carries its own inline logic instead. `penny-staff-chat` declares its own tool array, builds its own system prompt, and calls OpenAI directly. The spine sits beside it, tested and unused.

This is the single most important fact in this evaluation, and it is good news. It means the hard thinking is already done and simply hasn't been connected. The work ahead is wiring, not designing.

---

## What Penny actually does today

There are fifteen Penny-named functions live. They are not one assistant. They are three different things sharing a name.

### 1. The staff assistant — real, and the only one with tools

`penny-staff-chat` is the substantial one: 1,136 lines, running `gpt-4o` via the OpenAI API directly, with 21 tools wired and working.

Her read tools: `find_client`, `check_account`, `get_client_activity`, `get_client_email`, `get_opportunity`, `list_opportunities`, `get_community`, `list_communities`, `list_escalations`, `list_pending_emails`, `get_activity_report`.

Her write tools: `add_opportunity_note`, `update_opportunity_status`, `update_community`, `record_closing`, `resolve_escalation`, `compose_client_email`, `send_client_email`, `send_account_invite`, `invite_staff`.

So Penny can genuinely look up a client, read their activity, inspect an opportunity, draft and send a client email, record a closing, and invite staff. That is a real working assistant, not a demo.

### 2. The public assistant — conversation only

`penny-public-chat` has **no tools at all**. It is a pure conversational surface. She cannot look anything up for a visitor. Whatever she says to the public comes from the prompt, not from data.

### 3. The specialist functions — narrow, single-purpose

`penny-deal-scoring`, `penny-portfolio-analysis`, `penny-property-photos`, `penny-deal-intake`, `penny-generate-description`, `penny-staff-brief`, `penny-score-monitoring`, `nightly-penny-score-refresh`, plus four small alert senders. These are jobs, not conversation. They do one thing each and return.

`penny-landlord-chat` exists in the repo but is **not deployed live**. It needs a keep-or-delete decision.

---

## The owner problem, precisely

You and Rel both have `is_owner = true` in `staff_users`. That data is correct.

`penny-staff-chat` reads `is_owner` in exactly one place — a helper called `staffIsOwner()` at line 381 — and calls it for exactly one purpose: gating the `invite_staff` tool at line 597.

Penny is never *told* she is talking to an owner. The system prompt receives `staffName` but not owner status. So in conversation she treats you exactly as she treats any success manager.

And the shared capability spine has no owner concept either. Its `ROLES` list is: `visitor`, `client`, `landlord`, `acquisition_closer`, `admin_support`, `setup_manager`. There is no owner tier and nowhere to hang master access. Both of your `role` values in `staff_users` are `success_managers`.

The fix is small but touches shared ground: add `owner` to the role vocabulary, thread the `is_owner` lookup into the composed prompt, and gate owner-only powers off it. Because Clay and Arbo share this family, that change needs your explicit go-ahead before I touch it.

---

## What the spine promises that production does not deliver

`capability.ts` describes a business model in precise terms:

- A **$1,250 account deposit carrying 20 credits**, with client credit states of `unfunded`, `funded`, and `exhausted`.
- Two deal paths: `leadforge` finds, where identity unlocks on **account** funding, and `marketplace` operations, where identity unlocks on **that operation's own** deposit.
- Open fields always visible: score, data, summary, photos.
- Sealed fields until deposit: address, links, sources, landlord contact, operation takeover details.

None of that gating is enforced by any live function. It is a designed model sitting in unwired code.

That matters more than a normal unwired feature, because it is the confidentiality boundary. The comment in `capability.ts` calls itself "the SERVER-AUTHORITATIVE source of truth for what a given viewer may see." Right now nothing is authoritative — each function decides for itself.

---

## The honesty gap

Penny's doctrine holds that every number she states came from a tool that measured it. Four production functions violate that rule. All four are candidates for deletion rather than repair, and none of them is currently wired to Penny — but if any were wired as-is, they would poison her.

- `weekly-market-data-refresh` — invents all market figures, either from `Math.random()` or by asking a model with no data access. **Has never written a row.**
- `scheduled-report-generation` — client-facing PDF market reports generated entirely by prompting a model with no data. **Has never run.**
- `staff-deal-search` — silently substitutes hardcoded constants (ADR $150, occupancy 65%) when its AI call fails, labelled as "regional averages."
- `manage-portfolio-performance` — falls back to canned heuristics when the Anthropic key is absent.

The Penny AI SOP states her scoring draws on "market data snapshots, updated weekly." Those snapshots exist — 33 rows — but none came from the fabricator. Their `data_source` values are `market_research` and `aggregated`, and the newest is dated 1 February 2026. So Penny's market inputs are real but **six months stale**, not fabricated. That is a different and much more fixable problem.

---

## Two in-house patterns worth copying

We do not need to invent a standard for honest tools. Two functions already do it right.

`notify-matching-investors` counts only sends that actually returned OK, supports staff exclusions, and records `matched`, `notified`, `emailed`, and `excluded` as four separate numbers.

`submit-deal-inquiry` returns the real send result, and writes a staff note saying either "notified" or "NOT notified (email failed)" — recording the truth either way.

**Proposed rule for the wiring phase: no function becomes a Penny tool until it reports what actually happened.**

---

## Scale check

Live counts, same day:

21 properties. 34 investors. 1 resident. 154 property photos. 47 blog articles, newest December 2025. 9 AM agreements, 5 signed. 9,544 investor invitations. Zero email campaigns, zero digital products, zero seller documents, zero draft articles, zero SMS ever sent.

The platform's real centre of gravity is **deal flow and invitations**. Most of the surrounding subsystems have never been used. Penny's expansion should follow the usage, not the code volume.

---

## Recommended order of work

1. **Owner tier.** Add `owner` to the capability vocabulary and thread `is_owner` into the composed prompt. Small, high value, unblocks everything else. Needs your go-ahead.
2. **Wire the spine.** Point `penny-staff-chat` at `_shared/penny/` instead of its inline copies. The tests already exist.
3. **Refresh the market inputs.** Snapshots are six months old. Decide on a real data source before Penny quotes market figures to anyone.
4. **Enforce the confidentiality gate** from `capability.ts` in one server-authoritative place.
5. **Then extend her tools** — deal marketplace writes, landlord communications, agreement sending — using the two honest patterns above.

Do the deletions first. Several problems on this list disappear when the code carrying them is gone.
