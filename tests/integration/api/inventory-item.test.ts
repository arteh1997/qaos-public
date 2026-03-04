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
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
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

// Mock admin client and audit log
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}));

// Helper to create mock NextRequest
function createMockRequest(method: string, body?: object): NextRequest {
  const url = new URL("http://localhost:3000/api/inventory/item-123");

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

describe("Inventory Item API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/inventory/:itemId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return inventory item when found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const inventoryItemQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "item-123",
            name: "Tomatoes",
            unit_of_measure: "kg",
            category: "Produce",
            is_active: true,
            store_id: "store-1",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return inventoryItemQuery;
        return inventoryItemQuery;
      });

      const { GET } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Tomatoes");
    });

    it("should return 404 when item not found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const inventoryItemQuery = {
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
        if (table === "inventory_items") return inventoryItemQuery;
        return inventoryItemQuery;
      });

      const { GET } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ itemId: "nonexistent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/inventory/:itemId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { PATCH } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Tomatoes" });
      const response = await PATCH(request, {
        params: Promise.resolve({ itemId: "item-123" }),
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

      const { PATCH } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Tomatoes" });
      const response = await PATCH(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should update inventory item for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // Track calls to return different responses: ownership check, duplicate check, update
      let singleCallCount = 0;
      const inventoryItemQuery = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          singleCallCount++;
          if (singleCallCount === 1) {
            // First call: ownership check
            return Promise.resolve({
              data: { id: "item-123", store_id: "store-1" },
              error: null,
            });
          } else if (singleCallCount === 2) {
            // Second call: duplicate check - no duplicate found
            return Promise.resolve({
              data: null,
              error: null,
            });
          } else {
            // Third call: update result
            return Promise.resolve({
              data: {
                id: "item-123",
                name: "Updated Tomatoes",
                unit_of_measure: "kg",
                category: "Produce",
                is_active: true,
                store_id: "store-1",
              },
              error: null,
            });
          }
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return inventoryItemQuery;
        return inventoryItemQuery;
      });

      const { PATCH } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("PATCH", { name: "Updated Tomatoes" });
      const response = await PATCH(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Updated Tomatoes");
    });

    it("should return 400 for duplicate name", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // Track calls: first is ownership check, second is duplicate check
      let singleCallCount = 0;
      const duplicateCheckQuery = {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          singleCallCount++;
          if (singleCallCount === 1) {
            // First call: ownership check
            return Promise.resolve({
              data: { id: "item-123", store_id: "store-1" },
              error: null,
            });
          } else {
            // Second call: duplicate check — duplicate found
            return Promise.resolve({
              data: { id: "existing-item" },
              error: null,
            });
          }
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return duplicateCheckQuery;
        return duplicateCheckQuery;
      });

      const { PATCH } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("PATCH", {
        name: "Existing Item Name",
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("BAD_REQUEST");
      expect(data.message).toContain("already exists");
    });

    it("should allow Manager users", async () => {
      const { profileQuery, storeUsersQuery } =
        setupAuthenticatedUser("Manager");

      // Body has no 'name', so duplicate check is skipped — 2 .single() calls: ownership check, then update
      let singleCallCount = 0;
      const updateQuery = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          singleCallCount++;
          if (singleCallCount === 1) {
            // First call: ownership check
            return Promise.resolve({
              data: { id: "item-123", store_id: "store-1" },
              error: null,
            });
          } else {
            // Second call: update result
            return Promise.resolve({
              data: {
                id: "item-123",
                name: "Test Item",
                store_id: "store-1",
                unit_of_measure: "lbs",
              },
              error: null,
            });
          }
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return updateQuery;
        return updateQuery;
      });

      const { PATCH } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("PATCH", { unit_of_measure: "lbs" });
      const response = await PATCH(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("DELETE /api/inventory/:itemId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { DELETE } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ itemId: "item-123" }),
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

      const { DELETE } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should soft delete inventory item for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // 2 single() calls: ownership check, then soft delete
      let singleCallCount = 0;
      const deleteQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          singleCallCount++;
          if (singleCallCount === 1) {
            // First call: ownership check
            return Promise.resolve({
              data: { id: "item-123", store_id: "store-1" },
              error: null,
            });
          } else {
            // Second call: soft delete result
            return Promise.resolve({
              data: {
                id: "item-123",
                name: "Tomatoes",
                is_active: false,
                store_id: "store-1",
              },
              error: null,
            });
          }
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return deleteQuery;
        return deleteQuery;
      });

      const { DELETE } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ itemId: "item-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe("Inventory item deactivated");
      expect(data.data.item.is_active).toBe(false);
    });

    it("should return 404 when item not found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const deleteQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") return deleteQuery;
        return deleteQuery;
      });

      const { DELETE } = await import("@/app/api/inventory/[itemId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ itemId: "nonexistent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe("NOT_FOUND");
    });
  });
});
