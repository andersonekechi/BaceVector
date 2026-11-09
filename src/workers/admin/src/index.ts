import { Router } from "itty-router";

type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  BASE_PLAN_LIMIT_DOCS: string;
  BASE_PLAN_LIMIT_QUERIES: string;
  PRO_PLAN_LIMIT_DOCS: string;
  PRO_PLAN_LIMIT_QUERIES: string;
  OVERAGE_RATE_PER_QUERY: string;
  STRIPE_WEBHOOK_SECRET: string;
};

type UsageRecord = {
  tenantId: string;
  period: string; // YYYY-MM format
  documentCount: number;
  queryCount: number;
  overageQueries: number;
  overageCharges: number;
};

type TenantInfo = {
  tenantId: string;
  plan: "base" | "pro";
  status: "active" | "suspended" | "cancelled";
  currentPeriod: string;
  usage: UsageRecord;
  limits: {
    documents: number;
    queries: number;
  };
};

const router = Router();

/**
 * Get tenant usage and billing information
 */
router.get("/tenants/:tenantId/usage", async (request: Request, env: Env) => {
  const { tenantId } = request.params as { tenantId: string };

  if (!tenantId) {
    return new Response(JSON.stringify({ error: "Missing tenantId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Get tenant info
    const tenantResult = await env.DB.prepare(
      "SELECT * FROM tenants WHERE tenant_id = ?"
    )
      .bind(tenantId)
      .first();

    if (!tenantResult) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const plan = tenantResult.plan as "base" | "pro";
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get current period usage
    const usageResult = await env.DB.prepare(
      "SELECT * FROM usage WHERE tenant_id = ? AND period = ?"
    )
      .bind(tenantId, currentPeriod)
      .first();

    const documentCount = (usageResult?.document_count as number) || 0;
    const queryCount = (usageResult?.query_count as number) || 0;

    // Calculate limits based on plan
    const limits = {
      documents:
        plan === "pro"
          ? parseInt(env.PRO_PLAN_LIMIT_DOCS, 10)
          : parseInt(env.BASE_PLAN_LIMIT_DOCS, 10),
      queries:
        plan === "pro"
          ? parseInt(env.PRO_PLAN_LIMIT_QUERIES, 10)
          : parseInt(env.BASE_PLAN_LIMIT_QUERIES, 10),
    };

    // Calculate overage
    const overageQueries = Math.max(0, queryCount - limits.queries);
    const overageCharges =
      overageQueries * parseFloat(env.OVERAGE_RATE_PER_QUERY);

    const response: TenantInfo = {
      tenantId,
      plan,
      status: tenantResult.status as "active" | "suspended" | "cancelled",
      currentPeriod,
      usage: {
        tenantId,
        period: currentPeriod,
        documentCount,
        queryCount,
        overageQueries,
        overageCharges,
      },
      limits,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Usage fetch error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch usage",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});

/**
 * Increment usage counters (called by ingestion/query workers)
 */
router.post("/tenants/:tenantId/usage/increment", async (request: Request, env: Env) => {
  const { tenantId } = request.params as { tenantId: string };
  const body = (await request.json()) as {
    type: "document" | "query";
    count?: number;
  };

  if (!tenantId || !body?.type) {
    return new Response(
      JSON.stringify({ error: "Missing tenantId or type" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const count = body.count || 1;

    // Upsert usage record
    if (body.type === "document") {
      await env.DB.prepare(
        `INSERT INTO usage (tenant_id, period, document_count, query_count) 
         VALUES (?, ?, ?, 0) 
         ON CONFLICT(tenant_id, period) 
         DO UPDATE SET document_count = document_count + ?`
      )
        .bind(tenantId, currentPeriod, count, count)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO usage (tenant_id, period, document_count, query_count) 
         VALUES (?, ?, 0, ?) 
         ON CONFLICT(tenant_id, period) 
         DO UPDATE SET query_count = query_count + ?`
      )
        .bind(tenantId, currentPeriod, count, count)
        .run();
    }

    // Invalidate cache
    await env.CACHE.delete(`usage:${tenantId}:${currentPeriod}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Usage increment error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to increment usage",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});

/**
 * Check if tenant can perform an action (rate limiting / quota check)
 */
router.post("/tenants/:tenantId/check-quota", async (request: Request, env: Env) => {
  const { tenantId } = request.params as { tenantId: string };
  const body = (await request.json()) as {
    type: "document" | "query";
  };

  if (!tenantId || !body?.type) {
    return new Response(
      JSON.stringify({ error: "Missing tenantId or type" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  try {
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Check cache first
    const cacheKey = `usage:${tenantId}:${currentPeriod}`;
    const cached = await env.CACHE.get(cacheKey, "json");

    let documentCount = 0;
    let queryCount = 0;
    let plan = "base";

    if (cached) {
      documentCount = (cached as any).documentCount || 0;
      queryCount = (cached as any).queryCount || 0;
      plan = (cached as any).plan || "base";
    } else {
      // Fetch from DB
      const tenantResult = await env.DB.prepare(
        "SELECT plan FROM tenants WHERE tenant_id = ?"
      )
        .bind(tenantId)
        .first();

      plan = (tenantResult?.plan as string) || "base";

      const usageResult = await env.DB.prepare(
        "SELECT * FROM usage WHERE tenant_id = ? AND period = ?"
      )
        .bind(tenantId, currentPeriod)
        .first();

      documentCount = (usageResult?.document_count as number) || 0;
      queryCount = (usageResult?.query_count as number) || 0;

      // Cache for 60 seconds
      await env.CACHE.put(
        cacheKey,
        JSON.stringify({ documentCount, queryCount, plan }),
        { expirationTtl: 60 }
      );
    }

    // Check limits
    const limits = {
      documents:
        plan === "pro"
          ? parseInt(env.PRO_PLAN_LIMIT_DOCS, 10)
          : parseInt(env.BASE_PLAN_LIMIT_DOCS, 10),
      queries:
        plan === "pro"
          ? parseInt(env.PRO_PLAN_LIMIT_QUERIES, 10)
          : parseInt(env.BASE_PLAN_LIMIT_QUERIES, 10),
    };

    const allowed =
      body.type === "document"
        ? documentCount < limits.documents
        : true; // Allow query overages (billable)

    const isOverage = body.type === "query" && queryCount >= limits.queries;

    return new Response(
      JSON.stringify({
        allowed,
        isOverage,
        current:
          body.type === "document" ? documentCount : queryCount,
        limit:
          body.type === "document" ? limits.documents : limits.queries,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Quota check error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to check quota",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});

/**
 * Health check endpoint
 */
router.get("/healthz", () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json" },
  });
});

// Root route
router.all("*", () => {
  return new Response(JSON.stringify({ 
    service: "BaceVector Admin API",
    endpoints: [
      "GET /tenants/:tenantId/usage",
      "POST /tenants/:tenantId/usage/increment",
      "POST /tenants/:tenantId/check-quota",
      "GET /healthz"
    ]
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      const response = await router.handle(request, env, ctx);
      if (!response) {
        return new Response(JSON.stringify({ error: "Route not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return response;
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};

