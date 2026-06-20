$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"
$Manifest = "C:\WebsiteMigrations\accessyourplace-code\scripts\batch3-functions.txt"
$Schema = "prj_X-ZoVQv6LKXT"

$Functions = @(
  "create-deal",
  "create-property",
  "new-deal-create",
  "property-photo-urls",
  "record-legal-acceptance",
  "seller-document-upload",
  "submit-deal-inquiry",
  "submit-issue-report",
  "manage-deal-alerts",
  "manage-disputes",
  "manage-email-logs",
  "manage-email-templates",
  "manage-invoices",
  "manage-market-reports",
  "manage-notifications",
  "manage-outreach",
  "manage-platform-connections",
  "manage-portfolio-approvals",
  "manage-portfolio-performance",
  "manage-property-expenses",
  "manage-property-referrals",
  "manage-referrals",
  "manage-resident-portal",
  "landlord-auth",
  "investor-auth-v2",
  "investor-oauth",
  "investor-deal-locator",
  "delete-article",
  "delete-digital-product",
  "delete-property"
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