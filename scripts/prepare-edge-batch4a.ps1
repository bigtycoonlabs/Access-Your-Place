$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"
$Manifest = "C:\WebsiteMigrations\accessyourplace-code\scripts\batch4a-functions.txt"
$Schema = "prj_X-ZoVQv6LKXT"

$Functions = @(
  "ai-property-analysis",
  "bulk-import-properties",
  "check-expired-refusals",
  "export-booking-data",
  "generate-agreement-pdf",
  "generate-report-pdf",
  "penny-deal-scoring",
  "penny-score-monitoring",
  "save-deal-analytics"
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