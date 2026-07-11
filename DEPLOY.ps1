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

# Commit if there are changes
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..." -ForegroundColor Cyan
    git commit -m "fix: server.js STAFF_SELECT + App.tsx ErrorBoundary + StaffDashboard null guard

- Remove non-existent columns from STAFF_SELECT (notification_preferences,
  failed_login_attempts, locked_until, trainee_status, commission_split)
- Add AppErrorBoundary to App.tsx to prevent blank white screen on crash
- Add null guard to StaffDashboard so loading spinner shows before session loads
- Restore App.tsx routes (was truncated by prior sed command)"
    if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed" -ForegroundColor Red; pause; exit 1 }
} else {
    Write-Host "Nothing new to commit — pulling then pushing" -ForegroundColor Green
}

# Pull remote changes (rebase keeps our commits on top)
Write-Host "Pulling remote changes (rebase)..." -ForegroundColor Cyan
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "REBASE CONFLICT — your changes conflict with remote." -ForegroundColor Red
    Write-Host "Run: git rebase --abort   then tell Claude what happened." -ForegroundColor Yellow
    pause; exit 1
}

# Push to GitHub (triggers Railway deploy)
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed — check credentials" -ForegroundColor Red; pause; exit 1 }

Write-Host ""
Write-Host "DONE. Railway will deploy in ~2 minutes." -ForegroundColor Green
Write-Host "Watch: https://railway.app/dashboard" -ForegroundColor Cyan
pause
