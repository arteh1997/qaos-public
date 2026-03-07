import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoist mock references so they're accessible inside vi.mock factories
const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAdminClient = vi.hoisted(() => ({
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

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
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: mockAuditLog,
}));

// Mock rate limit to always allow
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

const STORE_ID = "550e8400-e29b-41d4-a716-446655440000";

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: object,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL("http://localhost:3000/api/inventory");
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return {
    method,
    nextUrl: url,
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

// Setup authenticated user with specific role
function setupAuthenticatedUser(role: string) {
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
        store_id: STORE_ID,
        user_id: "user-123",
        role,
        is_billing_owner: role === "Owner",
        store: {
          id: STORE_ID,
          name: "Test Store",
          is_active: true,
        },
      },
    ],
    error: null,
  });

  return { profileQuery, storeUsersQuery };
}

describe("Inventory API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/inventory", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { GET } = await import("@/app/api/inventory/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Authorized Requests", () => {
      it("should scope query to store_id and return full item list", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const inventoryQuery = createChainableMock({
          data: [
            {
              id: "item-1",
              name: "Tomatoes",
              category: "Produce",
              unit_of_measure: "kg",
              is_active: true,
              store_id: STORE_ID,
            },
            {
              id: "item-2",
              name: "Chicken",
              category: "Meat",
              unit_of_measure: "kg",
              is_active: true,
              store_id: STORE_ID,
            },
          ],
          count: 2,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "inventory_items") return inventoryQuery;
          return inventoryQuery;
        });

        const { GET } = await import("@/app/api/inventory/route");

        const request = createMockRequest("GET", undefined, {
          store_id: STORE_ID,
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        // Verify response body contains expected item fields
        expect(data.data[0]).toMatchObject({
          id: "item-1",
          name: "Tomatoes",
          category: "Produce",
          unit_of_measure: "kg",
        });
        // Verify multi-tenant store_id filter was applied
        expect(inventoryQuery.eq).toHaveBeenCalledWith("store_id", STORE_ID);
      });

      it("should return pagination metadata with correct totals", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const inventoryQuery = createChainableMock({
          data: [{ id: "item-1", name: "Tomatoes", category: "Produce" }],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inventoryQuery;
        });

        const { GET } = await import("@/app/api/inventory/route");

        const request = createMockRequest("GET", undefined, {
          store_id: STORE_ID,
          page: "1",
          pageSize: "10",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.pagination).toMatchObject({
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      });
    });

    describe("Filtering", () => {
      it("should apply ilike search filter across name and category columns", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const inventoryQuery = createChainableMock({
          data: [{ id: "item-1", name: "Tomatoes", category: "Produce" }],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inventoryQuery;
        });

        const { GET } = await import("@/app/api/inventory/route");

        const request = createMockRequest("GET", undefined, {
          store_id: STORE_ID,
          search: "tomato",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toHaveLength(1);
        // Verify the or() filter was applied with ilike pattern for name and category
        expect(inventoryQuery.or).toHaveBeenCalledWith(
          expect.stringMatching(/ilike.*tomato/i),
        );
      });

      it("should apply eq filter for category column", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const inventoryQuery = createChainableMock({
          data: [{ id: "item-2", name: "Chicken", category: "Meat" }],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inventoryQuery;
        });

        const { GET } = await import("@/app/api/inventory/route");

        const request = createMockRequest("GET", undefined, {
          store_id: STORE_ID,
          category: "Meat",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data[0].category).toBe("Meat");
        // Verify category eq filter was applied
        expect(inventoryQuery.eq).toHaveBeenCalledWith("category", "Meat");
      });
    });
  });

  describe("POST /api/inventory", () => {
    describe("Authorization", () => {
      it("should return 403 for Staff users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          name: "New Item",
          unit_of_measure: "kg",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.code).toBe("FORBIDDEN");
      });
    });

    describe("Validation", () => {
      it("should return 400 for missing name", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          store_id: STORE_ID,
          unit_of_measure: "kg",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.code).toBe("BAD_REQUEST");
      });

      it("should return 400 for missing store_id", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          name: "Valid Name",
          unit_of_measure: "kg",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
      });
    });

    describe("Duplicate Detection", () => {
      it("should return 400 if item name already exists in the store", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        // Mock existing item found
        const inventoryQuery = createChainableMock({
          data: { id: "existing-item" },
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "inventory_items") return inventoryQuery;
          return inventoryQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          store_id: STORE_ID,
          name: "Existing Item",
          unit_of_measure: "kg",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toContain("already exists");
      });
    });

    describe("Successful Creation", () => {
      it("should insert item with store_id and write audit log for Owner", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        let callCount = 0;
        const inventoryQuery = createChainableMock();
        inventoryQuery.single = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: check for existing (none found)
            return Promise.resolve({ data: null, error: { code: "PGRST116" } });
          }
          // Second call: inserted item
          return Promise.resolve({
            data: {
              id: "new-item-123",
              name: "New Ingredient",
              category: "Produce",
              unit_of_measure: "kg",
              is_active: true,
              store_id: STORE_ID,
              created_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          });
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "inventory_items") return inventoryQuery;
          return inventoryQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          store_id: STORE_ID,
          name: "New Ingredient",
          category: "Produce",
          unit_of_measure: "kg",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        // Verify response body contains full item with store_id
        expect(data.data).toMatchObject({
          id: "new-item-123",
          name: "New Ingredient",
          category: "Produce",
          unit_of_measure: "kg",
          store_id: STORE_ID,
        });

        // Verify INSERT included store_id for multi-tenant isolation
        expect(inventoryQuery.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            store_id: STORE_ID,
            name: "New Ingredient",
            unit_of_measure: "kg",
            is_active: true,
          }),
        );

        // Verify audit log was written with correct action, store, and resource metadata
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: "inventory.item_create",
            storeId: STORE_ID,
            resourceType: "inventory_item",
            resourceId: "new-item-123",
            details: expect.objectContaining({
              itemName: "New Ingredient",
              category: "Produce",
              unit: "kg",
            }),
          }),
        );
      });

      it("should insert item with store_id and write audit log for Manager", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        let callCount = 0;
        const inventoryQuery = createChainableMock();
        inventoryQuery.single = vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: null, error: { code: "PGRST116" } });
          }
          return Promise.resolve({
            data: {
              id: "new-item-456",
              name: "Manager Created Item",
              unit_of_measure: "units",
              is_active: true,
              store_id: STORE_ID,
            },
            error: null,
          });
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inventoryQuery;
        });

        const { POST } = await import("@/app/api/inventory/route");

        const request = createMockRequest("POST", {
          store_id: STORE_ID,
          name: "Manager Created Item",
          unit_of_measure: "units",
          is_active: true,
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          id: "new-item-456",
          name: "Manager Created Item",
          store_id: STORE_ID,
        });

        // Verify INSERT included store_id
        expect(inventoryQuery.insert).toHaveBeenCalledWith(
          expect.objectContaining({ store_id: STORE_ID }),
        );

        // Verify audit log recorded the Manager's action
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: "inventory.item_create",
            storeId: STORE_ID,
            resourceType: "inventory_item",
            resourceId: "new-item-456",
          }),
        );
      });
    });
  });
});
