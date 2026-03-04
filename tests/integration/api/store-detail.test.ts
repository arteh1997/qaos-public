import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Create chainable query builder mock that is also thenable
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

  // Make the mock thenable so it can be awaited without calling .single()
  mock.then = ((resolve?: ((value: unknown) => unknown) | null) =>
    Promise.resolve(resolvedValue).then(
      resolve,
    )) as typeof Promise.prototype.then;

  return mock;
}

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock admin client
const mockAdminClient = {
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// Mock audit log
vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(() => Promise.resolve()),
  computeFieldChanges: vi.fn().mockReturnValue([]),
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

// Mock CSRF validation
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

// Helper to create mock NextRequest
function createMockRequest(method: string, body?: object): NextRequest {
  const url = new URL("http://localhost:3000/api/stores/store-123");

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

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = createChainableMock({
    data: {
      role,
      store_id: null,
      is_platform_admin: false,
      default_store_id: null,
    },
    error: null,
  });

  const storeUsersQuery = createChainableMock({
    data:
      stores.length > 0
        ? stores
        : [
            {
              id: "su-1",
              store_id: "store-123",
              user_id: "user-123",
              role,
              is_billing_owner: role === "Owner",
              store: { id: "store-123", name: "Test Store", is_active: true },
            },
          ],
    error: null,
  });

  return { profileQuery, storeUsersQuery };
}

describe("Store Detail API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/stores/:storeId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return store when user has access", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const storeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "store-123",
            name: "Test Store",
            is_active: true,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return storeQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Test Store");
    });

    it("should return 403 when user has no access to store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        [
          {
            id: "su-1",
            store_id: "other-store",
            user_id: "user-123",
            role: "Owner",
            is_billing_owner: true,
            store: { id: "other-store", name: "Other Store", is_active: true },
          },
        ],
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should return 404 when store not found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const storeQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return storeQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/stores/:storeId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { PATCH } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Store" });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 for Staff users", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PATCH } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Store" });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should update store for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const storeQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "store-123",
            name: "Updated Store",
            is_active: true,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return storeQuery;
      });

      const { PATCH } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Store" });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Updated Store");
    });

    it("should cancel invites when deactivating store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // Setup admin client mocks
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "user_invites") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gt: vi.fn().mockResolvedValue({
              data: [
                { id: "invite-1", email: "test@example.com", role: "Staff" },
              ],
              error: null,
            }),
            contains: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
            delete: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
          };
        }
        return mockAdminClient.from("");
      });

      const storeQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "store-123",
            name: "Test Store",
            is_active: false,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return storeQuery;
      });

      const { PATCH } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("PATCH", { is_active: false });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should allow Manager users to update store", async () => {
      const { profileQuery, storeUsersQuery } =
        setupAuthenticatedUser("Manager");

      const storeQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "store-123",
            name: "Updated Store",
            is_active: true,
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "stores") return storeQuery;
        return storeQuery;
      });

      const { PATCH } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Store" });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("DELETE /api/stores/:storeId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { DELETE } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 for Staff users", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { DELETE } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should return 400 when store has assigned users", async () => {
      const { profileQuery } = setupAuthenticatedUser("Owner");

      // Track calls to store_users to return different responses
      let storeUsersCallCount = 0;
      const storeUsersQueryMock = {
        select: vi
          .fn()
          .mockImplementation(
            (selectFields: string, options?: { count?: string }) => {
              storeUsersCallCount++;
              if (options?.count === "exact") {
                // Count query for checking assigned users
                return {
                  eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
                };
              }
              // Auth query for user's store memberships
              const chainable = createChainableMock({
                data: [
                  {
                    id: "su-1",
                    store_id: "store-123",
                    user_id: "user-123",
                    role: "Owner",
                    is_billing_owner: true,
                    store: {
                      id: "store-123",
                      name: "Test Store",
                      is_active: true,
                    },
                  },
                ],
                error: null,
              });
              return chainable;
            },
          ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQueryMock;
        return profileQuery;
      });

      const { DELETE } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("BAD_REQUEST");
      expect(data.message).toContain("assigned users");
    });

    it("should return 400 when store has pending invitations", async () => {
      const { profileQuery } = setupAuthenticatedUser("Owner");

      // Store users query mock that handles both auth and count queries
      const storeUsersQueryMock = {
        select: vi
          .fn()
          .mockImplementation(
            (selectFields: string, options?: { count?: string }) => {
              if (options?.count === "exact") {
                // Count query for checking assigned users - return 0 (no other users)
                return {
                  eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                };
              }
              // Auth query for user's store memberships
              const chainable = createChainableMock({
                data: [
                  {
                    id: "su-1",
                    store_id: "store-123",
                    user_id: "user-123",
                    role: "Owner",
                    is_billing_owner: true,
                    store: {
                      id: "store-123",
                      name: "Test Store",
                      is_active: true,
                    },
                  },
                ],
                error: null,
              });
              return chainable;
            },
          ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQueryMock;
        if (table === "user_invites") {
          return {
            select: vi.fn().mockImplementation((_, options) => {
              if (options?.count === "exact") {
                return {
                  eq: vi.fn().mockReturnThis(),
                  is: vi.fn().mockResolvedValue({ count: 2, error: null }),
                };
              }
              return createChainableMock({ data: [], error: null });
            }),
          };
        }
        return profileQuery;
      });

      const { DELETE } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain("pending invitations");
    });

    it("should delete store when no users or invitations", async () => {
      const { profileQuery } = setupAuthenticatedUser("Owner");

      // Store users query mock that handles both auth and count queries
      const storeUsersQueryMock = {
        select: vi
          .fn()
          .mockImplementation(
            (selectFields: string, options?: { count?: string }) => {
              if (options?.count === "exact") {
                // Count query for checking assigned users - return 0 (no other users)
                return {
                  eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
                };
              }
              // Auth query for user's store memberships
              const chainable = createChainableMock({
                data: [
                  {
                    id: "su-1",
                    store_id: "store-123",
                    user_id: "user-123",
                    role: "Owner",
                    is_billing_owner: true,
                    store: {
                      id: "store-123",
                      name: "Test Store",
                      is_active: true,
                    },
                  },
                ],
                error: null,
              });
              return chainable;
            },
          ),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQueryMock;
        if (table === "user_invites") {
          return {
            select: vi.fn().mockImplementation((_, options) => {
              if (options?.count === "exact") {
                return {
                  eq: vi.fn().mockReturnThis(),
                  is: vi.fn().mockResolvedValue({ count: 0, error: null }),
                };
              }
              return createChainableMock({ data: [], error: null });
            }),
          };
        }
        if (table === "stores") {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return profileQuery;
      });

      const { DELETE } = await import("@/app/api/stores/[storeId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: "store-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
    });
  });
});
