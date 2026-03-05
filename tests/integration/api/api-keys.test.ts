import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
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
  RATE_LIMITS: { api: { limit: 100, windowMs: 60000 } },
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
  if (searchParams)
    Object.entries(searchParams).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    headers: new Headers(),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest;
}

const STORE_UUID = "11111111-1111-4111-a111-111111111111";

function setupAuthenticatedOwner() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "owner@example.com" } },
    error: null,
  });
  const profileQuery = createChainableMock({
    data: {
      id: "user-123",
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
        store_id: STORE_UUID,
        user_id: "user-123",
        role: "Owner",
        is_billing_owner: true,
        store: { id: STORE_UUID, name: "Test Store", is_active: true },
      },
    ],
    error: null,
  });
  return { profileQuery, storeUsersQuery };
}

describe("API Keys Management", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/stores/[storeId]/api-keys", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { GET } = await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/api-keys`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(401);
    });

    it("should return API keys for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();

      const keysQuery = createChainableMock({
        data: [
          {
            id: "key-1",
            name: "Production",
            key_prefix: "rk_live_a1b2",
            scopes: ["*"],
            is_active: true,
            last_used_at: null,
            expires_at: null,
            created_at: "2026-02-10",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "api_keys") return keysQuery;
        return storeUsersQuery;
      });

      const { GET } = await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/api-keys`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Production");
    });
  });

  describe("POST /api/stores/[storeId]/api-keys", () => {
    it("should create an API key for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();

      const insertQuery = createChainableMock({
        data: {
          id: "key-2",
          name: "Test Key",
          key_prefix: "rk_live_test",
          scopes: ["inventory:read"],
          expires_at: null,
          created_at: "2026-02-10",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "api_keys") return insertQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/api-keys`,
        {
          name: "Test Key",
          scopes: ["inventory:read"],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.key).toMatch(/^rk_live_/); // Full key returned at creation
    });

    it("should return 400 for missing name", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/api-keys`,
        {
          scopes: ["inventory:read"],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(400);
    });

    it("should return 400 for empty scopes", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/api-keys`,
        {
          name: "Key",
          scopes: [],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid scope", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/api-keys`,
        {
          name: "Key",
          scopes: ["nonexistent:scope"],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(400);
    });

    it("should return 403 for Staff", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-456", email: "staff@example.com" } },
        error: null,
      });
      const profileQuery = createChainableMock({
        data: {
          id: "user-456",
          role: "Staff",
          store_id: STORE_UUID,
          is_platform_admin: false,
          default_store_id: null,
        },
        error: null,
      });
      const storeUsersQuery = createChainableMock({
        data: [
          {
            id: "su-2",
            store_id: STORE_UUID,
            user_id: "user-456",
            role: "Staff",
            is_billing_owner: false,
            store: { id: STORE_UUID, name: "Store", is_active: true },
          },
        ],
        error: null,
      });
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/api-keys`,
        {
          name: "Key",
          scopes: ["*"],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/stores/[storeId]/api-keys", () => {
    it("should revoke an API key", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();

      const updateQuery = createChainableMock({ data: null, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "api_keys") return updateQuery;
        return storeUsersQuery;
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "DELETE",
        `/api/stores/${STORE_UUID}/api-keys`,
        undefined,
        { keyId: "key-1" },
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.revoked).toBe(true);
    });

    it("should return 400 without keyId", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedOwner();
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { DELETE } =
        await import("@/app/api/stores/[storeId]/api-keys/route");
      const request = createMockRequest(
        "DELETE",
        `/api/stores/${STORE_UUID}/api-keys`,
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(400);
    });
  });
});
