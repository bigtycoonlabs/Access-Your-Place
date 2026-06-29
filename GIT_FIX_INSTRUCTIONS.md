# Git Fix — Run These Commands First

The git index got corrupted during migration cleanup. Run these 3 commands in
your terminal (PowerShell or Git Bash) from the project folder before anything else:

```bash
cd "C:\Users\Brandon\Desktop\Access-Your-Place-fix"

# 1. Remove the stale lock file
del .git\index.lock

# 2. Remove the corrupt index
del .git\index

# 3. Rebuild the index from HEAD
git reset HEAD
```

After those 3 commands, run `git status` — you should see only the new files
added during this session as "Untracked files."

---

## Then commit everything clean:

```bash
# Stage all new files
git add .gitattributes
git add supabase/
git add src/components/PennyAI.tsx
git add src/pages/CommunityStandards.tsx
git add src/pages/LegalAgreementGate.tsx
git add src/App.tsx
git add public/pages/

# Commit
git commit -m "feat: add edge functions, Penny AI, landing pages, fix line endings

- Add .gitattributes to normalize CRLF→LF on all future commits
- Add supabase/functions/ directory with 26 edge function deployments
- Add supabase/config.toml and deploy-all.sh for one-command deployment
- Add PennyAI floating chat component (ai-investor-chat edge fn powered)
- Add CommunityStandards and LegalAgreementGate pages + routes
- Add static landing pages to public/pages/ (ayp-landing-page-final)
- Fix duplicate Careers import and duplicate /careers route in App.tsx"

# Push
git push origin main
```

---

## Then deploy edge functions to Supabase:

Make sure you have the Supabase CLI installed:
```bash
npm install -g supabase
supabase login
```

Then from the project root:
```bash
bash supabase/deploy-all.sh
```

---

## Environment Variables needed in Supabase dashboard:

Go to: Supabase Dashboard → Project → Settings → Edge Functions → Secrets

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (for Penny AI) |
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `RESEND_API_KEY` | For email notifications |
| `STRIPE_SECRET_KEY` | For payments |

These are already referenced in the edge function code — just need to be set in the dashboard.
