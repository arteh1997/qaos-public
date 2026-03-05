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
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  ),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock Stripe server functions
vi.mock("@/lib/stripe/server", () => ({
  getOrCreateCustomer: vi.fn(),
  createSetupIntent: vi.fn(),
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
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
    billing: { limit: 10, windowMs: 60000 },
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

// Helper to setup authenticated user with specific role
function setupAuthenticatedUser(
  role: string,
  options: { isBillingOwner?: boolean; stores?: object[] } = {},
) {
  const { isBillingOwner = role === "Owner", stores } = options;

  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  });

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        role,
        store_id: null,
        is_platform_admin: false,
        default_store_id: null,
        stripe_customer_id: "cus_existing123",
      },
      error: null,
    }),
  };

  const storeUsersQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: stores || [
        {
          id: "su-1",
          store_id: "store-1",
          user_id: "user-123",
          role,
          is_billing_owner: isBillingOwner,
          store: { id: "store-1", name: "Test Store", is_active: true },
        },
      ],
      error: null,
    }),
  };

  return { profileQuery, storeUsersQuery };
}

describe("Billing API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/billing/setup-intent", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { POST } = await import("@/app/api/billing/setup-intent/route");

        const request = createMockRequest("POST", "/api/billing/setup-intent", {
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Successful Setup Intent", () => {
      it("should create setup intent for authenticated user", async () => {
        const { profileQuery, storeUsersQuery } =
          setupAuthenticatedUser("Owner");

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === "profiles") return profileQuery;
          if (table === "store_users") return storeUsersQuery;
          return profileQuery;
        });

        // Import mocked stripe functions
        const { getOrCreateCustomer, createSetupIntent } =
          await import("@/lib/stripe/server");
        const mockedGetOrCreateCustomer = vi.mocked(getOrCreateCustomer);
        const mockedCreateSetupIntent = vi.mocked(createSetupIntent);

        mockedGetOrCreateCustomer.mockResolvedValue("cus_test123");
        mockedCreateSetupIntent.mockResolvedValue({
          id: "seti_test123",
          client_secret: "seti_test123_secret_abc",
        } as unknown as ReturnType<typeof createSetupIntent> extends Promise<
          infer T
        >
          ? T
          : never);

        const { POST } = await import("@/app/api/billing/setup-intent/route");

        const request = createMockRequest("POST", "/api/billing/setup-intent", {
          storeId: "store-1",
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.clientSecret).toBeDefined();
        expect(mockedGetOrCreateCustomer).toHaveBeenCalled();
        expect(mockedCreateSetupIntent).toHaveBeenCalledWith("cus_test123");
      });
    });
  });

  describe("GET /api/billing/subscriptions", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { GET } = await import("@/app/api/billing/subscriptions/route");

        const request = createMockRequest(
          "GET",
          "/api/billing/subscriptions",
          undefined,
          {
            storeId: "store-1",
          },
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });
  });

  describe("POST /api/billing/subscriptions", () => {
    describe("Authentication", () => {
      it("should return 401 when not authenticated", async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const { POST } = await import("@/app/api/billing/subscriptions/route");

        const request = createMockRequest(
          "POST",
          "/api/billing/subscriptions",
          {
            storeId: "store-1",
            paymentMethodId: "pm_test123",
          },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.code).toBe("UNAUTHORIZED");
      });
    });
  });
});
