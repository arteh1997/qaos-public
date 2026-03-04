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
  getRateLimitHeaders: vi.fn(() => ({
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": String(Date.now() + 60000),
  })),
}));

// Mock CSRF validation
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

// Helper to create mock NextRequest (copied from stores.test.ts)
function createMockRequest(
  method: string,
  body?: object,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL("http://localhost:3000/api/stores");
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

describe("Categories API", () => {
  const mockUserId = "user-123";
  const mockStoreId = "store-123";
  const mockCategoryId = "category-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to set up auth mocks (REQUIRED by middleware)
  function setupAuthMocks(role: string = "Manager") {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId, email: "test@example.com" } },
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

    // Store users query - needs to handle both array (middleware) and single (routes)
    const storeUsersData = [
      { id: "su-1", store_id: mockStoreId, user_id: mockUserId, role },
    ];
    const storeUsersQuery = createChainableMock({
      data: storeUsersData,
      error: null,
    });

    // Override .single() to return first element of array (routes expect this)
    storeUsersQuery.single = vi.fn().mockResolvedValue({
      data: storeUsersData[0],
      error: null,
    });

    return { profileQuery, storeUsersQuery };
  }

  // Diagnostic test using stores route to verify mock setup works
  describe("DIAGNOSTIC", () => {
    it("should work with stores route (sanity check)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId, email: "test@example.com" } },
        error: null,
      });

      const profileQuery = createChainableMock({
        data: {
          id: mockUserId,
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
            store_id: mockStoreId,
            user_id: mockUserId,
            role: "Owner",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock({ data: [], error: null });
      });

      const { GET } = await import("@/app/api/stores/route");
      const request = createMockRequest("GET");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/stores/[storeId]/categories", () => {
    it("should return categories with item counts for authorized user", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const mockCategories = [
        {
          id: "cat-1",
          name: "Produce",
          description: "Fresh produce",
          color: "#22C55E",
          sort_order: 1,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        {
          id: "cat-2",
          name: "Dairy",
          description: "Dairy products",
          color: "#3B82F6",
          sort_order: 2,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ];

      const mockItemCounts = [
        { category_id: "cat-1" },
        { category_id: "cat-1" },
        { category_id: "cat-2" },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          return createChainableMock({ data: mockCategories, error: null });
        }
        if (table === "inventory_items") {
          return createChainableMock({ data: mockItemCounts, error: null });
        }
        return createChainableMock();
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.categories).toHaveLength(2);
      expect(data.data.categories[0].item_count).toBe(2);
      expect(data.data.categories[1].item_count).toBe(1);
    });

    it("should not include item counts from other stores", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const mockCategories = [
        {
          id: "cat-1",
          name: "Produce",
          description: null,
          color: null,
          sort_order: 1,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          return createChainableMock({ data: mockCategories, error: null });
        }
        if (table === "inventory_items") {
          // Return empty — store filter correctly excludes other stores' items
          return createChainableMock({ data: [], error: null });
        }
        return createChainableMock();
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.categories[0].item_count).toBe(0);
    });

    it("should return 403 for unauthorized user", async () => {
      const { profileQuery } = setupAuthMocks();

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") {
          // No store access - .single() should return null data
          const noAccessQuery = createChainableMock({ data: [], error: null });
          noAccessQuery.single = vi
            .fn()
            .mockResolvedValue({ data: null, error: null });
          return noAccessQuery;
        }
        return createChainableMock();
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/stores/[storeId]/categories", () => {
    it("should create a new category for Owner/Manager", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const newCategory = {
        name: "Beverages",
        description: "All drinks",
        color: "#8B5CF6",
        sort_order: 5,
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          const mockChain = createChainableMock();
          // Mock select for duplicate check (no duplicate)
          mockChain.select = vi.fn(() =>
            createChainableMock({ data: null, error: null }),
          );
          // Mock insert
          mockChain.insert = vi.fn(() =>
            createChainableMock({
              data: { id: "cat-new", ...newCategory },
              error: null,
            }),
          );
          return mockChain;
        }
        return createChainableMock();
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("POST", newCategory);
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.category.name).toBe("Beverages");
    });

    it("should reject duplicate category name", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const duplicateCategory = { name: "Produce" };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          // Mock duplicate found
          return createChainableMock({
            data: { id: "existing-cat" },
            error: null,
          });
        }
        return createChainableMock();
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("POST", duplicateCategory);
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("already exists");
    });

    it("should reject for Staff role", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock();
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/categories/route");
      const request = createMockRequest("POST", { name: "Test" });
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("PATCH /api/stores/[storeId]/categories/[categoryId]", () => {
    it("should update category for Owner/Manager", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const updates = { name: "Fresh Produce", color: "#10B981" };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          const mockChain = createChainableMock();
          let neqCalled = false;

          // Track if .neq() is called (for duplicate check)
          mockChain.neq = vi.fn(() => {
            neqCalled = true;
            return mockChain;
          });

          // Mock .single() to return different results based on context
          mockChain.single = vi.fn().mockImplementation(() => {
            // If .neq() was called, this is the duplicate check -> return null (no duplicate)
            if (neqCalled) {
              return Promise.resolve({ data: null, error: null });
            }
            // Otherwise, it's the existence check -> return the category
            return Promise.resolve({
              data: { id: mockCategoryId },
              error: null,
            });
          });

          // Mock update (returns chainable that supports .select().single())
          mockChain.update = vi.fn(() => {
            const updateChain = createChainableMock();
            updateChain.select = vi.fn(() => {
              const selectChain = createChainableMock();
              selectChain.single = vi.fn().mockResolvedValue({
                data: { id: mockCategoryId, ...updates },
                error: null,
              });
              return selectChain;
            });
            return updateChain;
          });
          return mockChain;
        }
        return createChainableMock();
      });

      const { PATCH } =
        await import("@/app/api/stores/[storeId]/categories/[categoryId]/route");
      const request = createMockRequest("PATCH", updates);
      const response = await PATCH(request, {
        params: Promise.resolve({
          storeId: mockStoreId,
          categoryId: mockCategoryId,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.category.name).toBe("Fresh Produce");
    });

    it("should return 404 for non-existent category", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          return createChainableMock({ data: null, error: null });
        }
        return createChainableMock();
      });

      const { PATCH } =
        await import("@/app/api/stores/[storeId]/categories/[categoryId]/route");
      const request = createMockRequest("PATCH", { name: "Test" });
      const response = await PATCH(request, {
        params: Promise.resolve({
          storeId: mockStoreId,
          categoryId: mockCategoryId,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe("DELETE /api/stores/[storeId]/categories/[categoryId]", () => {
    it("should delete category for Owner only", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          const mockChain = createChainableMock();
          mockChain.select = vi.fn(() =>
            createChainableMock({ data: { id: mockCategoryId }, error: null }),
          );
          mockChain.delete = vi.fn(() =>
            createChainableMock({ data: null, error: null }),
          );
          return mockChain;
        }
        if (table === "inventory_items") {
          return createChainableMock({ data: [], error: null });
        }
        return createChainableMock();
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/categories/[categoryId]/route");
      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({
          storeId: mockStoreId,
          categoryId: mockCategoryId,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should prevent deletion if items are using the category", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          return createChainableMock({
            data: { id: mockCategoryId },
            error: null,
          });
        }
        if (table === "inventory_items") {
          return createChainableMock({ data: [{ id: "item-1" }], error: null });
        }
        return createChainableMock();
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/categories/[categoryId]/route");
      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({
          storeId: mockStoreId,
          categoryId: mockCategoryId,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("assigned to active items");
    });

    it("should reject for Manager role", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_categories") {
          return createChainableMock({
            data: { id: mockCategoryId },
            error: null,
          });
        }
        return createChainableMock();
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/categories/[categoryId]/route");
      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({
          storeId: mockStoreId,
          categoryId: mockCategoryId,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });
});
