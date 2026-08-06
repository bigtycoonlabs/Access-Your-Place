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
import { TOOLS, toolsForContext, type ToolName } from './tools.ts';

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
 * THE MERGE — one Penny, aware everywhere, gated per surface.
 *
 * Penny used to be assembled as if she were several different assistants: the public
 * surface was told about no tools at all, so she genuinely did not know that the rest of
 * her existed. That produced a specific, avoidable failure — a visitor asks something she
 * can absolutely do once they are inside, and she answers as though the capability is not
 * real. She could not say "that lives in your portal, let's get you in there" because from
 * where she was standing, it didn't.
 *
 * So awareness and permission are now separate things:
 *   - EVERY surface is told Penny's FULL capability set. She always knows what she is.
 *   - Each surface is told which of those she may EXECUTE right here.
 *   - And where the rest lives, so she can route a person to it instead of dead-ending.
 *
 * This does NOT widen what she can do. Execution is enforced in planToolInvocation(),
 * which rejects any tool absent from toolsForContext(ctx) before a single parameter is
 * read. Awareness is prompt-level; permission is code-level. Telling her what exists
 * cannot grant her the ability to run it — the gate is not the prompt, and never was.
 */
function renderFullAwareness(ctx: ViewerContext): string {
  const here = new Set(toolsForContext(ctx));
  const all = (Object.keys(TOOLS) as ToolName[]);
  const elsewhere = all.filter((n) => !here.has(n));

  const lines: string[] = [];
  lines.push(
    'EVERYTHING YOU CAN DO ANYWHERE ON THIS PLATFORM. This is the whole of you — not a menu for ' +
      'this page. Knowing the full shape of yourself is what lets you tell someone honestly where ' +
      'a thing happens instead of implying it does not exist.',
  );
  lines.push(all.map((n) => `- ${n}: ${TOOLS[n].summary}`).join('\n'));

  if (elsewhere.length) {
    lines.push(
      'OF THOSE, THE ONES YOU CANNOT RUN FROM THIS SURFACE:\n' +
        elsewhere.map((n) => `- ${n}`).join('\n') +
        '\n\nDo not run these here and never imply you have. Say plainly that it happens inside the ' +
        'platform, name what it will do for them, and walk them to where it lives — that is a real ' +
        'answer, not a deflection. Continuity matters: the same you meets them there, so speak as ' +
        'one person picking the conversation back up, not as a handoff to some other system.',
    );
  }
  return lines.join('\n\n');
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

  // THE MERGE: full capability awareness goes to EVERY surface, public included.
  // Previously this block was skipped entirely when includeTools was false, which left
  // the public Penny unaware that the rest of herself existed.
  sections.push(renderFullAwareness(ctx));

  if (includeTools) {
    sections.push(
      `WHAT YOU MAY EXECUTE RIGHT HERE (you ${prof.canWrite ? 'may act, with confirmation where marked' : 'may read and reason; you cannot write from here'}):\n` +
        renderTools(ctx),
    );
    sections.push(PENNY_TOOL_PROTOCOL);
  } else {
    // Public surface: she knows the full shape of herself from the block above, but
    // executes nothing here. She is grounded by library articles injected each turn.
    sections.push(
      'WHAT YOU MAY EXECUTE RIGHT HERE: nothing. This surface is conversation only — you run no ' +
        'tools from this page. That is a limit on your hands, not on your knowledge: you still know ' +
        'exactly what you could do for this person once they are inside, so say so concretely and ' +
        'invite them in. Never narrate running something here, and never state a number or an ' +
        'address as though a tool produced it.',
    );
    sections.push(PENNY_PUBLIC_GROUNDING);
  }

  return sections.join(RULE);
}
