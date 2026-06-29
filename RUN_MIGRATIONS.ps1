# ============================================================
#  AYP — Run Supabase Migrations via Management API
#  Right-click → Run with PowerShell
# ============================================================

$projectRef = "adcbrclppmnguzkzwiys"
$projectDir  = "C:\Users\Brandon\Desktop\Access-Your-Place-fix"
$schemaFile  = "$projectDir\DATABASE_SCHEMA.sql"
$rlsFile     = "$projectDir\migrations\rls_fix_production.sql"

Write-Host ""
Write-Host "=== AYP Supabase Migration Runner ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You need a Personal Access Token — NOT the service role key." -ForegroundColor Yellow
Write-Host "  1. Go to: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
Write-Host "  2. Click 'Generate new token'" -ForegroundColor Yellow
Write-Host "  3. Copy the token (starts with sbp_...)" -ForegroundColor Yellow
Write-Host ""
$token = Read-Host "Paste Personal Access Token"

if (-not $token) {
    Write-Host "No token provided. Exiting." -ForegroundColor Red; pause; exit 1
}

if ($token -like "eyJ*") {
    Write-Host ""
    Write-Host "ERROR: That looks like a service role key (JWT), not a Personal Access Token." -ForegroundColor Red
    Write-Host "Personal Access Tokens start with 'sbp_' and are found at:" -ForegroundColor Red
    Write-Host "  https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
    pause; exit 1
}

function Invoke-SupabaseSQL {
    param([string]$label, [string]$sql)
    Write-Host ""
    Write-Host "Running: $label ..." -ForegroundColor Cyan

    $body = @{ query = $sql } | ConvertTo-Json -Depth 5 -Compress

    try {
        $response = Invoke-RestMethod `
            -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $token"
                "Content-Type"  = "application/json"
            } `
            -Body $body -ErrorAction Stop

        Write-Host "  OK" -ForegroundColor Green
        return $true
    }
    catch {
        $errMsg = $_.ErrorDetails.Message
        if (-not $errMsg) { $errMsg = $_.Exception.Message }
        Write-Host "  FAILED: $errMsg" -ForegroundColor Red
        return $false
    }
}

# ── Step 1: Run DATABASE_SCHEMA.sql ──────────────────────────
if (-not (Test-Path $schemaFile)) {
    Write-Host "ERROR: Cannot find $schemaFile" -ForegroundColor Red; pause; exit 1
}

$schemaSql = Get-Content $schemaFile -Raw -Encoding UTF8
$ok = Invoke-SupabaseSQL "DATABASE_SCHEMA.sql (create all tables)" $schemaSql

if (-not $ok) {
    Write-Host ""
    Write-Host "Schema migration failed. Fix the error above before continuing." -ForegroundColor Red
    pause; exit 1
}

# ── Step 2: Insert admin user (teamvissionworks@gmail.com) ───
$adminSql = @"
INSERT INTO staff_users (
  email, password_hash, name, first_name, last_name,
  team, role, department, roles, permissions,
  is_active, account_completed, yp_certified,
  created_at, updated_at
)
VALUES (
  'teamvissionworks@gmail.com',
  'e4267bce9a1978d15616ed8913b97eda49ebcf6686395aa782eff766defbdca4',
  'Admin TeamVission',
  'Admin',
  'TeamVission',
  'leadership',
  'admin',
  'success_managers',
  ARRAY['admin','success_manager','staff'],
  ARRAY['all','admin','manage_staff','manage_investors','manage_properties',
        'manage_deals','manage_billing','manage_settings','view_analytics',
        'manage_agreements','manage_crm','manage_hr','send_notifications'],
  true,
  true,
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  role              = EXCLUDED.role,
  roles             = EXCLUDED.roles,
  permissions       = EXCLUDED.permissions,
  department        = EXCLUDED.department,
  is_active         = true,
  account_completed = true,
  updated_at        = now();
"@

Invoke-SupabaseSQL "Insert teamvissionworks@gmail.com admin user" $adminSql | Out-Null

# ── Step 3: Run session security migration (adds missing columns) ────────────
$sessionFile = "$projectDir\migrations\001_staff_login_session_security.sql"
if (Test-Path $sessionFile) {
    $sessionSql = Get-Content $sessionFile -Raw -Encoding UTF8
    $ok3 = Invoke-SupabaseSQL "Session security columns (001_staff_login_session_security.sql)" $sessionSql
    if (-not $ok3) {
        Write-Host "  (Non-fatal — columns may already exist)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  (Skipping session migration — file not found)" -ForegroundColor DarkGray
}

# ── Step 4: Run RLS fix migration ────────────────────────────
if (Test-Path $rlsFile) {
    $rlsSql = Get-Content $rlsFile -Raw -Encoding UTF8
    Invoke-SupabaseSQL "RLS fix" $rlsSql | Out-Null
} else {
    Write-Host ""
    Write-Host "  (Skipping RLS fix — file not found at $rlsFile)" -ForegroundColor DarkGray
}

# ── Done ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== All migrations complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Staff login:  https://www.accessyourplace.com/staff/login" -ForegroundColor Cyan
Write-Host "Email:        teamvissionworks@gmail.com" -ForegroundColor Cyan
Write-Host "Password:     TempAdmin2024!  (change immediately after login)" -ForegroundColor Yellow
Write-Host ""
pause
