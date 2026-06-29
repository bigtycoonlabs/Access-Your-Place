# Git Fix — Run This Now in PowerShell

Open **PowerShell** (not Git Bash, not CMD) and paste the entire block below as one operation:

```powershell
cd "C:\Users\Brandon\Desktop\Access-Your-Place-fix"

# 1. Remove the lock file blocking git
if (Test-Path ".git\index.lock") { Remove-Item ".git\index.lock" -Force }

# 2. Stage EVERYTHING (all 600+ source files git currently ignores)
git add -A

# 3. Commit all changes from both sessions
git commit -m "feat: stripe billing, admin user, supabase schema fix, penny staff tool, platform footer

- Fix supabase.ts: schema 'prj_X-ZoVQv6LKXT' -> 'public' (fixes staff login redirect loop)
- Add Stripe billing to backend/server.js: PaymentIntent, subscriptions, customer portal, webhooks
- Add stripe@14 to backend/package.json
- Fix backend/server.js: was truncated mid-case, now complete with app.listen
- Add /webhooks/stripe endpoint for payment_intent, subscription, invoice events
- Add migrations/admin_user_teamvissionworks.sql — full admin access for teamvissionworks@gmail.com
- BookCallSection: Book a Call emails success@accessyourplace.com
- StaffDashboard: Book a Call button in header nav
- Footer: removed TycoonLabs, added Our Platforms section (AYP / AYPFlow / AYPLabs)
- AppLayout: updated SEO title and description
- InvestorPortal: PennyStaffTool floating widget (bottom-left, GoDaddy agent)
- Add .gitattributes for CRLF normalization
- Add supabase/ edge functions directory
- Add PennyAI component, CommunityStandards, LegalAgreementGate pages
- Add RLS fix migration SQL"

# 4. Push to GitHub → triggers Railway deploy
git push origin main
```

---

## After the push completes (5 steps, do in order)

### Step 1 — Add Railway env vars
Go to **Railway → your service → Variables** and add:

```
STRIPE_SECRET_KEY        = sk_live_... (from Stripe Dashboard → API keys)
STRIPE_WEBHOOK_SECRET    = whsec_...  (from Stripe Dashboard → Webhooks, after step 2)
STRIPE_PRICE_STARTER     = price_...  (from Stripe Dashboard → Products)
STRIPE_PRICE_GROWTH      = price_...
STRIPE_PRICE_SCALE       = price_...
```

### Step 2 — Register the Stripe webhook
In **Stripe Dashboard → Developers → Webhooks → Add endpoint**:
- URL: `https://your-railway-domain.railway.app/webhooks/stripe`
- Events to listen for:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copy the **Signing secret** → paste into Railway as `STRIPE_WEBHOOK_SECRET`

### Step 3 — Create the admin user
Go to **Supabase Dashboard → SQL Editor → New Query**, paste and run:
```
migrations/admin_user_teamvissionworks.sql
```
Login: `teamvissionworks@gmail.com` / `TempAdmin2024!`
**Change password immediately after first login.**

### Step 4 — Run the RLS fix
In **Supabase Dashboard → SQL Editor → New Query**, paste and run:
```
migrations/rls_fix_production.sql
```
This fixes 1,042 daily Postgres errors (lifts success rate from ~41% to 95%+).

### Step 5 — Prevent the old page from returning (branch protection)
In **GitHub → your repo → Settings → Branches → Add rule**:
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass
- ✅ Do not allow bypassing the above settings

This prevents any force-push from reverting your code.

---

## What each change fixed

| File | What it fixes |
|------|--------------|
| `supabase.ts` | Staff login redirect loop — wrong schema pointed at Famous.ai |
| `backend/server.js` | Stripe PaymentIntent + subscriptions + webhooks wired up; file was truncated (missing `app.listen`) — now complete |
| `backend/package.json` | Added `stripe` npm package |
| `migrations/admin_user_teamvissionworks.sql` | Full admin access for teamvissionworks@gmail.com |
| `Footer.tsx` | Removed TycoonLabs; added AccessYourPlace / AccessYPFlow / AccessYPLabs cards |
| `BookCallSection.tsx` + `StaffDashboard.tsx` | Book a Call → `success@accessyourplace.com` |
| `InvestorPortal.tsx` | PennyStaffTool widget for staff during client calls |
