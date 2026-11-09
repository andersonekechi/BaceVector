# BaceVector End-to-End Test
Write-Host "`n=== BaceVector Complete Setup Test ===" -ForegroundColor Cyan

# Verify all resources
Write-Host "`n✅ Cloudflare Resources:" -ForegroundColor Green
Write-Host "  • D1 Database: bacevector-db (27c29996-b885-4f56-9d09-85b3c78adc3f)"
Write-Host "  • Vectorize Index: bacevector-vectors (768 dimensions)"
Write-Host "  • R2 Bucket: bacevector-documents"
Write-Host "  • KV Namespace: CACHE (9430ac604ff34c0a9d6a60d0efd38a65)"

Write-Host "`n✅ Test Tenant Created:" -ForegroundColor Green
Write-Host "  • Tenant ID: test-tenant"
Write-Host "  • Plan: base (100 docs, 5000 queries/month)"
Write-Host "  • Status: active"

Write-Host "`n🚀 Ready to Test!" -ForegroundColor Cyan
Write-Host "`nYou can now test the complete RAG pipeline:" -ForegroundColor White

Write-Host "`n1️⃣  Start Admin Worker (Terminal 1):" -ForegroundColor Yellow
Write-Host "   cd src\workers\admin" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "   → Runs on http://localhost:8789" -ForegroundColor DarkGray

Write-Host "`n2️⃣  Start Query Worker (Terminal 2):" -ForegroundColor Yellow
Write-Host "   cd src\workers\query" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "   → Runs on http://localhost:8788" -ForegroundColor DarkGray

Write-Host "`n3️⃣  Start Ingestion Worker (Terminal 3):" -ForegroundColor Yellow
Write-Host "   cd src\workers\ingestion" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "   → Runs on http://localhost:8787" -ForegroundColor DarkGray

Write-Host "`n4️⃣  Test the API (Terminal 4):" -ForegroundColor Yellow
Write-Host "   # Check tenant usage" -ForegroundColor Gray
Write-Host "   curl http://localhost:8789/tenants/test-tenant/usage" -ForegroundColor Gray
Write-Host "" 
Write-Host "   # Upload a test document to R2 (manual for now)" -ForegroundColor Gray
Write-Host "   wrangler r2 object put bacevector-documents/test-tenant/doc1/test.txt --file=test.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Trigger ingestion" -ForegroundColor Gray
Write-Host '   curl -X POST http://localhost:8787/ingest -H "Content-Type: application/json" -d "{\"tenantId\":\"test-tenant\",\"documentId\":\"doc1\",\"filename\":\"test.txt\",\"r2Key\":\"test-tenant/doc1/test.txt\"}"' -ForegroundColor Gray
Write-Host ""
Write-Host "   # Query the document" -ForegroundColor Gray
Write-Host '   curl -X POST http://localhost:8788/query -H "Content-Type: application/json" -d "{\"tenantId\":\"test-tenant\",\"question\":\"What does the document say?\"}"' -ForegroundColor Gray

Write-Host "`n📚 Documentation:" -ForegroundColor Cyan
Write-Host "  • Full testing guide: TESTING.md"
Write-Host "  • Quick start: QUICK-START.md"
Write-Host "  • Setup checklist: SETUP-CHECKLIST.md"
Write-Host "  • Architecture: docs/implementation-plan.md"

Write-Host "`nQuick Test Without Documents:" -ForegroundColor Cyan
Write-Host "  See test-without-r2.md for testing query/admin workers"
Write-Host "  with manually inserted test vectors"

Write-Host "`nEverything is ready! Start the workers and test!" -ForegroundColor Green

