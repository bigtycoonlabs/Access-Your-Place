$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$RemainingFile = "C:\WebsiteMigrations\accessyourplace-code\scripts\remaining-functions.txt"
$OutFile = "C:\WebsiteMigrations\accessyourplace-code\scripts\remaining-function-env-inventory.txt"

if (!(Test-Path $RemainingFile)) {
  Write-Host "Missing remaining-functions.txt. Run inventory-remaining-functions.ps1 first." -ForegroundColor Red
  exit 1
}

$Functions = Get-Content $RemainingFile | Where-Object { $_.Trim() -ne "" }

$Lines = @()
$Lines += "Remaining Function Environment / Risk Inventory"
$Lines += "Generated: $(Get-Date)"
$Lines += ""

foreach ($fn in $Functions) {
  $srcFn = Join-Path $SourceRoot $fn

  if (!(Test-Path $srcFn)) {
    $Lines += "FUNCTION: $fn"
    $Lines += "  STATUS: MISSING SOURCE"
    $Lines += ""
    continue
  }

  $latest = Get-ChildItem $srcFn -Directory |
    Where-Object { $_.Name -match '^v\d+$' } |
    Sort-Object { [int]($_.Name.TrimStart('v')) } -Descending |
    Select-Object -First 1

  if (!$latest) {
    $Lines += "FUNCTION: $fn"
    $Lines += "  STATUS: NO VERSION FOLDER"
    $Lines += ""
    continue
  }

  $bundle = Join-Path $latest.FullName "bundle.js"

  if (!(Test-Path $bundle)) {
    $Lines += "FUNCTION: $fn"
    $Lines += "  VERSION: $($latest.Name)"
    $Lines += "  STATUS: MISSING bundle.js"
    $Lines += ""
    continue
  }

  $content = Get-Content $bundle -Raw

  $envMatches = [regex]::Matches($content, "Deno\.env\.get\(['""]([^'""]+)['""]\)")
  $envs = $envMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

  $riskTags = @()

  if ($content -match "stripe|STRIPE") { $riskTags += "STRIPE/PAYMENT" }
  if ($content -match "twilio|TWILIO|sms|SMS") { $riskTags += "TWILIO/SMS" }
  if ($content -match "resend|RESEND|sendgrid|SENDGRID|email") { $riskTags += "EMAIL" }
  if ($content -match "openai|OPENAI|anthropic|ANTHROPIC|ai-|penny") { $riskTags += "AI" }
  if ($content -match "cron|schedule|scheduled|nightly|weekly|daily") { $riskTags += "SCHEDULED/CRON" }
  if ($content -match "delete|truncate|clear-all|bulk") { $riskTags += "BULK/DESTRUCTIVE" }
  if ($content -match "webhook") { $riskTags += "WEBHOOK" }
  if ($fn -match "^test-") { $riskTags += "TEST" }

  $Lines += "FUNCTION: $fn"
  $Lines += "  VERSION: $($latest.Name)"
  $Lines += "  ENV_VARS: " + ($(if ($envs.Count -gt 0) { $envs -join ", " } else { "none detected" }))
  $Lines += "  RISK_TAGS: " + ($(if ($riskTags.Count -gt 0) { ($riskTags | Sort-Object -Unique) -join ", " } else { "DB/APP or unknown" }))
  $Lines += ""
}

$Lines | Set-Content $OutFile -Encoding UTF8

Write-Host ""
Write-Host "Inventory written to:"
Write-Host $OutFile
Write-Host ""

Get-Content $OutFile