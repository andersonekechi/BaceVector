# Internal Document Q&A Micro-SaaS – Implementation Plan

## 1. Vision & Value Proposition
- **Problem**: Mid-market teams lose productivity searching tribal knowledge buried in PDFs, Word docs, and wikis.
- **Solution**: Deliver a tenant-isolated RAG copilot that ingests internal documents, surfaces accurate answers, and tracks usage.
- **Audience**: 50–500 employee companies; ops, HR, CS, enablement leaders.
- **North-star metric**: Time-to-answer < 10 seconds with ≥ 80% helpfulness rating.

## 2. High-Level Architecture
- **Presentation**: Orchard Core SaaS recipe for marketing site + multi-tenant admin portals.
- **APIs / Orchestration**: Cloudflare Workers (TypeScript) expose ingestion, query, and admin endpoints.
- **Storage**:
  - Documents & metadata → Cloudflare R2 (encrypted at rest) with per-tenant buckets or prefixes.
  - Vector embeddings → Cloudflare Vectorize namespaces (tenant scoped).
  - Tenant config, usage, billing state → Orchard Core + durable objects (as needed for rate limiting).
- **AI / Retrieval**:
  - Workers AI `@cf/baai/bge-large-en-v1.5` (or similar) for embeddings.
  - Workers AI `@cf/meta/llama-3-8b-instruct` as default LLM; allow premium tenants to toggle external APIs.
- **Security**: Tenant-scoped API keys, JWT-based session tokens, optional SSO (SAML/OIDC), encrypted uploads, audit logs.
- **Observability**: Cloudflare Logs, Metrics, and Orchard dashboards; alerts on ingestion failures and usage spikes.

## 3. Major Workstreams & Milestones
1. **Foundation (Week 1-2)**
   - Scaffold Orchard Core multi-tenant setup (SaaS recipe) with marketing + tenant portals.
   - Establish Git repo, CI pipeline (GitHub Actions), environment variables, IaC baseline (Terraform for Cloudflare resources).
2. **Ingestion Pipeline (Week 2-3)**
   - Build file upload UI (tenant admin) with chunking configs.
   - Implement Worker ingestion handler: fetch file from R2, chunk, clean, embed, upsert to Vectorize.
   - Support PDF, DOCX, TXT with retry + logging.
3. **Query Experience (Week 3-4)**
   - Create Q&A UI with conversation history and citations.
  - Implement query Worker: question embedding, vector search, context assembly, LLM invocation, usage tracking.
   - Add answer validation (fallback to direct search when confidence low).
4. **Billing & Usage (Week 4-5)**
   - Stripe integration for subscription tiers, metered queries, overages.
   - Admin dashboards: document count, query usage, billing alerts.
   - Automated emails (limit warnings, invoices, trial conversion).
5. **Security & Reliability (Week 5-6)**
   - Role-based access, tenant API keys, rate limiting (Durable Object).
   - Audit logs, PII redaction options, data retention policies.
   - Load/perf testing, failover handling, monitoring dashboards.
6. **Pilot & Feedback (Week 6-7)**
   - Onboard 1-2 design partners, track accuracy, gather UX feedback.
   - Iterate on ingestion edge cases, answer quality, admin usability.

## 4. Detailed Backlog (Initial)
- **Orchard Core**
  - Configure SaaS recipe, themes, tenant creation wizard.
  - Implement marketing pages (features, pricing, demo booking).
  - Tenant admin: user management, document list, usage dashboard, billing settings.
  - Tenant employee portal: Q&A chat, search history.
- **Cloudflare Workers**
  - Auth middleware (tenant token validation, rate limits).
  - `/ingest/upload` endpoint → orchestrates R2 storage + queue.
  - `/ingest/process` cron/queue Worker → chunk, clean, embed, upsert to Vectorize.
  - `/query` endpoint → embed question, fetch top-k, call LLM, respond with sources.
  - `/admin/usage` endpoint → aggregated metrics for Orchard dashboards.
- **Data Processing**
  - Document parsing service (PDF/DOCX/TXT) with `pdfjs`, `docx`, fallbacks.
  - Chunking strategy (token-length aware) configurable per tenant.
  - Metadata schema: tenantId, docId, sectionId, source path, chunk text, embeddings.
- **Billing & Analytics**
  - Stripe customer/plan sync, webhooks (subscription created, invoice, payment failure).
  - Usage tracker storing counts per tenant per month.
  - Email notifications via Workers Email or third-party (Postmark).
- **Security & Compliance**
  - Tenant isolation policies, encryption keys, secret rotation.
  - Optional SSO setup flow (Azure AD, Okta).
  - Privacy settings: doc deletion, retention, export.
- **GTM Support**
  - Trial provisioning automation, in-app onboarding checklist.
  - Demo workspace seeded with sample docs.
  - Feedback capture (thumbs up/down, comment) tied to analytics.

## 5. Tech Stack & Tooling
- **Frontend**: Orchard Core (Razor, Liquid), TailwindCSS, HTMX for interactivity.
- **Backend**: C# modules in Orchard Core, Cloudflare Workers (TypeScript).
- **AI / Vector**: Workers AI, Cloudflare Vectorize, optional OpenAI API.
- **Storage**: Cloudflare R2, Vectorize, Orchard DB (SQLite dev → PostgreSQL prod).
- **CI/CD**: GitHub Actions deploying Orchard to Azure App Service or container host; Wrangler for Workers deployments.
- **Infrastructure**: Terraform or Pulumi for repeatable Cloudflare + Azure resources.
- **Monitoring**: Cloudflare Analytics, Application Insights (if hosted on Azure), Sentry for UI errors.

## 6. Environment Strategy
- **Local**: Orchard Core running with SQLite; Workers via Wrangler dev using local mocks.
- **Staging**: Dedicated Cloudflare namespaces, test Stripe account, seeded tenant.
- **Production**: Separate Cloudflare account resources, live Stripe, backup policies.
- **Secrets management**: Azure Key Vault or Cloudflare Secrets; avoid storing API keys in code.

## 7. Risk & Mitigation
- **Doc parsing failures** → fallback extractors, manual review queue, telemetry on parse errors.
- **LLM hallucinations** → answer confidence scoring, show sources, allow “search again” manual mode.
- **Usage spikes** → enforce per-tenant rate limits, fast scaling via Workers, caching embeddings.
- **Compliance** → log deletion events, optional data residency configuration, audit trails.
- **Adoption churn** → guided onboarding, ROI reporting, regular check-in automation.

## 8. Milestone Deliverables
- **Milestone 1**: Live marketing site + tenant provisioning, sample ingestion end-to-end.
- **Milestone 2**: Production-ready ingestion + query with metrics, limited pilot activated.
- **Milestone 3**: Billing + overage automation, security hardening complete.
- **Milestone 4**: Pilot feedback incorporated, launch-ready product assets & support playbook.

## 9. Open Questions / Next Decisions
- Confirm hosting choice for Orchard Core (Azure App Service vs. container on Azure Container Apps).
- Decide on default document size limits and per-tenant R2 storage cap.
- Choose external LLM fallback vendor (OpenAI vs Anthropic) and pricing strategy.
- Determine initial GTM channel prioritization (Cloudflare marketplace vs direct).


