# BaceVector Shared Library

Common TypeScript types and utilities used across all Cloudflare Workers.

## Structure

- `types.ts` - Shared TypeScript interfaces and type definitions
- `utils.ts` - Common utility functions (auth, rate limiting, text processing, etc.)
- `index.ts` - Main export file

## Usage

Import from other workers:

```typescript
import { Tenant, Plan, errorResponse, chunkText } from "../shared";
```

## Types

- `Tenant`, `Document`, `UsageRecord` - Core domain models
- `QueryRequest`, `QueryResponse` - Query worker contracts
- `IngestionRequest`, `IngestionResponse` - Ingestion worker contracts
- `PlanLimits` - Plan configuration and limits

## Utilities

- `errorResponse()`, `jsonResponse()` - Standardized HTTP responses
- `validateApiKey()`, `isAuthorized()` - Authentication helpers
- `chunkText()` - Text chunking for embeddings
- `checkRateLimit()` - KV-based rate limiting
- `calculateOverage()` - Billing calculations
- `handleCors()` - CORS preflight handling

