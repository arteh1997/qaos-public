import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
  auth: { getUser: vi.fn() },
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
  RATE_LIMITS: { reports: { limit: 100, windowMs: 60000 } },
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

const STORE_UUID = "11111111-1111-4111-a111-111111111111";

function createMockRequest(
  method: string,
  path: string,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (searchParams)
    Object.entries(searchParams).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest;
}

function setupAuthenticatedOwner() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "owner@example.com" } },
    error: null,
  });
  const profileQuery = createChainableMock({
    data: {
      id: "user-123",
      role: "Owner",
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
        store_id: STORE_UUID,
        user_id: "user-123",
        role: "Owner",
        is_billing_owner: true,
        store: { id: STORE_UUID, name: "Test Store", is_active: true },
      },
    ],
    error: null,
  });
  return { profileQuery, storeUsersQuery };
}

describe("Forecast API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/reports/forecast", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
      });
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it("should return 400 when store_id is missing", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast");
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it("should return forecast data for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();

      const inventoryQuery = createChainableMock({
        data: [
          {
            id: "si-1",
            store_id: STORE_UUID,
            quantity: 50,
            par_level: 20,
            unit_cost: 3.5,
            inventory_item: {
              id: "item-1",
              name: "Tomatoes",
              category: "Produce",
              unit_of_measure: "kg",
              is_active: true,
            },
          },
          {
            id: "si-2",
            store_id: STORE_UUID,
            quantity: 10,
            par_level: 30,
            unit_cost: 2.0,
            inventory_item: {
              id: "item-2",
              name: "Lettuce",
              category: "Produce",
              unit_of_measure: "units",
              is_active: true,
            },
          },
        ],
        error: null,
      });

      const stockHistoryQuery = createChainableMock({
        data: [
          {
            inventory_item_id: "item-1",
            action_type: "Count",
            quantity_change: -5,
            created_at: "2026-02-05T10:00:00Z",
          },
          {
            inventory_item_id: "item-1",
            action_type: "Count",
            quantity_change: -3,
            created_at: "2026-02-06T10:00:00Z",
          },
          {
            inventory_item_id: "item-2",
            action_type: "Count",
            quantity_change: -8,
            created_at: "2026-02-05T10:00:00Z",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "store_inventory") return inventoryQuery;
        if (table === "stock_history") return stockHistoryQuery;
        return storeUsersQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
        days: "30",
        forecast_days: "14",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.forecasts).toHaveLength(2);
      expect(data.data.forecasts[0].itemName).toBeDefined();
      expect(data.data.forecasts[0].forecast).toHaveLength(14);
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.total).toBe(2);
      expect(data.data.period.historyDays).toBe(30);
      expect(data.data.period.forecastDays).toBe(14);
    });

    it("should return empty forecasts for store with no inventory", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();

      const emptyQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "store_inventory") return emptyQuery;
        return storeUsersQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.forecasts).toHaveLength(0);
      expect(data.data.summary.total).toBe(0);
    });

    it("should return 403 for Staff role", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-456", email: "staff@example.com" } },
        error: null,
      });
      const profileQuery = createChainableMock({
        data: {
          id: "user-456",
          role: "Staff",
          store_id: STORE_UUID,
          is_platform_admin: false,
          default_store_id: null,
        },
        error: null,
      });
      const storeUsersQuery = createChainableMock({
        data: [
          {
            id: "su-2",
            store_id: STORE_UUID,
            user_id: "user-456",
            role: "Staff",
            is_billing_owner: false,
            store: { id: STORE_UUID, name: "Store", is_active: true },
          },
        ],
        error: null,
      });
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
      });
      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it("should cap history days at 90", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      const emptyQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "store_inventory") return emptyQuery;
        return emptyQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
        days: "365",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.historyDays).toBe(90);
    });

    it("should cap forecast days at 30", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      const emptyQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "store_inventory") return emptyQuery;
        return emptyQuery;
      });

      const { GET } = await import("@/app/api/reports/forecast/route");
      const request = createMockRequest("GET", "/api/reports/forecast", {
        store_id: STORE_UUID,
        forecast_days: "60",
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.period.forecastDays).toBe(30);
    });
  });
});
