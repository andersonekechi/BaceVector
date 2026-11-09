/**
 * Shared TypeScript types for BaceVector workers
 */

export type Plan = "base" | "pro" | "enterprise";

export type TenantStatus = "active" | "suspended" | "cancelled" | "trial";

export interface Tenant {
  tenantId: string;
  name: string;
  plan: Plan;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface Document {
  documentId: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  chunkCount?: number;
  metadata?: Record<string, unknown>;
  r2Key?: string;
}

export interface UsageRecord {
  tenantId: string;
  period: string; // YYYY-MM
  documentCount: number;
  queryCount: number;
  storageBytes: number;
  overageQueries: number;
  overageCharges: number;
}

export interface QueryRequest {
  tenantId: string;
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  maxResults?: number;
  temperature?: number;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    documentId: string;
    chunk: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  usage: {
    queryTokens: number;
    responseTokens: number;
  };
}

export interface IngestionRequest {
  tenantId: string;
  documentUrl: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionResponse {
  status: "queued" | "processing" | "completed" | "failed";
  documentId?: string;
  chunkCount?: number;
  error?: string;
}

export interface VectorMetadata {
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  filename?: string;
  uploadedAt?: string;
  [key: string]: unknown;
}

export interface PlanLimits {
  documents: number;
  queries: number;
  storageGB: number;
  maxFileSize: number; // bytes
  apiCallsPerMinute: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  base: {
    documents: 100,
    queries: 5000,
    storageGB: 1,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    apiCallsPerMinute: 60,
  },
  pro: {
    documents: 500,
    queries: 20000,
    storageGB: 10,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    apiCallsPerMinute: 300,
  },
  enterprise: {
    documents: 10000,
    queries: 500000,
    storageGB: 500,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    apiCallsPerMinute: 1000,
  },
};

export interface ApiError {
  error: string;
  code?: string;
  details?: string;
  timestamp?: string;
}

