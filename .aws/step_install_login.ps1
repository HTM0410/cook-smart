# Supabase CLI migration: Tokyo → Singapore
# Requires: SUPABASE_ACCESS_TOKEN env var set

param(
    [string]$NewProjectName = "cooksmart-prod-sg",
    [string]$NewDbPassword = "hoanghhk123.",
    [string]$OrgSlug = ""  # Optional: if multiple orgs, set org slug
)

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "ERROR: Set SUPABASE_ACCESS_TOKEN first:" -ForegroundColor Red
    Write-Host '  $env:SUPABASE_ACCESS_TOKEN="sbp_xxx..."'
    exit 1
}

Write-Host "=== Checking supabase CLI ===" -ForegroundColor Cyan
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $cli) {
    Write-Host "Installing Supabase CLI via npm..."
    npm install -g supabase
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm failed. Try: scoop install supabase" -ForegroundColor Yellow
        Write-Host "Or download from: https://github.com/supabase/cli/releases" -ForegroundColor Yellow
        exit 1
    }
}
$ver = supabase --version
Write-Host "Supabase CLI: $ver"

Write-Host "`n=== Login ===" -ForegroundColor Cyan
$env:SUPABASE_ACCESS_TOKEN | supabase login --token $env:SUPABASE_ACCESS_TOKEN 2>&1

Write-Host "`n=== List organizations ===" -ForegroundColor Cyan
supabase orgs list

# Need org ID for project creation
if (-not $OrgSlug) {
    Write-Host "`nSet OrgSlug param if multiple orgs" -ForegroundColor Yellow
}