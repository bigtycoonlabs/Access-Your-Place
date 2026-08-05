import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeSystemPrompt, PENNY_TOOL_PROTOCOL } from './compose.ts';
import { type ViewerContext } from './capability.ts';
import { containsPaymentDestination } from './doctrine.ts';

const visitor: ViewerContext = { surface: 'public', role: 'visitor' };
const unfunded: ViewerContext = { surface: 'client', role: 'client', creditState: 'unfunded' };
const funded: ViewerContext = { surface: 'client', role: 'client', creditState: 'funded' };
const staff: ViewerContext = { surface: 'staff', role: 'acquisition_closer' };
const landlord: ViewerContext = { surface: 'landlord', role: 'landlord' };

test('every prompt carries identity, mission, values, and family', () => {
  for (const ctx of [visitor, unfunded, funded, staff, landlord]) {
    const p = composeSystemPrompt(ctx);
    assert.match(p, /Penny 10\.3/);
    assert.match(p, /WHY THIS WORK MATTERS/);
    assert.match(p, /THE VALUES YOU HOLD/);
    assert.match(p, /THE FAMILY/);
    assert.match(p, /accessypflow\.com/);
    assert.match(p, /accessyplabs\.com/);
    assert.ok(p.includes(PENNY_TOOL_PROTOCOL));
  }
});

test('visitor prompt seals identity and invites signup, offers only read tools', () => {
  const p = composeSystemPrompt(visitor);
  assert.match(p, /SEALED/);
  assert.match(p, /no account yet/);
  assert.match(p, /- search_knowledge:/);
  assert.match(p, /- read_article:/);
  assert.ok(!p.includes('- draft_article:'), 'visitor must not be offered authoring tools');
  assert.ok(!p.includes('- send_email:'), 'visitor must not be offered send tools');
  assert.match(p, /may read and reason; you cannot write/);
});

test('funded client prompt unseals finds and requires confirmation before spending a credit', () => {
  const p = composeSystemPrompt(funded);
  assert.match(p, /FUNDED client/);
  assert.match(p, /unsealed/);
  assert.match(p, /Confirm before you spend a credit/);
});

test('unfunded client prompt keeps finds sealed', () => {
  const p = composeSystemPrompt(unfunded);
  assert.match(p, /does not have an active deposit/);
  assert.match(p, /SEALED/);
});

test('staff prompt grants authoring but keeps publish + PII gated', () => {
  const p = composeSystemPrompt(staff);
  assert.match(p, /STAFF control surface/);
  assert.match(p, /staff approve\s+and publish/);
  assert.match(p, /username only/);
  assert.match(p, /- draft_article:/);
  assert.match(p, /may act, with confirmation where marked/);
});

test('confirmation-required tools are labelled in the prompt', () => {
  const p = composeSystemPrompt(funded);
  // introduce_landlord is a confirmation tool available to clients
  assert.match(p, /introduce_landlord:.*needs human confirmation/);
});

test('the coaching arc appears for deciders (visitor/client) but not staff', () => {
  assert.match(composeSystemPrompt(visitor), /HOW YOU COACH A NEW OPERATOR/);
  assert.match(composeSystemPrompt(funded), /HOW YOU COACH A NEW OPERATOR/);
  assert.ok(!composeSystemPrompt(staff).includes('HOW YOU COACH A NEW OPERATOR'));
});

test('composition is deterministic', () => {
  assert.equal(composeSystemPrompt(funded), composeSystemPrompt(funded));
});

test('public grounding mode omits the tool list and swaps in the grounding note', () => {
  const p = composeSystemPrompt(visitor, { includeTools: false });
  assert.ok(!p.includes('YOUR TOOLS ON THIS SURFACE'), 'no tool list in public grounding mode');
  assert.ok(!p.includes('- search_knowledge:'), 'no tool entries');
  assert.match(p, /HOW YOU WORK ON THIS PAGE/);
  assert.match(p, /never invent an article/);
  assert.match(p, /Penny 10\.3/); // identity still present
  assert.match(p, /THE FAMILY/); // doctrine still present
});

/* ------------------------- owner posture & money doctrine ------------------------- */

test('an owner at the staff desk gets the owner posture block', () => {
  const p = composeSystemPrompt({ surface: 'staff', role: 'owner' });
  assert.match(p, /YOU ARE TALKING TO AN OWNER/);
  assert.match(p, /Do not withhold/);
  assert.match(p, /lead with that/);
});

test('ordinary staff never see the owner posture block', () => {
  for (const role of ['acquisition_closer', 'admin_support', 'setup_manager'] as const) {
    const p = composeSystemPrompt({ surface: 'staff', role });
    assert.doesNotMatch(p, /YOU ARE TALKING TO AN OWNER/, `leaked owner posture to ${role}`);
  }
});

test('owner posture keeps confirmation rather than removing it', () => {
  // The whole risk of an owner tier is that "you may do anything" reads as
  // "you need not ask". The prompt must say the opposite, explicitly.
  const p = composeSystemPrompt({ surface: 'staff', role: 'owner' });
  assert.match(p, /does NOT remove confirmation/);
  assert.match(p, /never itself authority to skip it/);
});

test('money doctrine reaches EVERY surface, including public', () => {
  const surfaces: { surface: 'public' | 'client' | 'landlord' | 'staff'; role: any }[] = [
    { surface: 'public', role: 'visitor' },
    { surface: 'client', role: 'client' },
    { surface: 'landlord', role: 'landlord' },
    { surface: 'staff', role: 'acquisition_closer' },
    { surface: 'staff', role: 'owner' },
  ];
  for (const ctx of surfaces) {
    const p = composeSystemPrompt(ctx);
    assert.match(p, /NEVER RECITE A PAYMENT DESTINATION/, `missing on ${ctx.surface}/${ctx.role}`);
    assert.match(p, /Cooper Family Inc/, `missing holding-company note on ${ctx.surface}/${ctx.role}`);
  }
});

test('the composed prompt never contains an actual payment destination', () => {
  // Belt and braces: the doctrine describes destinations, it must not carry one.
  const known = ['@payayp', '$accessyourplace'];
  for (const ctx of [
    { surface: 'public', role: 'visitor' },
    { surface: 'staff', role: 'owner' },
  ] as const) {
    const leak = containsPaymentDestination(composeSystemPrompt(ctx), known);
    assert.equal(leak.leaked, false, `prompt leaked ${leak.kinds.join(', ')} on ${ctx.surface}`);
  }
});
