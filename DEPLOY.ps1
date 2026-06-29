# Access Your Place — Production Deploy Script
# Double-click this file or right-click → Run with PowerShell

Set-Location "C:\Users\Brandon\Desktop\Access-Your-Place-fix"

Write-Host "=== AYP Production Deploy ===" -ForegroundColor Cyan

# Remove git lock if present
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "Removed index.lock" -ForegroundColor Yellow
}

# Stage all files
Write-Host "Staging all files..." -ForegroundColor Cyan
git add -A
if ($LASTEXITCODE -ne 0) { Write-Host "git add failed" -ForegroundColor Red; pause; exit 1 }

# Check if there's anything to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..." -ForegroundColor Cyan
    git commit -m "deploy: sync all source files to production

- src/lib/supabase.ts: schema public (fixes staff login)
- src/components/Footer.tsx: platforms section, no TycoonLabs
- src/components/BookCallSection.tsx: email success@accessyourplace.com
- src/pages/StaffDashboard.tsx: Book a Call button
- src/pages/InvestorPortal.tsx: PennyStaffTool widget
- src/components/AppLayout.tsx: updated SEO
- backend/server.js: complete with app.listen, no Stripe
- migrations/admin_user_teamvissionworks.sql: admin user"
} else {
    Write-Host "Nothing new to commit — pushing existing commits" -ForegroundColor Green
}

# Push to GitHub (triggers Railway deploy)
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed — check credentials" -ForegroundColor Red; pause; exit 1 }

Write-Host "" 
Write-Host "DONE. Railway will deploy in ~2 minutes." -ForegroundColor Green
Write-Host "Watch: https://railway.app/dashboard" -ForegroundColor Cyan
pause
