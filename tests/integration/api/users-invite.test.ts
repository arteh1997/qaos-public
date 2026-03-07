import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoist mock reference so we can assert on it after the mock is applied
const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// Mock crypto for deterministic token generation
vi.mock("crypto", () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => "mock-secure-token-12345"),
    })),
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

const mockAdminClient = {
  auth: {
    admin: {
      listUsers: vi.fn(),
    },
  },
  from: vi.fn(
    (_table: string): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
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
    remaining: 9,
    resetTime: Date.now() + 60000,
    limit: 10,
  })),
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60000 },
    createUser: { limit: 10, windowMs: 60000 },
  },
  getRateLimitHeaders: vi.fn(() => ({})),
}));

// Mock email
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
  getInviteEmailHtml: vi.fn(() => "<html>Invite Email</html>"),
  getAddedToStoreEmailHtml: vi.fn(() => "<html>Added to Store Email</html>"),
}));

// Mock audit log — use hoisted ref so we can assert on calls
vi.mock("@/lib/audit", () => ({
  auditLog: mockAuditLog,
  computeFieldChanges: vi.fn().mockReturnValue([]),
}));

// Mock CSRF validation
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

// Helper to create mock NextRequest
function createMockRequest(method: string, body?: object): NextRequest {
  const url = new URL("http://localhost:3000/api/users/invite");

  return {
    method,
    nextUrl: url,
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
    data: { user: { id: "inviter-123", email: "inviter@example.com" } },
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
                store_id: "store-1",
                user_id: "inviter-123",
                role,
                is_billing_owner: role === "Owner",
                store: { id: "store-1", name: "Test Store", is_active: true },
              },
            ],
      error: null,
    }),
  };

  return { profileQuery, storeUsersQuery };
}

describe("Users Invite API Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/users/invite", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newuser@example.com",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Authorization", () => {
      it("should return 403 for Staff users", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Staff");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newuser@example.com",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.code).toBe("FORBIDDEN");
      });
    });

    describe("Validation", () => {
      beforeEach(() => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });
      });

      it("should return 400 for invalid email", async () => {
        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "not-an-email",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.code).toBe("BAD_REQUEST");
      });

      it("should return 400 for missing role", async () => {
        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newuser@example.com",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
      });

      it("should return 400 for invalid role", async () => {
        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newuser@example.com",
          role: "SuperAdmin", // Invalid role
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe("BAD_REQUEST");
      });
    });

    describe("Business Rules", () => {
      it("should prevent self-invitation", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const inviterRoleQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "Owner" },
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.from.mockImplementation(() => inviterRoleQuery);

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "inviter@example.com", // Same as authenticated user
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toContain("cannot invite yourself");
      });

      it("should prevent Manager from inviting Owner", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Manager");

        const inviterRoleQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "Manager" },
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.from.mockImplementation(() => inviterRoleQuery);
        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: { users: [] },
          error: null,
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newowner@example.com",
          role: "Owner", // Manager cannot invite Owner
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.message).toContain("don't have permission");
      });
    });

    describe("Existing User Handling", () => {
      it("should return error if user has pending invitation", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const inviterRoleQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "Owner" },
            error: null,
          }),
        };

        const existingProfileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "existing-user-1", status: "Invited" },
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return existingProfileQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: {
            users: [{ id: "existing-user-1", email: "existing@example.com" }],
          },
          error: null,
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "existing@example.com",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toContain("pending invitation");
      });
    });

    describe("Duplicate Invite Detection", () => {
      it("should return error if active invite already exists", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const inviterRoleQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "Owner" },
            error: null,
          }),
        };

        const existingInviteQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "invite-1",
              email: "newuser@example.com",
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            },
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.from.mockImplementation((table: string) => {
          if (table === "user_invites") return existingInviteQuery;
          if (table === "profiles")
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { full_name: "Inviter" },
                error: null,
              }),
            };
          return inviterRoleQuery;
        });

        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: { users: [] },
          error: null,
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newuser@example.com",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toContain("active invitation already exists");
      });
    });

    describe("Successful New User Invitation", () => {
      it("should insert invite record with correct fields and write audit log", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        const inviterRoleQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "Owner" },
            error: null,
          }),
        };

        // Capture the insert mock so we can assert on it
        const userInvitesInsertMock = vi
          .fn()
          .mockResolvedValue({ data: null, error: null });
        const userInvitesQuery = {
          select: vi.fn().mockReturnThis(),
          insert: userInvitesInsertMock,
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          // No existing invite found
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        };

        const storeDetailsQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "store-1", name: "Test Store" },
            error: null,
          }),
        };

        const inviterProfileQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { full_name: "Store Owner", email: "inviter@example.com" },
            error: null,
          }),
        };

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return inviterRoleQuery;
        });

        mockAdminClient.from.mockImplementation((table: string) => {
          if (table === "user_invites") return userInvitesQuery;
          if (table === "stores") return storeDetailsQuery;
          if (table === "profiles") return inviterProfileQuery;
          return inviterRoleQuery;
        });

        // No existing user with this email
        mockAdminClient.auth.admin.listUsers.mockResolvedValue({
          data: { users: [] },
          error: null,
        });

        const { POST } = await import("@/app/api/users/invite/route");

        const request = createMockRequest("POST", {
          email: "newstaff@example.com",
          role: "Staff",
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data).toMatchObject({
          message: "Invitation sent successfully",
          email: "newstaff@example.com",
        });
        // Verify expires_at is returned
        expect(data.data.expiresAt).toBeDefined();

        // Verify invite record was inserted with correct fields
        expect(userInvitesInsertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "newstaff@example.com",
            role: "Staff",
            store_id: "store-1",
            invited_by: "inviter-123",
            token: expect.any(String),
            expires_at: expect.any(String),
          }),
        );

        // Verify audit log was written with correct invitation metadata
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            action: "user.invite",
            storeId: "store-1",
            resourceType: "user_invite",
            details: expect.objectContaining({
              invitedEmail: "newstaff@example.com",
              role: "Staff",
            }),
          }),
        );
      });
    });
  });
});
