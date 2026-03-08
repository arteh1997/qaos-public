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
 * Build a chainable Supabase mock that resolves to `{ data, error }` after
 * the expected number of `.eq()` calls. Also records the arguments passed
 * to each `.eq()` call for assertion.
 */
function buildStoreUsersChain(
  data: unknown[],
  error: { message: string } | null = null,
) {
  const eqCalls: Array<[string, unknown]> = [];
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    _eqCalls: Array<[string, unknown]>;
  } = { _eqCalls: eqCalls } as never;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockImplementation((field: string, value: unknown) => {
    eqCalls.push([field, value]);
    if (eqCalls.length >= 2) {
      return Promise.resolve({ data: error ? null : data, error });
    }
    return chain;
  });
  return chain;
}

function stripeError(code: string, message: string) {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
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
      expect.any(Object),
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
      expect.any(Object),
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

    mockStripe.coupons.retrieve.mockRejectedValue(
      stripeError("resource_missing", "No such coupon"),
    );
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
      expect.any(Object),
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

    mockStripe.coupons.retrieve.mockRejectedValue(
      stripeError("resource_missing", "Not found"),
    );
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

  it("should propagate non-resource_missing errors from coupon retrieve", async () => {
    // 4 active + 1 new = 5 → qualifies for discount, but retrieve fails with auth error
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

    mockStripe.coupons.retrieve.mockRejectedValue(
      stripeError("api_key_expired", "Your API key has expired"),
    );

    const { createSubscription } = await import("@/lib/stripe/server");
    await expect(
      createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP"),
    ).rejects.toThrow("Your API key has expired");

    expect(mockStripe.coupons.create).not.toHaveBeenCalled();
  });

  it("should handle race condition where coupon is created concurrently", async () => {
    // 4 active + 1 new = 5 → qualifies for discount
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

    // Retrieve says missing, but create fails because another request created it first
    mockStripe.coupons.retrieve.mockRejectedValue(
      stripeError("resource_missing", "Not found"),
    );
    mockStripe.coupons.create.mockRejectedValue(
      stripeError("resource_already_exists", "Coupon already exists"),
    );

    const { createSubscription } = await import("@/lib/stripe/server");
    // Should succeed — the coupon exists now, so we use it
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ coupon: "volume-10pct" }),
      expect.any(Object),
    );
  });

  it("should filter by is_billing_owner and only count those stores", async () => {
    // Mock returns 6 stores total, but we verify the query filters correctly.
    // The key assertion is that .eq() is called with "is_billing_owner" and true.
    let capturedChain: ReturnType<typeof buildStoreUsersChain> | null = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        // Return only 1 store (simulating that the billing-owner filter excluded the rest)
        capturedChain = buildStoreUsersChain([
          { store_id: "s1", store: { subscription_status: "active" } },
        ]);
        return capturedChain;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    // Verify the query explicitly filters by is_billing_owner = true
    expect(capturedChain!._eqCalls).toEqual([
      ["user_id", "user_1"],
      ["is_billing_owner", true],
    ]);

    // 1 active + 1 new = 2, below threshold → no coupon
    expect(mockStripe.coupons.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ coupon: expect.any(String) }),
      expect.any(Object),
    );
  });

  it("should throw when Supabase query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain([], { message: "connection refused" });
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { createSubscription } = await import("@/lib/stripe/server");
    await expect(
      createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP"),
    ).rejects.toThrow("Failed to query active stores for volume discount");
  });

  it("should exclude the current store from count to avoid double-counting on retry", async () => {
    // 5 stores returned, but one is "store_new" (the store being created).
    // After excluding it: 4 active + 1 new = 5 → 10% discount
    // Without exclusion: 5 active + 1 = 6 → still 10%, so use a case at the boundary.
    // 4 stores returned including "store_new" → excluding: 3 + 1 = 4 (no discount)
    mockFrom.mockImplementation((table: string) => {
      if (table === "store_users") {
        return buildStoreUsersChain([
          { store_id: "s1", store: { subscription_status: "active" } },
          { store_id: "s2", store: { subscription_status: "active" } },
          { store_id: "s3", store: { subscription_status: "active" } },
          { store_id: "store_new", store: { subscription_status: "trialing" } },
        ]);
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { createSubscription } = await import("@/lib/stripe/server");
    await createSubscription("cus_123", "pm_123", "store_new", "user_1", "GBP");

    // 3 (excluding store_new) + 1 = 4, below 5-store threshold → no coupon
    expect(mockStripe.coupons.retrieve).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ coupon: expect.any(String) }),
      expect.any(Object),
    );
  });
});
