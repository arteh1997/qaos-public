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

  // Make the mock thenable so it can be awaited without calling .single()
  mock.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(resolve);

  return mock;
}

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock admin client (used by the audit-logs route)
const mockAdminClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}));

// Mock rate limit
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

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL("http://localhost:3000/api/audit-logs");
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method,
    nextUrl: url,
    url: url.toString(),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

// Setup authenticated user with specific role
function setupAuthenticatedUser(
  role: string,
  options: { isPlatformAdmin?: boolean } = {},
) {
  const { isPlatformAdmin = false } = options;

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = createChainableMock({
    data: {
      id: "user-123",
      role,
      store_id: null,
      is_platform_admin: isPlatformAdmin,
      default_store_id: null,
    },
    error: null,
  });

  const storeUsersQuery = createChainableMock({
    data: [
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
  });

  return { profileQuery, storeUsersQuery };
}

describe("Audit Logs API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/audit-logs", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { GET } = await import("@/app/api/audit-logs/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Authorization", () => {
      it("should return 403 for Staff users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { GET } = await import("@/app/api/audit-logs/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.code).toBe("FORBIDDEN");
      });
    });

    describe("Successful Requests", () => {
      it("should return audit logs for platform admin", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          {
            isPlatformAdmin: true,
          },
        );

        const auditLogsQuery = createChainableMock({
          data: [
            {
              id: "log-1",
              event_type: "user.created",
              user_id: "user-123",
              timestamp: new Date().toISOString(),
              metadata: { email: "test@example.com" },
            },
            {
              id: "log-2",
              event_type: "store.updated",
              user_id: "user-123",
              timestamp: new Date().toISOString(),
              metadata: { store_id: "store-1" },
            },
          ],
          count: 2,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return auditLogsQuery;
        });

        // Admin client is used by the route to query audit_logs
        mockAdminClient.from.mockImplementation(() => auditLogsQuery);

        const { GET } = await import("@/app/api/audit-logs/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // API returns { logs: [...], pagination: {...} }
        expect(Array.isArray(data.data.logs)).toBe(true);
      });

      it("should support filtering by date range", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          {
            isPlatformAdmin: true,
          },
        );

        const auditLogsQuery = createChainableMock({
          data: [],
          count: 0,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return auditLogsQuery;
        });

        mockAdminClient.from.mockImplementation(() => auditLogsQuery);

        const { GET } = await import("@/app/api/audit-logs/route");

        const request = createMockRequest("GET", {
          start_date: "2025-01-01",
          end_date: "2025-01-31",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it("should support filtering by event type", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          {
            isPlatformAdmin: true,
          },
        );

        const auditLogsQuery = createChainableMock({
          data: [
            {
              id: "log-1",
              event_type: "user.created",
              user_id: "user-123",
              timestamp: new Date().toISOString(),
            },
          ],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return auditLogsQuery;
        });

        mockAdminClient.from.mockImplementation(() => auditLogsQuery);

        const { GET } = await import("@/app/api/audit-logs/route");

        const request = createMockRequest("GET", {
          event_type: "user.created",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });
  });
});
