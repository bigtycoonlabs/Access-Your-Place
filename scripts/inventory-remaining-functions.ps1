$SourceRoot = "C:\WebsiteMigrations\accessyourplace\functions"
$TargetRoot = "C:\WebsiteMigrations\accessyourplace-code\supabase\functions"

$SourceFunctions = Get-ChildItem $SourceRoot -Directory | Select-Object -ExpandProperty Name | Sort-Object
$PreparedFunctions = Get-ChildItem $TargetRoot -Directory | Select-Object -ExpandProperty Name | Sort-Object

$Remaining = $SourceFunctions | Where-Object { $_ -notin $PreparedFunctions }

Write-Host ""
Write-Host "Source function count: $($SourceFunctions.Count)"
Write-Host "Prepared/deployed local function count: $($PreparedFunctions.Count)"
Write-Host "Remaining function count: $($Remaining.Count)"
Write-Host ""

Write-Host "Remaining functions:" -ForegroundColor Cyan
$Remaining | ForEach-Object { Write-Host $_ }

$Remaining | Set-Content "C:\WebsiteMigrations\accessyourplace-code\scripts\remaining-functions.txt" -Encoding UTF8

Write-Host ""
Write-Host "Saved to scripts\remaining-functions.txt"