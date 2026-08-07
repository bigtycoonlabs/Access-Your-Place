import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsPaymentDestination,
  destinationRefusal,
  PENNY_PAYMENT_DOCTRINE,
  PENNY_OWNERSHIP,
} from './doctrine.ts';

/* ---------------------------------------------------------------------------
 * The guard exists because reciting a payment destination is irreversible in a
 * way almost nothing else Penny does is. These tests cover both failure modes:
 * emitting a CORRECT destination, and emitting a CORRUPTED one. The second is
 * the dangerous case — that is the address that loses the money.
 * ------------------------------------------------------------------------- */

// Representative live-shaped values. Not the production values.
const KNOWN = ['@payayp', '$accessyourplace', 'bc1qexampleaddressvaluehere0000', '026009593', '898143863808'];

test('clean operational text is not flagged', () => {
  const ok = [
    'Open the Payments tab and use the copy button next to Bitcoin.',
    'We take Zelle, wire, Cash App and Bitcoin — no cards.',
    'Wires go to Cooper Family Inc, the parent company of Set Up Your Place LLC.',
    'That deal has 3 beds and 2 baths at $2,500 a month.',
    'I sent your screenshot to the team to confirm.',
  ];
  for (const text of ok) {
    assert.equal(containsPaymentDestination(text, KNOWN).leaked, false, `false positive on: ${text}`);
  }
});

test('a correctly reproduced known destination is caught', () => {
  for (const value of KNOWN) {
    const r = containsPaymentDestination(`Send it to ${value} please`, KNOWN);
    assert.equal(r.leaked, true, `missed known destination: ${value}`);
  }
});

test('a CORRUPTED bitcoin address is still caught — the case that loses money', () => {
  // One character dropped from the known value. Exact matching alone would wave
  // this through, which is precisely the disaster the guard exists to prevent.
  const corrupted = 'bc1qexampleaddressvaluehere000';
  assert.notEqual(corrupted, KNOWN[2]);
  const r = containsPaymentDestination(`The address is ${corrupted}`, KNOWN);
  assert.equal(r.leaked, true);
  assert.ok(r.kinds.includes('bitcoin address'));
});

test('an entirely unknown bitcoin address is caught by shape', () => {
  const r = containsPaymentDestination('Send BTC to bc1q9d8ufkw2mzq7rr3vslxpr4ka2nv0ptrx', []);
  assert.equal(r.leaked, true);
  assert.ok(r.kinds.includes('bitcoin address'));
});

test('legacy-format bitcoin addresses are caught', () => {
  const r = containsPaymentDestination('use 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', []);
  assert.equal(r.leaked, true);
});

test('destinations broken up for "readability" are still caught', () => {
  // Splitting a destination across separators is a natural thing for a model to
  // do when trying to be helpful to a screen reader, and it is just as unsafe.
  const spaced = containsPaymentDestination('routing is 026 009 593', KNOWN);
  assert.equal(spaced.leaked, true);

  const hyphenated = containsPaymentDestination('account 898-143-863-808', KNOWN);
  assert.equal(hyphenated.leaked, true);

  const chunked = containsPaymentDestination('bc1q example address valuehere0000', KNOWN);
  assert.equal(chunked.leaked, true);
});

test('routing and account numbers are caught by shape even when unknown', () => {
  const r = containsPaymentDestination('Wire to routing 121000248, account 000123456789', []);
  assert.equal(r.leaked, true);
  assert.ok(r.kinds.includes('account or routing number'));
});

test('ordinary money amounts and short numbers are not mistaken for destinations', () => {
  for (const text of [
    'The acquisition fee is $2,500 and setup is $3,350.',
    'That property returned $4,200 last month across 28 nights.',
    'Call them on 555 0134.',
  ]) {
    assert.equal(containsPaymentDestination(text, KNOWN).leaked, false, `false positive on: ${text}`);
  }
});

test('empty and absent input is safe', () => {
  assert.equal(containsPaymentDestination('', KNOWN).leaked, false);
  assert.equal(containsPaymentDestination('anything', []).leaked, false);
});

/* ------------------------------ the refusal ------------------------------ */

test('the refusal gives a route forward, not just a no', () => {
  const r = destinationRefusal('Bitcoin');
  assert.match(r, /Payments tab/);
  assert.match(r, /copy button/);
  // States the consequence, so it reads as care rather than obstruction.
  assert.match(r, /can't get it back/i);
});

test('the refusal itself never contains a destination', () => {
  assert.equal(containsPaymentDestination(destinationRefusal('wire'), KNOWN).leaked, false);
  assert.equal(containsPaymentDestination(destinationRefusal(), KNOWN).leaked, false);
});

/* ------------------------------ doctrine text ------------------------------ */

test('payment doctrine states the rails, the holding company, and both credit lists', () => {
  for (const term of ['Zelle', 'wire', 'Cash App', 'Bitcoin', 'Cooper Family Inc']) {
    assert.ok(PENNY_PAYMENT_DOCTRINE.includes(term), `doctrine missing: ${term}`);
  }
  // The exclusions matter more than the inclusions — a client will assume
  // credits cover these.
  for (const term of ['furniture', 'deposits', 'application fees', 'landlord rent']) {
    assert.ok(PENNY_PAYMENT_DOCTRINE.toLowerCase().includes(term), `doctrine missing exclusion: ${term}`);
  }
});

test('doctrine draws the line between intake and confirmation', () => {
  assert.match(PENNY_PAYMENT_DOCTRINE, /DO NOT CONFIRM/);
});

test('the doctrine text does not itself contain a payment destination', () => {
  assert.equal(containsPaymentDestination(PENNY_PAYMENT_DOCTRINE, KNOWN).leaked, false);
});


/* ---- ownership: the whole platform is Penny's job ---- */

test("OWNERSHIP: Penny is told the whole platform is hers, not one desk", () => {
  const t = PENNY_OWNERSHIP.toLowerCase();
  for (const area of ['clients', 'landlords', 'staff', 'marketplace', 'research', 'issues']) {
    assert.ok(t.includes(area), `ownership block never mentions ${area}`);
  }
  assert.ok(t.includes('the whole platform'), 'does not claim the whole platform');
});

test("OWNERSHIP: coaching acquisition and setup managers is explicitly hers", () => {
  const t = PENNY_OWNERSHIP.toLowerCase();
  assert.ok(t.includes('acquisition managers'), 'does not tell her to coach acquisition managers');
  assert.ok(t.includes('setup managers'), 'does not tell her to coach setup managers');
});

// The load-bearing one. Total ownership of the OUTCOME must never become permission to
// claim the MECHANISM. A Penny who believes she can do anything will report doing things
// she did not do, and both owners are blind and cannot catch that by looking at a screen.
test("OWNERSHIP: owning everything never licenses claiming everything", () => {
  const t = PENNY_OWNERSHIP.toLowerCase();
  assert.ok(t.includes('does not mean claiming everything'),
    'missing the line separating ownership from capability');
  assert.ok(t.includes('route'), 'never tells her to route what she cannot do');
  assert.ok(t.includes('make sure a tool actually did it'),
    'missing the check against reporting an action that never ran');
});

test("OWNERSHIP: the ambition is stated, and trust is named as the product", () => {
  const t = PENNY_OWNERSHIP.toLowerCase();
  assert.ok(t.includes('undisputed'), 'the ambition is not stated');
  assert.ok(t.includes('trust'), 'trust is not named as the product');
});
