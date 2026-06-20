$Manifest = "C:\WebsiteMigrations\accessyourplace-code\scripts\batch4a-functions.txt"

if (!(Test-Path $Manifest)) {
  Write-Host "Missing manifest: $Manifest" -ForegroundColor Red
  exit 1
}

$Functions = Get-Content $Manifest | Where-Object { $_.Trim() -ne "" }
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
Write-Host "Batch 4A deploy complete."

if ($Failed.Count -gt 0) {
  Write-Host "Failed functions:" -ForegroundColor Red
  $Failed | ForEach-Object { Write-Host $_ -ForegroundColor Red }
} else {
  Write-Host "All Batch 4A functions deployed successfully." -ForegroundColor Green
}