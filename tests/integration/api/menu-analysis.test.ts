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

describe("Menu Analysis API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const STORE_UUID = "11111111-1111-4111-a111-111111111111";

  describe("GET /api/stores/[storeId]/menu-analysis", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const { GET } =
        await import("@/app/api/stores/[storeId]/menu-analysis/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/menu-analysis`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
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
        return profileQuery;
      });
      const { GET } =
        await import("@/app/api/stores/[storeId]/menu-analysis/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/menu-analysis`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      expect(response.status).toBe(403);
    });

    it("should return analysis with empty menu", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );
      const menuItemsQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "menu_items") return menuItemsQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/menu-analysis/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/menu-analysis`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.total_menu_items).toBe(0);
      expect(data.data.items).toEqual([]);
      expect(data.data.categories).toEqual([]);
    });

    it("should return analysis with menu items and recipes", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Manager",
        STORE_UUID,
      );

      const menuItemsQuery = createChainableMock({
        data: [
          {
            id: "mi-1",
            name: "Margherita Pizza",
            category: "Pizza",
            selling_price: 15,
            recipe_id: "recipe-1",
            is_active: true,
            recipe: {
              id: "recipe-1",
              name: "Margherita Recipe",
              yield_quantity: 2,
            },
          },
          {
            id: "mi-2",
            name: "Water",
            category: "Drinks",
            selling_price: 3,
            recipe_id: null,
            is_active: true,
            recipe: null,
          },
        ],
        error: null,
      });

      const ingredientsQuery = createChainableMock({
        data: [
          { inventory_item_id: "item-1", quantity: 0.5 },
          { inventory_item_id: "item-2", quantity: 0.3 },
        ],
        error: null,
      });

      const inventoryQuery = createChainableMock({
        data: [
          { inventory_item_id: "item-1", unit_cost: 2 },
          { inventory_item_id: "item-2", unit_cost: 5 },
        ],
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "menu_items") return menuItemsQuery;
        if (table === "recipe_ingredients") return ingredientsQuery;
        if (table === "store_inventory") return inventoryQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/menu-analysis/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/menu-analysis`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.summary.total_menu_items).toBe(2);
      expect(data.data.summary.items_with_recipe).toBe(1);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.categories).toHaveLength(2);

      // Pizza item should have a food cost calculated
      const pizzaItem = data.data.items.find(
        (i: { name: string }) => i.name === "Margherita Pizza",
      );
      expect(pizzaItem).toBeDefined();
      expect(pizzaItem.has_recipe).toBe(true);
      expect(pizzaItem.food_cost).toBeGreaterThan(0);

      // Water should have no recipe
      const waterItem = data.data.items.find(
        (i: { name: string }) => i.name === "Water",
      );
      expect(waterItem.has_recipe).toBe(false);
      expect(waterItem.rating).toBe("no_recipe");
    });

    it("should respect custom target food cost", async () => {
      const { profileQuery, storeUsersQuery } = setupAuthenticatedUser(
        "Owner",
        STORE_UUID,
      );
      const menuItemsQuery = createChainableMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "store_users") return storeUsersQuery;
        if (table === "menu_items") return menuItemsQuery;
        return storeUsersQuery;
      });

      const { GET } =
        await import("@/app/api/stores/[storeId]/menu-analysis/route");
      const request = createMockRequest(
        "GET",
        `/api/stores/${STORE_UUID}/menu-analysis`,
        undefined,
        {
          targetFoodCost: "25",
        },
      );
      const response = await GET(request, {
        params: Promise.resolve({ storeId: STORE_UUID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.summary.target_food_cost_percentage).toBe(25);
    });
  });
});
