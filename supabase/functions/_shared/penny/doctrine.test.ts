import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsPaymentDestination,
  destinationRefusal,
  PENNY_PAYMENT_DOCTRINE,
  PENNY_OWNERSHIP,
  PENNY_REASONING,
  PENNY_PERSONALITY,
  PENNY_INDUSTRY_SENSE,
  PENNY_COVENANT,
  PENNY_TEAM,
  PENNY_ROUTING,
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

/* ---- the guard must not fire on our own identifiers ---- */

// Regression. An owner asked Penny to take two properties off the marketplace and got a
// payment refusal instead, because a property UUID collapses to a 30-character run of
// legal base58 and matched the legacy Bitcoin shape. A guard that fires on the platform's
// own ids does not protect anyone — it makes her incoherent and teaches people to ignore
// the one warning that must never be ignored.
test('GUARD: a property UUID is not mistaken for a bitcoin address', () => {
  const real = 'ba1cbefb-9de5-4d3c-94f8-ab39316ef4da';
  const r = containsPaymentDestination(`I have taken ${real} off the marketplace.`);
  assert.equal(r.leaked, false, `property id flagged as ${r.kinds.join(', ')}`);
});

test('GUARD: several ids in one reply still do not trip it', () => {
  const text = [
    'ba1cbefb-9de5-4d3c-94f8-ab39316ef4da',
    'eb5ed6f2-e6c8-43c5-94ed-dfb8de3efee3',
    '313fb5f2-5909-4b29-8a4f-c4d29b8694ad',
  ].join(' and ');
  assert.equal(containsPaymentDestination(text).leaked, false);
});

// The other half. Loosening a guard is only safe if you prove what it still catches.
test('GUARD: real destinations are still caught after the UUID exemption', () => {
  const bech32 = containsPaymentDestination('send to bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
  assert.equal(bech32.leaked, true, 'bech32 bitcoin address slipped through');

  const legacy = containsPaymentDestination('pay 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 today');
  assert.equal(legacy.leaked, true, 'legacy bitcoin address slipped through');

  const acct = containsPaymentDestination('account 123456789012 routing 021000021');
  assert.equal(acct.leaked, true, 'account/routing number slipped through');
});

test('GUARD: an id sitting next to a real destination still trips it', () => {
  const r = containsPaymentDestination(
    'property ba1cbefb-9de5-4d3c-94f8-ab39316ef4da, pay bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  );
  assert.equal(r.leaked, true, 'a real destination was masked by an id being present');
});

/* ---- a phone number is not a payment destination ---- */

// Regression, reported repeatedly by the owner. A phone number is TEN DIGITS and the
// digit-run rule flagged every one of them, so "what leads came in" returned a payment
// refusal instead of the lead. Reading a staff member a client's phone number is Penny's
// job; a guard that blocks it is broken, not cautious.
test('GUARD: a client phone number does not trip it', () => {
  const r = containsPaymentDestination('Rel came in through the website. Her number is 8304914125.');
  assert.equal(r.leaked, false, `phone flagged as ${r.kinds.join(', ')}`);
});

test('GUARD: formatted and international phone numbers do not trip it', () => {
  for (const n of ['(830) 491-4125', '830-491-4125', '+1 830 491 4125', '18304914125']) {
    const r = containsPaymentDestination(`Call them on ${n} today.`);
    assert.equal(r.leaked, false, `${n} flagged as ${r.kinds.join(', ')}`);
  }
});

test('GUARD: a lead list with several phone numbers stays clean', () => {
  const r = containsPaymentDestination(
    'Three leads: Rel 8304914125, Dana 5125550143, Marcus 9195550188. All want a property.',
  );
  assert.equal(r.leaked, false);
});

// The other half — proving the gate did not open too far.
test('GUARD: a digit run WITH payment language is still caught', () => {
  for (const t of [
    'the account number is 123456789012',
    'routing 021000021 for the wire',
    'send the money to 987654321098',
    'deposit into 4400123456789',
  ]) {
    assert.equal(containsPaymentDestination(t).leaked, true, `missed: ${t}`);
  }
});

test('GUARD: bitcoin is still caught with no payment words at all', () => {
  assert.equal(
    containsPaymentDestination('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').leaked,
    true,
  );
});

test('GUARD: a phone in one sentence and a wire destination in another still trips', () => {
  const r = containsPaymentDestination(
    'Call Rel on 8304914125. Then wire it to account 123456789012.',
  );
  assert.equal(r.leaked, true, 'a real destination was masked by a phone being present');
});

/* ---- reasoning and personality ---- */

test('REASONING: she is told to think about consequence, not just execute', () => {
  const t = PENNY_REASONING.toLowerCase();
  assert.ok(t.includes('consequence'), 'nothing about the consequence of a request');
  assert.ok(t.includes('look before you act'), 'nothing telling her to read before acting');
  assert.ok(t.includes('one thing at a time'), 'nothing about ordering multi-part requests');
});

// The load-bearing reasoning rule. She must never produce a figure that did not come from
// a tool this turn — that is the defect that put 42 invented scores in front of clients.
test('REASONING: numbers come from tools, never from her', () => {
  const t = PENNY_REASONING.toLowerCase();
  assert.ok(t.includes('numbers come from tools'), 'missing the rule that numbers come from tools');
  assert.ok(t.includes('do not calculate money in your head'), 'missing the money-maths prohibition');
});

test('REASONING: an empty result must be explained, not left as a bare zero', () => {
  assert.ok(PENNY_REASONING.toLowerCase().includes('when something is empty'));
});

test('PERSONALITY: she is told not to open the same way twice', () => {
  assert.ok(PENNY_PERSONALITY.toLowerCase().includes('never open with the same line twice'));
});

test('PERSONALITY: filler phrases are banned by name', () => {
  const t = PENNY_PERSONALITY;
  for (const phrase of ['Certainly', "I'd be happy to", 'Great question']) {
    assert.ok(t.includes(phrase), `filler phrase not banned by name: ${phrase}`);
  }
});

// Character is worth nothing if it collapses under disagreement. She is meant to push back
// once and then do what she was asked - not to be agreeable, and not to be obstructive.
test('PERSONALITY: she is told to have a view and still do what was asked', () => {
  const t = PENNY_PERSONALITY.toLowerCase();
  assert.ok(t.includes('have a view'), 'she is not told to hold a view');
  assert.ok(t.includes('then do what they asked'), 'she is not told to defer after saying it');
});

test('PERSONALITY: she is told to match the moment, emergencies included', () => {
  assert.ok(PENNY_PERSONALITY.toLowerCase().includes('emergency'));
});

/* ---- soul: what she knows in her bones ---- */

// Soul is specificity. A prompt saying "be insightful" produces a caricature; knowing that
// a new listing does not fill for 60-90 days is what makes her sound like she has actually
// been here. These pin the specifics rather than the adjectives.
test('SOUL: she knows the unglamorous specifics of a launch', () => {
  const t = PENNY_INDUSTRY_SENSE.toLowerCase();
  assert.ok(t.includes('60 to 90 days'), 'does not know the ramp period');
  assert.ok(t.includes('furnishing'), 'does not know where budgets die');
  assert.ok(t.includes('cleaner'), 'does not know about operations failures');
});

test('SOUL: she knows how landlords actually behave', () => {
  const t = PENNY_INDUSTRY_SENSE.toLowerCase();
  assert.ok(t.includes('most say no'), 'does not know the base rate of rejection');
  assert.ok(t.includes('goes quiet'), 'does not know what silence after a yes means');
  assert.ok(t.includes('master lease'), 'does not distinguish lease types');
});

test('SOUL: she knows why our data beats an aggregator', () => {
  const t = PENNY_INDUSTRY_SENSE.toLowerCase();
  assert.ok(t.includes('direct booking'), 'does not know what aggregators miss');
  assert.ok(t.includes('lodging tax'), 'does not know where the real answer lives');
});

test('SOUL: she knows the lodging-tax thresholds differ by state', () => {
  const t = PENNY_INDUSTRY_SENSE;
  for (const s of ['30 days in\nVirginia', '31 in Massachusetts', '90 in New Jersey']) {
    assert.ok(t.replace(/\s+/g, ' ').includes(s.replace(/\s+/g, ' ')), `missing threshold: ${s}`);
  }
});

/* ---- the covenant ---- */

// The load-bearing commercial rule. Knowledge free, properties paid. If this ever softens,
// the platform becomes the thing it was built to replace.
test('COVENANT: knowledge is free and she may never gate it', () => {
  const t = PENNY_COVENANT.toLowerCase();
  assert.ok(t.includes('knowledge is free'), 'the free-knowledge promise is missing');
  assert.ok(t.includes('never gate it'), 'she is not forbidden from gating knowledge');
  assert.ok(t.includes('we charge for properties'), 'what we DO charge for is not stated');
});

test('COVENANT: she coaches and does not take over the operation', () => {
  const t = PENNY_COVENANT.toLowerCase();
  assert.ok(t.includes('coach, do not take over'), 'the coaching stance is missing');
  assert.ok(t.includes('not their property manager'), 'the boundary is not stated');
});

test('COVENANT: she is told never to side with the company against a customer', () => {
  assert.ok(
    PENNY_COVENANT.toLowerCase().includes('protecting the company from a customer'),
    'missing the line about whose side she is on',
  );
});

/* ---- the success team ---- */

test("TEAM: our staff are called the Success Team, and she is told not to say 'staff'", () => {
  const t = PENNY_TEAM;
  assert.ok(t.includes('THE SUCCESS TEAM'), 'the team is not named');
  assert.ok(/Not "staff"/.test(t), 'she is not told to avoid calling them staff');
});

test('TEAM: all three roles are described by what they actually do', () => {
  const t = PENNY_TEAM.toLowerCase();
  for (const [role, marker] of [['admin', 'compliance'], ['acquisition', 'negotiates'], ['setup', 'furniture']]) {
    assert.ok(t.includes(role), `${role} is missing`);
    assert.ok(t.includes(marker), `${role} has no description of the actual work`);
  }
});

test('TEAM: ownership is named, and framed as the people who decide', () => {
  const t = PENNY_TEAM;
  assert.ok(t.includes('Vission') && t.includes('Rel'), 'the owners are not named');
  assert.ok(t.toLowerCase().includes('decides'), 'ownership is not framed as deciding');
});

// Routing to the wrong role costs somebody a day. She is told to ask rather than guess.
test('TEAM: she is told to ask rather than guess which role owns something', () => {
  assert.ok(PENNY_TEAM.toLowerCase().includes('rather than guessing'));
});

/* ---- routing across one united team ---- */

test('ROUTING: admin owns disputes, legal and anything unclassified', () => {
  const t = PENNY_ROUTING.toLowerCase();
  for (const w of ['disputes', 'legal', 'compliance', 'refunds', 'chargebacks']) {
    assert.ok(t.includes(w), `admin scope missing: ${w}`);
  }
  assert.ok(t.includes('it belongs to admin'), 'no default route for unclear items');
});

test('ROUTING: owners see everything, and she is told not to withhold', () => {
  assert.ok(/sees ALL of it/i.test(PENNY_ROUTING));
  assert.ok(/never hide something from an owner/i.test(PENNY_ROUTING));
});

// The team is a front, not a ladder. This is the owner's framing and it must survive edits.
test('ROUTING: no role is described as senior to another', () => {
  assert.ok(/each equally important/i.test(PENNY_ROUTING));
  assert.ok(/never speak about one role as senior/i.test(PENNY_ROUTING));
});

test('ROUTING: she is told to write differently to different roles', () => {
  assert.ok(/Do not send all three the same paragraph/i.test(PENNY_ROUTING));
});

/* ---- the doctrine must not hand the model a script ---- */

// An owner asked "which articles have never been checked against a primary source?" and got
// the payment refusal verbatim. The guard had not fired — the DOCTRINE contained the
// refusal sentence in first person, so the model could simply copy it out.
//
// A prompt that contains a ready-made first-person sentence is a loaded gun: the model will
// eventually emit it in the wrong place.
test('PAYMENT: the doctrine does not contain a quotable first-person refusal', () => {
  assert.ok(
    !/I won't type|I will not type/i.test(PENNY_PAYMENT_DOCTRINE),
    'the doctrine hands the model a verbatim refusal it can emit at any time',
  );
});

test('PAYMENT: she is told this applies only when money destinations are asked about', () => {
  // Whitespace-tolerant: the doctrine is a wrapped template literal, so a phrase can break
  // across a line. A test that only matches single spaces fails on formatting, not meaning.
  const flat = PENNY_PAYMENT_DOCTRINE.replace(/\s+/g, ' ');
  assert.ok(/only applies when somebody is actually asking where to send money/i.test(flat));
  assert.ok(/never fall back on this/i.test(flat));
});
