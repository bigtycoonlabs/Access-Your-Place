$Functions = @(
  "process-scheduled-campaigns",
  "security-alerts",
  "send-acquisition-emails",
  "send-bulk-email",
  "send-inquiry-notifications",
  "sign-agreement",
  "staff-forgot-password",
  "unassigned-investor-digest"
)

$Failed = @()

foreach ($fn in $Functions) {
  Write-Host ""
  Write-Host "Retrying $fn ..." -ForegroundColor Cyan

  npx supabase functions deploy $fn

  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $fn" -ForegroundColor Red
    $Failed += $fn
  } else {
    Write-Host "DEPLOYED: $fn" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Retry complete."

if ($Failed.Count -gt 0) {
  Write-Host "Still failed:" -ForegroundColor Red
  $Failed | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "All failed Batch 4B functions deployed successfully." -ForegroundColor Green
}