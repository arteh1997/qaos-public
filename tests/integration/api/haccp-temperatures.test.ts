import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Valid UUID for testing (RFC 4122 compliant - version 4, variant a)
const STORE_UUID = "11111111-1111-4111-a111-111111111111";

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

describe("HACCP Temperature Logs API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/stores/[storeId]/haccp/temperature-logs", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return temperature logs for authenticated user", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const tempLogsQuery = createChainableMock({
        data: [
          {
            id: "tl-1",
            store_id: STORE_UUID,
            location_name: "Walk-in Fridge",
            temperature_celsius: 4.5,
            is_in_range: true,
            min_temp: 2,
            max_temp: 8,
            recorded_by: "user-123",
            recorded_at: "2026-02-25T10:00:00Z",
          },
          {
            id: "tl-2",
            store_id: STORE_UUID,
            location_name: "Freezer",
            temperature_celsius: -18,
            is_in_range: true,
            min_temp: -25,
            max_temp: -15,
            recorded_by: "user-123",
            recorded_at: "2026-02-25T09:00:00Z",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogsQuery;
        return profileQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].location_name).toBe("Walk-in Fridge");
      expect(data.data[1].location_name).toBe("Freezer");
    });

    it("should filter by out_of_range_only", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const tempLogsQuery = createChainableMock({
        data: [
          {
            id: "tl-3",
            store_id: STORE_UUID,
            location_name: "Walk-in Fridge",
            temperature_celsius: 12,
            is_in_range: false,
            min_temp: 2,
            max_temp: 8,
            recorded_by: "user-123",
            recorded_at: "2026-02-25T08:00:00Z",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogsQuery;
        return profileQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        undefined,
        {
          out_of_range_only: "true",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Verify the eq filter was applied for is_in_range
      expect(tempLogsQuery.eq).toHaveBeenCalled();
    });

    it("should filter by location", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const tempLogsQuery = createChainableMock({
        data: [
          {
            id: "tl-1",
            store_id: STORE_UUID,
            location_name: "Walk-in Fridge",
            temperature_celsius: 4.5,
            is_in_range: true,
            min_temp: 2,
            max_temp: 8,
            recorded_by: "user-123",
            recorded_at: "2026-02-25T10:00:00Z",
          },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogsQuery;
        return profileQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        undefined,
        {
          location: "Walk-in Fridge",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Verify the eq filter was applied for location_name
      expect(tempLogsQuery.eq).toHaveBeenCalled();
    });
  });

  describe("POST /api/stores/[storeId]/haccp/temperature-logs", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        {
          location_name: "Walk-in Fridge",
          temperature_celsius: 4.5,
          min_temp: 2,
          max_temp: 8,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 for missing location_name", async () => {
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
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        {
          temperature_celsius: 4.5,
          min_temp: 2,
          max_temp: 8,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("BAD_REQUEST");
    });

    it("should log temperature in range (temp=5, min=2, max=8)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      const tempLogQuery = createChainableMock({
        data: {
          id: "tl-1",
          store_id: STORE_UUID,
          location_name: "Walk-in Fridge",
          temperature_celsius: 5,
          is_in_range: true,
          min_temp: 2,
          max_temp: 8,
          recorded_by: "user-123",
          recorded_at: "2026-02-25T10:00:00Z",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogQuery;
        return profileQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        {
          location_name: "Walk-in Fridge",
          temperature_celsius: 5,
          min_temp: 2,
          max_temp: 8,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.is_in_range).toBe(true);
      expect(data.data.temperature_celsius).toBe(5);
      expect(data.data.location_name).toBe("Walk-in Fridge");
    });

    it("should log temperature out of range (temp=12, min=2, max=8)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const tempLogQuery = createChainableMock({
        data: {
          id: "tl-2",
          store_id: STORE_UUID,
          location_name: "Walk-in Fridge",
          temperature_celsius: 12,
          is_in_range: false,
          min_temp: 2,
          max_temp: 8,
          recorded_by: "user-123",
          recorded_at: "2026-02-25T10:00:00Z",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogQuery;
        return profileQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        {
          location_name: "Walk-in Fridge",
          temperature_celsius: 12,
          min_temp: 2,
          max_temp: 8,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.is_in_range).toBe(false);
      expect(data.data.temperature_celsius).toBe(12);
    });

    it("should log temperature without bounds (is_in_range defaults to true)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const tempLogQuery = createChainableMock({
        data: {
          id: "tl-3",
          store_id: STORE_UUID,
          location_name: "Prep Area",
          temperature_celsius: 20,
          is_in_range: true,
          min_temp: null,
          max_temp: null,
          recorded_by: "user-123",
          recorded_at: "2026-02-25T10:00:00Z",
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "haccp_temperature_logs") return tempLogQuery;
        return profileQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/haccp/temperature-logs/route");

      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/haccp/temperature-logs`,
        {
          location_name: "Prep Area",
          temperature_celsius: 20,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.is_in_range).toBe(true);
      expect(data.data.min_temp).toBeNull();
      expect(data.data.max_temp).toBeNull();
    });
  });
});
