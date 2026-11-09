# Cloudflare Workers

This folder contains the Workers responsible for ingestion, query, and admin operations. Each worker has its own `wrangler.toml`, `package.json`, and `src` directory.

## Current Workers
- `ingestion/` – Accepts document ingestion requests from Orchard Core, queues processing, and will invoke embeddings + Vectorize.

## Planned Workers
- `query/` – Handles employee questions, retrieves context from Vectorize, and streams responses from Workers AI.
- `admin/` – Exposes usage metrics and billing hooks to the Orchard Core portal.

Create additional workers by copying the ingestion scaffold or running:

```ps1
npm create cloudflare@latest my-worker -- --type typescript
```


