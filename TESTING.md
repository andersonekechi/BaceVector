# BaceVector Testing Guide

This guide walks you through testing the BaceVector platform locally and in staging.

## Prerequisites

Before testing, ensure you have:

### Required Software
- ✅ **Node.js 20+** and npm
- ✅ **.NET SDK 8.0+** (for Orchard Core)
- ✅ **Wrangler CLI** (`npm install -g wrangler`)
- ✅ **Cloudflare Account** with Workers, Vectorize, R2, and D1 enabled

### Cloudflare Setup Required
1. **Create Cloudflare Resources:**
   ```bash
   # Login to Cloudflare
   wrangler login
   
   # Create D1 Database
   wrangler d1 create bacevector-db
   # Note the database_id and update wrangler.toml files
   
   # Create Vectorize Index
   wrangler vectorize create bacevector-vectors --dimensions=768 --metric=cosine
   
   # Create R2 Bucket
   wrangler r2 bucket create bacevector-documents
   ```

2. **Initialize Database Schema:**
   ```bash
   cd src/workers
   wrangler d1 execute bacevector-db --file=schema.sql
   ```

3. **Update Configuration:**
   - Edit `src/workers/ingestion/wrangler.toml` and replace `YOUR_D1_DATABASE_ID`
   - Edit `src/workers/admin/wrangler.toml` and replace `YOUR_D1_DATABASE_ID`
   - Copy `env.example` to `.env` and fill in values

## Testing Cloudflare Workers

### 1. Test Ingestion Worker

```bash
cd src/workers/ingestion
npm install
npm run dev
```

In another terminal, test the endpoint:

```bash
# Health check
curl http://localhost:8787/healthz

# Test ingestion (requires R2 setup)
curl -X POST http://localhost:8787/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "documentId": "test-doc-001",
    "filename": "sample.txt",
    "r2Key": "test-tenant/test-doc-001/sample.txt"
  }'
```

**Expected Response:**
```json
{
  "status": "completed",
  "documentId": "test-doc-001",
  "chunkCount": 5
}
```

### 2. Test Query Worker

```bash
cd src/workers/query
npm install
npm run dev
```

Test the RAG query endpoint:

```bash
# Health check
curl http://localhost:8788/healthz

# Ask a question
curl -X POST http://localhost:8788/query \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "question": "What is the vacation policy?"
  }'
```

**Expected Response:**
```json
{
  "answer": "Based on the documents...",
  "sources": [
    {
      "documentId": "test-doc-001",
      "chunk": "Vacation policy text...",
      "score": 0.85
    }
  ],
  "usage": {
    "queryTokens": 8,
    "responseTokens": 45
  }
}
```

### 3. Test Admin Worker

```bash
cd src/workers/admin
npm install
npm run dev
```

Test usage tracking:

```bash
# Get tenant usage
curl http://localhost:8789/tenants/test-tenant/usage

# Increment usage
curl -X POST http://localhost:8789/tenants/test-tenant/usage/increment \
  -H "Content-Type: application/json" \
  -d '{"type": "query", "count": 1}'

# Check quota
curl -X POST http://localhost:8789/tenants/test-tenant/check-quota \
  -H "Content-Type: application/json" \
  -d '{"type": "document"}'
```

## Testing Orchard Core Module

### 1. Bootstrap Orchard Core (First Time)

```bash
cd src/orchard

# Install Orchard Core templates
dotnet new install OrchardCore.ProjectTemplates

# Create new Orchard Core CMS project
dotnet new occms -n BaceVector.Web

# Add the custom module
cd BaceVector.Web
dotnet add reference ../Modules/BaceVector.Documents/BaceVector.Documents.csproj
```

### 2. Configure Orchard Core

Edit `appsettings.json` in the Orchard Core project:

```json
{
  "BaceVector": {
    "Workers": {
      "IngestionUrl": "http://localhost:8787",
      "QueryUrl": "http://localhost:8788",
      "AdminUrl": "http://localhost:8789"
    },
    "R2": {
      "UploadUrl": "https://your-r2-upload-endpoint.workers.dev"
    }
  }
}
```

### 3. Run Orchard Core

```bash
cd src/orchard/BaceVector.Web
dotnet run
```

Navigate to `https://localhost:5001` and complete the setup wizard.

### 4. Enable BaceVector Module

1. Login to Orchard Core admin
2. Go to **Configuration → Features**
3. Enable **BaceVector Documents** module
4. Navigate to `/Documents` to access the document management UI

## End-to-End Testing Workflow

### Scenario 1: Upload and Query a Document

1. **Start all services:**
   ```bash
   # Terminal 1: Ingestion Worker
   cd src/workers/ingestion && npm run dev
   
   # Terminal 2: Query Worker
   cd src/workers/query && npm run dev
   
   # Terminal 3: Admin Worker
   cd src/workers/admin && npm run dev
   
   # Terminal 4: Orchard Core
   cd src/orchard/BaceVector.Web && dotnet run
   ```

2. **Upload a test document:**
   - Navigate to `https://localhost:5001/Documents/Upload`
   - Upload a `.txt` file with sample company policy text
   - Verify document appears in the library with "Processing" status
   - Wait for status to change to "Completed"

3. **Query the document:**
   - Navigate to `https://localhost:5001/Query`
   - Ask: "What is mentioned in the document?"
   - Verify you get a contextual answer with source citations

4. **Check usage:**
   - Navigate to `https://localhost:5001/Documents`
   - Verify usage counters show 1 document and 1 query

### Scenario 2: Test Quota Limits

1. **Seed test tenant with limits:**
   ```bash
   # Insert test tenant into D1
   wrangler d1 execute bacevector-db --command \
     "INSERT INTO tenants (tenant_id, name, plan, status, api_key_hash) 
      VALUES ('test-tenant', 'Test Company', 'base', 'active', 'test-hash');"
   ```

2. **Test document limit:**
   - Try uploading 101 documents (base plan limit is 100)
   - Verify error message about quota exceeded

3. **Test query overage:**
   - Make 5001 queries (base plan limit is 5000)
   - Verify overage warning appears
   - Check usage endpoint shows overage charges

## Common Issues and Solutions

### Issue: "VECTORIZE_INDEX is not defined"
**Solution:** Make sure you've created the Vectorize index and updated `wrangler.toml` bindings.

### Issue: "Database not found"
**Solution:** Run the schema.sql file to initialize D1:
```bash
cd src/workers
wrangler d1 execute bacevector-db --file=schema.sql
```

### Issue: "Workers AI model not found"
**Solution:** Ensure your Cloudflare account has Workers AI enabled. Check the model name is correct: `@cf/baai/bge-base-en-v1.5`

### Issue: Orchard Core module not loading
**Solution:** 
1. Verify the module is referenced in the main project
2. Check `Manifest.cs` is present
3. Rebuild the solution: `dotnet build`

### Issue: CORS errors when calling Workers from Orchard
**Solution:** Add CORS headers to Worker responses (already implemented in shared utils).

## Manual Test Checklist

Before deploying to production, verify:

- [ ] Ingestion worker processes TXT files correctly
- [ ] Embeddings are generated and stored in Vectorize
- [ ] Query worker returns relevant answers with sources
- [ ] Usage tracking increments correctly
- [ ] Quota limits are enforced for documents
- [ ] Query overage is calculated correctly
- [ ] Document upload UI works in Orchard Core
- [ ] Query UI shows conversation history
- [ ] Usage dashboard displays accurate metrics
- [ ] Document deletion removes vectors from Vectorize
- [ ] Multi-tenant isolation works (different tenants can't see each other's docs)

## Load Testing

For production readiness, test with:

```bash
# Install k6 for load testing
brew install k6  # or download from k6.io

# Run load test
k6 run tests/load-test.js
```

Example load test script (`tests/load-test.js`):

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.post('https://query.bacevector.workers.dev/query', 
    JSON.stringify({
      tenantId: 'test-tenant',
      question: 'What is the vacation policy?'
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has answer': (r) => JSON.parse(r.body).answer !== undefined,
  });
}
```

## Next Steps

Once local testing passes:

1. Deploy workers to Cloudflare staging environment
2. Deploy Orchard Core to Azure App Service staging slot
3. Run integration tests against staging
4. Set up monitoring and alerting
5. Deploy to production

See `DEPLOYMENT.md` for deployment instructions.

