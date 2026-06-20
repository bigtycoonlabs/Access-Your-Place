$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"
$Manifest = "C:\WebsiteMigrations\accessyourplace-code\scripts\batch2-functions.txt"
$Schema = "prj_X-ZoVQv6LKXT"

$Functions = @(
  "investor-session",
  "investor-favorites",
  "investor-email-notifications",
  "investor-activity-log",
  "investor-weekly-digest",
  "manage-investor-credits",
  "manage-investor-progress",
  "manage-investor-pipeline",
  "send-investor-invitation",
  "send-notification-email",
  "book-discovery-call",
  "get-digital-products",
  "upload-digital-product",
  "track-download",
  "track-event",
  "submit-lead",
  "get-leads",
  "manage-landlord-portal",
  "manage-landlords",
  "manage-investor-crm",
  "manage-support-requests",
  "manage-hr-commissions",
  "manage-sop-repository",
  "get-draft-articles",
  "update-article-status",
  "sync-static-articles",
  "submit-resident-request"
)

$Shim = @"
const DATA_SCHEMA = '$Schema';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

"@

$Prepared = @()

foreach ($fn in $Functions) {
  $srcFn = Join-Path $SourceRoot $fn

  if (!(Test-Path $srcFn)) {
    Write-Host "MISSING SOURCE: $fn" -ForegroundColor Yellow
    continue
  }

  $latest = Get-ChildItem $srcFn -Directory |
    Where-Object { $_.Name -match '^v\d+$' } |
    Sort-Object { [int]($_.Name.TrimStart('v')) } -Descending |
    Select-Object -First 1

  if (!$latest) {
    Write-Host "NO VERSION FOLDER: $fn" -ForegroundColor Yellow
    continue
  }

  $bundle = Join-Path $latest.FullName "bundle.js"

  if (!(Test-Path $bundle)) {
    Write-Host "MISSING bundle.js: $fn $($latest.Name)" -ForegroundColor Yellow
    continue
  }

  $targetDir = Join-Path $TargetRoot $fn
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  $target = Join-Path $targetDir "index.ts"
  $content = Get-Content $bundle -Raw

  if ($content -notmatch "const DATA_SCHEMA =") {
    $content = $Shim + $content
  }

  Set-Content -Path $target -Value $content -Encoding UTF8
  $Prepared += $fn

  Write-Host "Prepared $fn from $($latest.Name)" -ForegroundColor Green
}

$Prepared | Set-Content -Path $Manifest -Encoding UTF8

Write-Host ""
Write-Host "Prepared function count: $($Prepared.Count)" -ForegroundColor Cyan
Write-Host "Manifest written to: $Manifest" -ForegroundColor Cyan