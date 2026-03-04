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

function setupAuthenticatedUser(role: string, storeId: string) {
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

describe("HACCP Corrective Actions API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const STORE_UUID = "11111111-1111-4111-a111-111111111111";
  const ACTION_UUID = "22222222-2222-4222-a222-222222222222";

  describe("GET /api/stores/[storeId]/haccp/corrective-actions", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(401);
    });

    it("should return corrective actions list for authenticated user", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const actionsQuery = createChainableMock({
        data: [
          {
            id: ACTION_UUID,
            store_id: STORE_UUID,
            description: "Fridge temperature above safe range",
            check_id: null,
            temp_log_id: null,
            action_taken: null,
            resolved_at: null,
            resolved_by: null,
            created_at: "2026-02-20T10:00:00Z",
            created_by: "user-123",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_corrective_actions") return actionsQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].description).toBe(
        "Fridge temperature above safe range",
      );
    });

    it("should filter unresolved_only", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const actionsQuery = createChainableMock({
        data: [
          {
            id: ACTION_UUID,
            store_id: STORE_UUID,
            description: "Fridge temperature above safe range",
            check_id: null,
            temp_log_id: null,
            action_taken: null,
            resolved_at: null,
            resolved_by: null,
            created_at: "2026-02-20T10:00:00Z",
            created_by: "user-123",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_corrective_actions") return actionsQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
        undefined,
        {
          unresolved_only: "true",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Verify the is filter was applied for unresolved (resolved_at is null)
      expect(actionsQuery.is).toHaveBeenCalled();
    });
  });

  describe("POST /api/stores/[storeId]/haccp/corrective-actions", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
        {
          description: "Fridge temperature above safe range",
          check_id: null,
          temp_log_id: null,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(401);
    });

    it("should return 400 for short description", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
        {
          description: "Hi",
          check_id: null,
          temp_log_id: null,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(400);
    });

    it("should create corrective action successfully", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const insertQuery = createChainableMock({
        data: {
          id: ACTION_UUID,
          store_id: STORE_UUID,
          description: "Fridge temperature above safe range",
          check_id: null,
          temp_log_id: null,
          action_taken: null,
          resolved_at: null,
          resolved_by: null,
          created_at: "2026-02-20T10:00:00Z",
          created_by: "user-123",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_corrective_actions") return insertQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions`,
        {
          description: "Fridge temperature above safe range",
          check_id: null,
          temp_log_id: null,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.description).toBe("Fridge temperature above safe range");
    });
  });

  describe("PUT /api/stores/[storeId]/haccp/corrective-actions/[actionId]", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { PUT } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/[actionId]/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions/${ACTION_UUID}`,
        {
          action_taken:
            "Moved items to backup fridge and called repair service",
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID, actionId: ACTION_UUID }),
      });
      expect(response.status).toBe(401);
    });

    it("should return 403 for Staff", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      const { PUT } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/[actionId]/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions/${ACTION_UUID}`,
        {
          action_taken:
            "Moved items to backup fridge and called repair service",
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID, actionId: ACTION_UUID }),
      });
      expect(response.status).toBe(403);
    });

    it("should return 400 for short action_taken", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      const { PUT } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/[actionId]/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions/${ACTION_UUID}`,
        {
          action_taken: "Fix",
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID, actionId: ACTION_UUID }),
      });
      expect(response.status).toBe(400);
    });

    it("should resolve action successfully for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const updateQuery = createChainableMock({
        data: {
          id: ACTION_UUID,
          store_id: STORE_UUID,
          description: "Fridge temperature above safe range",
          check_id: null,
          temp_log_id: null,
          action_taken:
            "Moved items to backup fridge and called repair service",
          resolved_at: "2026-02-20T12:00:00Z",
          resolved_by: "user-123",
          created_at: "2026-02-20T10:00:00Z",
          created_by: "user-123",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_corrective_actions") return updateQuery;
        return storeUsersQuery;
      });

      const { PUT } =
        await import("@/app/api/stores/[storeId]/haccp/corrective-actions/[actionId]/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/haccp/corrective-actions/${ACTION_UUID}`,
        {
          action_taken:
            "Moved items to backup fridge and called repair service",
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID, actionId: ACTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.action_taken).toBe(
        "Moved items to backup fridge and called repair service",
      );
      expect(data.data.resolved_by).toBe("user-123");
    });
  });
});
