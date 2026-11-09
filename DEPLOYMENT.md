# BaceVector Deployment Guide

Complete guide for deploying BaceVector to Cloudflare infrastructure.

## Prerequisites

1. **Cloudflare Account** with Workers, D1, R2, Vectorize, and Workers AI enabled
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Node.js** 20+ and npm
4. **Git** for version control
5. **.NET SDK 8.0+** for Orchard Core (if deploying CMS)

## Initial Setup

### 1. Authenticate Wrangler

```bash
wrangler login
```

### 2. Create Cloudflare Resources

#### D1 Database

```bash
# Production
wrangler d1 create bacevector-db

# Staging
wrangler d1 create bacevector-db-staging
```

Copy the database IDs and update `wrangler.toml` files in each worker directory.

#### KV Namespace

```bash
# Production
wrangler kv:namespace create "CACHE"

# Staging
wrangler kv:namespace create "CACHE" --preview
```

#### R2 Bucket

```bash
# Production
wrangler r2 bucket create bacevector-docs-prod

# Staging
wrangler r2 bucket create bacevector-docs-staging
```

#### Vectorize Index

```bash
# Production
wrangler vectorize create bacevector-docs --dimensions=768 --metric=cosine

# Staging
wrangler vectorize create bacevector-docs-staging --dimensions=768 --metric=cosine
```

The dimensions match the BGE-base-en-v1.5 embedding model (768 dimensions).

### 3. Configure Environment Variables

Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

Update all the IDs and secrets from the previous steps.

### 4. Initialize Database

```bash
# Staging
wrangler d1 execute bacevector-db-staging --file=./database/schema.sql
wrangler d1 execute bacevector-db-staging --file=./database/seed.sql

# Production (skip seed.sql)
wrangler d1 execute bacevector-db --file=./database/schema.sql
```

## Deploying Workers

### Option 1: Using the Deploy Script

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to staging
./deploy.sh staging

# Deploy to production
./deploy.sh production
```

### Option 2: Using Makefile

```bash
# Deploy to staging
make deploy-staging

# Deploy to production
make deploy-production
```

### Option 3: Manual Deployment

```bash
# Ingestion Worker
cd src/workers/ingestion
npm install
wrangler deploy --env production

# Query Worker
cd ../query
npm install
wrangler deploy --env production

# Admin Worker
cd ../admin
npm install
wrangler deploy --env production
```

## Deploying Orchard Core

### Local Development

```bash
cd src/orchard

# Install Orchard Core templates
dotnet new install OrchardCore.ProjectTemplates

# Create new Orchard CMS project
dotnet new occms -n BaceVector.Web

# Run locally
cd BaceVector.Web
dotnet run
```

### Production Deployment

Orchard Core can be deployed to:

1. **Azure App Service** (recommended for .NET apps)
2. **AWS Elastic Beanstalk**
3. **Docker containers** (Kubernetes, ECS, etc.)
4. **Traditional IIS hosting**

Example Docker deployment:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "BaceVector.Web.dll"]
```

## CI/CD with GitHub Actions

The repository includes GitHub Actions workflows:

- `.github/workflows/deploy-workers.yml` - Auto-deploy workers on push to main/staging
- `.github/workflows/test.yml` - Run tests on pull requests

### Setup GitHub Secrets

Add these secrets to your GitHub repository:

```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Generate an API token at: https://dash.cloudflare.com/profile/api-tokens

Required permissions:
- Account > Workers Scripts > Edit
- Account > D1 > Edit
- Account > Vectorize > Edit

## Post-Deployment

### 1. Verify Workers

```bash
# Check deployment status
wrangler deployments list --name bacevector-ingestion

# Test health endpoints
curl https://bacevector-ingestion.your-subdomain.workers.dev/healthz
curl https://bacevector-query.your-subdomain.workers.dev/healthz
curl https://bacevector-admin.your-subdomain.workers.dev/healthz
```

### 2. Monitor Logs

```bash
# Tail logs in real-time
wrangler tail bacevector-ingestion
wrangler tail bacevector-query
wrangler tail bacevector-admin
```

### 3. Set Up Custom Domains

In Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select each worker
3. Add custom domain (e.g., `api.bacevector.com`)

### 4. Configure Stripe Webhooks

1. Go to Stripe Dashboard > Webhooks
2. Add endpoint: `https://api.bacevector.com/admin/webhooks/stripe`
3. Select events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
4. Copy webhook secret to `wrangler.toml`

## Rollback

If a deployment fails:

```bash
# List recent deployments
wrangler deployments list --name bacevector-query

# Rollback to previous version
wrangler rollback --name bacevector-query --deployment-id <previous-id>
```

## Monitoring & Alerts

Set up monitoring in Cloudflare Dashboard:

1. **Workers Analytics** - Track requests, errors, CPU time
2. **Logpush** - Send logs to external service (Datadog, Splunk, etc.)
3. **Alerts** - Configure alerts for error rates, latency spikes

## Scaling Considerations

- **Workers**: Auto-scale globally, no configuration needed
- **D1**: Currently limited to 10GB, plan for sharding if needed
- **Vectorize**: Scales automatically, monitor query latency
- **R2**: Unlimited storage, pay per GB

## Security Checklist

- [ ] Rotate API keys regularly
- [ ] Enable Cloudflare WAF for Workers
- [ ] Set up rate limiting in admin worker
- [ ] Use secrets for sensitive values (not environment variables)
- [ ] Enable audit logging for all tenant actions
- [ ] Configure CORS policies appropriately
- [ ] Set up DDoS protection

## Troubleshooting

### Worker fails to deploy

```bash
# Check syntax
cd src/workers/query
npx tsc --noEmit

# Check wrangler config
wrangler deploy --dry-run
```

### Database connection issues

```bash
# Verify D1 binding
wrangler d1 info bacevector-db

# Test query
wrangler d1 execute bacevector-db --command "SELECT COUNT(*) FROM tenants"
```

### Vectorize not returning results

- Verify index dimensions match embedding model (768 for BGE-base)
- Check that vectors were successfully inserted
- Ensure tenantId filter is correct

## Cost Estimates

**Staging** (light usage):
- Workers: ~$5/month
- D1: Free tier
- R2: ~$1/month
- Vectorize: ~$5/month
- Total: ~$11/month

**Production** (100 tenants, 50k queries/month):
- Workers: ~$25/month
- D1: ~$5/month
- R2: ~$10/month
- Vectorize: ~$50/month
- Workers AI: ~$20/month
- Total: ~$110/month

## Support

- Cloudflare Docs: https://developers.cloudflare.com
- Orchard Core Docs: https://docs.orchardcore.net
- GitHub Issues: https://github.com/your-org/bacevector/issues

