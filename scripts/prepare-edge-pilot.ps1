$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"
$Functions = @("staff-login", "get-properties")
$Schema = "prj_X-ZoVQv6LKXT"

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
    Write-Host "Missing source function: $fn" -ForegroundColor Red
    continue
  }

  $latest = Get-ChildItem $srcFn -Directory |
    Sort-Object { [int]($_.Name.TrimStart('v')) } -Descending |
    Select-Object -First 1

  if (!$latest) {
    Write-Host "No version folders found for: $fn" -ForegroundColor Red
    continue
  }

  $bundle = Join-Path $latest.FullName "bundle.js"

  if (!(Test-Path $bundle)) {
    Write-Host "Missing bundle.js for: $fn" -ForegroundColor Red
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

  Write-Host "Prepared $fn from $($latest.Name) -> $target"
}