# 🎯 Interactive Testing Guide

Your document is ready in R2: `C:\Users\andye\Documents\valid.txt`

## Step 1: Start Workers (3 Separate Terminals)

### Terminal 1 - Ingestion Worker
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\ingestion
npm run dev
```
**Wait for**: "Ready on http://localhost:8787"

### Terminal 2 - Query Worker
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\query
npm run dev
```
**Wait for**: "Ready on http://localhost:8788"

### Terminal 3 - Admin Worker
```powershell
cd C:\Users\andye\Documents\BaceVector\src\workers\admin
npm run dev
```
**Wait for**: "Ready on http://localhost:8789"

---

## Step 2: Process Your Document (Terminal 4)

Once all 3 workers show "Ready", open a 4th terminal:

```powershell
cd C:\Users\andye\Documents\BaceVector

# Trigger ingestion of your document
curl.exe -X POST http://localhost:8787/ingest -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"documentId\":\"doc1\",\"filename\":\"valid.txt\",\"r2Key\":\"test-tenant/doc1/valid.txt\"}'
```

**Expected response:**
```json
{
  "status": "completed",
  "documentId": "doc1",
  "chunkCount": 5
}
```

This means:
- ✅ Document fetched from R2
- ✅ Text extracted and chunked
- ✅ Embeddings generated with Workers AI
- ✅ Vectors stored in Vectorize

---

## Step 3: Ask Questions About Your Document

Now you can ask questions! I'll suggest some based on typical documents:

### Example Questions:

```powershell
# Question 1: General summary
curl.exe -X POST http://localhost:8788/query -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"question\":\"What is this document about?\"}'

# Question 2: Specific details
curl.exe -X POST http://localhost:8788/query -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"question\":\"What are the main points mentioned?\"}'

# Question 3: Numbers/data (if your doc has them)
curl.exe -X POST http://localhost:8788/query -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"question\":\"Are there any numbers or statistics?\"}'
```

### Or Ask Your Own Question:

```powershell
# Replace "YOUR QUESTION HERE" with anything you want to know
curl.exe -X POST http://localhost:8788/query -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"question\":\"YOUR QUESTION HERE\"}'
```

**Expected response:**
```json
{
  "answer": "Based on the document, ...",
  "sources": [
    {
      "documentId": "doc1",
      "chunk": "relevant text from your document...",
      "score": 0.85
    }
  ],
  "usage": {
    "queryTokens": 8,
    "responseTokens": 45
  }
}
```

---

## Step 4: Check Usage Tracking

```powershell
curl.exe http://localhost:8789/tenants/test-tenant/usage
```

**Expected response:**
```json
{
  "tenantId": "test-tenant",
  "plan": "base",
  "usage": {
    "documentCount": 1,
    "queryCount": 3,
    "overageQueries": 0,
    "overageCharges": 0
  },
  "limits": {
    "documents": 100,
    "queries": 5000
  }
}
```

---

## 🎉 What You're Testing

1. **Document Ingestion**: R2 → Text Extraction → Chunking → Embeddings → Vectorize
2. **RAG Query**: Question → Vector Search → Context Retrieval → LLM Answer
3. **Usage Tracking**: Document count, query count, quota enforcement
4. **Multi-tenancy**: Tenant isolation (test-tenant can only see their docs)

---

## 💡 What to Tell Me

After you run the tests, let me know:
1. ✅ Did ingestion work? (got "completed" status?)
2. ✅ Did queries return relevant answers?
3. ✅ What questions did you ask?
4. ✅ Were the answers accurate to your document?

Then I can help optimize or add features!

