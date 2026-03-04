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
    } else if (method === "range") {
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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => createChainableMock({ error: null })),
  })),
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
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

function createMockRequest(
  method: string,
  path: string,
  body?: object,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

function setupAuthenticatedUser(role: string, storeId: string = "store-123") {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = createChainableMock({
    data: {
      id: "user-123",
      role,
      store_id: null,
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  });

  const storeUsersQuery = createChainableMock({
    data: [
      {
        id: "su-1",
        store_id: storeId,
        user_id: "user-123",
        role,
        is_billing_owner: role === "Owner",
        store: { id: storeId, name: "Test Store", is_active: true },
      },
    ],
    error: null,
  });

  return { profileQuery, storeUsersQuery };
}

describe("Waste Analytics API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/stores/[storeId]/waste-analytics", () => {
    const STORE_UUID = "11111111-1111-4111-a111-111111111111";

    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/waste-analytics/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/waste-analytics`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 for Staff users", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/waste-analytics/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/waste-analytics`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should return analytics with empty data", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const wasteLogQuery = createChainableMock({
        data: [],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "waste_log") return wasteLogQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/waste-analytics/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/waste-analytics`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.total_quantity).toBe(0);
      expect(data.data.summary.total_incidents).toBe(0);
      expect(data.data.by_reason).toEqual([]);
      expect(data.data.top_items).toEqual([]);
      expect(data.data.daily_trend).toEqual([]);
    });

    it("should return analytics with waste data", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const wasteLogQuery = createChainableMock({
        data: [
          {
            id: "wl-1",
            store_id: STORE_UUID,
            inventory_item_id: "item-1",
            quantity: 5,
            reason: "spoilage",
            notes: null,
            estimated_cost: 10,
            reported_by: "user-123",
            reported_at: "2026-02-08T10:00:00Z",
            inventory_item: {
              id: "item-1",
              name: "Tomatoes",
              category: "Produce",
              unit_of_measure: "kg",
            },
          },
          {
            id: "wl-2",
            store_id: STORE_UUID,
            inventory_item_id: "item-2",
            quantity: 3,
            reason: "expired",
            notes: null,
            estimated_cost: 15,
            reported_by: "user-123",
            reported_at: "2026-02-09T10:00:00Z",
            inventory_item: {
              id: "item-2",
              name: "Milk",
              category: "Dairy",
              unit_of_measure: "L",
            },
          },
          {
            id: "wl-3",
            store_id: STORE_UUID,
            inventory_item_id: "item-1",
            quantity: 2,
            reason: "spoilage",
            notes: null,
            estimated_cost: 4,
            reported_by: "user-123",
            reported_at: "2026-02-09T14:00:00Z",
            inventory_item: {
              id: "item-1",
              name: "Tomatoes",
              category: "Produce",
              unit_of_measure: "kg",
            },
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "waste_log") return wasteLogQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/waste-analytics/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/waste-analytics`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Summary
      expect(data.data.summary.total_quantity).toBe(10);
      expect(data.data.summary.total_estimated_cost).toBe(29);
      expect(data.data.summary.total_incidents).toBe(3);

      // By reason - spoilage should be first (7 quantity vs 3)
      expect(data.data.by_reason).toHaveLength(2);
      expect(data.data.by_reason[0].reason).toBe("spoilage");
      expect(data.data.by_reason[0].quantity).toBe(7);
      expect(data.data.by_reason[0].count).toBe(2);
      expect(data.data.by_reason[1].reason).toBe("expired");
      expect(data.data.by_reason[1].quantity).toBe(3);

      // Top items - Tomatoes should be first (7 quantity vs 3)
      expect(data.data.top_items).toHaveLength(2);
      expect(data.data.top_items[0].item_name).toBe("Tomatoes");
      expect(data.data.top_items[0].total_quantity).toBe(7);
      expect(data.data.top_items[0].incident_count).toBe(2);
      expect(data.data.top_items[1].item_name).toBe("Milk");
      expect(data.data.top_items[1].total_quantity).toBe(3);

      // Daily trend - should have 2 days
      expect(data.data.daily_trend).toHaveLength(2);
      expect(data.data.daily_trend[0].date).toBe("2026-02-08");
      expect(data.data.daily_trend[0].quantity).toBe(5);
      expect(data.data.daily_trend[1].date).toBe("2026-02-09");
      expect(data.data.daily_trend[1].quantity).toBe(5);
    });

    it("should accept custom date range", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const wasteLogQuery = createChainableMock({
        data: [],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "waste_log") return wasteLogQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/waste-analytics/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/waste-analytics`,
        undefined,
        {
          from: "2026-01-01T00:00:00Z",
          to: "2026-01-31T23:59:59Z",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.from).toBe("2026-01-01T00:00:00Z");
      expect(data.data.period.to).toBe("2026-01-31T23:59:59Z");
    });
  });
});
