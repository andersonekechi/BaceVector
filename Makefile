# BaceVector Makefile
# Common development and deployment tasks

.PHONY: help install dev deploy-staging deploy-production db-init db-seed clean

help:
	@echo "BaceVector Development Commands"
	@echo "================================"
	@echo "make install          - Install all dependencies"
	@echo "make dev              - Start local development servers"
	@echo "make deploy-staging   - Deploy to staging environment"
	@echo "make deploy-production - Deploy to production environment"
	@echo "make db-init          - Initialize database schema"
	@echo "make db-seed          - Seed database with test data"
	@echo "make clean            - Clean build artifacts"

install:
	@echo "📦 Installing dependencies..."
	cd src/workers/ingestion && npm install
	cd src/workers/query && npm install
	cd src/workers/admin && npm install
	@echo "✅ Dependencies installed!"

dev:
	@echo "🔧 Starting development servers..."
	@echo "Run these in separate terminals:"
	@echo "  cd src/workers/ingestion && npm run dev"
	@echo "  cd src/workers/query && npm run dev"
	@echo "  cd src/workers/admin && npm run dev"

deploy-staging:
	@echo "🚀 Deploying to staging..."
	./deploy.sh staging

deploy-production:
	@echo "🚀 Deploying to production..."
	./deploy.sh production

db-init:
	@echo "🗄️  Initializing database..."
	wrangler d1 execute bacevector-db-staging --file=./database/schema.sql
	@echo "✅ Database initialized!"

db-seed:
	@echo "🌱 Seeding database..."
	wrangler d1 execute bacevector-db-staging --file=./database/seed.sql
	@echo "✅ Database seeded!"

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf src/workers/ingestion/dist src/workers/ingestion/.wrangler
	rm -rf src/workers/query/dist src/workers/query/.wrangler
	rm -rf src/workers/admin/dist src/workers/admin/.wrangler
	@echo "✅ Clean complete!"

