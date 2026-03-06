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

  mock.then = ((resolve?: (value: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(
      resolve ?? ((v) => v),
    )) as typeof Promise.prototype.then;
  return mock;
}

function createMockRequest(
  storeId: string,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost:3000/api/stores/${storeId}/export`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method: "GET",
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
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

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}));

const mockStoreId = "550e8400-e29b-41d4-a716-446655440000";
const mockUserId = "660e8400-e29b-41d4-a716-446655440000";

function setupAuthMocks(role: string = "Owner", storeId: string = mockStoreId) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: mockUserId, email: "owner@example.com" } },
    error: null,
  });

  const profileQuery = createChainableMock({
    data: {
      id: mockUserId,
      role,
      store_id: null,
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  });

  const storeUsersData = [
    {
      id: "su-1",
      store_id: storeId,
      user_id: mockUserId,
      role,
      store: { id: storeId, name: "Test Store", is_active: true },
    },
  ];
  const storeUsersQuery = createChainableMock({
    data: storeUsersData,
    error: null,
  });

  storeUsersQuery.single = vi.fn().mockResolvedValue({
    data: storeUsersData[0],
    error: null,
  });

  return { profileQuery, storeUsersQuery };
}

describe("Export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/stores/:storeId/export", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const { GET } = await import("@/app/api/stores/[storeId]/export/route");
      const request = createMockRequest(mockStoreId);
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      expect(response.status).toBe(401);
    });

    it("should return 403 when user does not have access to the store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      // User owns a different store
      const otherStoreId = "aaaaaaaa-0000-0000-0000-000000000000";
      const storeUsersForOtherStore = createChainableMock({
        data: [
          {
            id: "su-2",
            store_id: otherStoreId,
            user_id: mockUserId,
            role: "Owner",
            store: { id: otherStoreId, name: "Other Store", is_active: true },
          },
        ],
        error: null,
      });
      storeUsersForOtherStore.single = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "Not found" } });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersForOtherStore;
        return createChainableMock();
      });

      const { GET } = await import("@/app/api/stores/[storeId]/export/route");
      const request = createMockRequest(mockStoreId);
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      expect(response.status).toBe(403);
    });

    it("should return 403 when user is not an Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock();
      });

      const { GET } = await import("@/app/api/stores/[storeId]/export/route");
      const request = createMockRequest(mockStoreId);
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      expect(response.status).toBe(403);
    });

    it("should return xlsx file when Owner accesses their own store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      const storeQuery = createChainableMock({
        data: { name: "Test Store" },
        error: null,
      });
      const emptyQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return emptyQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/export/route");
      const request = createMockRequest(mockStoreId);
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(response.headers.get("content-disposition")).toMatch(
        /attachment; filename=".+\.xlsx"/,
      );
    });

    it("should accept date range query params", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      const storeQuery = createChainableMock({
        data: { name: "Test Store" },
        error: null,
      });
      const emptyQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return emptyQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/export/route");
      const request = createMockRequest(mockStoreId, {
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toMatch(/\.xlsx"/);
    });
  });
});
