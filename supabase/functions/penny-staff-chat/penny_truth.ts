// penny_truth.ts - Penny's shared TRUTH SPINE (Phase 0 of the v11 master plan).
//
// Ported from Clay's clay/interpreter.js + clay/actionGuard.js (which were themselves
// ported from Arbo), and adapted to Penny's real stateful actions on Access Your Place.
//
// The guiding principle, from a blind founder: a confident wrong answer is worse than an
// honest "let me check." Penny can write "I've credited your account and unlocked the deal"
// or "check your inbox" when no tool did any of it - and a client or founder who cannot see
// that nothing changed will never know. So this module makes two guarantees structural,
// not prompt-level:
//   1) A reply that CLAIMS a stateful action was COMPLETED is only allowed to stand if a
//      tool actually performed that action this turn (the false-action-claim guard).
//   2) An empty or failed result is never dressed up as a real answer (the interpreter).
//
// Pure, dependency-free, deploy-safe. Imported by every Penny surface.

// -----------------------------------------------------------------------------
// PART 1 - THE RESULT INTERPRETER
// Every tool result / section is classified so the platform never presents an empty
// or failed result as a real answer.
//   answered     - real, substantive content was produced
//   empty        - Penny ran but produced nothing usable
//   unavailable  - Penny could not run (no key, upstream error, timeout, "I don't have")
//   refused      - Penny declined on policy grounds (and says why)
// -----------------------------------------------------------------------------

export type ResultStatus = "answered" | "empty" | "unavailable" | "refused";
export const STATUSES: ResultStatus[] = ["answered", "empty", "unavailable", "refused"];

export function classifyResult(value: unknown): ResultStatus {
  if (value == null) return "empty";
  // Empty containers are empty, not answers.
  if (Array.isArray(value) && value.length === 0) return "empty";
  if (typeof value === "object" && !Array.isArray(value)) {
    if (Object.keys(value as Record<string, unknown>).length === 0) return "empty";
    return "answered";
  }
  const t = String(value).trim();
  if (!t) return "empty";
  if (t.length < 240 && /^(unable to|cannot|can'?t|i don'?t have|no data|not available|error|failed)/i.test(t)) {
    return "unavailable";
  }
  return "answered";
}

// Coverage across a package of named sections: what came back vs. what's missing,
// described plainly so a blind user hears the truth, not a green checkmark.
export interface Coverage {
  present: string[];
  missing: string[];
  complete: boolean;
  gap_description: string;
}

export function assessCoverage(sections: Record<string, unknown>): Coverage {
  const present: string[] = [];
  const missing: string[] = [];
  for (const [key, val] of Object.entries(sections)) {
    (classifyResult(val) === "answered" ? present : missing).push(key);
  }
  const total = present.length + missing.length;
  return {
    present,
    missing,
    complete: missing.length === 0,
    gap_description: missing.length
      ? `Penny produced ${present.length} of ${total} sections. Still missing: ${missing.join(", ")}.`
      : "Penny produced every section.",
  };
}

// -----------------------------------------------------------------------------
// PART 2 - THE FALSE-ACTION-CLAIM GUARD
// A reply that claims a stateful action was COMPLETED is only true if a tool actually
// did it this turn. Matches COMPLETION language ("I've credited your account", "it's in
// your inbox"), never a truthful STATUS READOUT ("your deal is still sealed"), never an
// OFFER or a FUTURE ("I can unlock it", "want me to email it?", "once the team confirms").
// -----------------------------------------------------------------------------

export type ActionClass =
  | "credited"
  | "unlocked"
  | "payment_confirmed"
  | "emailed"
  | "deal_listed"
  | "status_changed";

export const CLASSES: ActionClass[] = [
  "credited", "unlocked", "payment_confirmed", "emailed", "deal_listed", "status_changed", "closing_recorded",
];

// If any of these frame the sentence as an offer or a future intention, a nearby verb is
// NOT a completion. Includes Penny's normal "once the team confirms, I'll credit" language.
const OFFER_OR_FUTURE =
  /\b(want me to|would you like|shall i|i can|i could|i'?ll|i will|do you want|ready to|i'?d be happy to|happy to|i'?m going to|about to|going to|if you(?:'?d)? (want|like)|just say|let me know|once (you|the team|they|it)|when (you|the team|they)|after (you|the team|they)|as soon as|will (be )?(credit|unlock|confirm|send|email|list))\b/;

function has(t: string, re: RegExp): boolean {
  return re.test(t);
}

// Detect which COMPLETED action classes a reply claims. Order-independent; a reply can
// claim several. Offer/future framing anywhere in the text suppresses all detections.
// Run the six completion detectors on ONE lowercased clause. The offer/future veto is NOT
// applied here; the caller applies it per-sentence so a polite sign-off or a fresh offer in
// a later sentence cannot cancel a genuine completion ("I've sent the invitation") stated
// earlier. Only offer/future framing in the SAME sentence as the claim suppresses it.
function detectClaimsInClause(t: string): ActionClass[] {
  const out: ActionClass[] = [];

  // CREDITED - an account credit was issued.
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\bcredited\b/) ||
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(issued|applied|added|put)\b[^.!?]{0,25}\bcredit/) ||
    has(t, /\byour (account|credit)\b[^.!?]{0,22}\b(has been|is now|was|have been)\b[^.!?]{0,15}\bcredited\b/) ||
    has(t, /\bcredit\b[^.!?]{0,12}\b(has been|is now|was)\b[^.!?]{0,10}\b(applied|added|issued|on your account)\b/)
  ) out.push("credited");

  // UNLOCKED / UNSEALED - deal access granted or the identity revealed.
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(unlocked|unsealed|granted|opened up|revealed)\b[^.!?]{0,25}\b(the deal|deal|access|the address|the property|the details|it for you)\b/) ||
    has(t, /\b(the deal|the address|your access|the full details?|the property|the listing)\b[^.!?]{0,22}\b(is|are|has been|have been)\b[^.!?]{0,14}\b(now )?(unlocked|unsealed|open|available|revealed|granted)\b/)
  ) out.push("unlocked");

  // PAYMENT CONFIRMED - a payment was verified/approved by us.
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(confirmed|verified|approved)\b[^.!?]{0,22}\b(the |your |this )?payment\b/) ||
    has(t, /\byour payment\b[^.!?]{0,18}\b(has been|is|was|have been)\b[^.!?]{0,12}\b(confirmed|verified|approved|received and confirmed|all set|cleared)\b/) ||
    has(t, /\bpayment\b[^.!?]{0,10}\b(is )?(confirmed|verified|approved)\b[^.!?]{0,20}\b(you'?re all set|your account|the deal)\b/)
  ) out.push("payment_confirmed");

  // EMAILED - sent an email, sent an invite/welcome/account link, or told them to check their inbox.
  // Covers client-facing ("sent it to you" / "check your inbox") AND staff-facing onboarding
  // claims ("I've sent the invitation to Maria", "the invite is on its way") - the latter would
  // otherwise slip past because the recipient is a third party, not "you".
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(emailed|sent)\b[^.!?]{0,32}\b(to (you|your inbox|your email)|it to you|your way|over to you|to your inbox|to your email)\b/) ||
    has(t, /\b(check|it'?s in|it is in|you'?ll find it in|i'?ve put it in|i'?ve dropped it in) your (inbox|email)\b/) ||
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,40}\b(sent|emailed|dispatched|fired off|shot off)\b[^.!?]{0,40}\b(invit\w*|welcome(?:\s+(?:email|message))?|onboarding(?:\s+(?:email|invite|link))?|account[- ]?(?:creation|setup|invite|link|email)|sign[- ]?up(?:\s+(?:email|link|invite))?)\b/) ||
    has(t, /\bthe (invit\w*|welcome email|onboarding email|account (?:email|link)|sign[- ]?up (?:email|link))\b[^.!?]{0,24}\b(is|has been|was|have been|'?s)\b[^.!?]{0,16}\b(sent|on its way|on the way|out the door|delivered)\b/)
  ) out.push("emailed");

  // DEAL LISTED - a property was published to the marketplace (Penny never does this in chat).
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(listed|posted|published|put)\b[^.!?]{0,25}\b(deal|property|listing|marketplace|up (for sale|live))\b/) ||
    has(t, /\b(the|your) (deal|property|listing)\b[^.!?]{0,16}\b(is|has been)\b[^.!?]{0,10}\b(now )?(live|listed|posted|published)\b/)
  ) out.push("deal_listed");

  // STATUS CHANGED - an opportunity status/note was written (staff desk).
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(updated|changed|marked|set|saved|added)\b[^.!?]{0,25}\b(status|the note|a note|as (contacted|closed|won|lost|new)|to (contacted|closed|won|lost))\b/)
  ) out.push("status_changed");

  // CLOSING RECORDED - a completed deal was entered into the company ledger / P&L (staff desk).
  // Distinct from deal_listed (publishing to the marketplace): this is booking a finished closing.
  if (
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(recorded|logged|entered|booked|saved|added|put)\b[^.!?]{0,30}\b(closing|deal record|the deal|the closing|it)\b[^.!?]{0,24}\b(in|into|to|on)\b[^.!?]{0,14}\b(the )?(ledger|books|p&l|p and l|profit and loss|record|system)\b/) ||
    has(t, /\b(i'?ve|i have|i just|we'?ve|we have)\b[^.!?]{0,45}\b(recorded|logged|entered|booked)\b[^.!?]{0,22}\b(the )?(closing|deal)\b/) ||
    has(t, /\b(the )?(closing|deal record)\b[^.!?]{0,20}\b(is|has been|was|have been)\b[^.!?]{0,14}\b(recorded|logged|entered|booked|on the books|in the books|in the ledger)\b/)
  ) out.push("closing_recorded");

  return out;
}

// Public entry: which COMPLETED action classes a reply claims. Evaluated sentence by
// sentence, so a real completion is not cancelled by an offer or a polite sign-off
// elsewhere in the message ("I've sent the invitation. Just let me know if you need
// anything else.").
export function claimedCompletedActions(text: string): ActionClass[] {
  const raw = text || "";
  if (!raw.trim()) return [];
  const out = new Set<ActionClass>();
  for (const sentence of raw.split(/[.!?]+\s+/)) {
    const t = sentence.toLowerCase();
    if (!t.trim()) continue;
    const found = detectClaimsInClause(t);
    if (!found.length) continue;
    // Offer/future framing in THIS sentence means its claim is not a completion.
    if (has(t, OFFER_OR_FUTURE)) continue;
    for (const cls of found) out.add(cls);
  }
  return [...out];
}

// Which action classes a successfully-run tool actually backs. A tool not listed here
// backs nothing - and email on the client surfaces / deal-listing in chat back NOTHING,
// which is the whole point.
const TOOL_BACKS: Record<string, ActionClass[]> = {
  // Staff desk tools.
  penny_confirm_payment: ["payment_confirmed", "credited", "unlocked"],
  send_client_email: ["emailed"],
  send_account_invite: ["emailed"],
  update_opportunity_status: ["status_changed"],
  add_opportunity_note: ["status_changed"],
  record_closing: ["closing_recorded"],
  update_community: ["status_changed"],
  invite_staff: ["emailed"],
};

export function backedActionsFromTools(toolsRun: string[]): Set<ActionClass> {
  const s = new Set<ActionClass>();
  for (const tool of toolsRun) {
    for (const cls of TOOL_BACKS[tool] || []) s.add(cls);
  }
  return s;
}

// Per-class honest correction (a re-prompt instruction) and a deterministic fallback
// appended when a rewrite still leaves the false claim, so the person ALWAYS gets the truth.
const META: Record<ActionClass, { correction: string; fallback: string }> = {
  credited: {
    correction:
      "you told the client their account was credited, but no tool issued a credit this turn - only the success team, after confirming a payment, can credit an account",
    fallback:
      "To be straight with you: I haven't credited your account yet. Our success team confirms your payment first, and the credit goes on right after that.",
  },
  unlocked: {
    correction:
      "you told the client the deal is unlocked, but nothing unlocked it this turn - a deal only unlocks after the success team confirms payment",
    fallback:
      "To be accurate: the deal isn't unlocked yet. It opens up the moment our success team confirms your payment.",
  },
  payment_confirmed: {
    correction:
      "you told the client their payment is confirmed, but you cannot confirm a payment - only the success team does, and no confirmation ran this turn",
    fallback:
      "To be honest: I can't confirm a payment myself. I've passed it to our success team, and they confirm it before anything is credited or unlocked.",
  },
  emailed: {
    correction:
      "you told the person you emailed them or that it's in their inbox, but no email was sent this turn - telling a blind person to 'check your inbox' when nothing was sent is exactly the false claim never to make",
    fallback:
      "To be honest: I haven't emailed anything from here. Let me know and I'll get it to the right place for you.",
  },
  deal_listed: {
    correction:
      "you told them a deal is listed, but nothing listed it this turn - listing a property happens in the List a Deal tab, not in chat",
    fallback:
      "To be accurate: I haven't listed anything from here. Listing a property happens in the List a Deal tab.",
  },
  status_changed: {
    correction:
      "you told the staff member a status or note was saved, but no write ran this turn - say plainly what you'd change and do it only after a clear yes",
    fallback:
      "To be accurate: I haven't saved that change yet. Tell me to go ahead and I'll make it.",
  },
  closing_recorded: {
    correction:
      "you told the staff member the closing was recorded, but no tool recorded a deal this turn - recording a closing writes to the live company P&L and only counts when record_closing actually runs and returns success",
    fallback:
      "To be accurate: I haven't recorded that closing yet. Confirm the numbers and tell me to go ahead, and I'll record it.",
  },
};

export interface ClaimIssue {
  kind: ActionClass;
  correction: string;
  fallback: string;
}

// The audit: which claimed completions are NOT backed by a tool that ran this turn.
export function auditUnbackedClaims(text: string, backed: Set<ActionClass>): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  for (const a of claimedCompletedActions(text)) {
    if (!backed.has(a)) issues.push({ kind: a, correction: META[a].correction, fallback: META[a].fallback });
  }
  return issues;
}

// A single "STOP -" instruction to hand the model so it rewrites the reply truthfully.
export function buildCorrection(issues: ClaimIssue[]): string {
  return (
    "STOP - you just told the person something no tool did this turn: " +
    issues.map((i) => i.correction).join("; ") +
    ". Rewrite your reply so it makes no such claim: offer the step and let them decide, or state the honest status. " +
    "Never tell someone something was done for them unless a tool truly did it this turn. They may be blind and cannot see that nothing changed."
  );
}

// Deterministic honest fallback appended when a rewrite still leaves a false claim, so the
// person always receives the correction even if the model won't rephrase.
export function appendFallbacks(text: string, issues: ClaimIssue[]): string {
  const adds = issues.map((i) => i.fallback);
  return (text ? String(text).trim() + "\n\n" : "") + adds.join(" ");
}

// Convenience: the deterministic guard. Given a reply and the tools that actually ran,
// return the safe reply (with an honest correction appended if any claim was unbacked)
// plus the issues found. This is the guaranteed floor used on single-shot surfaces.
export interface GuardResult {
  text: string;
  issues: ClaimIssue[];
  ok: boolean;
}

export function guardReply(text: string, toolsRun: string[] = []): GuardResult {
  const backed = backedActionsFromTools(toolsRun);
  const issues = auditUnbackedClaims(text, backed);
  return {
    text: issues.length ? appendFallbacks(text, issues) : text,
    issues,
    ok: issues.length === 0,
  };
}
