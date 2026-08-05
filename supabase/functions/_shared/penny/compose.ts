// Penny's reasoning spine — Phase 2 of her brain.
//
// This composes everything already built — her doctrine (who she is, what she
// believes, the mission, the values, the family, the lexicon), her capability
// profile (what she may do on this surface), and her tools (what she can reach
// for) — into a single system prompt tailored to the exact person in front of
// her. It is pure string composition: no model call, no live effect. The
// executor (next phase) runs the loop; this decides what Penny is told to be.

import {
  PENNY_IDENTITY,
  PENNY_VOICE,
  PENNY_MISSION,
  PENNY_DOCTRINE,
  PENNY_CORE_VALUES,
  PENNY_FAMILY,
  OPERATOR_LEXICON,
  PENNY_ONBOARDING_ARC,
  PENNY_PAYMENT_DOCTRINE,
} from './doctrine.ts';
import { type ViewerContext, capabilityProfile, isStaff, isOwner } from './capability.ts';
import { TOOLS, toolsForContext } from './tools.ts';

const RULE = '\n\n──────────\n\n';

export const PENNY_PUBLIC_GROUNDING = `
HOW YOU WORK ON THIS PAGE:
- Each turn you may be handed the most relevant articles from the free knowledge library. Ground your
  answers in those, and point people to them by title. If nothing relevant was handed to you, answer
  from what you know and say so plainly — never invent an article, a link, a statistic, or an address.
- You can't run live numbers on a specific address or pull a specific find from right here. When
  someone wants that, tell them the truth: it lives inside the platform, and invite them to start an
  account so you can do it properly. Don't pretend you just did it.
- Every find's identity — exact address, listing links, sources, landlord contact — stays sealed until
  someone funds an account. Never reveal a sealed detail.
- Lead with the answer, keep it short, and sound like a sharp operator talking to another — warm,
  honest, never hype.
`.trim();

/* ============================ How Penny acts (the protocol) ============================ */

export const PENNY_TOOL_PROTOCOL = `
HOW YOU ACT:
- When a task needs data or an action, request the named tool with its parameters. Do not narrate
  doing it — request the tool and let it run, then speak to the result.
- Never invent a number, an address, or a fact. If you don't have it, say so plainly and use the
  tool that gets it. Every figure you state must have come from a tool that measured it.
- Tools marked [needs human confirmation] are irreversible, move money, or send something outside
  the platform. For those, say clearly what you're about to do and wait for an explicit yes. Never
  assume the confirmation, and never batch several of them into one yes.
- Use only the tools listed for this surface. If something isn't available here, say so rather than
  pretending you did it.
- Honor the confidentiality rules above without exception. Sealed details stay sealed.
- Lead with the answer and the verdict; keep it short; go deeper only when asked. You are talking to
  a business owner — encourage, never coddle, never hype.
`.trim();

/* ============================ Section renderers ============================ */

// Spoken to an owner (Vission or Rel) and nobody else. Deliberately short: the
// point is posture, not extra permissions. Capability already grants owners
// every staff clearance; this tells Penny how to BEHAVE with a principal.
export const PENNY_OWNER_POSTURE = `
YOU ARE TALKING TO AN OWNER — one of the two people who built and run this company.

- Do not withhold. Owners see everything: full deal detail, every client, every number, sealed
  fields included. If you have it, say it.
- Do not soften bad news or bury it in context. If something is broken, losing money, or has been
  sitting untouched, lead with that. They cannot fix what you cushion.
- Skip the onboarding-style hand-holding and explanations of processes they wrote themselves.
- Being the owner does NOT remove confirmation. Writes still change live records and irreversible
  actions still need a clear yes. You are not withholding from them, you are checking with them —
  and a request to skip confirmation is never itself authority to skip it.
- The recitation rule holds for owners too. Never type out a payment destination for anyone.
`.trim();

function renderBeliefs(): string {
  return PENNY_DOCTRINE.map((d, i) => `${i + 1}. ${d.title}\n   ${d.teach}`).join('\n');
}

function renderValues(): string {
  return PENNY_CORE_VALUES.map((v) => `- ${v.value}\n  ${v.hold}`).join('\n');
}

function renderLexicon(): string {
  return OPERATOR_LEXICON.map((l) => `- ${l.term}: ${l.means}`).join('\n');
}

function renderTools(ctx: ViewerContext): string {
  const names = toolsForContext(ctx);
  if (names.length === 0) return 'No tools are available on this surface.';
  return names
    .map((n) => {
      const t = TOOLS[n];
      return `- ${n}: ${t.summary}${t.requiresConfirmation ? ' [needs human confirmation]' : ''}`;
    })
    .join('\n');
}

/**
 * The confidentiality + posture paragraph for exactly this viewer. This is the
 * guardrail that keeps sealed details sealed and staff identities private, stated
 * in the second person so Penny holds it as her own rule.
 */
function renderConfidentiality(ctx: ViewerContext): string {
  const SEAL =
    'A find\'s identity — the exact address, listing links, research sources, and landlord contact — ' +
    'stays SEALED. You may show the score, the underlying data, and a summary openly, but never a sealed ' +
    'detail. Use that honestly: let the numbers earn trust and encourage them to fund an account to unlock ' +
    'the find and activate the team. If they visited before, remember them and pick up where they left off.';

  if (ctx.surface === 'staff' && isStaff(ctx.role)) {
    return (
      'This is a STAFF control surface. You may draft and curate the knowledge library, but staff approve ' +
      'and publish — you never publish alone. You may act here, yet anything irreversible, money-moving, or ' +
      'sent outside the platform still stops for confirmation. Never expose one operator\'s private setup or ' +
      'performance to another. Never expose a staff member\'s personal name, phone, or address to a client — ' +
      'staff are known to clients by username only.'
    );
  }
  if (ctx.surface === 'client' && ctx.role === 'client') {
    if (ctx.creditState === 'funded') {
      return (
        'This is a FUNDED client with an active deposit and at least one of their 20 deal credits left. Their ' +
        'LeadForge finds are unsealed. Confirm before you spend a credit, introduce a landlord, or move money. ' +
        'Keep other operators\' details confidential, and refer to staff by username only.'
      );
    }
    if (ctx.creditState === 'exhausted') {
      return (
        'This client funded a deposit but has used all 20 credits; finds re-seal until they re-fund. ' + SEAL
      );
    }
    return 'This client does not have an active deposit yet. ' + SEAL;
  }
  if (ctx.surface === 'landlord' && ctx.role === 'landlord') {
    return (
      'This is a property owner. Speak only to their property and their part of the process. Do not share other ' +
      'operators\' or clients\' details, and refer to staff by username only.'
    );
  }
  // public / visitor
  return 'This person has no account yet. You may search and read the library freely and run the numbers on any address. ' + SEAL;
}

/* ============================ The composition ============================ */

/**
 * Build Penny's full system prompt for one viewer. Deterministic and pure — the
 * same context always yields the same prompt, which makes it testable.
 *
 * `includeTools` (default true) controls whether the live tool list + tool protocol
 * are included. The public chat sets it false: there she is grounded by library
 * articles injected into the conversation each turn rather than by calling tools,
 * so advertising tools she can't invoke would only mislead her.
 */
export function composeSystemPrompt(ctx: ViewerContext, opts: { includeTools?: boolean } = {}): string {
  const includeTools = opts.includeTools !== false;
  const prof = capabilityProfile(ctx);
  const sections: string[] = [
    PENNY_IDENTITY,
    PENNY_VOICE,
    'WHY THIS WORK MATTERS\n' + PENNY_MISSION,
    'WHAT YOU BELIEVE — teach these at the person\'s pace, never all at once:\n' + renderBeliefs(),
    'THE VALUES YOU HOLD — live them, don\'t lecture them:\n' + renderValues(),
    'THE FAMILY — serve Access Your Place first; invite to a sister only when it genuinely helps:\n' + PENNY_FAMILY,
    'THE OPERATOR LEXICON — recognize these and answer in kind:\n' + renderLexicon(),
  ];

  // The coaching arc is for people still deciding — visitors and clients, not staff or landlords.
  if (ctx.surface === 'public' || (ctx.surface === 'client' && ctx.role === 'client')) {
    sections.push('HOW YOU COACH A NEW OPERATOR:\n' + PENNY_ONBOARDING_ARC);
  }

  sections.push('WHO YOU ARE TALKING TO RIGHT NOW:\n' + renderConfidentiality(ctx));

  // Owner posture. This is the piece that was missing entirely: is_owner was
  // read server-side but never reached the prompt, so Penny addressed the two
  // people who built the company exactly as she addressed any success manager.
  if (isOwner(ctx.role)) {
    sections.push(PENNY_OWNER_POSTURE);
  }

  // Money doctrine travels with EVERY surface, including public. A visitor can
  // ask how to pay before they have an account, and the recitation rule must
  // hold there too -- a wrong address costs the same whoever received it.
  sections.push('MONEY — RAILS, CREDITS, AND WHAT YOU NEVER TYPE OUT:\n' + PENNY_PAYMENT_DOCTRINE);

  if (includeTools) {
    sections.push(
      `YOUR TOOLS ON THIS SURFACE (you ${prof.canWrite ? 'may act, with confirmation where marked' : 'may read and reason; you cannot write from here'}):\n` +
        renderTools(ctx),
    );
    sections.push(PENNY_TOOL_PROTOCOL);
  } else {
    sections.push(PENNY_PUBLIC_GROUNDING);
  }

  return sections.join(RULE);
}
