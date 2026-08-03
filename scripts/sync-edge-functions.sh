#!/usr/bin/env bash
#
# sync-edge-functions.sh — mirror ALL live Supabase edge functions into this repo.
#
# WHY THIS EXISTS: most of the project's edge functions live only as deployed artifacts
# on Supabase, not in git. Pulling them one-at-a-time through the API is slow. The Supabase
# CLI's `functions download` mirrors every function's source directly into
# supabase/functions/<slug>/ in one pass — this is the fast, correct way to do the bulk sync.
# (It must run somewhere the CLI can reach Supabase — i.e. NOT the AI sandbox, whose network
# is locked down. A normal dev machine or CI works.)
#
# PREREQS:
#   1. Install the Supabase CLI:  https://supabase.com/docs/guides/cli
#   2. Create a personal access token: Supabase dashboard > Account > Access Tokens
#   3. export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
#
# USAGE:
#   ./scripts/sync-edge-functions.sh
#   git push origin main      # after reviewing the commit it creates
#
set -euo pipefail

PROJECT_REF="adcbrclppmnguzkzwiys"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUGS_FILE="$REPO_ROOT/docs/live-function-slugs.txt"

cd "$REPO_ROOT"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: set SUPABASE_ACCESS_TOKEN first (Supabase dashboard > Account > Access Tokens)." >&2
  exit 1
fi

# Prefer the committed slug list (known-good). Fall back to asking the CLI live.
if [ -f "$SLUGS_FILE" ]; then
  echo "Using slug list: $SLUGS_FILE ($(grep -c . "$SLUGS_FILE") functions)"
  SLUGS="$(grep -E '^[a-z0-9-]+$' "$SLUGS_FILE" | sort -u)"
else
  echo "No slug list found; querying live functions..."
  SLUGS="$(supabase functions list --project-ref "$PROJECT_REF" \
    | awk 'NR>1 {print $NF}' | grep -E '^[a-z0-9-]+$' | sort -u)"
fi

count=0
fail=0
while read -r slug; do
  [ -z "$slug" ] && continue
  printf '  -> %-40s' "$slug"
  if supabase functions download "$slug" --project-ref "$PROJECT_REF" >/dev/null 2>&1; then
    echo "ok"
    count=$((count + 1))
  else
    echo "FAILED (skipped)"
    fail=$((fail + 1))
  fi
done <<< "$SLUGS"

echo
echo "Downloaded $count function(s); $fail failure(s)."

git add supabase/functions
if git diff --cached --quiet; then
  echo "No changes to commit — repo already matches live."
else
  git commit -m "repo-sync: mirror all live edge functions (supabase functions download)"
  echo "Committed. Review with: git log -1 --stat   then:  git push origin main"
fi
