# Testing BaceVector Without R2

Since R2 is not enabled on your account, here's what you CAN test right now:

## ✅ What Works Without R2

### 1. Admin Worker - Usage Tracking & Tenant Management
The admin worker uses D1 and KV, both of which are set up.

### 2. Query Worker - RAG Queries (with manual vector insertion)
We can manually insert test vectors into Vectorize and test the query flow.

## 🧪 Quick Test Plan

### Step 1: Create a Test Tenant

```powershell
wrangler d1 execute bacevector-db --remote --command "INSERT INTO tenants (tenant_id, name, plan, status, api_key_hash) VALUES ('test-tenant', 'Test Company', 'base', 'active', 'test-key-hash');"
```

### Step 2: Start Admin Worker

```powershell
cd src/workers/admin
npm run dev
```

Open new terminal and test:

```powershell
# Get tenant usage (should return 0 documents, 0 queries)
curl http://localhost:8789/tenants/test-tenant/usage

# Increment query count
curl -X POST http://localhost:8789/tenants/test-tenant/usage/increment -H "Content-Type: application/json" -d '{\"type\":\"query\",\"count\":1}'

# Check usage again (should show 1 query)
curl http://localhost:8789/tenants/test-tenant/usage
```

### Step 3: Manually Insert Test Vectors (Optional)

Since we can't upload documents without R2, we can manually insert test vectors:

```javascript
// test-insert-vectors.js
const vectors = [
  {
    id: 'test-doc-1_chunk_0',
    values: Array(768).fill(0).map(() => Math.random()),
    metadata: {
      tenantId: 'test-tenant',
      documentId: 'test-doc-1',
      chunkIndex: 0,
      text: 'Our vacation policy allows 15 days of paid time off per year.',
      filename: 'hr-policy.txt'
    }
  }
];

// Run: wrangler vectorize insert bacevector-vectors --file=test-vectors.json
```

### Step 4: Test Query Worker

```powershell
cd src/workers/query
npm run dev
```

Test query:

```powershell
curl -X POST http://localhost:8788/query -H "Content-Type: application/json" -d '{\"tenantId\":\"test-tenant\",\"question\":\"What is the vacation policy?\"}'
```

## 🔧 To Enable Full Testing

You need to enable R2 in your Cloudflare account:

1. Go to https://dash.cloudflare.com/7341a7b1d55f3adeea87e772222fcb68/r2
2. Click "Enable R2"
3. Accept the pricing (has a free tier)
4. Come back and run:
   ```powershell
   wrangler r2 bucket create bacevector-documents
   ```

Then you can test the full document upload → ingestion → query flow!

## 🎯 What You Can Verify Now

Without R2, you can still verify:
- ✅ Admin worker tracks usage correctly
- ✅ Quota limits are enforced
- ✅ Overage calculations work
- ✅ Query worker can search Vectorize (if vectors are manually inserted)
- ✅ LLM generates answers from context
- ✅ Database schema is correct
- ✅ Multi-tenant isolation works

The **only** thing blocked by R2 is:
- ❌ Document upload/storage
- ❌ Automatic ingestion pipeline

Everything else is fully functional!

