import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({
    success: true,
    remaining: 9,
    resetTime: Date.now() + 60000,
    limit: 10,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    reports: { limit: 10, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Helper to create mock NextRequest
function createMockRequest(searchParams?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/alerts/missing-counts");
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

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        role,
        store_id: null,
        is_platform_admin: false,
        default_store_id: null,
      },
      error: null,
    }),
  };

  const storeUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data:
        stores.length > 0
          ? stores
          : [
              {
                id: "su-1",
                store_id: "store-1",
                user_id: "user-123",
                role,
                is_billing_owner: role === "Owner",
                store: { id: "store-1", name: "Test Store", is_active: true },
              },
            ],
      error: null,
    }),
  };

  return { profileQuery, storeUsersQuery };
}

describe("Missing Counts Alert API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/alerts/missing-counts", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest();
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Authorization", () => {
      it("should allow Owner users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "store-1", name: "Store 1" },
              { id: "store-2", name: "Store 2" },
            ],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ store_id: "store-1" }], // Only store-1 has counts
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest({ date: "2025-01-15" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.missing_count).toBe(1); // store-2 is missing
        expect(data.data.total_stores).toBe(2);
        expect(data.data.missing_stores).toHaveLength(1);
        expect(data.data.missing_stores[0].id).toBe("store-2");
      });

      it("should allow Manager users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: "store-1", name: "Store 1" }],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ store_id: "store-1" }],
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest();
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it("should allow Staff users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest();
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe("Date Handling", () => {
      it("should use provided date when specified", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: "store-1", name: "Store 1" }],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest({ date: "2025-01-10" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.date).toBe("2025-01-10");
      });

      it("should default to yesterday when no date provided", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest(); // No date param
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.date).toBeDefined();
        // Should be yesterday's date
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .split("T")[0];
        expect(data.data.date).toBe(yesterday);
      });
    });

    describe("Response Data", () => {
      it("should return all stores as missing when no counts submitted", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "store-1", name: "Store 1" },
              { id: "store-2", name: "Store 2" },
              { id: "store-3", name: "Store 3" },
            ],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [], // No counts submitted
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest({ date: "2025-01-15" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.missing_count).toBe(3);
        expect(data.data.total_stores).toBe(3);
        expect(data.data.missing_stores).toHaveLength(3);
      });

      it("should return empty missing stores when all have counts", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const storesQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "store-1", name: "Store 1" },
              { id: "store-2", name: "Store 2" },
            ],
            error: null,
          }),
        };

        const dailyCountsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ store_id: "store-1" }, { store_id: "store-2" }],
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "stores") return storesQuery;
          if (table === "daily_counts") return dailyCountsQuery;
          return storesQuery;
        });

        const { GET } = await import("@/app/api/alerts/missing-counts/route");

        const request = createMockRequest({ date: "2025-01-15" });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.missing_count).toBe(0);
        expect(data.data.total_stores).toBe(2);
        expect(data.data.missing_stores).toHaveLength(0);
      });
    });
  });
});
