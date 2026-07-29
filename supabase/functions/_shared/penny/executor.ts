// Penny's executor — Phase 3 of her brain.
//
// The planner (tools.ts) decides reject/confirm/execute. This runs the "execute"
// ones for real, dispatching each tool to the EXISTING function or table it wraps.
// Two safety properties are structural, not prompt-based:
//   1. Nothing runs unless the planner approved it (surface + params + confirmation).
//   2. Confidential identity fields are stripped from every result for a viewer who
//      isn't entitled — in code — so a prompt slip can never leak a sealed address.
//
// The runtime (how to actually call a function / read a table) is injected, so this
// module is pure and fully testable, and the real wiring lives in the edge function.

import { type ViewerContext, isStaff, SEALED_DEAL_FIELDS } from './capability.ts';
import { type ToolName, planToolInvocation } from './tools.ts';

const APP_SCHEMA = 'prj_X-ZoVQv6LKXT';

/* ============================ Injected runtime ============================ */

export interface RuntimeResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ReadOpts {
  schema?: string;
  eq?: Record<string, string>;
  search?: { columns: string[]; term: string };
  limit?: number;
  order?: string;
}

export interface ToolRuntime {
  callFunction(slug: string, body: Record<string, unknown>): Promise<RuntimeResult>;
  readTable(table: string, opts: ReadOpts): Promise<RuntimeResult>;
}

/* ============================ Outcomes ============================ */

export type ToolOutcome =
  | { status: 'answered'; tool: ToolName; data: unknown }
  | { status: 'empty'; tool: ToolName } // ran cleanly, found nothing
  | { status: 'confirm'; tool: ToolName; params: Record<string, unknown> } // needs a human yes
  | { status: 'refused'; tool: ToolName; reason: string } // planner said no
  | { status: 'unavailable'; tool: ToolName; error: string }; // runtime error, or not yet wired

/* ============================ Confidentiality (enforced) ============================ */

/** May this viewer see a find's confidential identity (address, contacts, sources)? */
export function entitledToIdentity(ctx: ViewerContext): boolean {
  return isStaff(ctx.role) || ctx.creditState === 'funded' || ctx.operationAccess === 'deposit_paid';
}

/** Strip sealed fields from any result unless the viewer is entitled. Deep + total. */
export function sealForViewer(data: unknown, ctx: ViewerContext): unknown {
  if (entitledToIdentity(ctx)) return data;
  const sealed = SEALED_DEAL_FIELDS as readonly string[];
  const strip = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(strip);
    if (o && typeof o === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (sealed.includes(k)) continue;
        out[k] = strip(v);
      }
      return out;
    }
    return o;
  };
  return strip(data);
}

/* ============================ Dispatch ============================ */

function classify(tool: ToolName, r: RuntimeResult): ToolOutcome {
  if (!r.ok) return { status: 'unavailable', tool, error: r.error ?? 'the tool call failed' };
  const d = r.data;
  const empty = d == null || (Array.isArray(d) && d.length === 0);
  return empty ? { status: 'empty', tool } : { status: 'answered', tool, data: d };
}

type Handler = (p: Record<string, unknown>, ctx: ViewerContext, rt: ToolRuntime) => Promise<ToolOutcome>;

// Helper: a tool that simply wraps an existing edge function.
const wrapsFn =
  (tool: ToolName, slug: string, pick: (p: Record<string, unknown>) => Record<string, unknown>): Handler =>
  async (p, _ctx, rt) =>
    classify(tool, await rt.callFunction(slug, pick(p)));

// Every handler names the EXISTING piece it drives. Read tools hit the app schema;
// the rest call existing edge functions.
const HANDLERS: Partial<Record<ToolName, Handler>> = {
  search_knowledge: async (p, _c, rt) =>
    classify(
      'search_knowledge',
      await rt.readTable('blog_articles', {
        schema: APP_SCHEMA,
        eq: { status: 'published' },
        search: { columns: ['title', 'excerpt', 'content'], term: String(p.query ?? '') },
        limit: 8,
        order: 'published_at.desc',
      }),
    ),
  read_article: async (p, _c, rt) =>
    classify(
      'read_article',
      await rt.readTable('blog_articles', { schema: APP_SCHEMA, eq: { slug: String(p.slug ?? '') }, limit: 1 }),
    ),
  run_numbers: wrapsFn('run_numbers', 'penny-deal-scoring', (p) => ({ address: p.address, operation_type: p.operation_type })),
  score_deal: wrapsFn('score_deal', 'penny-deal-scoring', (p) => ({ deal_id: p.deal_id })),
  leadforge_search: wrapsFn('leadforge_search', 'apollo-leadforge', (p) => ({ market: p.market, operation_type: p.operation_type })),
  generate_description: wrapsFn('generate_description', 'penny-generate-description', (p) => ({ property_id: p.property_id })),
  generate_market_report: wrapsFn('generate_market_report', 'manage-market-reports', (p) => ({
    city: p.city,
    state: p.state,
    property_type: p.property_type,
  })),
  draft_article: wrapsFn('draft_article', 'generate-single-article', (p) => ({
    topic: p.topic,
    category: p.category,
    city: p.city,
    state: p.state,
  })),
};

/**
 * Run a tool — but only if the planner approves, and only ever returning a result
 * the viewer is entitled to see.
 */
export async function executeTool(
  name: ToolName,
  params: Record<string, unknown>,
  ctx: ViewerContext,
  rt: ToolRuntime,
  opts: { confirmed?: boolean } = {},
): Promise<ToolOutcome> {
  const plan = planToolInvocation(name, params, ctx, opts);
  if (plan.action === 'reject') return { status: 'refused', tool: name, reason: plan.reason };
  if (plan.action === 'confirm') return { status: 'confirm', tool: name, params };

  const handler = HANDLERS[name];
  if (!handler) return { status: 'unavailable', tool: name, error: 'this tool is not wired to a runtime handler yet' };

  const outcome = await handler(params, ctx, rt);
  if (outcome.status === 'answered') {
    return { status: 'answered', tool: name, data: sealForViewer(outcome.data, ctx) };
  }
  return outcome;
}
