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

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: object,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL("http://localhost:3000/api/shifts");
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

// Setup authenticated user with specific role
function setupAuthenticatedUser(role: string, storeId: string = "store-1") {
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

describe("Shifts API Integration Tests", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("GET /api/shifts", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { GET } = await import("@/app/api/shifts/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Authorized Requests", () => {
      it("should return shifts list", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const shiftsQuery = createChainableMock({
          data: [
            {
              id: "shift-1",
              store_id: "store-1",
              user_id: "user-456",
              start_time: "2025-01-15T09:00:00Z",
              end_time: "2025-01-15T17:00:00Z",
              store: { id: "store-1", name: "Test Store" },
              user: { id: "user-456", full_name: "John Doe" },
            },
          ],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQuery;
          return shiftsQuery;
        });

        const { GET } = await import("@/app/api/shifts/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it("should filter by store_id", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const shiftsQuery = createChainableMock({
          data: [],
          count: 0,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return shiftsQuery;
        });

        const { GET } = await import("@/app/api/shifts/route");

        const request = createMockRequest("GET", undefined, {
          store_id: "store-1",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it("should filter by date range", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const shiftsQuery = createChainableMock({
          data: [],
          count: 0,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return shiftsQuery;
        });

        const { GET } = await import("@/app/api/shifts/route");

        const request = createMockRequest("GET", undefined, {
          start_date: "2025-01-01",
          end_date: "2025-01-31",
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe("Staff Role Restrictions", () => {
      it("should return shifts for Staff", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const shiftsQuery = createChainableMock({
          data: [
            {
              id: "shift-1",
              store_id: "store-1",
              user_id: "user-123",
              start_time: "2025-01-15T09:00:00Z",
              end_time: "2025-01-15T17:00:00Z",
            },
          ],
          count: 1,
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQuery;
          return shiftsQuery;
        });

        const { GET } = await import("@/app/api/shifts/route");

        const request = createMockRequest("GET");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });
  });

  describe("POST /api/shifts", () => {
    describe("Authorization", () => {
      it("should return 403 for Staff users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const request = createMockRequest("POST", {
          store_id: "store-1",
          user_id: "user-456",
          start_time: futureDate.toISOString(),
          end_time: new Date(
            futureDate.getTime() + 8 * 60 * 60 * 1000,
          ).toISOString(),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.code).toBe("FORBIDDEN");
      });
    });

    describe("Validation", () => {
      it("should return 400 for missing required fields", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const request = createMockRequest("POST", {
          user_id: "user-456",
          start_time: futureDate.toISOString(),
          end_time: new Date(
            futureDate.getTime() + 8 * 60 * 60 * 1000,
          ).toISOString(),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.code).toBe("BAD_REQUEST");
      });

      it("should return 400 for invalid time format", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const request = createMockRequest("POST", {
          store_id: "store-1",
          user_id: "user-456",
          start_time: "not-a-date",
          end_time: "also-not-a-date",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
      });
    });

    describe("Successful Creation", () => {
      // Use valid UUID format (RFC 4122 compliant - version 4, variant a)
      const STORE_UUID = "11111111-1111-4111-a111-111111111111";
      const USER_UUID = "22222222-2222-4222-a222-222222222222";
      const USER_UUID_2 = "33333333-3333-4333-a333-333333333333";

      it("should create shift for Owner", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          STORE_UUID,
        );

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000);

        // Create a chainable mock for overlap check query
        const overlapCheckResult = { data: [], error: null };
        const overlapCheckQuery = createChainableMock(overlapCheckResult);

        // Create a chainable mock for insert query that returns shift data via .single()
        const insertResultData = {
          id: "new-shift-123",
          store_id: STORE_UUID,
          user_id: USER_UUID,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
          store: { id: STORE_UUID, name: "Test Store" },
          user: { id: USER_UUID, full_name: "John Doe" },
        };
        const insertQuery = createChainableMock({
          data: insertResultData,
          error: null,
        });

        // Track which operation is being performed
        let isInsertOperation = false;
        const shiftsQueryHandler = {
          select: vi.fn().mockImplementation(() => {
            if (isInsertOperation) {
              return insertQuery;
            }
            return overlapCheckQuery;
          }),
          insert: vi.fn().mockImplementation(() => {
            isInsertOperation = true;
            return shiftsQueryHandler;
          }),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(overlapCheckResult).then(resolve),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQueryHandler;
          return shiftsQueryHandler;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const request = createMockRequest("POST", {
          store_id: STORE_UUID,
          user_id: USER_UUID,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe("new-shift-123");
      });

      it("should create shift for Manager", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Manager",
          STORE_UUID,
        );

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000);

        // Create a chainable mock for overlap check query
        const overlapCheckResult = { data: [], error: null };
        const overlapCheckQuery = createChainableMock(overlapCheckResult);

        // Create a chainable mock for insert query that returns shift data via .single()
        const insertResultData = {
          id: "new-shift-456",
          store_id: STORE_UUID,
          user_id: USER_UUID_2,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
        };
        const insertQuery = createChainableMock({
          data: insertResultData,
          error: null,
        });

        // Track which operation is being performed
        let isInsertOperation = false;
        const shiftsQueryHandler = {
          select: vi.fn().mockImplementation(() => {
            if (isInsertOperation) {
              return insertQuery;
            }
            return overlapCheckQuery;
          }),
          insert: vi.fn().mockImplementation(() => {
            isInsertOperation = true;
            return shiftsQueryHandler;
          }),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(overlapCheckResult).then(resolve),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQueryHandler;
          return shiftsQueryHandler;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const request = createMockRequest("POST", {
          store_id: STORE_UUID,
          user_id: USER_UUID_2,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
      });
    });
  });
});
