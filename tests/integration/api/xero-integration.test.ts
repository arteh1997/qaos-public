import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  computeFieldChanges: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/csrf", () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
  getCSRFToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

const mockGetAccounts = vi.fn();
const mockCreateBill = vi.fn();
const mockFindOrCreateContact = vi.fn();
const mockRevokeXeroToken = vi.fn().mockResolvedValue(undefined);
const mockGetXeroCredentials = vi.fn();

vi.mock("@/lib/services/accounting/xero", () => ({
  xeroAdapter: {
    provider: "xero",
    getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
    createBill: (...args: unknown[]) => mockCreateBill(...args),
    findOrCreateContact: (...args: unknown[]) =>
      mockFindOrCreateContact(...args),
  },
  getXeroCredentials: (...args: unknown[]) => mockGetXeroCredentials(...args),
  revokeXeroToken: (...args: unknown[]) => mockRevokeXeroToken(...args),
}));

vi.mock("@/lib/services/accounting/quickbooks", () => ({
  quickbooksAdapter: {
    provider: "quickbooks",
    createBill: vi.fn(),
    findOrCreateContact: vi.fn(),
  },
  getQuickBooksCredentials: vi.fn(),
  revokeQuickBooksToken: vi.fn(),
}));

vi.mock("@/lib/validations/accounting", async () => {
  const { z } = await import("zod");
  return {
    glMappingSchema: z.object({
      gl_mappings: z.record(z.string(), z.string()).optional(),
      auto_sync: z.boolean().optional(),
      sync_invoices: z.boolean().optional(),
      sync_purchase_orders: z.boolean().optional(),
    }),
    triggerSyncSchema: z.object({
      entity_type: z.enum(["invoice", "bill", "purchase_order"]).optional(),
      entity_id: z.string().uuid().optional(),
    }),
    XERO_OAUTH_CONFIG: {
      authUrl: "https://login.xero.com/identity/connect/authorize",
      tokenUrl: "https://identity.xero.com/connect/token",
      connectionsUrl: "https://api.xero.com/connections",
      apiBaseUrl: "https://api.xero.com/api.xro/2.0",
      scopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "accounting.transactions",
        "accounting.contacts",
        "accounting.settings.read",
      ],
      stateExpiryMinutes: 10,
    },
  };
});

// ── Helpers ──

const STORE_UUID = "11111111-1111-4111-a111-111111111111";
const OTHER_STORE_UUID = "99999999-9999-4999-a999-999999999999";
const CONNECTION_UUID = "cc111111-1111-4111-a111-111111111111";
const INVOICE_UUID = "22222222-2222-4222-a222-222222222222";
const USER_ID = "user-123";

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

// ── Test Data ──

const sampleConnection = {
  id: CONNECTION_UUID,
  store_id: STORE_UUID,
  provider: "xero",
  is_active: true,
  last_synced_at: "2026-02-20T10:00:00Z",
  sync_status: "idle",
  sync_error: null,
  config: {
    gl_mappings: { Produce: "5100", Dairy: "5200", _default: "5000" },
    auto_sync: false,
  },
  credentials: {
    access_token: "xero-access-token",
    refresh_token: "xero-refresh-token",
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    token_type: "Bearer",
    tenant_id: "xero-tenant-123",
  },
  created_at: "2026-02-01T10:00:00Z",
  updated_at: "2026-02-20T10:00:00Z",
};

const sampleSyncLog = [
  {
    id: "sync-1",
    connection_id: CONNECTION_UUID,
    store_id: STORE_UUID,
    entity_type: "invoice",
    entity_id: INVOICE_UUID,
    external_id: "xero-inv-001",
    direction: "push",
    status: "success",
    error_message: null,
    created_at: "2026-02-20T10:05:00Z",
  },
];

const sampleXeroAccounts = [
  {
    account_id: "acc-1",
    code: "5000",
    name: "Cost of Goods Sold",
    type: "EXPENSE",
    class: "EXPENSE",
    status: "ACTIVE",
  },
  {
    account_id: "acc-2",
    code: "5100",
    name: "Produce Costs",
    type: "EXPENSE",
    class: "EXPENSE",
    status: "ACTIVE",
  },
  {
    account_id: "acc-3",
    code: "5200",
    name: "Dairy Costs",
    type: "EXPENSE",
    class: "EXPENSE",
    status: "ACTIVE",
  },
  {
    account_id: "acc-4",
    code: "1000",
    name: "Bank Account",
    type: "BANK",
    class: "ASSET",
    status: "ACTIVE",
  },
  {
    account_id: "acc-5",
    code: "5300",
    name: "Archived Account",
    type: "EXPENSE",
    class: "EXPENSE",
    status: "ARCHIVED",
  },
];

const sampleInvoice = {
  id: INVOICE_UUID,
  store_id: STORE_UUID,
  invoice_number: "INV-2026-001",
  invoice_date: "2026-02-20",
  due_date: "2026-03-20",
  total_amount: 600,
  currency: "GBP",
  status: "applied",
  supplier_id: "sup-1",
  suppliers: {
    id: "sup-1",
    name: "Fresh Foods Co",
    email: "info@freshfoods.com",
    phone: "020-1234-5678",
  },
};

const sampleLineItems = [
  {
    id: "li-1",
    invoice_id: INVOICE_UUID,
    description: "Tomatoes 5kg",
    quantity: 10,
    unit_price: 25,
    total_price: 250,
    match_status: "auto_matched",
    sort_order: 0,
    inventory_items: { name: "Tomatoes", category: "Produce" },
  },
  {
    id: "li-2",
    invoice_id: INVOICE_UUID,
    description: "Olive Oil 1L",
    quantity: 5,
    unit_price: 50,
    total_price: 250,
    match_status: "manual_matched",
    sort_order: 1,
    inventory_items: { name: "Olive Oil", category: null },
  },
];

// ── Tests ──

describe("Xero Accounting Integration API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetXeroCredentials.mockResolvedValue(sampleConnection.credentials);
    mockGetAccounts.mockResolvedValue(sampleXeroAccounts);
    mockCreateBill.mockResolvedValue({
      success: true,
      external_id: "xero-bill-001",
    });
    mockFindOrCreateContact.mockResolvedValue("xero-contact-001");
  });

  // ================================================================
  // GET /api/stores/[storeId]/accounting — Connection status
  // ================================================================
  describe("GET /api/stores/[storeId]/accounting", () => {
    it("should return connections list without credentials", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionsQuery = createChainableMock({
        data: [
          {
            id: CONNECTION_UUID,
            store_id: STORE_UUID,
            provider: "xero",
            is_active: true,
            last_synced_at: sampleConnection.last_synced_at,
            sync_status: "idle",
            sync_error: null,
            config: sampleConnection.config,
            created_at: sampleConnection.created_at,
            updated_at: sampleConnection.updated_at,
          },
        ],
        error: null,
      });

      const syncLogQuery = createChainableMock({
        data: sampleSyncLog,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let adminCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") return connectionsQuery;
        if (table === "accounting_sync_log") {
          adminCallCount++;
          return syncLogQuery;
        }
        return createChainableMock({ data: null, error: null });
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.connections).toHaveLength(1);
      expect(data.data.connections[0].provider).toBe("xero");
      expect(data.data.connections[0].credentials).toBeUndefined();
      expect(data.data.recent_syncs).toHaveLength(1);
    });

    it("should return empty connections when none exist", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const emptyConnectionsQuery = createChainableMock({
        data: [],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") return emptyConnectionsQuery;
        return createChainableMock({ data: null, error: null });
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.connections).toEqual([]);
      expect(data.data.recent_syncs).toEqual([]);
    });

    it("should return Manager access to connection status", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const connectionsQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => connectionsQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(200);
    });

    it("should return 403 for unauthorized store access", async () => {
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
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${OTHER_STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: OTHER_STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should handle database errors gracefully", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const errorQuery = createChainableMock({
        data: null,
        error: { message: "DB error", code: "42P01" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => errorQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  // ================================================================
  // GET /api/stores/[storeId]/accounting/accounts — Chart of accounts
  // ================================================================
  describe("GET /api/stores/[storeId]/accounting/accounts", () => {
    it("should return expense accounts from Xero", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") return connectionQuery;
        return createChainableMock({ data: null, error: null });
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/accounts/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/accounts`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Only ACTIVE EXPENSE accounts in the expense list
      expect(data.data.accounts).toHaveLength(3);
      expect(
        data.data.accounts.every(
          (a: { class: string }) => a.class === "EXPENSE",
        ),
      ).toBe(true);
      // All active accounts (expense + bank, not archived)
      expect(data.data.all_accounts).toHaveLength(4);
    });

    it("should return 400 when no active connection exists", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const noConnectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => noConnectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/accounts/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/accounts`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("No active xero connection found");
    });

    it("should handle Xero API failure", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);
      mockGetAccounts.mockRejectedValue(
        new Error("Failed to fetch Xero accounts: 401"),
      );

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/accounts/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/accounts`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("Failed to fetch Xero accounts");
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
        await import("@/app/api/stores/[storeId]/accounting/accounts/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${OTHER_STORE_UUID}/accounting/accounts`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: OTHER_STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/stores/[storeId]/accounting/config — Get config
  // ================================================================
  describe("GET /api/stores/[storeId]/accounting/config", () => {
    it("should return GL mappings configuration", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: { id: CONNECTION_UUID, config: sampleConnection.config },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/config`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.gl_mappings).toEqual({
        Produce: "5100",
        Dairy: "5200",
        _default: "5000",
      });
    });

    it("should return empty config when connection has no config", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: { id: CONNECTION_UUID, config: null },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => connectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/config`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual({});
    });

    it("should return 400 when no connection exists", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const noConnectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => noConnectionQuery);

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/config`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("No xero connection found");
    });
  });

  // ================================================================
  // PUT /api/stores/[storeId]/accounting/config — Update config
  // ================================================================
  describe("PUT /api/stores/[storeId]/accounting/config", () => {
    it("should update GL mappings successfully", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: { id: CONNECTION_UUID, config: sampleConnection.config },
        error: null,
      });
      const updateQuery = createChainableMock({ data: null, error: null });

      let connectionCallCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateQuery;
        }
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { PUT } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        {
          gl_mappings: { Produce: "5100", Dairy: "5250", Meat: "5300" },
          auto_sync: true,
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Merged config should contain the updated values
      expect(data.data.gl_mappings).toEqual({
        Produce: "5100",
        Dairy: "5250",
        Meat: "5300",
      });
      expect(data.data.auto_sync).toBe(true);
    });

    it("should return 400 for invalid config schema", async () => {
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
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        {
          gl_mappings: "not-an-object", // Invalid: should be Record<string, string>
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("Invalid config");
    });

    it("should return 400 when no connection found for update", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const noConnectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => noConnectionQuery);

      const { PUT } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        {
          auto_sync: true,
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("No xero connection found");
    });

    it("should handle database update errors", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: { id: CONNECTION_UUID, config: sampleConnection.config },
        error: null,
      });
      const updateErrorQuery = createChainableMock({
        data: null,
        error: { message: "Update failed" },
      });

      let connectionCallCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateErrorQuery;
        }
        return createChainableMock({ data: null, error: null });
      });

      const { PUT } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        {
          auto_sync: false,
        },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  // ================================================================
  // POST /api/stores/[storeId]/accounting/sync — Trigger sync
  // ================================================================
  describe("POST /api/stores/[storeId]/accounting/sync", () => {
    it("should sync unsynced invoices successfully", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const invoicesQuery = createChainableMock({
        data: [{ id: INVOICE_UUID }],
        error: null,
      });
      const existingSyncsQuery = createChainableMock({
        data: [],
        error: null,
      });
      const invoiceDetailQuery = createChainableMock({
        data: sampleInvoice,
        error: null,
      });
      const lineItemsQuery = createChainableMock({
        data: sampleLineItems,
        error: null,
      });
      const insertSyncLogQuery = createChainableMock({
        data: null,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      let invoiceCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        if (table === "invoices") {
          invoiceCallCount++;
          if (invoiceCallCount === 1) return invoicesQuery;
          return invoiceDetailQuery;
        }
        if (table === "accounting_sync_log") {
          // First call: check existing syncs; subsequent calls: insert
          if (existingSyncsQuery.select.mock.calls.length === 0)
            return existingSyncsQuery;
          return insertSyncLogQuery;
        }
        if (table === "invoice_line_items") return lineItemsQuery;
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {},
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.synced).toBe(1);
      expect(data.data.failed).toBe(0);
      expect(data.data.results).toHaveLength(1);
      expect(data.data.results[0].success).toBe(true);
    });

    it("should sync a specific invoice by entity_id", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const invoiceDetailQuery = createChainableMock({
        data: sampleInvoice,
        error: null,
      });
      const lineItemsQuery = createChainableMock({
        data: sampleLineItems,
        error: null,
      });
      const insertSyncLogQuery = createChainableMock({
        data: null,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        if (table === "invoices") return invoiceDetailQuery;
        if (table === "invoice_line_items") return lineItemsQuery;
        if (table === "accounting_sync_log") return insertSyncLogQuery;
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {
          entity_id: INVOICE_UUID,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.synced).toBe(1);
      expect(data.data.results[0].entity_id).toBe(INVOICE_UUID);
      expect(data.data.results[0].external_id).toBe("xero-bill-001");
    });

    it("should return 400 when no active Xero connection", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const noConnectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => noConnectionQuery);

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {},
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("No active accounting connection found");
    });

    it("should return 400 for invalid sync request schema", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {
          entity_id: "not-a-uuid", // Must be UUID
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("Invalid sync request");
    });

    it("should record sync failure and report results", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const invoiceDetailQuery = createChainableMock({
        data: sampleInvoice,
        error: null,
      });
      const lineItemsQuery = createChainableMock({
        data: sampleLineItems,
        error: null,
      });
      const insertSyncLogQuery = createChainableMock({
        data: null,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      // Make createBill fail
      mockCreateBill.mockResolvedValue({
        success: false,
        error: "Xero API error: 422 Validation error",
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        if (table === "invoices") return invoiceDetailQuery;
        if (table === "invoice_line_items") return lineItemsQuery;
        if (table === "accounting_sync_log") return insertSyncLogQuery;
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {
          entity_id: INVOICE_UUID,
        },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.synced).toBe(0);
      expect(data.data.failed).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].error).toContain("Xero API error");
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

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${OTHER_STORE_UUID}/accounting/sync`,
        {},
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: OTHER_STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should use per-category GL mappings for line items", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const invoiceDetailQuery = createChainableMock({
        data: sampleInvoice,
        error: null,
      });
      const lineItemsQuery = createChainableMock({
        data: sampleLineItems,
        error: null,
      });
      const insertSyncLogQuery = createChainableMock({
        data: null,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        if (table === "invoices") return invoiceDetailQuery;
        if (table === "invoice_line_items") return lineItemsQuery;
        if (table === "accounting_sync_log") return insertSyncLogQuery;
        if (table === "suppliers")
          return createChainableMock({
            data: {
              id: "sup-1",
              name: "Fresh Foods Co",
              email: "info@freshfoods.com",
              phone: "020-1234-5678",
            },
            error: null,
          });
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        { entity_id: INVOICE_UUID },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify createBill was called with correct per-category account codes
      const billArg = mockCreateBill.mock.calls[0][1];
      // First line item: category "Produce" → mapped to "5100"
      expect(billArg.line_items[0].account_code).toBe("5100");
      // Second line item: category null → falls back to _default "5000"
      expect(billArg.line_items[1].account_code).toBe("5000");
    });

    it("should return 500 when token is revoked during credential fetch", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      const { TokenRevokedError } =
        await import("@/lib/services/accounting/types");
      mockGetXeroCredentials.mockRejectedValue(new TokenRevokedError("Xero"));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        { entity_id: INVOICE_UUID },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      // Error message is sanitized (contains "token" → redacted), so check for generic error
      expect(data.message).toBeDefined();
    });

    it("should handle rate limit errors from Xero API", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const invoiceDetailQuery = createChainableMock({
        data: sampleInvoice,
        error: null,
      });
      const lineItemsQuery = createChainableMock({
        data: sampleLineItems,
        error: null,
      });
      const insertSyncLogQuery = createChainableMock({
        data: null,
        error: null,
      });
      const updateConnectionQuery = createChainableMock({
        data: null,
        error: null,
      });

      const { RateLimitError } =
        await import("@/lib/services/accounting/types");
      mockCreateBill.mockRejectedValue(new RateLimitError("Xero", 60));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateConnectionQuery;
        }
        if (table === "invoices") return invoiceDetailQuery;
        if (table === "invoice_line_items") return lineItemsQuery;
        if (table === "accounting_sync_log") return insertSyncLogQuery;
        if (table === "suppliers")
          return createChainableMock({
            data: {
              id: "sup-1",
              name: "Fresh Foods Co",
              email: "info@freshfoods.com",
              phone: "020-1234-5678",
            },
            error: null,
          });
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        { entity_id: INVOICE_UUID },
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].error).toContain("rate limit");
    });
  });

  // ================================================================
  // POST /api/integrations/xero/disconnect — Disconnect Xero
  // ================================================================
  describe("POST /api/integrations/xero/disconnect", () => {
    it("should deactivate connection and revoke token", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const connectionQuery = createChainableMock({
        data: sampleConnection,
        error: null,
      });
      const updateQuery = createChainableMock({ data: null, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      let connectionCallCount = 0;
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "accounting_connections") {
          connectionCallCount++;
          if (connectionCallCount === 1) return connectionQuery;
          return updateQuery;
        }
        if (table === "audit_logs")
          return createChainableMock({ data: null, error: null });
        return createChainableMock({ data: null, error: null });
      });

      const { POST } =
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        {
          store_id: STORE_UUID,
        },
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.disconnected).toBe(true);
      expect(mockRevokeXeroToken).toHaveBeenCalledWith(
        sampleConnection.credentials,
      );
    });

    it("should return 400 when store_id is missing", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });

      const { POST } =
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        {},
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("store_id is required");
    });

    it("should return 400 when no Xero connection exists", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );

      const noConnectionQuery = createChainableMock({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return storeUsersQuery;
      });
      mockAdminClient.from.mockImplementation(() => noConnectionQuery);

      const { POST } =
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        {
          store_id: STORE_UUID,
        },
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain("No Xero connection found");
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

      const { POST } =
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        {
          store_id: OTHER_STORE_UUID,
        },
      );
      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  // ================================================================
  // Auth and access control
  // ================================================================
  describe("Auth and access control", () => {
    it("should return 401 when not authenticated (GET connection status)", async () => {
      setupUnauthenticatedUser();

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 when not authenticated (GET accounts)", async () => {
      setupUnauthenticatedUser();

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/accounts/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/accounts`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 when not authenticated (GET config)", async () => {
      setupUnauthenticatedUser();

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting/config`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 when not authenticated (PUT config)", async () => {
      setupUnauthenticatedUser();

      const { PUT } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        { auto_sync: true },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 when not authenticated (POST sync)", async () => {
      setupUnauthenticatedUser();

      const { POST } =
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {},
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(401);
    });

    it("should return 401 when not authenticated (POST disconnect)", async () => {
      setupUnauthenticatedUser();

      const { POST } =
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        { store_id: STORE_UUID },
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 403 for Staff role on GET connection status", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/accounting/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/accounting`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should return 403 for Staff role on PUT config", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Staff",
        STORE_UUID,
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        return profileQuery;
      });

      const { PUT } =
        await import("@/app/api/stores/[storeId]/accounting/config/route");
      const request = createMockRequest(
        "PUT",
        `/api/stores/${STORE_UUID}/accounting/config`,
        { auto_sync: true },
      );
      const response = await PUT(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should return 403 for Staff role on POST sync", async () => {
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
        await import("@/app/api/stores/[storeId]/accounting/sync/route");
      const request = createMockRequest(
        "POST",
        `/api/stores/${STORE_UUID}/accounting/sync`,
        {},
      );
      const response = await POST(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });

      expect(response.status).toBe(403);
    });

    it("should return 403 for Staff role on POST disconnect", async () => {
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
        await import("@/app/api/integrations/xero/disconnect/route");
      const request = createMockRequest(
        "POST",
        "/api/integrations/xero/disconnect",
        { store_id: STORE_UUID },
      );
      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });
});
