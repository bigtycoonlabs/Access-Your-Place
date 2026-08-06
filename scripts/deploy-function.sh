#!/usr/bin/env bash
#
# deploy-function.sh — deploy ONE edge function to the live project, then VERIFY it landed.
#
# WHY THIS EXISTS: the Supabase MCP's deploy_edge_function takes file contents as a
# parameter, which means an assistant must reproduce the whole file verbatim. For a small
# new function that is tolerable. For a large function that staff use daily it is not: a
# truncated call is harmless (invalid JSON, never executes), but a transcription slip
# produces a VALID call that deploys subtly wrong code over a working function.
#
# The CLI copies bytes from disk. No transcription, no risk. This script wraps it with the
# two things that are easy to forget: the correct --project-ref, and a read-back check so
# "deployed" means verified rather than assumed.
#
# PREREQS:
#   1. Supabase CLI:  https://supabase.com/docs/guides/cli
#   2. export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx   (dashboard > Account > Access Tokens)
#
# USAGE:
#   ./scripts/deploy-function.sh penny-staff-chat
#
set -euo pipefail

# The LIVE project. Do not take this from supabase/config.toml — that file's project_id is
# a local-dev identifier and has historically held a stale ref for a different project.
PROJECT_REF="adcbrclppmnguzkzwiys"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
  echo "ERROR: name the function to deploy, e.g. ./scripts/deploy-function.sh penny-staff-chat" >&2
  exit 1
fi

SRC_DIR="$REPO_ROOT/supabase/functions/$SLUG"
if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: no such function in this repo: supabase/functions/$SLUG" >&2
  exit 1
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: set SUPABASE_ACCESS_TOKEN first (dashboard > Account > Access Tokens)." >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "Function : $SLUG"
echo "Project  : $PROJECT_REF"
echo "Source   : supabase/functions/$SLUG"
echo
echo "Checksums BEFORE deploy (compare these to the read-back afterwards):"
find "$SRC_DIR" -type f -name '*.ts' -print0 | sort -z | xargs -0 md5sum
echo

# NOTE: verify_jwt is deliberately NOT passed. Omitting the flag preserves whatever the
# function is already configured with. Passing --no-verify-jwt would silently strip auth
# from a function that requires it, which is how a private endpoint becomes a public one.
supabase functions deploy "$SLUG" --project-ref "$PROJECT_REF"

echo
echo "Deployed. Now VERIFY rather than assume:"
echo "  1. supabase functions download $SLUG --project-ref $PROJECT_REF"
echo "  2. diff the downloaded source against supabase/functions/$SLUG"
echo "  3. If they differ in ANY way, say so plainly and redeploy. Do not report success"
echo "     on an unverified deploy."
echo
echo "Then verify BEHAVIOURALLY — a green checkmark is not evidence the new code is live."
