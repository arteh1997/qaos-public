import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock next/server with redirect support ──
vi.mock("next/server", async () => {
  const actual = (await vi.importActual("next/server")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((data: unknown, init?: ResponseInit) => ({
        json: async () => data,
        status: init?.status ?? 200,
        headers: new Map(
          Object.entries((init?.headers as Record<string, string>) ?? {}),
        ),
      })),
      redirect: vi.fn((url: string | URL, status?: number) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        return {
          status: status ?? 302,
          headers: new Headers({ location: urlStr }),
          json: async () => ({}),
        };
      }),
    },
  };
});

// ── Chainable Supabase mock ──

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

// ── Module mocks ──

const mockSupabaseClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

const mockAdminClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
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
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));
vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}));

// ── POS service mocks ──

const mockGetAdapter = vi.fn();
const mockProcessSaleEvent = vi.fn();
const mockValidateWebhookSignature = vi.fn();

vi.mock("@/lib/services/pos", () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
  processSaleEvent: (...args: unknown[]) => mockProcessSaleEvent(...args),
  validateWebhookSignature: (...args: unknown[]) =>
    mockValidateWebhookSignature(...args),
  POS_PROVIDERS: {
    square: {
      name: "Square",
      description: "Square POS",
      authType: "oauth2",
      region: "Global",
    },
    toast: {
      name: "Toast",
      description: "Toast POS",
      authType: "oauth2",
      region: "US",
    },
    clover: {
      name: "Clover",
      description: "Clover POS",
      authType: "oauth2",
      region: "Global",
    },
    lightspeed: {
      name: "Lightspeed",
      description: "Lightspeed POS",
      authType: "oauth2",
      region: "Global",
    },
    zettle: {
      name: "Zettle",
      description: "Zettle by PayPal",
      authType: "oauth2",
      region: "UK & EU",
    },
    sumup: {
      name: "SumUp",
      description: "SumUp POS",
      authType: "oauth2",
      region: "UK & EU",
    },
    epos_now: {
      name: "Epos Now",
      description: "Epos Now cloud POS",
      authType: "api_key",
      region: "UK",
    },
    tevalis: {
      name: "Tevalis",
      description: "Tevalis hospitality",
      authType: "api_key",
      region: "UK",
    },
    custom: {
      name: "Custom",
      description: "Custom POS via webhook",
      authType: "api_key",
      region: "Any",
    },
  },
}));

// ── Constants ──

const STORE_UUID = "11111111-1111-4111-a111-111111111111";
const OTHER_STORE_UUID = "99999999-9999-4999-a999-999999999999";
const CONNECTION_UUID = "cc111111-1111-4111-a111-111111111111";
const USER_ID = "user-123";

// ── Helpers ──

function createMockRequest(
  method: string,
  path: string,
  body?: object,
  searchParams?: Record<string, string>,
  headers?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (searchParams)
    Object.entries(searchParams).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  const reqHeaders = new Headers();
  if (headers)
    Object.entries(headers).forEach(([k, v]) => reqHeaders.set(k, v));
  return {
    method,
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve(body || {})),
    text: vi.fn(() => Promise.resolve(body ? JSON.stringify(body) : "")),
    headers: reqHeaders,
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  } as unknown as NextRequest;
}

function setupAuthenticatedUser(role: string, storeId: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: "test@example.com" } },
    error: null,
  });
  const profileQuery = createChainableMock({
    data: {
      id: USER_ID,
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
        user_id: USER_ID,
        role,
        is_billing_owner: role === "Owner",
        store: { id: storeId, name: "Test Store", is_active: true },
      },
    ],
    error: null,
  });
  return { profileQuery, storeUsersQuery };
}

function setupUnauthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

// ── Tests ──

describe("POS Expansion API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ================================================================
  // GET /api/integrations/pos/[provider]/auth — POS OAuth Initiation
  // ================================================================
  describe("GET /api/integrations/pos/[provider]/auth", () => {
    it("should return redirect for OAuth providers", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const insertQuery = createChainableMock({ data: null, error: null });
      mockAdminClient.from.mockImplementation(() => insertQuery);

      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        getAuthUrl: (storeId: string, stateToken: string) =>
          `https://connect.squareup.com/oauth2/authorize?state=${stateToken}&store=${storeId}`,
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      // redirect returns 302 via Response.redirect
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("squareup.com");
    });

    it("should return redirect for zettle OAuth provider", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const insertQuery = createChainableMock({ data: null, error: null });
      mockAdminClient.from.mockImplementation(() => insertQuery);

      mockGetAdapter.mockReturnValue({
        provider: "zettle",
        name: "Zettle",
        authType: "oauth2",
        getAuthUrl: (storeId: string, stateToken: string) =>
          `https://oauth.zettle.com/authorize?state=${stateToken}&store=${storeId}`,
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/zettle/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "zettle" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("zettle.com");
    });

    it("should return 400 for API-key providers (epos_now)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      // epos_now is api_key only — no getAuthUrl
      mockGetAdapter.mockReturnValue({
        provider: "epos_now",
        name: "Epos Now",
        authType: "api_key",
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
        // no getAuthUrl
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/epos_now/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "epos_now" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("does not support OAuth");
    });

    it("should return 400 for API-key providers (tevalis)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      mockGetAdapter.mockReturnValue({
        provider: "tevalis",
        name: "Tevalis",
        authType: "api_key",
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
        // no getAuthUrl
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/tevalis/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "tevalis" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("does not support OAuth");
    });

    it("should return 400 for unknown provider (null adapter)", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      mockGetAdapter.mockReturnValue(null);

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/unknown_provider/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "unknown_provider" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("does not support OAuth");
    });

    it("should return 400 if store_id is missing", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/auth",
        // no store_id in search params
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("store_id is required");
    });

    it("should return 403 if user does not have access to store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      // User has access to STORE_UUID, not OTHER_STORE_UUID
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/auth",
        undefined,
        { store_id: OTHER_STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toContain("do not have access");
    });

    it("should return 401 when not authenticated", async () => {
      setupUnauthenticatedUser();

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 500 when state insert fails", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const insertErrorQuery = createChainableMock({
        data: null,
        error: { message: "Insert failed", code: "23505" },
      });
      mockAdminClient.from.mockImplementation(() => insertErrorQuery);

      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        getAuthUrl: vi.fn(),
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/auth/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/auth",
        undefined,
        { store_id: STORE_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  // ================================================================
  // GET /api/integrations/pos/[provider]/callback — POS OAuth Callback
  // ================================================================
  describe("GET /api/integrations/pos/[provider]/callback", () => {
    it("should redirect with error when error param is present", async () => {
      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { error: "access_denied" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/integrations");
      expect(location).toContain("error=access_denied");
    });

    it("should redirect with error when code is missing", async () => {
      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { state: "some-state" }, // no code
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=missing_params");
    });

    it("should redirect with error when state is missing", async () => {
      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { code: "some-code" }, // no state
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=missing_params");
    });

    it("should redirect with error when both code and state are missing", async () => {
      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        // no search params at all
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=missing_params");
    });

    it("should redirect with error for invalid state token", async () => {
      // State lookup returns no match
      const stateQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });
      mockAdminClient.from.mockImplementation(() => stateQuery);

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { code: "auth-code", state: "invalid-state-token" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=invalid_state");
    });

    it("should redirect with error for expired state token", async () => {
      const expiredState = {
        id: "state-1",
        state_token: "expired-state",
        provider: "square",
        store_id: STORE_UUID,
        redirect_data: { store_id: STORE_UUID, provider: "square" },
        expires_at: new Date(Date.now() - 60000).toISOString(), // Expired 1 min ago
        used_at: null,
        created_by: USER_ID,
      };
      const stateQuery = createChainableMock({
        data: expiredState,
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => stateQuery);

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { code: "auth-code", state: "expired-state" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=state_expired");
    });

    it("should redirect to success on valid OAuth callback", async () => {
      const validState = {
        id: "state-1",
        state_token: "valid-state",
        provider: "square",
        store_id: STORE_UUID,
        redirect_data: { store_id: STORE_UUID, provider: "square" },
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(), // Expires in 5 min
        used_at: null,
        created_by: USER_ID,
      };

      const stateSelectQuery = createChainableMock({
        data: validState,
        error: null,
      });
      const updateQuery = createChainableMock({ data: null, error: null });
      const insertQuery = createChainableMock({ data: null, error: null });
      const auditQuery = createChainableMock({ data: null, error: null });

      let oauthStateCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "integration_oauth_states") {
          oauthStateCallCount++;
          if (oauthStateCallCount === 1) return stateSelectQuery;
          return updateQuery;
        }
        if (table === "pos_connections") return insertQuery;
        if (table === "audit_logs") return auditQuery;
        return createChainableMock({ data: null, error: null });
      });

      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        exchangeCode: vi.fn().mockResolvedValue({
          access_token: "sq-access-token",
          refresh_token: "sq-refresh-token",
          merchant_id: "sq-merchant-123",
        }),
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { code: "valid-auth-code", state: "valid-state" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain(`/stores/${STORE_UUID}/pos`);
      expect(location).toContain("success=connected");
      expect(location).toContain("provider=square");
    });

    it("should redirect with error when code exchange fails", async () => {
      const validState = {
        id: "state-1",
        state_token: "valid-state",
        provider: "square",
        store_id: STORE_UUID,
        redirect_data: { store_id: STORE_UUID, provider: "square" },
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
        used_at: null,
        created_by: USER_ID,
      };

      const stateSelectQuery = createChainableMock({
        data: validState,
        error: null,
      });
      const updateQuery = createChainableMock({ data: null, error: null });

      let oauthStateCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "integration_oauth_states") {
          oauthStateCallCount++;
          if (oauthStateCallCount === 1) return stateSelectQuery;
          return updateQuery;
        }
        return createChainableMock({ data: null, error: null });
      });

      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        exchangeCode: vi
          .fn()
          .mockRejectedValue(new Error("Token exchange failed")),
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/integrations/pos/[provider]/callback/route");
      const request = createMockRequest(
        "GET",
        "/api/integrations/pos/square/callback",
        undefined,
        { code: "bad-code", state: "valid-state" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ provider: "square" }),
      });

      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("error=exchange_failed");
    });
  });

  // ================================================================
  // GET /api/stores/[storeId]/pos/menu-items — Menu Items Sync
  // ================================================================
  describe("GET /api/stores/[storeId]/pos/menu-items", () => {
    it("should return 400 if connection_id is missing", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        // no connection_id
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("connection_id is required");
    });

    it("should return 400 if connection not found", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const connectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: "nonexistent-id" },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Connection not found");
    });

    it("should return 400 if connection is inactive", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          provider: "square",
          credentials: { access_token: "tok" },
          is_active: false, // inactive
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: CONNECTION_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Connection is inactive");
    });

    it("should return 400 if provider does not support menu sync", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          provider: "custom",
          credentials: {},
          is_active: true,
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      // Adapter without fetchMenuItems
      mockGetAdapter.mockReturnValue({
        provider: "custom",
        name: "Custom",
        authType: "api_key",
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
        // no fetchMenuItems
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: CONNECTION_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("does not support menu sync");
    });

    it("should return menu items with mapping status on success", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          provider: "square",
          credentials: { access_token: "sq-tok" },
          is_active: true,
        },
        error: null,
      });
      const mappingsQuery = createChainableMock({
        data: [
          {
            pos_item_id: "sq-item-1",
            inventory_item_id: "inv-1",
            is_active: true,
          },
        ],
        error: null,
      });

      let adminCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "pos_connections") {
          adminCallCount++;
          return connectionQuery;
        }
        if (table === "pos_item_mappings") return mappingsQuery;
        return createChainableMock({ data: null, error: null });
      });

      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        fetchMenuItems: vi.fn().mockResolvedValue([
          {
            pos_item_id: "sq-item-1",
            pos_item_name: "Cheeseburger",
            price: 12.99,
            category: "Mains",
          },
          {
            pos_item_id: "sq-item-2",
            pos_item_name: "Fries",
            price: 4.99,
            category: "Sides",
          },
        ]),
        validateSignature: vi.fn(),
        normalizeEvent: vi.fn(),
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: CONNECTION_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      // First item is mapped
      expect(data.data[0].pos_item_name).toBe("Cheeseburger");
      expect(data.data[0].is_mapped).toBe(true);
      expect(data.data[0].mapping).toEqual({
        pos_item_id: "sq-item-1",
        inventory_item_id: "inv-1",
        is_active: true,
      });
      // Second item is not mapped
      expect(data.data[1].pos_item_name).toBe("Fries");
      expect(data.data[1].is_mapped).toBe(false);
      expect(data.data[1].mapping).toBeNull();
    });

    it("should return 403 for unauthorized store", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${OTHER_STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: CONNECTION_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: OTHER_STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      setupUnauthenticatedUser();

      const { GET } =
        await import("@/app/api/stores/[storeId]/pos/menu-items/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/pos/menu-items`,
        undefined,
        { connection_id: CONNECTION_UUID },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });
  });

  // ================================================================
  // POST /api/pos/webhook/[connectionId] — POS Webhook Receiver
  // ================================================================
  describe("POST /api/pos/webhook/[connectionId]", () => {
    it("should return 404 for invalid connection", async () => {
      const connectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const request = createMockRequest(
        "POST",
        "/api/pos/webhook/nonexistent-id",
        {
          event_id: "evt-1",
          items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: "nonexistent-id" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid connection");
    });

    it("should return 403 for inactive connection", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: false,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        {
          event_id: "evt-1",
          items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Connection is inactive");
    });

    it("should return 401 for invalid webhook signature when secret is configured", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: { webhook_secret: "whsec_test123" },
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockValidateWebhookSignature.mockReturnValue(false);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-1",
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
        undefined,
        { "x-webhook-signature": "invalid-signature" },
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid webhook signature");
    });

    it("should return 401 when signature header is missing but secret is configured", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: { webhook_secret: "whsec_test123" },
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-1",
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
        // no signature header
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid webhook signature");
    });

    it("should return 400 for missing event_id in generic format", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {}, // no webhook_secret, so signature check is skipped
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null); // custom provider returns null from getAdapter in normalizeEvent path

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      // Missing event_id
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("event_id is required");
    });

    it("should return 400 for missing items array in generic format", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = { event_id: "evt-1" };
      // Missing items array
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("items array is required");
    });

    it("should return 400 for empty items array in generic format", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = { event_id: "evt-1", items: [] };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("items array is required");
    });

    it("should return 400 for items missing required fields", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-1",
        items: [{ pos_item_id: "i1" }], // missing pos_item_name and quantity
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("pos_item_id, pos_item_name, and quantity");
    });

    it("should return 201 for valid sale event (processed)", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null); // custom provider, falls through to generic format

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "evt-sale-1",
        status: "processed",
        items_deducted: 2,
        items_skipped: 0,
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-sale-1",
        event_type: "sale",
        items: [
          {
            pos_item_id: "burger-1",
            pos_item_name: "Cheeseburger",
            quantity: 2,
            unit_price: 12.99,
          },
          {
            pos_item_id: "fries-1",
            pos_item_name: "Fries",
            quantity: 1,
            unit_price: 4.99,
          },
        ],
        total_amount: 30.97,
        currency: "GBP",
        occurred_at: "2026-02-23T12:00:00Z",
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("processed");
      expect(data.data.items_deducted).toBe(2);

      // Verify processSaleEvent was called with correct args
      expect(mockProcessSaleEvent).toHaveBeenCalledWith(
        CONNECTION_UUID,
        STORE_UUID,
        expect.objectContaining({
          external_event_id: "evt-sale-1",
          event_type: "sale",
          items: expect.arrayContaining([
            expect.objectContaining({ pos_item_id: "burger-1", quantity: 2 }),
          ]),
        }),
      );
    });

    it("should return 200 for duplicate event (skipped)", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "evt-dup-1",
        status: "skipped",
        items_deducted: 0,
        items_skipped: 0,
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-dup-1",
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("skipped");
    });

    it("should return 500 for failed processing", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "evt-fail-1",
        status: "failed",
        items_deducted: 0,
        items_skipped: 0,
        error: "Database error",
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-fail-1",
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should use provider-native normalization for non-custom providers", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "square",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      // Square adapter normalizes the event
      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        normalizeEvent: vi.fn().mockReturnValue({
          external_event_id: "sq-evt-123",
          event_type: "sale",
          items: [
            { pos_item_id: "sq-item-1", pos_item_name: "Burger", quantity: 1 },
          ],
          total_amount: 12.99,
          currency: "USD",
          occurred_at: "2026-02-23T12:00:00Z",
        }),
        validateSignature: vi.fn(),
      });

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "sq-evt-123",
        status: "processed",
        items_deducted: 1,
        items_skipped: 0,
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      // Raw Square payload — the adapter handles normalization
      const body = {
        type: "payment.completed",
        data: { id: "sq-evt-123" },
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("processed");
    });

    it("should skip signature verification when no webhook secret is configured", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {}, // no webhook_secret
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAdapter.mockReturnValue(null);

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "evt-no-sig",
        status: "processed",
        items_deducted: 1,
        items_skipped: 0,
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = {
        event_id: "evt-no-sig",
        items: [{ pos_item_id: "i1", pos_item_name: "Item", quantity: 1 }],
      };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
        // no signature header needed
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // validateWebhookSignature should NOT have been called
      expect(mockValidateWebhookSignature).not.toHaveBeenCalled();
    });

    it("should use provider-specific signature header", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "square",
          is_active: true,
          credentials: { webhook_secret: "sq-secret-123" },
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      // Adapter returns normalized event
      mockGetAdapter.mockReturnValue({
        provider: "square",
        name: "Square",
        authType: "oauth2",
        normalizeEvent: vi.fn().mockReturnValue({
          external_event_id: "sq-evt-456",
          event_type: "sale",
          items: [
            { pos_item_id: "sq-i1", pos_item_name: "Pizza", quantity: 1 },
          ],
          occurred_at: "2026-02-23T14:00:00Z",
        }),
        validateSignature: vi.fn(),
      });
      mockValidateWebhookSignature.mockReturnValue(true);

      mockProcessSaleEvent.mockResolvedValue({
        event_id: "sq-evt-456",
        status: "processed",
        items_deducted: 1,
        items_skipped: 0,
      });

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");
      const body = { type: "payment.completed", data: { id: "sq-evt-456" } };
      const request = createMockRequest(
        "POST",
        `/api/pos/webhook/${CONNECTION_UUID}`,
        body,
        undefined,
        { "x-square-hmacsha256-signature": "valid-square-sig" },
      );
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // Verify signature validation was called with correct provider and secret
      expect(mockValidateWebhookSignature).toHaveBeenCalledWith(
        "square",
        expect.any(String),
        "valid-square-sig",
        "sq-secret-123",
      );
    });

    it("should handle JSON parse errors gracefully", async () => {
      const connectionQuery = createChainableMock({
        data: {
          id: CONNECTION_UUID,
          store_id: STORE_UUID,
          provider: "custom",
          is_active: true,
          credentials: {},
        },
        error: null,
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { POST } =
        await import("@/app/api/pos/webhook/[connectionId]/route");

      // Create a request with invalid JSON body
      const url = new URL(
        `http://localhost:3000/api/pos/webhook/${CONNECTION_UUID}`,
      );
      const request = {
        method: "POST",
        nextUrl: url,
        url: url.toString(),
        json: vi.fn(() => Promise.reject(new Error("Invalid JSON"))),
        text: vi.fn(() => Promise.resolve("not valid json {")),
        headers: new Headers(),
        cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      } as unknown as NextRequest;
      const response = await POST(request, {
        params: Promise.resolve({ connectionId: CONNECTION_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Internal error");
    });
  });
});
