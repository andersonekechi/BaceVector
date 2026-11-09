/**
 * Shared utility functions for BaceVector workers
 */

import { ApiError, PLAN_LIMITS, Plan } from "./types";

/**
 * Create a standardized JSON error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  code?: string,
  details?: string
): Response {
  const body: ApiError = {
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Create a standardized JSON success response
 */
export function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Validate tenant API key from request headers
 * Returns tenantId if valid, null otherwise
 */
export function validateApiKey(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.substring(7);
  
  // TODO: Implement actual API key validation against D1/KV
  // For now, extract tenantId from key format: bv_<tenantId>_<random>
  const match = apiKey.match(/^bv_([a-zA-Z0-9]+)_/);
  return match ? match[1] : null;
}

/**
 * Check if request is authorized for tenant
 */
export function isAuthorized(request: Request, tenantId: string): boolean {
  const extractedTenantId = validateApiKey(request);
  return extractedTenantId === tenantId;
}

/**
 * Get plan limits for a given plan
 */
export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}

/**
 * Calculate overage charges
 */
export function calculateOverage(
  queryCount: number,
  queryLimit: number,
  ratePerQuery: number
): { overageQueries: number; overageCharges: number } {
  const overageQueries = Math.max(0, queryCount - queryLimit);
  const overageCharges = overageQueries * ratePerQuery;
  return { overageQueries, overageCharges };
}

/**
 * Chunk text into overlapping segments for embedding
 */
export function chunkText(
  text: string,
  chunkSize: number = 512,
  overlap: number = 128
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Extract text from different file types
 * Returns plain text content
 */
export async function extractText(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  // For MVP, handle plain text and basic formats
  if (mimeType.includes("text/plain")) {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }

  // TODO: Add PDF parsing (pdf-parse or similar)
  // TODO: Add DOCX parsing (mammoth or similar)
  // TODO: Add HTML parsing

  throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(tenantId: string, filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${tenantId}_${timestamp}_${random}`;
}

/**
 * Get current billing period (YYYY-MM)
 */
export function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Rate limiting check using KV
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

  const current = await kv.get(windowKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(windowKey, String(count + 1), {
    expirationTtl: windowSeconds,
  });

  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * CORS headers for API responses
 */
export function corsHeaders(origin?: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("Origin") || undefined),
    });
  }
  return null;
}

