$Functions = @(
  "investor-auth",
  "investor-login",
  "investor-register",
  "manage-investor-admin",
  "manage-staff",
  "manage-acquisition-requests",
  "manage-acquisition-workflow",
  "manage-acquisitions",
  "manage-property-assignments",
  "manage-investor-documents",
  "manage-document-signatures",
  "manage-deal-inquiries",
  "manage-deal-marketplace",
  "manage-notes",
  "investor-inquiries",
  "investor-messaging",
  "deal-flow-notifications",
  "manage-am-assignments",
  "manage-setup-tasks",
  "add-property",
  "update-property",
  "upload-deal-photo",
  "am-submit-deal",
  "staff-deal-search",
  "penny-property-photos",
  "penny-generate-description",
  "get-deal-analytics",
  "get-site-analytics"
)

$Failed = @()

foreach ($fn in $Functions) {
  Write-Host ""
  Write-Host "Deploying $fn ..." -ForegroundColor Cyan

  npx supabase functions deploy $fn

  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $fn" -ForegroundColor Red
    $Failed += $fn
  } else {
    Write-Host "DEPLOYED: $fn" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Batch deploy complete."

if ($Failed.Count -gt 0) {
  Write-Host "Failed functions:" -ForegroundColor Red
  $Failed | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "All functions deployed successfully." -ForegroundColor Green
}