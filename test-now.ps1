# BaceVector Live Test Script
Write-Host "`n=== Testing BaceVector RAG Pipeline ===" -ForegroundColor Cyan

# Check if workers are running
Write-Host "`nChecking worker processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object {$_.ProcessName -like "*node*"}
if ($nodeProcesses.Count -lt 3) {
    Write-Host "ERROR: Not all workers are running!" -ForegroundColor Red
    Write-Host "Make sure you have 3 terminals with workers running." -ForegroundColor Red
    exit 1
}
Write-Host "Found $($nodeProcesses.Count) Node processes running" -ForegroundColor Green

Write-Host "`n=== Step 1: Trigger Document Ingestion ===" -ForegroundColor Cyan
Write-Host "This will process your document from R2..." -ForegroundColor White

# Since workers are in remote mode, we need to deploy them or use wrangler tail
Write-Host "`nIMPORTANT: Your workers are running in REMOTE mode." -ForegroundColor Yellow
Write-Host "They are accessible at Cloudflare URLs, not localhost." -ForegroundColor Yellow

Write-Host "`n=== Alternative: Deploy and Test ===" -ForegroundColor Cyan
Write-Host "Let's deploy the workers to Cloudflare and test there:" -ForegroundColor White

Write-Host "`n1. Deploy Ingestion Worker:" -ForegroundColor Yellow
Write-Host "   cd src\workers\ingestion" -ForegroundColor Gray
Write-Host "   wrangler deploy" -ForegroundColor Gray

Write-Host "`n2. Deploy Query Worker:" -ForegroundColor Yellow
Write-Host "   cd src\workers\query" -ForegroundColor Gray
Write-Host "   wrangler deploy" -ForegroundColor Gray

Write-Host "`n3. Deploy Admin Worker:" -ForegroundColor Yellow
Write-Host "   cd src\workers\admin" -ForegroundColor Gray
Write-Host "   wrangler deploy" -ForegroundColor Gray

Write-Host "`n4. Then test with the deployed URLs!" -ForegroundColor Yellow

Write-Host "`nWould you like me to deploy them now? (Y/N)" -ForegroundColor Cyan

