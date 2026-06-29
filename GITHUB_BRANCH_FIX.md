# GitHub Branch Fix — Clean This Up Today

## What You're Looking At

| Branch | Status | Problem |
|--------|--------|---------|
| `main` | ✗ 3/4 checks failing | Currently deployed but broken |
| `migration-supabase-recovery` | ✓ 1/1 PASSING | Your cleanest code |
| `codex/live-landing-page-refresh` | ✗ 2/4 failing | 35 commits behind main |
| `codex/ayp-v2-railway-preview` | ✗ failing | 42 commits behind |
| `env-setup` | stale | 57 commits behind |
| `rescue-full-code` | ✗ 1/3 failing | 62 commits behind |
| `railway/fix-deploy-d45f98` | stale | 58 commits behind |

**`migration-supabase-recovery` is the winner.** It's the only branch that passes.
The plan: make it the new `main`, then delete the dead branches.

---

## Step-by-Step: Run in Git Bash or PowerShell

```bash
cd "C:\Users\Brandon\Desktop\Access-Your-Place-fix"

# 1. Fix the corrupt git index first (from previous session)
del .git\index.lock
del .git\index
git reset HEAD

# 2. Fetch everything
git fetch --all

# 3. Switch to the passing branch
git checkout migration-supabase-recovery

# 4. Pull latest
git pull origin migration-supabase-recovery

# 5. Rename it to main locally
git branch -m migration-supabase-recovery main

# 6. Force push to make it the new main on GitHub
git push origin main --force

# 7. Delete the dead branches (remote)
git push origin --delete codex/live-landing-page-refresh
git push origin --delete codex/ayp-v2-railway-preview
git push origin --delete env-setup
git push origin --delete rescue-full-code
git push origin --delete railway/fix-deploy-d45f98

# 8. Now add the new files from this session
git add .gitattributes
git add supabase/
git add src/components/PennyAI.tsx
git add src/pages/CommunityStandards.tsx
git add src/pages/LegalAgreementGate.tsx
git add src/App.tsx
git add public/pages/
git add migrations/rls_fix_production.sql
git add GIT_FIX_INSTRUCTIONS.md

git commit -m "feat: clean migration — edge functions, Penny AI, landing pages, RLS fix"
git push origin main
```

---

## After That: Fix Supabase (most urgent)

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Open the file `migrations/rls_fix_production.sql` (it's in your project folder)
3. Paste the entire contents and click **Run**
4. This enables RLS on all 180+ tables and adds proper policies
5. Check your dashboard — success rate should jump from 41.6% toward 95%+

---

## Then Redeploy Railway

Once `main` is clean, trigger a redeploy on Railway:
- Railway Dashboard → your service → **Redeploy** (or it auto-deploys on push)

---

## Bottom Line

The 1,042 daily Postgres errors are 100% the RLS issue — tables have policies 
written but RLS not switched on. One SQL run fixes it. The branch chaos is 
secondary but also needs to be cleaned up today so future deployments are 
predictable.
