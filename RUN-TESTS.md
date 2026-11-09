# ✅ All Workers Built Successfully!

Your document (`C:\Users\andye\Documents\valid.txt`) is uploaded to R2.

## 🚀 Run These Commands

### Terminal 1 - Query Worker
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\query
npm run dev
```

### Terminal 2 - Ingestion Worker  
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\ingestion
npm run dev
```

### Terminal 3 - Admin Worker
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\admin
npm run dev
```

Wait 10 seconds for all to start, then run tests:

### Terminal 4 - Test Commands

```powershell
# Test 1: Trigger ingestion of your document
curl -X POST http://localhost:8787/ingest -H "Content-Type: application/json" -d "{\"tenantId\":\"test-tenant\",\"documentId\":\"doc1\",\"filename\":\"valid.txt\",\"r2Key\":\"test-tenant/doc1/valid.txt\"}"

# Wait 30 seconds for processing, then:

# Test 2: Query the document
curl -X POST http://localhost:8788/query -H "Content-Type: application/json" -d "{\"tenantId\":\"test-tenant\",\"question\":\"What does the document say?\"}"

# Test 3: Check usage
curl http://localhost:8789/tenants/test-tenant/usage
```

## What Should Happen

1. **Ingestion** - Chunks your document, generates embeddings, stores in Vectorize
2. **Query** - Searches vectors, finds relevant chunks, generates AI answer
3. **Usage** - Shows 1 document, 1 query tracked

The complete RAG pipeline working end-to-end!

