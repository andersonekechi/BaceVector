-- Migration: Add user_id column to documents table
-- Run with: wrangler d1 execute bacevector-db --file=migration-add-user-id.sql

-- Add user_id column to documents table
ALTER TABLE documents ADD COLUMN user_id TEXT;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- Create index for tenant + user lookups (common query pattern)
CREATE INDEX IF NOT EXISTS idx_documents_tenant_user ON documents(tenant_id, user_id);

