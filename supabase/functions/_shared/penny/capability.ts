// Penny capability & confidentiality core — Phase 0 of the Access Your Place overhaul.
//
// Pure, dependency-free logic (safe in both Deno edge functions and Node tests).
// It answers the two foundational questions before Penny ever acts or reveals
// anything:
//   1. WHO is Penny talking to, and what may she do?   (capability profile)
//   2. WHAT stays sealed until money is down?           (confidentiality gate)
//
// Nothing here performs I/O or anything irreversible. This is the frame the whole
// money model hangs on, and it is the SERVER-AUTHORITATIVE source of truth for
// what a given viewer may see — the frontend may mirror it, but this decides.

/* ============================ Vocabulary (enum-guarded) ============================ */

export const SURFACES = ['public', 'client', 'landlord', 'staff'] as const;
export type Surface = (typeof SURFACES)[number];

// Roles a viewer can hold. The three staff roles ARE the unified Success team.
export const ROLES = [
  'visitor', // unauthenticated public
  'client', // an investor / operator using the platform
  'landlord', // a property owner onboarded to the platform
  'acquisition_closer', // negotiates, finalizes; the ONLY role that lists/approves deals
  'admin_support', // admin / dispute resolution / issue handling
  'setup_manager', // on-the-ground project management
  'owner', // Vission or Rel — carries staff_users.is_owner; sees and may do everything
] as const;
export type Role = (typeof ROLES)[number];

// Owner is a STAFF role: it inherits every staff power and confidentiality
// clearance, then adds owner-only powers on top. Listing it here means no
// existing staff check has to learn about owners separately.
export const STAFF_ROLES: readonly Role[] = [
  'acquisition_closer',
  'admin_support',
  'setup_manager',
  'owner',
];

// Owner status is NOT self-declared and NOT inferable from the staff role
// string. It is the is_owner column on staff_users, read server-side, and it
// must be threaded into the composed prompt so Penny actually knows who she is
// speaking to — otherwise she treats an owner as an ordinary success manager.
export function isOwner(role: Role): boolean {
  return role === 'owner';
}

// A client's funding / credit posture — drives the confidentiality gate on LeadForge finds.
//   unfunded  — no active deposit; sees score + data only.
//   funded    — active $1,250 deposit with at least one of the 20 credits left.
//   exhausted — deposit was funded but all 20 credits used; must re-fund for more.
export const CREDIT_STATES = ['unfunded', 'funded', 'exhausted'] as const;
export type CreditState = (typeof CREDIT_STATES)[number];

// Access to a SPECIFIC marketplace/takeover operation's confidential file — a
// separate, per-operation deposit, independent of account funding.
export const OPERATION_ACCESS = ['none', 'deposit_paid'] as const;
export type OperationAccess = (typeof OPERATION_ACCESS)[number];

/* ============================ Deal fields, by sensitivity ============================ */

// Always open — the hook that earns trust before any money is down.
export const OPEN_DEAL_FIELDS = ['score', 'data', 'summary', 'photos'] as const;
// Confidential identity — sealed until the matching deposit is paid.
export const SEALED_DEAL_FIELDS = [
  'address',
  'links',
  'sources',
  'landlord_contact',
  'operation_takeover_details',
] as const;
export type DealField = (typeof OPEN_DEAL_FIELDS)[number] | (typeof SEALED_DEAL_FIELDS)[number];

// The two deal paths unlock identity differently:
//   'leadforge'   — a Penny/LeadForge find; identity unlocks on ACCOUNT funding.
//   'marketplace' — a listed operation/takeover; identity unlocks on THAT
//                   operation's own deposit, regardless of account funding.
export const DEAL_KINDS = ['leadforge', 'marketplace'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

/* ============================ Viewer context ============================ */

export interface ViewerContext {
  surface: Surface;
  role: Role;
  creditState?: CreditState; // for clients
  operationAccess?: OperationAccess; // for a specific marketplace operation being viewed
}

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/* ==================== Capability profile: (surface × role × credit) → powers ==================== */

export interface CapabilityProfile {
  role: Role;
  surface: Surface;
  canWrite: boolean; // may Penny perform any write in this context
  turnBudget: number; // bounded reasoning turns
  toolCallBudget: number; // bounded tool calls per turn
  // Tool NAMES arrive in later phases; Phase 0 fixes the shape, the budgets, and
  // the write boundary, so no scattered role checks appear downstream.
}

export function capabilityProfile(ctx: ViewerContext): CapabilityProfile {
  const base = { role: ctx.role, surface: ctx.surface };

  // Owner at the staff desk: the widest context Penny ever operates in. Wider
  // budgets because owners ask cross-cutting questions that legitimately need
  // several lookups before an answer is worth anything.
  //
  // Wider budget is NOT weaker safety. Owner-only powers stay gated per-action,
  // and every irreversible action still requires explicit confirmation — being
  // the owner means Penny does not withhold, not that she stops checking.
  if (ctx.surface === 'staff' && isOwner(ctx.role)) {
    return { ...base, canWrite: true, turnBudget: 10, toolCallBudget: 14 };
  }

  // Staff control room: the only surface Penny may WRITE from. Every such write
  // is still gated per-action by the reasoning loop + approval queue (later phases).
  if (ctx.surface === 'staff' && isStaff(ctx.role)) {
    return { ...base, canWrite: true, turnBudget: 6, toolCallBudget: 8 };
  }

  // Client portal: deeper budget for funded clients (they're paying), lean for
  // unfunded/exhausted (cost control that doubles as the gate). Never writes.
  if (ctx.surface === 'client' && ctx.role === 'client') {
    const funded = ctx.creditState === 'funded';
    return { ...base, canWrite: false, turnBudget: funded ? 5 : 3, toolCallBudget: funded ? 6 : 3 };
  }

  // Landlord surface: read + reason only.
  if (ctx.surface === 'landlord' && ctx.role === 'landlord') {
    return { ...base, canWrite: false, turnBudget: 3, toolCallBudget: 3 };
  }

  // Public / visitor — top-of-funnel hook: reason + read, never write, no account tools.
  return { ...base, canWrite: false, turnBudget: 3, toolCallBudget: 3 };
}

/* ==================== Confidentiality gate: what may this viewer SEE ==================== */

export interface DealDescriptor {
  kind: DealKind;
}

export interface FieldVisibility {
  visible: DealField[];
  sealed: DealField[];
}

// The core rule of "the sell before the deal": score + data are ALWAYS open;
// identity (address / links / sources / contacts / takeover details) is sealed
// until the matching deposit is down. Staff always see everything.
export function visibleDealFields(ctx: ViewerContext, deal: DealDescriptor): FieldVisibility {
  const open = [...OPEN_DEAL_FIELDS] as DealField[];
  const sealedAll = [...SEALED_DEAL_FIELDS] as DealField[];

  if (isStaff(ctx.role)) {
    return { visible: [...open, ...sealedAll], sealed: [] };
  }

  let identityUnlocked = false;
  if (deal.kind === 'leadforge') {
    // LeadForge finds unlock on ACCOUNT funding (a funded client with credits left).
    identityUnlocked = ctx.role === 'client' && ctx.creditState === 'funded';
  } else if (deal.kind === 'marketplace') {
    // A listed operation unlocks only on THAT operation's deposit — account funding
    // alone never reveals a marketplace/takeover file.
    identityUnlocked = ctx.operationAccess === 'deposit_paid';
  }

  if (identityUnlocked) {
    return { visible: [...open, ...sealedAll], sealed: [] };
  }
  return { visible: open, sealed: sealedAll };
}

export function canSeeField(ctx: ViewerContext, deal: DealDescriptor, field: DealField): boolean {
  return visibleDealFields(ctx, deal).visible.includes(field);
}

/* ==================== Staff identity gate: usernames only ==================== */

// Only a staff member on the staff surface may see another staff member's real
// identity (name, phone, email). To a client or a landlord, staff are usernames —
// no exceptions. (The DB-side half of this — sealing staff PII columns from the
// public key — shipped in the auth lockdown; this is the application-layer rule.)
export function staffIdentityVisibleTo(ctx: ViewerContext): boolean {
  return ctx.surface === 'staff' && isStaff(ctx.role);
}

/* ============================ Derivations ============================ */

export const CREDITS_PER_DEPOSIT = 20;

// Derive the credit-state used everywhere above from raw funding info. Pure
// accounting; the ledger that PERSISTS this arrives in Phase 2.
export function deriveCreditState(input: { hasActiveDeposit: boolean; creditsUsed: number }): CreditState {
  if (!input.hasActiveDeposit) return 'unfunded';
  return creditsRemaining(input.creditsUsed) > 0 ? 'funded' : 'exhausted';
}

export function creditsRemaining(creditsUsed: number): number {
  return Math.max(0, CREDITS_PER_DEPOSIT - clampCredits(creditsUsed));
}

function clampCredits(used: number): number {
  if (!Number.isFinite(used) || used < 0) return 0;
  return Math.min(CREDITS_PER_DEPOSIT, Math.floor(used));
}
