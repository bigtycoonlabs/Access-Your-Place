import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeTool,
  entitledToIdentity,
  sealForViewer,
  type ToolRuntime,
  type RuntimeResult,
} from './executor.ts';
import { type ViewerContext } from './capability.ts';

const visitor: ViewerContext = { surface: 'public', role: 'visitor' };
const funded: ViewerContext = { surface: 'client', role: 'client', creditState: 'funded' };
const staff: ViewerContext = { surface: 'staff', role: 'acquisition_closer' };
const depositView: ViewerContext = {
  surface: 'client',
  role: 'client',
  creditState: 'unfunded',
  operationAccess: 'deposit_paid',
};

function rt(over: { fn?: RuntimeResult; read?: RuntimeResult } = {}): ToolRuntime {
  return {
    callFunction: async () => over.fn ?? { ok: true, data: { score: 80 } },
    readTable: async () => over.read ?? { ok: true, data: [{ slug: 'a', title: 'A' }] },
  };
}

test('entitledToIdentity: staff, funded, deposit_paid entitled; visitor not', () => {
  assert.equal(entitledToIdentity(staff), true);
  assert.equal(entitledToIdentity(funded), true);
  assert.equal(entitledToIdentity(depositView), true);
  assert.equal(entitledToIdentity(visitor), false);
});

test('sealForViewer strips every sealed field for a non-entitled viewer, deep and in arrays', () => {
  const raw = {
    score: 82,
    summary: 'strong',
    address: '1 Oak St',
    links: ['http://x'],
    sources: ['zillow'],
    landlord_contact: 'bob@x.com',
    operation_takeover_details: 'keys under the mat',
    nested: [{ address: 'hidden', score: 5 }],
  };
  const out = sealForViewer(raw, visitor) as Record<string, any>;
  assert.equal(out.score, 82);
  assert.equal(out.summary, 'strong');
  assert.equal(out.address, undefined);
  assert.equal(out.links, undefined);
  assert.equal(out.sources, undefined);
  assert.equal(out.landlord_contact, undefined);
  assert.equal(out.operation_takeover_details, undefined);
  assert.equal(out.nested[0].address, undefined, 'nested sealed field must also be stripped');
  assert.equal(out.nested[0].score, 5);
});

test('sealForViewer keeps everything for an entitled viewer', () => {
  const out = sealForViewer({ score: 82, address: '1 Oak St' }, funded) as Record<string, any>;
  assert.equal(out.address, '1 Oak St');
});

test('executeTool refuses a tool not allowed on the surface', async () => {
  const o = await executeTool('draft_article', { topic: 'x' }, visitor, rt());
  assert.equal(o.status, 'refused');
});

test('executeTool asks for confirmation on an irreversible tool', async () => {
  const o = await executeTool(
    'introduce_landlord',
    { deal_id: 'd', user_confirmed: true, landlord_confirmed: true },
    funded,
    rt(),
  );
  assert.equal(o.status, 'confirm');
});

test('executeTool runs a read and SEALS the result for a visitor (code, not prompt)', async () => {
  const fn: RuntimeResult = { ok: true, data: { score: 78, address: '9 Elm', links: ['http://l'], summary: 'ok' } };
  const o = await executeTool(
    'run_numbers',
    { address: '9 Elm', operation_type: 'short_term_rental' },
    visitor,
    rt({ fn }),
  );
  assert.equal(o.status, 'answered');
  const d = (o as { data: Record<string, any> }).data;
  assert.equal(d.score, 78);
  assert.equal(d.summary, 'ok');
  assert.equal(d.address, undefined, 'address must be sealed for a visitor');
  assert.equal(d.links, undefined);
});

test('executeTool returns empty when a read finds nothing', async () => {
  const o = await executeTool('search_knowledge', { query: 'zzz' }, visitor, rt({ read: { ok: true, data: [] } }));
  assert.equal(o.status, 'empty');
});

test('executeTool surfaces a runtime failure as unavailable', async () => {
  const o = await executeTool(
    'run_numbers',
    { address: '1', operation_type: 'short_term_rental' },
    visitor,
    rt({ fn: { ok: false, error: 'boom' } }),
  );
  assert.equal(o.status, 'unavailable');
});

test('a funded viewer keeps the identity fields in the result', async () => {
  const fn: RuntimeResult = { ok: true, data: { score: 78, address: '9 Elm' } };
  const o = await executeTool(
    'run_numbers',
    { address: '9 Elm', operation_type: 'short_term_rental' },
    funded,
    rt({ fn }),
  );
  assert.equal(o.status, 'answered');
  assert.equal((o as { data: Record<string, any> }).data.address, '9 Elm');
});
