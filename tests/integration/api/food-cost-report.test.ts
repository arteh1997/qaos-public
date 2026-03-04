import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Create chainable query builder mock
function createChainableMock(
  resolvedValue: unknown = { data: null, error: null },
) {
  const mock: Record<string, ReturnType<typeof vi.fn>> & {
    then?: typeof Promise.prototype.then;
  } = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "in",
    "is",
    "or",
    "and",
    "not",
    "filter",
    "match",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ];

  methods.forEach((method) => {
    if (method === "single" || method === "maybeSingle") {
      mock[method] = vi.fn().mockResolvedValue(resolvedValue);
    } else {
      mock[method] = vi.fn(() => mock);
    }
  });

  mock.then = ((resolve?: ((value: unknown) => unknown) | null) =>
    Promise.resolve(resolvedValue).then(
      resolve,
    )) as typeof Promise.prototype.then;
  return mock;
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    limit: 100,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    reports: { limit: 20, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/services/food-cost", () => ({
  generateFoodCostReport: vi.fn().mockResolvedValue({
    summary: {
      theoretical_cost: 1000,
      actual_cost: 1200,
      variance: 200,
      variance_percentage: 20,
      total_revenue: 3500,
      theoretical_food_cost_pct: 28.57,
      actual_food_cost_pct: 34.29,
      waste_cost: 50,
      unaccounted_variance: 150,
      period_start: "2026-02-01",
      period_end: "2026-02-07",
    },
    items: [],
    categories: [],
    trends: [],
  }),
}));

import { GET } from "@/app/api/stores/[storeId]/reports/food-cost/route";

function createRequest(url: string) {
  const parsedUrl = new URL(url, "http://localhost:3000");
  return {
    method: "GET",
    nextUrl: parsedUrl,
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

function setupAuthMock(role = "Owner") {
  const profileQuery = createChainableMock({
    data: {
      role,
      store_id: "store-1",
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  });

  const storeUsersQuery = createChainableMock({
    data: [
      {
        store_id: "store-1",
        user_id: "user-1",
        role,
        store: { id: "store-1", name: "Test Store" },
      },
    ],
    error: null,
  });

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "owner@test.com" } },
    error: null,
  });

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === "profiles") return profileQuery;
    if (table === "store_users") return storeUsersQuery;
    return createChainableMock();
  });
}

describe("GET /api/stores/:storeId/reports/food-cost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthMock();
  });

  it("should return 400 when startDate is missing", async () => {
    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?endDate=2026-02-07",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("startDate");
  });

  it("should return 400 when endDate is missing", async () => {
    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=2026-02-01",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("endDate");
  });

  it("should return 400 for invalid date format", async () => {
    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=01-02-2026&endDate=07-02-2026",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("YYYY-MM-DD");
  });

  it("should return 400 when startDate is after endDate", async () => {
    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=2026-02-10&endDate=2026-02-01",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("before");
  });

  it("should return food cost report with valid dates", async () => {
    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=2026-02-01&endDate=2026-02-07",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.summary).toBeDefined();
    expect(json.data.summary.theoretical_cost).toBe(1000);
    expect(json.data.summary.actual_cost).toBe(1200);
    expect(json.data.summary.variance).toBe(200);
    expect(json.data.items).toEqual([]);
    expect(json.data.categories).toEqual([]);
    expect(json.data.trends).toEqual([]);
  });

  it("should return 401 for unauthenticated request", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=2026-02-01&endDate=2026-02-07",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("should return 403 for Staff role", async () => {
    setupAuthMock("Staff");

    const req = createRequest(
      "/api/stores/store-1/reports/food-cost?startDate=2026-02-01&endDate=2026-02-07",
    );
    const res = await GET(req, {
      params: Promise.resolve({ storeId: "store-1" }),
    });
    expect(res.status).toBe(403);
  });
});
