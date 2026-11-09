# BaceVector Database

Cloudflare D1 database schema and migrations for the BaceVector SaaS platform.

## Setup

### 1. Create D1 Database

```bash
# Create production database
wrangler d1 create bacevector-db

# Create staging database
wrangler d1 create bacevector-db-staging
```

Copy the database IDs into your `wrangler.toml` files.

### 2. Initialize Schema

```bash
# Production
wrangler d1 execute bacevector-db --file=./database/schema.sql

# Staging
wrangler d1 execute bacevector-db-staging --file=./database/schema.sql
```

### 3. Seed Test Data (Optional)

```bash
# Only for development/staging
wrangler d1 execute bacevector-db-staging --file=./database/seed.sql
```

## Schema Overview

### Core Tables

- **tenants** - Company/organization accounts with plan and billing info
- **api_keys** - Authentication keys for tenant API access
- **documents** - Uploaded document metadata and processing status
- **users** - Individual users within each tenant (multi-user support)

### Usage & Billing

- **usage** - Monthly usage counters (documents, queries, storage)
- **billing_events** - Subscription charges, overages, refunds
- **query_logs** - Detailed query history for analytics

### Compliance

- **audit_logs** - Action audit trail for security and compliance

## Migrations

Future schema changes should be versioned:

```
database/
  migrations/
    001_initial_schema.sql
    002_add_sso_fields.sql
    003_add_document_versions.sql
```

Run migrations in order:

```bash
wrangler d1 execute bacevector-db --file=./database/migrations/002_add_sso_fields.sql
```

## Backup & Recovery

```bash
# Export data
wrangler d1 export bacevector-db --output=backup.sql

# Import data
wrangler d1 execute bacevector-db --file=backup.sql
```

## Local Development

Use Wrangler's local D1 for development:

```bash
wrangler dev --local --persist
```

This creates a local SQLite database in `.wrangler/state/`.

## Querying

Example queries from Workers:

```typescript
// Get tenant info
const tenant = await env.DB.prepare(
  "SELECT * FROM tenants WHERE tenant_id = ?"
).bind(tenantId).first();

// Update usage
await env.DB.prepare(
  "UPDATE usage SET query_count = query_count + 1 WHERE tenant_id = ? AND period = ?"
).bind(tenantId, period).run();

// Insert audit log
await env.DB.prepare(
  "INSERT INTO audit_logs (log_id, tenant_id, action, created_at) VALUES (?, ?, ?, datetime('now'))"
).bind(logId, tenantId, action).run();
```

## Performance Tips

- Use indexes for frequently queried columns (already defined in schema)
- Batch writes when possible using transactions
- Cache frequently accessed data in KV
- Use prepared statements to prevent SQL injection

