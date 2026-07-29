// Penny's tool registry + planner — Phase 1 of her brain.
//
// This does NOT rebuild anything. Every tool wraps infrastructure that already
// exists in the platform (the `wraps` field names it). What's new is the single
// place that (a) declares what Penny may do, (b) guards the vocabulary with enums,
// (c) decides reject / confirm / execute for every call, and (d) hands each surface
// its allowed subset. Pure and dependency-light (safe in Deno + Node).

import { type Surface, type Role, type CreditState, type ViewerContext, isStaff } from './capability.ts';

/* ============================ Tool registry ============================ */

export const TOOL_NAMES = [
  // Knowledge library (wraps blog_articles / draft_articles / get-draft-articles).
  'search_knowledge',
  'read_article',
  // Article authoring — Penny drafts, STAFF approve (wraps generate-single-article + draft_articles).
  'draft_article',
  'flag_article_outdated',
  'archive_article',
  'track_license_requirement',
  'generate_market_report', // wraps manage-market-reports
  // Deal / acquisition (wraps penny-deal-scoring / apollo-leadforge / penny-generate-description).
  'run_numbers',
  'score_deal',
  'leadforge_search',
  'generate_description',
  'release_resources', // unseal identity after funding — money-gated
  'select_for_negotiation', // spends one of the 20 credits
  'introduce_landlord', // Penny emails the intro — double-confirm
  'generate_agreement', // template acquisition agreement (draft)
  'list_to_marketplace', // acquisition-team approval required
  'propose_credit', // ToS-based credit, staff confirm
  // Operator / comms / memory.
  'assemble_welcome_docs',
  'send_email',
  'where_is_user',
  'remember_visitor', // returning pre-signup visitor memory (new; needs the memory layer)
  'recall_visitor',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolParam {
  name: string;
  required: boolean;
  enumValues?: readonly string[]; // controlled vocabulary — the guardrail
}

export interface ToolSpec {
  summary: string;
  params: ToolParam[];
  requiresConfirmation: boolean; // irreversible, money-moving, external send, or public write
  wraps?: string; // the EXISTING function/table this drives (proof we merged, not rebuilt)
}

const OPERATION_TYPES = ['short_term_rental', 'mid_term_rental', 'corporate_housing', 'shared_living'] as const;

export const TOOLS: Record<ToolName, ToolSpec> = {
  search_knowledge: {
    summary: 'Search the free knowledge library for articles and guidance.',
    params: [
      { name: 'query', required: true },
      { name: 'category', required: false },
    ],
    requiresConfirmation: false,
    wraps: 'blog_articles + published draft_articles (get-draft-articles)',
  },
  read_article: {
    summary: 'Read one knowledge article by slug or id.',
    params: [{ name: 'slug', required: true }],
    requiresConfirmation: false,
    wraps: 'blog_articles / draft_articles',
  },
  draft_article: {
    summary: 'Generate a new knowledge article as a DRAFT for staff approval. Never publishes.',
    params: [
      { name: 'topic', required: true },
      { name: 'category', required: false },
      { name: 'city', required: false },
      { name: 'state', required: false },
    ],
    requiresConfirmation: false, // a draft is reversible; publishing stays a staff action
    wraps: 'generate-single-article -> draft_articles (status pending)',
  },
  flag_article_outdated: {
    summary: 'Flag a published article as needing review because it may no longer be accurate.',
    params: [
      { name: 'article_id', required: true },
      { name: 'reason', required: true },
    ],
    requiresConfirmation: false, // a flag is reversible and safe
    wraps: 'draft_articles / blog_articles status -> needs_review',
  },
  archive_article: {
    summary: 'Remove an article from the public library (archive it).',
    params: [
      { name: 'article_id', required: true },
      { name: 'reason', required: true },
    ],
    requiresConfirmation: true, // pulling public content is a public write
    wraps: 'blog_articles / draft_articles status -> archived',
  },
  track_license_requirement: {
    summary:
      'Research and record a short-term-rental or shared-living license requirement as a draft knowledge article (with sources).',
    params: [
      { name: 'city', required: true },
      { name: 'state', required: true },
      { name: 'property_type', required: true, enumValues: OPERATION_TYPES },
      { name: 'requirement', required: true },
      { name: 'source_urls', required: true },
    ],
    requiresConfirmation: false, // a sourced draft, pending staff approval
    wraps: 'draft_articles (category legal_licensing, requires_license)',
  },
  generate_market_report: {
    summary: 'Generate a market report for a city / submarket.',
    params: [
      { name: 'city', required: true },
      { name: 'state', required: true },
      { name: 'property_type', required: false, enumValues: OPERATION_TYPES },
    ],
    requiresConfirmation: false,
    wraps: 'manage-market-reports',
  },
  run_numbers: {
    summary: 'Underwrite an address for a given operation type — rent, ADR/occupancy, spread.',
    params: [
      { name: 'address', required: true },
      { name: 'operation_type', required: true, enumValues: OPERATION_TYPES },
    ],
    requiresConfirmation: false,
    wraps: 'penny-deal-scoring',
  },
  score_deal: {
    summary: "Score an existing deal against Penny's model.",
    params: [{ name: 'deal_id', required: true }],
    requiresConfirmation: false,
    wraps: 'penny-deal-scoring',
  },
  leadforge_search: {
    summary: 'Source candidate properties/landlords in a market. Identity stays sealed until funded.',
    params: [
      { name: 'market', required: true },
      { name: 'operation_type', required: false, enumValues: OPERATION_TYPES },
    ],
    requiresConfirmation: false,
    wraps: 'apollo-leadforge',
  },
  generate_description: {
    summary: 'Generate a property listing description.',
    params: [{ name: 'property_id', required: true }],
    requiresConfirmation: false,
    wraps: 'penny-generate-description',
  },
  release_resources: {
    summary: "Unseal a LeadForge find's address, links and sources after the account is funded.",
    params: [{ name: 'deal_id', required: true }],
    requiresConfirmation: true, // money-gated unseal
  },
  select_for_negotiation: {
    summary: 'Hand a chosen deal to the team to negotiate. Spends one of the 20 credits.',
    params: [{ name: 'deal_id', required: true }],
    requiresConfirmation: true,
  },
  introduce_landlord: {
    summary: 'Email the landlord introduction — only after landlord AND user both confirm.',
    params: [
      { name: 'deal_id', required: true },
      { name: 'user_confirmed', required: true },
      { name: 'landlord_confirmed', required: true },
    ],
    requiresConfirmation: true, // external send, irreversible
  },
  generate_agreement: {
    summary: 'Generate the template acquisition agreement for a chosen deal (draft).',
    params: [{ name: 'deal_id', required: true }],
    requiresConfirmation: false, // a draft document; signing/closing is the gated step
  },
  list_to_marketplace: {
    summary: 'List a closed-landlord deal on the marketplace. Requires acquisition-team approval.',
    params: [
      { name: 'deal_id', required: true },
      { name: 'furnished', required: true },
      { name: 'price', required: false },
    ],
    requiresConfirmation: true,
  },
  propose_credit: {
    summary: 'Propose applying account credit to a situation, per the ToS. Staff confirm.',
    params: [
      { name: 'user_id', required: true },
      { name: 'amount', required: true },
      { name: 'reason', required: true },
    ],
    requiresConfirmation: true,
  },
  assemble_welcome_docs: {
    summary: 'Assemble a welcome document with the local vendors for a purchase (draft).',
    params: [{ name: 'user_id', required: true }],
    requiresConfirmation: false,
  },
  send_email: {
    summary: 'Send an email to a user (update, welcome doc, nudge).',
    params: [
      { name: 'to', required: true },
      { name: 'subject', required: true },
      { name: 'body', required: true },
    ],
    requiresConfirmation: true, // real external send
  },
  where_is_user: {
    summary: 'Report where a user stands in their process (for staff visibility).',
    params: [{ name: 'user_id', required: true }],
    requiresConfirmation: false,
  },
  remember_visitor: {
    summary: "Remember a returning pre-signup visitor's context to encourage them to sign up.",
    params: [
      { name: 'visitor_id', required: true },
      { name: 'context', required: true },
    ],
    requiresConfirmation: false,
  },
  recall_visitor: {
    summary: 'Recall what a returning visitor was working on.',
    params: [{ name: 'visitor_id', required: true }],
    requiresConfirmation: false,
  },
};

/* ============================ Which tools each surface gets ============================ */

const READ_TOOLS: ToolName[] = ['search_knowledge', 'read_article', 'run_numbers', 'score_deal', 'leadforge_search'];
const VISITOR_TOOLS: ToolName[] = [...READ_TOOLS, 'remember_visitor', 'recall_visitor'];
const CLIENT_TOOLS: ToolName[] = [
  ...READ_TOOLS,
  'generate_market_report',
  'release_resources',
  'select_for_negotiation',
  'introduce_landlord',
  'generate_agreement',
  'assemble_welcome_docs',
  'propose_credit',
  'where_is_user',
];
// Staff can do everything, including authoring/curating the knowledge library.
const STAFF_TOOLS: ToolName[] = [...TOOL_NAMES];

export function toolsForContext(ctx: ViewerContext): ToolName[] {
  if (isStaff(ctx.role)) return STAFF_TOOLS;
  if (ctx.surface === 'client' && ctx.role === 'client') return CLIENT_TOOLS;
  if (ctx.surface === 'landlord' && ctx.role === 'landlord') return ['read_article', 'search_knowledge', 'where_is_user'];
  return VISITOR_TOOLS; // public / visitor
}

/* ============================ Validation + the planner ============================ */

export function validateParams(name: ToolName, params: Record<string, unknown>): string | null {
  const spec = TOOLS[name];
  if (!spec) return `unknown tool: ${name}`;
  for (const p of spec.params) {
    const present = params[p.name] !== undefined && params[p.name] !== null && params[p.name] !== '';
    if (p.required && !present) return `missing required param: ${p.name}`;
    if (present && p.enumValues && !p.enumValues.includes(String(params[p.name]))) {
      return `invalid value for ${p.name}: must be one of ${p.enumValues.join(', ')}`;
    }
  }
  return null;
}

export type PlanDecision =
  | { action: 'reject'; reason: string }
  | { action: 'confirm'; tool: ToolName; params: Record<string, unknown> }
  | { action: 'execute'; tool: ToolName; params: Record<string, unknown> };

/**
 * The one safety decision, made the same way for every tool call:
 *   - reject  — unknown tool, not allowed for this viewer, or invalid params/enum.
 *   - confirm — valid but irreversible/money-moving/external; a human must approve.
 *   - execute — valid and reversible; run it.
 */
export function planToolInvocation(
  name: ToolName,
  params: Record<string, unknown>,
  ctx: ViewerContext,
  opts: { confirmed?: boolean } = {},
): PlanDecision {
  const spec = TOOLS[name];
  if (!spec) return { action: 'reject', reason: `unknown tool: ${name}` };
  if (!toolsForContext(ctx).includes(name)) {
    return { action: 'reject', reason: `tool ${name} is not available on the ${ctx.surface} surface` };
  }
  const paramError = validateParams(name, params);
  if (paramError) return { action: 'reject', reason: paramError };
  if (spec.requiresConfirmation && !opts.confirmed) {
    return { action: 'confirm', tool: name, params };
  }
  return { action: 'execute', tool: name, params };
}
