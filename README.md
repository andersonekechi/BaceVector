# BaceVector – Internal Document Q&A SaaS

Micro-SaaS platform that turns internal documents into a contextual Q&A copilot using Orchard Core, Cloudflare Workers, Vectorize, and Workers AI.

## Repository Structure
- `docs/` – Product and engineering documentation.
- `src/orchard/` – Orchard Core multi-tenant CMS + portal (requires .NET SDK 8).
- `src/workers/` – Cloudflare Workers for ingestion, query, and admin APIs.

## Getting Started
1. **Prerequisites**
   - .NET SDK 8.0+
   - Node.js 20+
   - `wrangler` CLI (`npm install -g wrangler`) or use the npm script.
2. **Orchard Core App**
   - Follow `src/orchard/README.md` to install templates and bootstrap the tenant-aware Orchard Core site.
3. **Cloudflare Worker**
   - `cd src/workers/ingestion`
   - `npm install`
   - `npm run dev` to run locally (`wrangler dev`).

## Next Up
- Flesh out the ingestion worker pipeline (R2 fetch, chunking, embeddings, Vectorize upsert).
- Scaffold the query worker and shared bindings.
- Configure CI/CD for Orchard Core (Azure App Service) and Workers (Wrangler deploy).


