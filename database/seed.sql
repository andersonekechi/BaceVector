-- BaceVector Seed Data for Development/Testing
-- Run this after schema.sql to populate test data

-- Insert test tenants
INSERT INTO tenants (tenant_id, name, email, plan, status, trial_ends_at) VALUES
  ('tenant_demo_001', 'Acme Corporation', 'admin@acme.example.com', 'pro', 'active', NULL),
  ('tenant_demo_002', 'TechStart Inc', 'contact@techstart.example.com', 'base', 'trial', datetime('now', '+14 days')),
  ('tenant_demo_003', 'Enterprise Co', 'it@enterprise.example.com', 'enterprise', 'active', NULL);

-- Insert test API keys (these are example hashes - in production, use proper bcrypt)
INSERT INTO api_keys (key_id, tenant_id, key_hash, name, is_active) VALUES
  ('key_001', 'tenant_demo_001', 'bv_tenant_demo_001_test123', 'Production Key', 1),
  ('key_002', 'tenant_demo_002', 'bv_tenant_demo_002_test456', 'Development Key', 1),
  ('key_003', 'tenant_demo_003', 'bv_tenant_demo_003_test789', 'Main API Key', 1);

-- Insert test documents
INSERT INTO documents (document_id, tenant_id, filename, mime_type, size_bytes, status, chunk_count) VALUES
  ('doc_001', 'tenant_demo_001', 'employee-handbook.pdf', 'application/pdf', 524288, 'completed', 45),
  ('doc_002', 'tenant_demo_001', 'sales-playbook.pdf', 'application/pdf', 1048576, 'completed', 78),
  ('doc_003', 'tenant_demo_002', 'product-specs.txt', 'text/plain', 102400, 'completed', 12),
  ('doc_004', 'tenant_demo_003', 'compliance-policy.pdf', 'application/pdf', 2097152, 'processing', 0);

-- Insert test usage records for current period
INSERT INTO usage (tenant_id, period, document_count, query_count, storage_bytes) VALUES
  ('tenant_demo_001', strftime('%Y-%m', 'now'), 2, 1247, 1572864),
  ('tenant_demo_002', strftime('%Y-%m', 'now'), 1, 89, 102400),
  ('tenant_demo_003', strftime('%Y-%m', 'now'), 1, 3421, 2097152);

-- Insert test users
INSERT INTO users (user_id, tenant_id, email, name, role, is_active) VALUES
  ('user_001', 'tenant_demo_001', 'john@acme.example.com', 'John Smith', 'owner', 1),
  ('user_002', 'tenant_demo_001', 'sarah@acme.example.com', 'Sarah Johnson', 'admin', 1),
  ('user_003', 'tenant_demo_002', 'mike@techstart.example.com', 'Mike Chen', 'owner', 1),
  ('user_004', 'tenant_demo_003', 'lisa@enterprise.example.com', 'Lisa Anderson', 'owner', 1);

-- Insert sample query logs
INSERT INTO query_logs (log_id, tenant_id, question, answer, sources_count, query_tokens, response_tokens, latency_ms) VALUES
  ('log_001', 'tenant_demo_001', 'What is our vacation policy?', 'According to the employee handbook...', 3, 8, 45, 1234),
  ('log_002', 'tenant_demo_001', 'How do I submit expenses?', 'To submit expenses, follow these steps...', 2, 7, 38, 987),
  ('log_003', 'tenant_demo_002', 'What are the product dimensions?', 'The product dimensions are...', 1, 6, 22, 654);

-- Insert sample billing events
INSERT INTO billing_events (event_id, tenant_id, period, event_type, amount_cents, description) VALUES
  ('bill_001', 'tenant_demo_001', strftime('%Y-%m', 'now'), 'subscription', 14900, 'Pro Plan - Monthly'),
  ('bill_002', 'tenant_demo_002', strftime('%Y-%m', 'now'), 'subscription', 4900, 'Base Plan - Monthly (Trial)'),
  ('bill_003', 'tenant_demo_003', strftime('%Y-%m', 'now'), 'subscription', 49900, 'Enterprise Plan - Monthly');

-- Insert sample audit logs
INSERT INTO audit_logs (log_id, tenant_id, user_id, action, resource_type, resource_id, ip_address) VALUES
  ('audit_001', 'tenant_demo_001', 'user_001', 'document.upload', 'document', 'doc_001', '192.168.1.100'),
  ('audit_002', 'tenant_demo_001', 'user_002', 'query.execute', 'query', 'log_001', '192.168.1.101'),
  ('audit_003', 'tenant_demo_002', 'user_003', 'document.upload', 'document', 'doc_003', '10.0.0.50');

