$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"
$Schema = "prj_X-ZoVQv6LKXT"

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

  Write-Host "Prepared $fn from $($latest.Name)" -ForegroundColor Green
}