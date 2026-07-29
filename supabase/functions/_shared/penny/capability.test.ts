import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  capabilityProfile,
  visibleDealFields,
  canSeeField,
  staffIdentityVisibleTo,
  deriveCreditState,
  creditsRemaining,
  isStaff,
  SEALED_DEAL_FIELDS,
  OPEN_DEAL_FIELDS,
  CREDITS_PER_DEPOSIT,
  type ViewerContext,
} from './capability.ts';

/* ------------------------------ capability profile ------------------------------ */

test('staff on the staff surface may write, with the deepest budget', () => {
  const p = capabilityProfile({ surface: 'staff', role: 'acquisition_closer' });
  assert.equal(p.canWrite, true);
  assert.equal(p.turnBudget, 6);
  assert.equal(p.toolCallBudget, 8);
});

test('every staff role gets the write-capable staff profile', () => {
  for (const role of ['acquisition_closer', 'admin_support', 'setup_manager'] as const) {
    assert.equal(capabilityProfile({ surface: 'staff', role }).canWrite, true);
  }
});

test('a funded client gets a deeper budget than an unfunded one, and never writes', () => {
  const funded = capabilityProfile({ surface: 'client', role: 'client', creditState: 'funded' });
  const unfunded = capabilityProfile({ surface: 'client', role: 'client', creditState: 'unfunded' });
  assert.equal(funded.canWrite, false);
  assert.equal(unfunded.canWrite, false);
  assert.ok(funded.turnBudget > unfunded.turnBudget);
  assert.ok(funded.toolCallBudget > unfunded.toolCallBudget);
});

test('an exhausted client is treated as lean, like unfunded', () => {
  const p = capabilityProfile({ surface: 'client', role: 'client', creditState: 'exhausted' });
  assert.equal(p.turnBudget, 3);
});

test('a public visitor and a landlord can never write', () => {
  assert.equal(capabilityProfile({ surface: 'public', role: 'visitor' }).canWrite, false);
  assert.equal(capabilityProfile({ surface: 'landlord', role: 'landlord' }).canWrite, false);
});

test('a client role arriving on the public surface cannot write (no surface confusion)', () => {
  assert.equal(capabilityProfile({ surface: 'public', role: 'client' }).canWrite, false);
});

test('a staff role OUTSIDE the staff surface cannot write', () => {
  // A closer viewing the client surface is not in the control room → no write power.
  assert.equal(capabilityProfile({ surface: 'client', role: 'acquisition_closer' }).canWrite, false);
});

/* ------------------------------ confidentiality gate ------------------------------ */

const leadforge = { kind: 'leadforge' as const };
const marketplace = { kind: 'marketplace' as const };

test('a public visitor sees score + data, and NEVER the address or contacts', () => {
  const ctx: ViewerContext = { surface: 'public', role: 'visitor' };
  const v = visibleDealFields(ctx, leadforge);
  for (const f of OPEN_DEAL_FIELDS) assert.ok(v.visible.includes(f), `open field ${f} should be visible`);
  for (const f of SEALED_DEAL_FIELDS) {
    assert.ok(v.sealed.includes(f), `sealed field ${f} must be sealed`);
    assert.ok(!v.visible.includes(f), `sealed field ${f} must NOT be visible`);
  }
  assert.equal(canSeeField(ctx, leadforge, 'address'), false);
  assert.equal(canSeeField(ctx, leadforge, 'score'), true);
});

test('an UNFUNDED client cannot see a LeadForge address', () => {
  const ctx: ViewerContext = { surface: 'client', role: 'client', creditState: 'unfunded' };
  assert.equal(canSeeField(ctx, leadforge, 'address'), false);
  assert.equal(canSeeField(ctx, leadforge, 'sources'), false);
});

test('a FUNDED client CAN see LeadForge identity (funding unlocks the find)', () => {
  const ctx: ViewerContext = { surface: 'client', role: 'client', creditState: 'funded' };
  for (const f of SEALED_DEAL_FIELDS) assert.equal(canSeeField(ctx, leadforge, f), true, `funded client should see ${f}`);
  assert.deepEqual(visibleDealFields(ctx, leadforge).sealed, []);
});

test('an EXHAUSTED client is re-sealed on LeadForge finds (must re-fund)', () => {
  const ctx: ViewerContext = { surface: 'client', role: 'client', creditState: 'exhausted' };
  assert.equal(canSeeField(ctx, leadforge, 'address'), false);
});

test('account funding alone does NOT unlock a marketplace operation file', () => {
  const funded: ViewerContext = { surface: 'client', role: 'client', creditState: 'funded' };
  assert.equal(canSeeField(funded, marketplace, 'address'), false);
  assert.equal(canSeeField(funded, marketplace, 'operation_takeover_details'), false);
  // ...but the score/data are still open, so Penny can sell it.
  assert.equal(canSeeField(funded, marketplace, 'score'), true);
});

test('a paid per-operation deposit unlocks that marketplace file', () => {
  const ctx: ViewerContext = { surface: 'client', role: 'client', creditState: 'unfunded', operationAccess: 'deposit_paid' };
  for (const f of SEALED_DEAL_FIELDS) assert.equal(canSeeField(ctx, marketplace, f), true, `operation-deposit should reveal ${f}`);
});

test('a per-operation deposit does NOT leak into unrelated LeadForge finds', () => {
  const ctx: ViewerContext = { surface: 'client', role: 'client', creditState: 'unfunded', operationAccess: 'deposit_paid' };
  assert.equal(canSeeField(ctx, leadforge, 'address'), false);
});

test('staff always see every field, on both deal kinds', () => {
  const ctx: ViewerContext = { surface: 'staff', role: 'acquisition_closer' };
  for (const deal of [leadforge, marketplace]) {
    assert.deepEqual(visibleDealFields(ctx, deal).sealed, []);
  }
});

/* ------------------------------ staff identity gate ------------------------------ */

test('clients and landlords never see staff real identity; staff do', () => {
  assert.equal(staffIdentityVisibleTo({ surface: 'client', role: 'client' }), false);
  assert.equal(staffIdentityVisibleTo({ surface: 'landlord', role: 'landlord' }), false);
  assert.equal(staffIdentityVisibleTo({ surface: 'staff', role: 'admin_support' }), true);
});

test('a staff role viewing the client surface still does not expose staff identity there', () => {
  assert.equal(staffIdentityVisibleTo({ surface: 'client', role: 'acquisition_closer' }), false);
});

/* ------------------------------ credit derivation ------------------------------ */

test('no active deposit → unfunded', () => {
  assert.equal(deriveCreditState({ hasActiveDeposit: false, creditsUsed: 0 }), 'unfunded');
});

test('active deposit with credits left → funded', () => {
  assert.equal(deriveCreditState({ hasActiveDeposit: true, creditsUsed: 0 }), 'funded');
  assert.equal(deriveCreditState({ hasActiveDeposit: true, creditsUsed: 19 }), 'funded');
  assert.equal(creditsRemaining(19), 1);
});

test('active deposit fully spent → exhausted', () => {
  assert.equal(deriveCreditState({ hasActiveDeposit: true, creditsUsed: 20 }), 'exhausted');
  assert.equal(creditsRemaining(20), 0);
});

test('credit accounting clamps garbage input (never negative, never over the cap)', () => {
  assert.equal(creditsRemaining(-5), CREDITS_PER_DEPOSIT);
  assert.equal(creditsRemaining(999), 0);
  assert.equal(creditsRemaining(NaN), CREDITS_PER_DEPOSIT);
  assert.equal(deriveCreditState({ hasActiveDeposit: true, creditsUsed: 999 }), 'exhausted');
});

/* ------------------------------ sanity ------------------------------ */

test('isStaff recognizes exactly the three success-team roles', () => {
  assert.equal(isStaff('acquisition_closer'), true);
  assert.equal(isStaff('admin_support'), true);
  assert.equal(isStaff('setup_manager'), true);
  assert.equal(isStaff('client'), false);
  assert.equal(isStaff('landlord'), false);
  assert.equal(isStaff('visitor'), false);
});
