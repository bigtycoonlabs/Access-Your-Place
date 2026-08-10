# Where Penny is wired, and one place she deliberately is not

**9 August 2026.**

## Wired and working

| Surface | Function | Audience |
|---|---|---|
| Staff dashboard | `penny-staff-chat` | Success Team — 62 tools |
| Staff home console | `penny-staff-chat` | Success Team, docked right rail |
| Investor portal | `ai-investor-chat` | Clients / operators |
| Public site | `ai-investor-chat` | Visitors |

All three surfaces carry the same doctrine (`PENNY_TEAM`, `PENNY_ROUTING`, `PENNY_OWNERSHIP`).

## The landlord portal has no Penny, and that is CORRECT until she has a landlord persona

`/landlord/portal` renders no Penny. It would be a one-line wire — and it would be **wrong**.

`ai-investor-chat` is written for the **operator** side of the table. It contains an entire
section on *"Drafting landlord pitches (winning the lease)"* that coaches operators on how to
persuade a landlord, including how to answer a landlord's fears about parties, damage and
subletting.

It also carries this hard rule:

> never reveal or hint at the operator's own profit or margin — the pitch is about what the
> landlord gets

**Wiring that Penny into the landlord portal would put her on the wrong side of her own
rule.** A landlord would be talking to an assistant built to win a lease *from* them, holding
instructions about what to withhold *from* them. At best it is confusing; at worst a landlord
asks a direct question about the economics and gets an answer shaped by a rule that exists to
protect somebody else.

**This is a build, not a wire.** A landlord Penny needs her own persona and her own tools —
the landlord portal already has 24 working handlers behind it (properties, documents,
messages, applications), so the capability is there. What is missing is a Penny who knows
whose side of the table she is on.

**Not done, and deliberately so. It needs an owner decision on what she is allowed to say to
a landlord about the operator's economics.**
