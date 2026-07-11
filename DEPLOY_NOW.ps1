# ONE-SHOT DEPLOY — removes lock, commits, pulls, pushes
Set-Location "C:\Users\Brandon\Desktop\Access-Your-Place-fix"

# Remove lock files
Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
Remove-Item -Force ".git\MERGE_HEAD" -ErrorAction SilentlyContinue
Remove-Item -Force ".git\rebase-merge" -Recurse -ErrorAction SilentlyContinue

# Git identity
git config user.email "teamvissionworks@gmail.com"
git config user.name "AYP Deploy"

# Stage everything
git add -A

# Commit if there are changes
$status = git status --porcelain
if ($status) {
    git commit -m "fix: staff login STAFF_SELECT, App.tsx ErrorBoundary, StaffDashboard null guard"
}

# Pull remote (rebase our commits on top)
Write-Host "Pulling remote changes..." -ForegroundColor Cyan
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Rebase conflict — aborting and force-pushing our version" -ForegroundColor Yellow
    git rebase --abort
    git push origin main --force-with-lease
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Force push also failed. Trying hard reset..." -ForegroundColor Red
        git fetch origin
        git reset --hard HEAD
        git add -A
        git stash
        git pull origin main
        git stash pop
        git push origin main
    }
} else {
    git push origin main
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "DEPLOYED. Railway builds in ~2 min." -ForegroundColor Green
    Write-Host "https://www.accessyourplace.com/staff/login" -ForegroundColor Cyan
} else {
    Write-Host "Push failed — see errors above" -ForegroundColor Red
}
pause
