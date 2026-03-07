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

vi.mock("@/lib/services/notifications", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/format-shift", () => ({
  formatShiftDate: vi
    .fn()
    .mockReturnValue({ date: "Jan 15, 2026", dayOfWeek: "Thursday" }),
  formatShiftTime: vi.fn().mockReturnValue("09:00 AM"),
  calculateDuration: vi.fn().mockReturnValue("8h 0m"),
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

// Use valid UUID format (RFC 4122 compliant - version 4, variant a)
const STORE_UUID = "11111111-1111-4111-a111-111111111111";
const USER_UUID = "22222222-2222-4222-a222-222222222222";
const MANAGER_UUID = "33333333-3333-4333-a333-333333333333";

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
function setupAuthenticatedUser(role: string, storeId: string = STORE_UUID) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: MANAGER_UUID, email: "manager@example.com" } },
    error: null,
  });

  const profileQuery = createChainableMock({
    data: {
      id: MANAGER_UUID,
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
        user_id: MANAGER_UUID,
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
      it("should return shifts list with expected shape", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const shiftsQuery = createChainableMock({
          data: [
            {
              id: "shift-1",
              store_id: STORE_UUID,
              user_id: USER_UUID,
              start_time: "2026-01-15T09:00:00Z",
              end_time: "2026-01-15T17:00:00Z",
              store: { id: STORE_UUID, name: "Test Store" },
              user: { id: USER_UUID, full_name: "John Doe" },
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
        // Verify response body shape includes nested store and user data
        expect(data.data[0]).toMatchObject({
          id: "shift-1",
          store_id: STORE_UUID,
          user_id: USER_UUID,
          start_time: "2026-01-15T09:00:00Z",
          end_time: "2026-01-15T17:00:00Z",
          store: { id: STORE_UUID, name: "Test Store" },
          user: { id: USER_UUID, full_name: "John Doe" },
        });
      });

      it("should apply store_id eq filter when store_id param is provided", async () => {
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
          store_id: STORE_UUID,
        });
        const response = await GET(request);

        expect(response.status).toBe(200);
        // Verify eq filter was applied for the specific store
        expect(shiftsQuery.eq).toHaveBeenCalledWith("store_id", STORE_UUID);
      });

      it("should apply date range filters using gte and lte", async () => {
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
          start_date: "2026-01-01",
          end_date: "2026-01-31",
        });
        const response = await GET(request);

        expect(response.status).toBe(200);
        // Verify date range filters were applied
        expect(shiftsQuery.gte).toHaveBeenCalledWith(
          "start_time",
          "2026-01-01T00:00:00.000Z",
        );
        expect(shiftsQuery.lte).toHaveBeenCalledWith(
          "end_time",
          "2026-01-31T23:59:59.999Z",
        );
      });
    });

    describe("Staff Role Restrictions", () => {
      it("should scope Staff query to their own user_id", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        const shiftsQuery = createChainableMock({
          data: [
            {
              id: "shift-1",
              store_id: STORE_UUID,
              user_id: MANAGER_UUID,
              start_time: "2026-01-15T09:00:00Z",
              end_time: "2026-01-15T17:00:00Z",
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

        expect(response.status).toBe(200);
        // Verify Staff can only see their own shifts
        expect(shiftsQuery.eq).toHaveBeenCalledWith("user_id", MANAGER_UUID);
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
          store_id: STORE_UUID,
          user_id: USER_UUID,
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
      it("should return 400 for missing store_id", async () => {
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
          user_id: USER_UUID,
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
          store_id: STORE_UUID,
          user_id: USER_UUID,
          start_time: "not-a-date",
          end_time: "also-not-a-date",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
      });
    });

    describe("Business Rules", () => {
      it("should return 400 when shift overlaps with an existing shift", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          STORE_UUID,
        );

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000);

        // Overlap check returns an existing conflicting shift
        const overlapCheckQuery = createChainableMock({
          data: [
            {
              id: "existing-shift-999",
              start_time: futureDate.toISOString(),
              end_time: endTime.toISOString(),
            },
          ],
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return overlapCheckQuery;
          return overlapCheckQuery;
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

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
        expect(data.message).toContain("already has a shift");
      });
    });

    describe("Successful Creation", () => {
      it("should insert shift with correct payload and write audit log for Owner", async () => {
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Owner",
          STORE_UUID,
        );

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000);

        const overlapCheckResult = { data: [], error: null };
        const overlapCheckQuery = createChainableMock(overlapCheckResult);

        const insertResultData = {
          id: "new-shift-123",
          store_id: STORE_UUID,
          user_id: USER_UUID,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
          notes: null,
          store: { id: STORE_UUID, name: "Test Store" },
          user: {
            id: USER_UUID,
            full_name: "John Doe",
            email: "john@example.com",
          },
        };
        const insertQuery = createChainableMock({
          data: insertResultData,
          error: null,
        });

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

        // Manager profile for notification lookup
        const managerProfileQuery = createChainableMock({
          data: { full_name: "Manager Name" },
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") {
            // First profile call is auth check; subsequent is notification lookup
            return profileQuery;
          }
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQueryHandler;
          return managerProfileQuery;
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
        // Verify response body contains full shift data with nested relations
        expect(data.data).toMatchObject({
          id: "new-shift-123",
          store_id: STORE_UUID,
          user_id: USER_UUID,
          store: { id: STORE_UUID, name: "Test Store" },
          user: { full_name: "John Doe" },
        });

        // Verify INSERT was called with correct shift fields
        expect(shiftsQueryHandler.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            store_id: STORE_UUID,
            user_id: USER_UUID,
            start_time: futureDate.toISOString(),
            end_time: endTime.toISOString(),
          }),
        );

        // Verify audit log recorded the shift creation with employee details
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: "shift.create",
            storeId: STORE_UUID,
            resourceType: "shift",
            resourceId: "new-shift-123",
            details: expect.objectContaining({
              employeeId: USER_UUID,
              startTime: futureDate.toISOString(),
              endTime: endTime.toISOString(),
            }),
          }),
        );
      });

      it("should insert shift and write audit log for Manager", async () => {
        const EMPLOYEE_UUID = "44444444-4444-4444-a444-444444444444";
        const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
          "Manager",
          STORE_UUID,
        );

        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endTime = new Date(futureDate.getTime() + 8 * 60 * 60 * 1000);

        const overlapCheckResult = { data: [], error: null };
        const overlapCheckQuery = createChainableMock(overlapCheckResult);

        const insertResultData = {
          id: "new-shift-456",
          store_id: STORE_UUID,
          user_id: EMPLOYEE_UUID,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
          notes: null,
          store: { id: STORE_UUID, name: "Test Store" },
          user: {
            id: EMPLOYEE_UUID,
            full_name: "Jane Smith",
            email: "jane@example.com",
          },
        };
        const insertQuery = createChainableMock({
          data: insertResultData,
          error: null,
        });

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

        const managerProfileQuery = createChainableMock({
          data: { full_name: "Manager Name" },
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          if (table === "shifts") return shiftsQueryHandler;
          return managerProfileQuery;
        });

        const { POST } = await import("@/app/api/shifts/route");

        const request = createMockRequest("POST", {
          store_id: STORE_UUID,
          user_id: EMPLOYEE_UUID,
          start_time: futureDate.toISOString(),
          end_time: endTime.toISOString(),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          id: "new-shift-456",
          store_id: STORE_UUID,
          user_id: EMPLOYEE_UUID,
        });

        // Verify INSERT included correct store and user IDs
        expect(shiftsQueryHandler.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            store_id: STORE_UUID,
            user_id: EMPLOYEE_UUID,
          }),
        );

        // Verify audit log recorded the Manager's action
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: "shift.create",
            storeId: STORE_UUID,
            resourceType: "shift",
            resourceId: "new-shift-456",
          }),
        );
      });
    });
  });
});
