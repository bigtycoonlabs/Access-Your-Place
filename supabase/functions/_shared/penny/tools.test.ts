import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS,
  TOOL_NAMES,
  toolsForContext,
  validateParams,
  planToolInvocation,
  type ToolName,
} from './tools.ts';
import { type ViewerContext } from './capability.ts';

const visitor: ViewerContext = { surface: 'public', role: 'visitor' };
const client: ViewerContext = { surface: 'client', role: 'client', creditState: 'funded' };
const staff: ViewerContext = { surface: 'staff', role: 'acquisition_closer' };

test('registry: every tool name has a well-formed spec', () => {
  for (const name of TOOL_NAMES) {
    const spec = TOOLS[name];
    assert.ok(spec, `missing spec for ${name}`);
    assert.equal(typeof spec.summary, 'string');
    assert.equal(typeof spec.requiresConfirmation, 'boolean');
    for (const p of spec.params) {
      assert.equal(typeof p.name, 'string');
      assert.equal(typeof p.required, 'boolean');
    }
  }
});

test('validateParams: missing required is rejected', () => {
  assert.match(validateParams('run_numbers', { address: '1 Oak' }) ?? '', /operation_type/);
});

test('validateParams: enum guardrail rejects bad values', () => {
  const err = validateParams('run_numbers', { address: '1 Oak', operation_type: 'timeshare' });
  assert.match(err ?? '', /must be one of/);
});

test('validateParams: valid params pass', () => {
  assert.equal(validateParams('run_numbers', { address: '1 Oak', operation_type: 'short_term_rental' }), null);
});

test('surfaces: visitor gets read-only tools, not authoring or sending', () => {
  const t = toolsForContext(visitor);
  assert.ok(t.includes('search_knowledge'));
  assert.ok(t.includes('read_article'));
  assert.ok(!t.includes('draft_article'), 'visitor must not author library content');
  assert.ok(!t.includes('send_email'), 'visitor must not send email');
  assert.ok(!t.includes('release_resources'), 'visitor must not unseal');
});

test('surfaces: staff gets the knowledge-authoring tools', () => {
  const t = toolsForContext(staff);
  for (const name of ['draft_article', 'flag_article_outdated', 'archive_article', 'track_license_requirement'] as ToolName[]) {
    assert.ok(t.includes(name), `staff should have ${name}`);
  }
});

test('planner: unknown tool is rejected', () => {
  // deliberately bad name
  const d = planToolInvocation('nope' as ToolName, {}, staff);
  assert.equal(d.action, 'reject');
});

test('planner: a tool not on the surface is rejected', () => {
  const d = planToolInvocation('draft_article', { topic: 'STR licensing in Austin' }, client);
  assert.equal(d.action, 'reject');
});

test('planner: invalid enum is rejected before anything runs', () => {
  const d = planToolInvocation('run_numbers', { address: '1 Oak', operation_type: 'bad' }, visitor);
  assert.equal(d.action, 'reject');
});

test('planner: reversible read executes immediately', () => {
  const d = planToolInvocation('search_knowledge', { query: 'landlord objections' }, visitor);
  assert.equal(d.action, 'execute');
});

test('planner: irreversible action asks for confirmation, then executes when confirmed', () => {
  const params = { deal_id: 'd1', user_confirmed: true, landlord_confirmed: true };
  const first = planToolInvocation('introduce_landlord', params, client);
  assert.equal(first.action, 'confirm');
  const second = planToolInvocation('introduce_landlord', params, client, { confirmed: true });
  assert.equal(second.action, 'execute');
});

test('planner: draft_article for staff is reversible (no confirmation) and executes', () => {
  const d = planToolInvocation('draft_article', { topic: 'Nashville STR permit basics' }, staff);
  assert.equal(d.action, 'execute');
});

test('planner: archiving public content requires confirmation', () => {
  const d = planToolInvocation('archive_article', { article_id: 'a1', reason: 'law changed' }, staff);
  assert.equal(d.action, 'confirm');
});

test('every wraps field points at real existing infra (documentation of the merge)', () => {
  // Tools that wrap existing infra should name it; new tools (memory, money) may omit.
  assert.match(TOOLS.search_knowledge.wraps ?? '', /blog_articles/);
  assert.match(TOOLS.draft_article.wraps ?? '', /generate-single-article/);
  assert.match(TOOLS.run_numbers.wraps ?? '', /penny-deal-scoring/);
  assert.match(TOOLS.leadforge_search.wraps ?? '', /apollo-leadforge/);
  assert.match(TOOLS.generate_market_report.wraps ?? '', /manage-market-reports/);
});
