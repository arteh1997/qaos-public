import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock admin client
const mockAdminClient = {
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// Mock audit log
vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(() => Promise.resolve()),
  computeFieldChanges: vi.fn().mockReturnValue([]),
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
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock CSRF validation
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

// Helper to create mock NextRequest
function createMockRequest(method: string, body?: object): NextRequest {
  const url = new URL("http://localhost:3000/api/shifts/shift-123");

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

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(role: string, stores: object[] = []) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        role,
        store_id: null,
        is_platform_admin: false,
        default_store_id: null,
      },
      error: null,
    }),
  };

  const storeUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data:
        stores.length > 0
          ? stores
          : [
              {
                id: "su-1",
                store_id: "store-123",
                user_id: "user-123",
                role,
                is_billing_owner: role === "Owner",
                store: { id: "store-123", name: "Test Store", is_active: true },
              },
            ],
      error: null,
    }),
  };

  return { profileQuery, storeUsersQuery };
}

describe("Shift Detail API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/shifts/:shiftId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { GET } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return shift for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const shiftQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "shift-123",
            user_id: "user-456",
            store_id: "store-123",
            start_time: "2025-01-15T09:00:00Z",
            end_time: "2025-01-15T17:00:00Z",
            store: { id: "store-123", name: "Test Store" },
            user: {
              id: "user-456",
              full_name: "John Doe",
              email: "john@example.com",
            },
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { GET } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("shift-123");
    });

    it("should return 404 when shift not found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const shiftQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { GET } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ shiftId: "nonexistent" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe("NOT_FOUND");
    });

    it("should return 403 when Staff tries to view another user shift", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      const shiftQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "shift-123",
            user_id: "other-user-456", // Different user
            store_id: "store-123",
            start_time: "2025-01-15T09:00:00Z",
            end_time: "2025-01-15T17:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { GET } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should allow Staff to view their own shift", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      const shiftQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "shift-123",
            user_id: "user-123", // Same user
            store_id: "store-123",
            start_time: "2025-01-15T09:00:00Z",
            end_time: "2025-01-15T17:00:00Z",
          },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { GET } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("PATCH /api/shifts/:shiftId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { PATCH } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("PATCH", { notes: "Updated notes" });
      const response = await PATCH(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 for Staff users", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PATCH } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("PATCH", { notes: "Updated notes" });
      const response = await PATCH(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should allow Owner to update shift schedule", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // Setup admin client for fetching existing shift
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "shifts") {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            gt: vi.fn().mockResolvedValue({
              data: [], // No overlapping shifts
              error: null,
            }),
            single: vi
              .fn()
              .mockResolvedValueOnce({
                data: {
                  id: "shift-123",
                  user_id: "user-456",
                  store_id: "store-123",
                  start_time: "2025-01-15T09:00:00Z",
                  end_time: "2025-01-15T17:00:00Z",
                  store: { id: "store-123", name: "Test Store" },
                  user: {
                    id: "user-456",
                    full_name: "John Doe",
                    email: "john@example.com",
                  },
                },
                error: null,
              })
              .mockResolvedValueOnce({
                data: {
                  id: "shift-123",
                  user_id: "user-456",
                  store_id: "store-123",
                  start_time: "2025-01-15T10:00:00Z",
                  end_time: "2025-01-15T18:00:00Z",
                  notes: "Updated shift",
                },
                error: null,
              }),
          };
        }
        return mockAdminClient.from("");
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PATCH } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("PATCH", {
        start_time: "2025-01-15T10:00:00Z",
        end_time: "2025-01-15T18:00:00Z",
        notes: "Updated shift",
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });

      expect(response.status).toBe(200);
    });

    it("should allow clock time correction", async () => {
      const { profileQuery, storeUsersQuery } =
        setupAuthenticatedUser("Manager");

      // Setup admin client
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "shifts") {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValueOnce({
                data: {
                  id: "shift-123",
                  user_id: "user-456",
                  store_id: "store-123",
                  start_time: "2025-01-15T09:00:00Z",
                  end_time: "2025-01-15T17:00:00Z",
                  clock_in_time: null,
                  clock_out_time: null,
                  store: { id: "store-123", name: "Test Store" },
                  user: {
                    id: "user-456",
                    full_name: "John Doe",
                    email: "john@example.com",
                  },
                },
                error: null,
              })
              .mockResolvedValueOnce({
                data: {
                  id: "shift-123",
                  clock_in_time: "2025-01-15T09:05:00Z",
                  clock_out_time: "2025-01-15T17:10:00Z",
                },
                error: null,
              }),
          };
        }
        return mockAdminClient.from("");
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PATCH } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("PATCH", {
        clock_in_time: "2025-01-15T09:05:00Z",
        clock_out_time: "2025-01-15T17:10:00Z",
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });

      expect(response.status).toBe(200);
    });

    it("should reject clock times too far from scheduled shift", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      // Setup admin client
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "shifts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "shift-123",
                user_id: "user-456",
                store_id: "store-123",
                start_time: "2025-01-15T09:00:00Z",
                end_time: "2025-01-15T17:00:00Z",
              },
              error: null,
            }),
          };
        }
        return mockAdminClient.from("");
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PATCH } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("PATCH", {
        clock_in_time: "2025-01-14T01:00:00Z", // Way too early (8+ hours before)
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("BAD_REQUEST");
      expect(data.message).toContain("too far from");
    });
  });

  describe("DELETE /api/shifts/:shiftId", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { DELETE } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 for Staff users", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Staff");

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { DELETE } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("FORBIDDEN");
    });

    it("should delete shift for Owner", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser("Owner");

      const shiftQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { DELETE } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
    });

    it("should delete shift for Manager", async () => {
      const { profileQuery, storeUsersQuery } =
        setupAuthenticatedUser("Manager");

      const shiftQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "shifts") return shiftQuery;
        return shiftQuery;
      });

      const { DELETE } = await import("@/app/api/shifts/[shiftId]/route");

      const request = createMockRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ shiftId: "shift-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
