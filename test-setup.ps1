# BaceVector Setup Test Script
Write-Host "`n=== BaceVector Setup Verification ===" -ForegroundColor Cyan

# Test 1: Check Wrangler Auth
Write-Host "`n[1/5] Checking Wrangler Authentication..." -ForegroundColor Yellow
$whoami = wrangler whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Wrangler authenticated" -ForegroundColor Green
} else {
    Write-Host "❌ Wrangler not authenticated" -ForegroundColor Red
    exit 1
}

# Test 2: Check D1 Database
Write-Host "`n[2/5] Checking D1 Database..." -ForegroundColor Yellow
$d1List = wrangler d1 list 2>&1 | Select-String "bacevector-db"
if ($d1List) {
    Write-Host "✅ D1 database 'bacevector-db' exists" -ForegroundColor Green
} else {
    Write-Host "❌ D1 database not found" -ForegroundColor Red
}

# Test 3: Check Vectorize Index
Write-Host "`n[3/5] Checking Vectorize Index..." -ForegroundColor Yellow
$vecList = wrangler vectorize list 2>&1 | Select-String "bacevector-vectors"
if ($vecList) {
    Write-Host "✅ Vectorize index 'bacevector-vectors' exists" -ForegroundColor Green
} else {
    Write-Host "❌ Vectorize index not found" -ForegroundColor Red
}

# Test 4: Check Worker Dependencies
Write-Host "`n[4/5] Checking Worker Dependencies..." -ForegroundColor Yellow
$workersReady = 0
if (Test-Path "src/workers/admin/node_modules") {
    Write-Host "  ✅ Admin worker dependencies installed" -ForegroundColor Green
    $workersReady++
}
if (Test-Path "src/workers/query/node_modules") {
    Write-Host "  ✅ Query worker dependencies installed" -ForegroundColor Green
    $workersReady++
}
if (Test-Path "src/workers/ingestion/node_modules") {
    Write-Host "  ✅ Ingestion worker dependencies installed" -ForegroundColor Green
    $workersReady++
}

if ($workersReady -eq 3) {
    Write-Host "✅ All worker dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some workers missing dependencies ($workersReady/3)" -ForegroundColor Yellow
}

# Test 5: Check Database Schema
Write-Host "`n[5/5] Checking Database Schema..." -ForegroundColor Yellow
$tables = wrangler d1 execute bacevector-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';" 2>&1
if ($tables -match "tenants" -and $tables -match "documents" -and $tables -match "usage") {
    Write-Host "✅ Database schema initialized" -ForegroundColor Green
} else {
    Write-Host "❌ Database schema not complete" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Setup Summary ===" -ForegroundColor Cyan
Write-Host "Account ID: 7341a7b1d55f3adeea87e772222fcb68"
Write-Host "Database ID: 27c29996-b885-4f56-9d09-85b3c78adc3f"
Write-Host "Vectorize Index: bacevector-vectors"
Write-Host "KV Namespace ID: 9430ac604ff34c0a9d6a60d0efd38a65"

Write-Host "`n⚠️  Note: R2 is not enabled on your account." -ForegroundColor Yellow
Write-Host "   Document upload features will not work until R2 is enabled." -ForegroundColor Yellow
Write-Host "   Enable R2 in Cloudflare Dashboard: https://dash.cloudflare.com/r2" -ForegroundColor Yellow

Write-Host "`n=== Ready to Test ===" -ForegroundColor Cyan
Write-Host "You can now test the workers:" -ForegroundColor White
Write-Host "  1. cd src/workers/admin && npm run dev" -ForegroundColor Gray
Write-Host "  2. cd src/workers/query && npm run dev" -ForegroundColor Gray
Write-Host "  3. Test endpoints with curl or Postman" -ForegroundColor Gray

Write-Host "`nFor detailed testing instructions, see TESTING.md" -ForegroundColor White

