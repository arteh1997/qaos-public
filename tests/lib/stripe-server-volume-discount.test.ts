import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Stripe ──
const mockStripe = {
  customers: {
    retrieve: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  paymentMethods: {
    retrieve: vi.fn(),
    list: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
  },
  products: {
    list: vi.fn(),
    create: vi.fn(),
  },
  prices: {
    list: vi.fn(),
    create: vi.fn(),
  },
  coupons: {
    retrieve: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/stripe/config", () => ({
  stripe: mockStripe,
  BILLING_CONFIG: {
    PRICE_AMOUNT_PENCE: 29900,
    CURRENCY: "gbp",
    TRIAL_DAYS: 30,
    PRODUCT_NAME: "Restaurant Inventory Management",
    FEATURES: [],
  },
}));

// ── Mock Supabase Admin ──
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

/**
 * Build a chainable Supabase mock that resolves to `data` after
 * the expected number of `.eq()` calls.
 */
function buildStoreUsersChain(data: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  let eqCallCount = 0;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockImplementation(() => {
    eqCallCount++;
    // After both .eq("user_id", …) and .eq("is_billing_owner", …)
    if (eqCallCount >= 2) {
      return Promise.resolve({ data });
    }
    return chain;
  });
  return chain;
}

describe("Volume Discount in createSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: customer has a payment method
    mockStripe.customers.retrieve.mockResolvedValue({
      deleted: false,
      invoice_settings: { default_payment_method: "pm_existing" },
    });
    mockStripe.customers.update.mockResolvedValue({});
    mockStripe.paymentMethods.retrieve.mockResolvedValue({
      card: { country: "GB" },
    });

    // Default: product exists, price exists
    mockStripe.products.list.mockResolvedValue({
      data: [{ id: "prod_123", name: "Restaurant Inventory Management" }],
    });
    mockStripe.prices.list.mockResolvedValue({
      data: [
        {
          id: "price_gbp",
          currency: "gbp",
          unit_amount: 29900,
          recurring: { interval: "month" },
        },
      ],
    });

    // Default subscription creation succeeds
    mockStripe.subscriptions.create.mockResolvedValue({
      id: "sub_123",
      status: "trialing",
    });
  });

  it("should NOT apply coupon when user has fewer than 5 stores", async () => {
    // 2 active + 1 new = 3, below 5-store threshold
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain([
          { store_id: "s1", store: { subscription_status: "active" } },
          { store_id: "s2", store: { subscription_status: "active" } },
        ]);
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    expect(mockStripe.coupons.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ coupon: expect.any(String) }),
    );
  });

  it("should apply 10% coupon when user has 5+ active stores", async () => {
    // 4 active + 1 new = 5 → 10% discount
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain([
          { store_id: "s1", store: { subscription_status: "active" } },
          { store_id: "s2", store: { subscription_status: "active" } },
          { store_id: "s3", store: { subscription_status: "trialing" } },
          { store_id: "s4", store: { subscription_status: "active" } },
        ]);
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockStripe.coupons.retrieve.mockResolvedValue({ id: "volume-10pct" });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    expect(mockStripe.coupons.retrieve).toHaveBeenCalledWith("volume-10pct");
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ coupon: "volume-10pct" }),
    );
  });

  it("should apply 20% coupon when user has 10+ active stores", async () => {
    // 9 active + 1 new = 10 → 20% discount
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain(
          Array.from({ length: 9 }, (_, i) => ({
            store_id: `s${i + 1}`,
            store: { subscription_status: "active" },
          })),
        );
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockStripe.coupons.retrieve.mockRejectedValue(new Error("No such coupon"));
    mockStripe.coupons.create.mockResolvedValue({ id: "volume-20pct" });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    expect(mockStripe.coupons.retrieve).toHaveBeenCalledWith("volume-20pct");
    expect(mockStripe.coupons.create).toHaveBeenCalledWith({
      id: "volume-20pct",
      percent_off: 20,
      duration: "forever",
      name: "Volume Discount: 20% off",
    });
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ coupon: "volume-20pct" }),
    );
  });

  it("should create coupon if it does not exist in Stripe", async () => {
    // 4 active + 1 new = 5 → 10% discount, coupon doesn't exist yet
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain(
          Array.from({ length: 4 }, (_, i) => ({
            store_id: `s${i}`,
            store: { subscription_status: "active" },
          })),
        );
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockStripe.coupons.retrieve.mockRejectedValue(new Error("Not found"));
    mockStripe.coupons.create.mockResolvedValue({ id: "volume-10pct" });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    expect(mockStripe.coupons.create).toHaveBeenCalledWith({
      id: "volume-10pct",
      percent_off: 10,
      duration: "forever",
      name: "Volume Discount: 10% off",
    });
  });

  it("should only count stores where user is billing owner", async () => {
    // Only 1 billing-owner store + 1 new = 2, below threshold
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain([
          { store_id: "s1", store: { subscription_status: "active" } },
        ]);
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    // 1 active + 1 new = 2, below threshold → no coupon
    expect(mockStripe.coupons.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ coupon: expect.any(String) }),
    );
  });
});
