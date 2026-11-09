#!/bin/bash

# BaceVector Deployment Script
# Usage: ./deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 Deploying BaceVector to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "❌ Invalid environment. Use 'staging' or 'production'"
  exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
fi

# Deploy workers
echo "📦 Deploying workers..."

cd src/workers/ingestion
npm install
wrangler deploy --env $ENVIRONMENT
cd ../../..

cd src/workers/query
npm install
wrangler deploy --env $ENVIRONMENT
cd ../../..

cd src/workers/admin
npm install
wrangler deploy --env $ENVIRONMENT
cd ../../..

echo "✅ All workers deployed successfully!"

# Optional: Run database migrations
read -p "Run database migrations? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗄️  Running database migrations..."
  
  if [[ "$ENVIRONMENT" == "production" ]]; then
    DB_NAME="bacevector-db"
  else
    DB_NAME="bacevector-db-staging"
  fi
  
  wrangler d1 execute $DB_NAME --file=./database/schema.sql
  echo "✅ Migrations completed!"
fi

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Verify workers at https://dash.cloudflare.com"
echo "2. Test API endpoints"
echo "3. Monitor logs with: wrangler tail <worker-name>"

