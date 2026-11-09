# BaceVector Quick Start Guide

Get up and running with BaceVector in 15 minutes.

## 🚀 Fast Track Setup

### 1. Install Prerequisites (5 min)

```bash
# Check versions
node --version    # Need 20+
npm --version
dotnet --version  # Need 8.0+

# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Create Cloudflare Resources (5 min)

```bash
# Create D1 Database
wrangler d1 create bacevector-db
# ⚠️ COPY the database_id from output!

# Create Vectorize Index
wrangler vectorize create bacevector-vectors --dimensions=768 --metric=cosine

# Create R2 Bucket
wrangler r2 bucket create bacevector-documents

# Initialize Database
cd src/workers
wrangler d1 execute bacevector-db --file=schema.sql
```

### 3. Configure Workers (2 min)

Update `database_id` in these files (use the ID from step 2):
- `src/workers/ingestion/wrangler.toml` (line 17)
- `src/workers/admin/wrangler.toml` (line 17)

### 4. Start Workers (3 min)

```bash
# Terminal 1: Ingestion Worker
cd src/workers/ingestion
npm install
npm run dev

# Terminal 2: Query Worker (new terminal)
cd src/workers/query
npm install
npm run dev

# Terminal 3: Admin Worker (new terminal)
cd src/workers/admin
npm install
npm run dev
```

## ✅ Verify Setup

Test each worker:

```bash
# Health checks
curl http://localhost:8787/healthz  # Ingestion
curl http://localhost:8788/healthz  # Query
curl http://localhost:8789/healthz  # Admin
```

All should return: `{"status":"ok"}`

## 🧪 Quick Test

### Create a test tenant:

```bash
wrangler d1 execute bacevector-db --command \
  "INSERT INTO tenants (tenant_id, name, plan, status, api_key_hash) 
   VALUES ('demo', 'Demo Corp', 'base', 'active', 'demo-key');"
```

### Test the query endpoint:

```bash
curl -X POST http://localhost:8788/query \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo",
    "question": "What is the company policy?"
  }'
```

Expected: You'll get a response saying no documents are found (which is correct - we haven't uploaded any yet!)

## 📚 Next Steps

### For Full Testing:
- See `TESTING.md` for comprehensive testing guide
- See `SETUP-CHECKLIST.md` for detailed setup verification

### To Upload Documents:
You'll need to either:
1. Set up the Orchard Core UI (see `src/orchard/README.md`)
2. Or manually upload to R2 and trigger ingestion via API

### To Deploy:
- See `DEPLOYMENT.md` for production deployment

## 🔧 Common Issues

**"Database not found"**
- Make sure you ran the schema.sql file
- Check database_id in wrangler.toml matches

**"npm run dev fails"**
- Run `npm install` first
- Check Node.js version is 20+

**"Workers AI not available"**
- Ensure your Cloudflare account has Workers AI enabled
- Check your account plan

## 📖 Architecture Overview

```
┌─────────────────┐
│  Orchard Core   │  Multi-tenant portal
│   (Optional)    │  Document upload UI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ingestion Worker│  Chunks docs, generates
│   (Port 8787)   │  embeddings, stores in
└────────┬────────┘  Vectorize
         │
         ▼
┌─────────────────┐
│  Vectorize DB   │  Vector embeddings
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Query Worker   │  RAG: Search vectors +
│   (Port 8788)   │  LLM answer generation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Admin Worker   │  Usage tracking,
│   (Port 8789)   │  billing, quotas
└─────────────────┘
```

## 💡 What You've Built

- ✅ **3 Cloudflare Workers** handling ingestion, queries, and admin
- ✅ **Vectorize database** for semantic search
- ✅ **D1 database** for metadata and usage tracking
- ✅ **R2 storage** for document files
- ✅ **Workers AI** for embeddings and LLM responses
- ✅ **Multi-tenant architecture** with usage tracking
- ✅ **RAG pipeline** for contextual Q&A

## 🎯 Ready for Production?

Before deploying:
1. Complete all tests in `TESTING.md`
2. Set up monitoring and alerting
3. Configure production secrets
4. Review security settings
5. Set up backup procedures

See `DEPLOYMENT.md` for the full production deployment guide.

