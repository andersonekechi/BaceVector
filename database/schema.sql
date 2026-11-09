-- BaceVector Database Schema for Cloudflare D1
-- This schema supports multi-tenant SaaS with usage tracking and billing

-- Tenants table: stores company/organization information
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK(plan IN ('base', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'cancelled', 'trial')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  trial_ends_at TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings TEXT -- JSON blob for tenant-specific settings
);

CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id);

-- API Keys table: stores tenant API keys for authentication
CREATE TABLE IF NOT EXISTS api_keys (
  key_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL, -- bcrypt hash of the actual key
  name TEXT, -- friendly name for the key
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Documents table: tracks uploaded documents
CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  chunk_count INTEGER DEFAULT 0,
  r2_key TEXT, -- R2 storage key
  error_message TEXT,
  metadata TEXT, -- JSON blob for custom metadata
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_uploaded ON documents(uploaded_at DESC);

-- Usage table: tracks monthly usage per tenant
CREATE TABLE IF NOT EXISTS usage (
  tenant_id TEXT NOT NULL,
  period TEXT NOT NULL, -- YYYY-MM format
  document_count INTEGER NOT NULL DEFAULT 0,
  query_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, period),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_period ON usage(period);

-- Query logs table: detailed query history for analytics
CREATE TABLE IF NOT EXISTS query_logs (
  log_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  sources_count INTEGER DEFAULT 0,
  query_tokens INTEGER DEFAULT 0,
  response_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_query_logs_tenant ON query_logs(tenant_id);
CREATE INDEX idx_query_logs_created ON query_logs(created_at DESC);

-- Billing events table: tracks charges and invoices
CREATE TABLE IF NOT EXISTS billing_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period TEXT NOT NULL, -- YYYY-MM
  event_type TEXT NOT NULL CHECK(event_type IN ('subscription', 'overage', 'refund', 'credit')),
  amount_cents INTEGER NOT NULL,
  description TEXT,
  stripe_invoice_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_billing_tenant ON billing_events(tenant_id);
CREATE INDEX idx_billing_period ON billing_events(period);
CREATE INDEX idx_billing_stripe ON billing_events(stripe_invoice_id);

-- Users table: individual users within a tenant (for multi-user access)
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- Audit log table: track important actions for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL, -- e.g., 'document.upload', 'query.execute', 'settings.update'
  resource_type TEXT,
  resource_id TEXT,
  details TEXT, -- JSON blob
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

