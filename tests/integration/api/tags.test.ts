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

// Helper to create mock NextRequest
function createMockRequest(method: string, body?: object): NextRequest {
  const url = new URL("http://localhost:3000/api/stores/store-123/tags");
  const headers = new Headers({
    "x-csrf-token": "test-csrf-token",
  });

  const mockRequest = {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers,
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  };

  // Ensure method is accessible
  Object.defineProperty(mockRequest, "method", {
    value: method,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  return mockRequest as unknown as NextRequest;
}

describe("Tags API", () => {
  const mockUserId = "user-123";
  const mockStoreId = "store-123";
  const mockTagId = "tag-123";

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

  describe("GET /api/stores/[storeId]/tags", () => {
    it("should return tags with usage counts for authorized user", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Staff");

      const mockTags = [
        {
          id: "tag-1",
          name: "Perishable",
          description: "Items that expire quickly",
          color: "#EF4444",
          created_at: "2024-01-01",
        },
        {
          id: "tag-2",
          name: "High-Value",
          description: "Expensive items",
          color: "#F59E0B",
          created_at: "2024-01-01",
        },
      ];

      const mockTagUsage = [
        { tag_id: "tag-1" },
        { tag_id: "tag-1" },
        { tag_id: "tag-2" },
      ];

      const mockStoreInventoryItems = [
        { id: "item-1" },
        { id: "item-2" },
        { id: "item-3" },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          return createChainableMock({ data: mockTags, error: null });
        }
        if (table === "inventory_items") {
          return createChainableMock({
            data: mockStoreInventoryItems,
            error: null,
          });
        }
        if (table === "inventory_item_tags") {
          return createChainableMock({ data: mockTagUsage, error: null });
        }
        return createChainableMock();
      });

      const { GET } = await import("@/app/api/stores/[storeId]/tags/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tags).toHaveLength(2);
      expect(data.data.tags[0].usage_count).toBe(2);
      expect(data.data.tags[1].usage_count).toBe(1);
    });

    it("should not include usage counts from other stores", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Staff");

      const mockTags = [
        {
          id: "tag-1",
          name: "Perishable",
          description: "Items that expire quickly",
          color: "#EF4444",
          created_at: "2024-01-01",
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          return createChainableMock({ data: mockTags, error: null });
        }
        if (table === "inventory_items") {
          // Store has no items — simulates store_id filter excluding other stores' items
          return createChainableMock({ data: [], error: null });
        }
        if (table === "inventory_item_tags") {
          // Should not be reached when storeItemIds is empty, but guard anyway
          return createChainableMock({
            data: [{ tag_id: "tag-1" }, { tag_id: "tag-1" }],
            error: null,
          });
        }
        return createChainableMock();
      });

      const { GET } = await import("@/app/api/stores/[storeId]/tags/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tags[0].usage_count).toBe(0);
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

      const { GET } = await import("@/app/api/stores/[storeId]/tags/route");
      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/stores/[storeId]/tags", () => {
    it("should create a new tag for Owner/Manager", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const newTag = {
        name: "Seasonal",
        description: "Seasonal items",
        color: "#8B5CF6",
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          const mockChain = createChainableMock();
          mockChain.select = vi.fn(() =>
            createChainableMock({ data: null, error: null }),
          );
          mockChain.insert = vi.fn(() =>
            createChainableMock({
              data: { id: "tag-new", ...newTag },
              error: null,
            }),
          );
          return mockChain;
        }
        return createChainableMock();
      });

      const { POST } = await import("@/app/api/stores/[storeId]/tags/route");
      const request = createMockRequest("POST", newTag);
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.tag.name).toBe("Seasonal");
    });

    it("should reject duplicate tag name", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const duplicateTag = { name: "Perishable" };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          return createChainableMock({
            data: { id: "existing-tag" },
            error: null,
          });
        }
        return createChainableMock();
      });

      const { POST } = await import("@/app/api/stores/[storeId]/tags/route");
      const request = createMockRequest("POST", duplicateTag);
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("already exists");
    });
  });

  describe("PATCH /api/stores/[storeId]/tags/[tagId]", () => {
    it("should update tag for Owner/Manager", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      const updates = { name: "Very Perishable", color: "#DC2626" };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
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
            // Otherwise, it's the existence check -> return the tag
            return Promise.resolve({ data: { id: mockTagId }, error: null });
          });

          // Mock update (returns chainable that supports .select().single())
          mockChain.update = vi.fn(() => {
            const updateChain = createChainableMock();
            updateChain.select = vi.fn(() => {
              const selectChain = createChainableMock();
              selectChain.single = vi.fn().mockResolvedValue({
                data: { id: mockTagId, ...updates },
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
        await import("@/app/api/stores/[storeId]/tags/[tagId]/route");
      const request = createMockRequest("PATCH", updates);
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: mockStoreId, tagId: mockTagId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tag.name).toBe("Very Perishable");
    });

    it("should return 404 for non-existent tag", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          return createChainableMock({ data: null, error: null });
        }
        return createChainableMock();
      });

      const { PATCH } =
        await import("@/app/api/stores/[storeId]/tags/[tagId]/route");
      const request = createMockRequest("PATCH", { name: "Test" });
      const response = await PATCH(request, {
        params: Promise.resolve({ storeId: mockStoreId, tagId: mockTagId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe("DELETE /api/stores/[storeId]/tags/[tagId]", () => {
    it("should delete tag for Owner only", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Owner");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          const mockChain = createChainableMock();
          mockChain.select = vi.fn(() =>
            createChainableMock({ data: { id: mockTagId }, error: null }),
          );
          mockChain.delete = vi.fn(() =>
            createChainableMock({ data: null, error: null }),
          );
          return mockChain;
        }
        return createChainableMock();
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/tags/[tagId]/route");
      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: mockStoreId, tagId: mockTagId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should reject for Manager role", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "item_tags") {
          return createChainableMock({ data: { id: mockTagId }, error: null });
        }
        return createChainableMock();
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/tags/[tagId]/route");
      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: mockStoreId, tagId: mockTagId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });
});
