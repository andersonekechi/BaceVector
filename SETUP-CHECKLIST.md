# BaceVector Setup Checklist

Use this checklist to ensure everything is properly configured before testing.

## ✅ Prerequisites Installed

- [ ] **Node.js 20+** installed (`node --version`)
- [ ] **npm** installed (`npm --version`)
- [ ] **.NET SDK 8.0+** installed (`dotnet --version`)
- [ ] **Wrangler CLI** installed (`wrangler --version` or `npm install -g wrangler`)
- [ ] **Cloudflare account** created and logged in (`wrangler login`)

## ✅ Cloudflare Resources Created

### D1 Database
```bash
wrangler d1 create bacevector-db
```
- [ ] Database created
- [ ] Copy the `database_id` from output
- [ ] Update `database_id` in `src/workers/ingestion/wrangler.toml`
- [ ] Update `database_id` in `src/workers/admin/wrangler.toml`
- [ ] Run schema: `wrangler d1 execute bacevector-db --file=src/workers/schema.sql`

### Vectorize Index
```bash
wrangler vectorize create bacevector-vectors --dimensions=768 --metric=cosine
```
- [ ] Index created
- [ ] Verify `index_name` matches in wrangler.toml files

### R2 Bucket
```bash
wrangler r2 bucket create bacevector-documents
```
- [ ] Bucket created
- [ ] Verify `bucket_name` matches in wrangler.toml files

### Workers AI
- [ ] Workers AI is enabled on your Cloudflare account (check dashboard)

## ✅ Worker Configuration

### Ingestion Worker (`src/workers/ingestion`)
- [ ] `npm install` completed successfully
- [ ] `wrangler.toml` has correct D1 database_id
- [ ] `wrangler.toml` has correct Vectorize index_name
- [ ] `wrangler.toml` has correct R2 bucket_name
- [ ] Can run `npm run dev` without errors

### Query Worker (`src/workers/query`)
- [ ] `npm install` completed successfully
- [ ] `wrangler.toml` has correct Vectorize index_name
- [ ] `wrangler.toml` has ADMIN_WORKER_URL configured
- [ ] Can run `npm run dev` without errors

### Admin Worker (`src/workers/admin`)
- [ ] `npm install` completed successfully
- [ ] `wrangler.toml` has correct D1 database_id
- [ ] `wrangler.toml` has plan limits configured
- [ ] Can run `npm run dev` without errors

## ✅ Database Setup

- [ ] Schema applied: `wrangler d1 execute bacevector-db --file=src/workers/schema.sql`
- [ ] Test tenant created (optional):
  ```bash
  wrangler d1 execute bacevector-db --command \
    "INSERT INTO tenants (tenant_id, name, plan, status, api_key_hash) 
     VALUES ('test-tenant', 'Test Company', 'base', 'active', 'test-key-hash');"
  ```

## ✅ Orchard Core Setup (Optional for Worker-Only Testing)

- [ ] .NET SDK 8.0+ installed
- [ ] Orchard Core templates installed: `dotnet new install OrchardCore.ProjectTemplates`
- [ ] Orchard Core project created in `src/orchard/`
- [ ] BaceVector.Documents module referenced
- [ ] `appsettings.json` configured with Worker URLs
- [ ] Can run `dotnet run` without errors

## ✅ Quick Smoke Tests

### Test 1: Health Checks
```bash
# Ingestion (port 8787)
curl http://localhost:8787/healthz

# Query (port 8788)
curl http://localhost:8788/healthz

# Admin (port 8789)
curl http://localhost:8789/healthz
```
- [ ] All health checks return `{"status":"ok"}`

### Test 2: Database Connection
```bash
wrangler d1 execute bacevector-db --command "SELECT * FROM tenants;"
```
- [ ] Query executes without errors

### Test 3: Vectorize Connection
```bash
wrangler vectorize get bacevector-vectors
```
- [ ] Index details displayed

## ✅ Environment Variables

Create `.env` file in project root:
```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
D1_DATABASE_ID=your_database_id
VECTORIZE_INDEX_NAME=bacevector-vectors
R2_BUCKET_NAME=bacevector-documents
```
- [ ] `.env` file created
- [ ] All values filled in
- [ ] `.env` added to `.gitignore`

## ✅ Ready to Test?

If all items above are checked, you're ready to proceed with testing!

### Next Steps:
1. Follow `TESTING.md` for detailed testing procedures
2. Start with individual worker tests
3. Progress to end-to-end integration tests
4. Review `DEPLOYMENT.md` when ready to deploy

## Common Setup Issues

### Issue: "wrangler: command not found"
```bash
npm install -g wrangler
# or use npx
npx wrangler login
```

### Issue: "D1 database not found"
- Verify you created the database: `wrangler d1 list`
- Check the database_id matches in wrangler.toml

### Issue: "Vectorize index not found"
- Verify you created the index: `wrangler vectorize list`
- Check the index_name matches in wrangler.toml

### Issue: "Workers AI not available"
- Check your Cloudflare plan supports Workers AI
- Verify AI binding is in wrangler.toml: `[[ai]]` with `binding = "AI"`

### Issue: npm install fails
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Need Help?

- Check `TESTING.md` for detailed testing instructions
- Review `docs/implementation-plan.md` for architecture details
- Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/

