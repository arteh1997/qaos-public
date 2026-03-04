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
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
  },
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

function createMockRequest(
  method: string,
  path: string,
  body?: object,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
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

function setupAuthenticatedUser(role: string, storeId: string = "store-123") {
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
        store_id: storeId,
        user_id: "user-123",
        role,
        is_billing_owner: role === "Owner",
        store: { id: storeId, name: "Test Store", is_active: true },
      },
    ],
    error: null,
  });

  return { profileQuery, storeUsersQuery };
}

describe("HACCP Checks API", () => {
  const STORE_UUID = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/stores/[storeId]/haccp/checks", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/checks`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return checks list for authenticated user", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const checksQuery = createChainableMock({
        data: [
          {
            id: "check-1",
            store_id: STORE_UUID,
            template_id: null,
            completed_by: "user-123",
            completed_at: "2026-02-20T08:00:00Z",
            status: "pass",
            notes: "All good",
            items: [
              {
                template_item_id: "1",
                label: "Fridge temp OK?",
                value: true,
                passed: true,
              },
            ],
            template: null,
          },
          {
            id: "check-2",
            store_id: STORE_UUID,
            template_id: "tmpl-1",
            completed_by: "user-456",
            completed_at: "2026-02-19T08:00:00Z",
            status: "fail",
            notes: "Fridge temp too high",
            items: [
              {
                template_item_id: "1",
                label: "Fridge temp OK?",
                value: false,
                passed: false,
              },
            ],
            template: { id: "tmpl-1", name: "Opening Checks" },
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_checks") return checksQuery;
        return checksQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/checks`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].status).toBe("pass");
      expect(data.data[1].status).toBe("fail");
    });

    it("should apply status filter", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const checksQuery = createChainableMock({
        data: [
          {
            id: "check-2",
            store_id: STORE_UUID,
            template_id: "tmpl-1",
            completed_by: "user-456",
            completed_at: "2026-02-19T08:00:00Z",
            status: "fail",
            notes: "Fridge temp too high",
            items: [
              {
                template_item_id: "1",
                label: "Fridge temp OK?",
                value: false,
                passed: false,
              },
            ],
            template: { id: "tmpl-1", name: "Opening Checks" },
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_checks") return checksQuery;
        return checksQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/checks`,
        undefined,
        {
          status: "fail",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(checksQuery.eq).toHaveBeenCalled();
    });
  });

  describe("POST /api/stores/[storeId]/haccp/checks", () => {
    const validCheckBody = {
      template_id: null,
      items: [
        {
          template_item_id: "1",
          label: "Fridge temp OK?",
          value: true,
          passed: true,
        },
        {
          template_item_id: "2",
          label: "Hands washed?",
          value: true,
          passed: true,
        },
      ],
      status: "pass",
      notes: "All good",
    };

    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/checks`,
        validCheckBody,
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 for invalid data with missing status", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/checks`,
        {
          template_id: null,
          items: [
            { template_item_id: "1", label: "Test", value: true, passed: true },
          ],
          // missing status field
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("BAD_REQUEST");
    });

    it("should submit check successfully for Staff", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const checksQuery = createChainableMock({
        data: {
          id: "check-new",
          store_id: STORE_UUID,
          template_id: null,
          completed_by: "user-123",
          completed_at: "2026-02-20T10:00:00Z",
          status: "pass",
          notes: "All good",
          items: validCheckBody.items,
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_checks") return checksQuery;
        return checksQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/checks`,
        validCheckBody,
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it("should submit check successfully for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const checksQuery = createChainableMock({
        data: {
          id: "check-owner",
          store_id: STORE_UUID,
          template_id: null,
          completed_by: "user-123",
          completed_at: "2026-02-20T10:00:00Z",
          status: "pass",
          notes: "All good",
          items: validCheckBody.items,
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_checks") return checksQuery;
        return checksQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/checks/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/checks`,
        validCheckBody,
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });
});
