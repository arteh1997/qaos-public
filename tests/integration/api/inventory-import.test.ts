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

// Mock admin Supabase client (used for audit log)
const mockAdminClient = {
  from: vi.fn(() => createChainableMock({ data: null, error: null })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
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

// Mock audit log
vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

// Helper to create a mock FormData with a CSV file
function createMockFormData(csvContent?: string) {
  const content =
    csvContent ??
    "name,category,current_stock,par_level,cost_per_unit\nApples,Produce,10,5,0.50";
  const file = new File([content], "test.csv", { type: "text/csv" });
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

// Helper to create mock NextRequest
function createMockRequest(method: string, formData?: FormData): NextRequest {
  const url = new URL(
    "http://localhost:3000/api/stores/store-123/inventory/import",
  );
  const headers = new Headers({
    "x-csrf-token": "test-csrf-token",
  });

  const mockRequest = {
    method,
    nextUrl: url,
    url: url.toString(),
    formData: vi.fn(() => Promise.resolve(formData ?? createMockFormData())),
    json: vi.fn(() => Promise.resolve({})),
    headers,
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  };

  Object.defineProperty(mockRequest, "method", {
    value: method,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  return mockRequest as unknown as NextRequest;
}

describe("Inventory Import API", () => {
  const mockUserId = "user-123";
  const mockStoreId = "store-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        full_name: "Test User",
      },
      error: null,
    });

    const storeUsersData = [
      { id: "su-1", store_id: mockStoreId, user_id: mockUserId, role },
    ];
    const storeUsersQuery = createChainableMock({
      data: storeUsersData,
      error: null,
    });
    storeUsersQuery.single = vi
      .fn()
      .mockResolvedValue({ data: storeUsersData[0], error: null });

    return { profileQuery, storeUsersQuery };
  }

  describe("POST /api/stores/[storeId]/inventory/import", () => {
    it("should return 401 for unauthenticated request", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/inventory/import/route");
      const request = createMockRequest("POST");
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should return 400 when no file is uploaded", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock();
      });

      const emptyFormData = new FormData(); // no file appended
      const { POST } =
        await import("@/app/api/stores/[storeId]/inventory/import/route");
      const request = createMockRequest("POST", emptyFormData);
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("No file uploaded");
    });

    it("should return 400 for invalid CSV rows", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock();
      });

      // Row has empty name (fails validation)
      const badCsv = "name,category\n,Produce";
      const { POST } =
        await import("@/app/api/stores/[storeId]/inventory/import/route");
      const request = createMockRequest("POST", createMockFormData(badCsv));
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should import valid CSV and return 200", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthMocks("Manager");

      const mockInsertedItems = [
        {
          id: "item-1",
          name: "Apples",
          category: "Produce",
          store_id: mockStoreId,
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "inventory_items") {
          const chain = createChainableMock({
            data: mockInsertedItems,
            error: null,
          });
          chain.insert = vi.fn(() => ({
            ...chain,
            select: vi
              .fn()
              .mockResolvedValue({ data: mockInsertedItems, error: null }),
          }));
          return chain;
        }
        if (table === "store_inventory") {
          return createChainableMock({ data: null, error: null });
        }
        return createChainableMock();
      });

      const validCsv =
        "name,category,current_stock,par_level,cost_per_unit\nApples,Produce,10,5,0.50";
      const { POST } =
        await import("@/app/api/stores/[storeId]/inventory/import/route");
      const request = createMockRequest("POST", createMockFormData(validCsv));
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.itemsImported).toBe(1);
    });

    it("should return 403 for Staff role", async () => {
      const { profileQuery } = setupAuthMocks("Staff");

      // Staff user has no entry in store_users with Owner/Manager role
      // middleware allowedRoles check will block at the global level
      // but we also set up store_users to return Staff role
      const storeUsersData = [
        {
          id: "su-1",
          store_id: mockStoreId,
          user_id: mockUserId,
          role: "Staff",
        },
      ];
      const storeUsersQuery = createChainableMock({
        data: storeUsersData,
        error: null,
      });
      storeUsersQuery.single = vi
        .fn()
        .mockResolvedValue({ data: storeUsersData[0], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return createChainableMock();
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/inventory/import/route");
      const request = createMockRequest("POST");
      const response = await POST(request, {
        params: Promise.resolve({ storeId: mockStoreId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });
});
