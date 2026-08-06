#!/usr/bin/env bash
#
# deploy-all.sh — RETIRED. This script no longer deploys anything, on purpose.
#
# It is kept (rather than deleted) so that anyone who reaches for the familiar command
# gets this explanation instead of silence.
#
# WHAT IT USED TO DO, AND WHY THAT WAS UNSAFE:
#
#   1. WRONG PROJECT. It passed --project-ref "lxfgylmkexnyryafmibi". The live project is
#      adcbrclppmnguzkzwiys. Every other ref in this repo (src/lib/supabase.ts,
#      scripts/sync-edge-functions.sh, RUN_MIGRATIONS.ps1, docs/) points at the live one.
#
#   2. IT STRIPPED AUTH. Every function was attempted with --no-verify-jwt FIRST:
#          supabase functions deploy "$fn" --project-ref "$REF" --no-verify-jwt 2>/dev/null || \
#          supabase functions deploy "$fn" --project-ref "$REF"
#      On success that leaves the function callable with no JWT at all. The list included
#      staff-login, manage-staff, manage-hr-commissions, manage-investor-crm and
#      delete-property. Turning those into unauthenticated endpoints is a serious hole,
#      and nothing in the output would have said so.
#
#   3. IT HID ITS OWN ERRORS. The 2>/dev/null on the first attempt discarded the reason
#      the first form failed, so a wrong-project or permission error looked like a normal
#      fallback. That is this platform's dominant defect pattern -- reporting success while
#      doing nothing -- in the deploy path itself, where it is hardest to notice.
#
#   4. IT WAS STALE. It listed 25 functions; the repo now carries 163. It did NOT include
#      penny-staff-chat, so running it would not have deployed the function most likely to
#      be the reason someone ran it.
#
# WHAT TO USE INSTEAD:
#
#   One function at a time, to the right project, preserving its existing auth setting:
#       ./scripts/deploy-function.sh <slug>
#
#   To mirror live functions back INTO this repo:
#       ./scripts/sync-edge-functions.sh
#
# Bulk-deploying every function at once is not a safe operation on this platform: most
# functions in the repo were mirrored verbatim FROM live, so a mass deploy mostly rewrites
# functions with copies of themselves while risking a real regression on any that drifted.

echo "deploy-all.sh is retired -- it targeted the wrong project and stripped JWT verification."
echo
echo "Deploy one function instead:"
echo "    ./scripts/deploy-function.sh <slug>"
echo
echo "Read the comments at the top of this file for the full reasoning."
exit 1
