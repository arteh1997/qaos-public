/**
 * Stripe Server-Side Helpers
 */

import { stripe, BILLING_CONFIG } from "./config";
import {
  getPricingTier,
  getCurrencyForCountry,
  getVolumeDiscount,
} from "./billing-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { Enums, Json } from "@/types/database";
import Stripe from "stripe";

// Type alias for subscription status
type SubscriptionStatus = Enums<"subscription_status">;

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  const supabaseAdmin = createAdminClient();

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // Save customer ID to profile
  await supabaseAdmin
    .from("profiles")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return customer.id;
}

/**
 * Create a Setup Intent for collecting payment method
 */
export async function createSetupIntent(
  customerId: string,
): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session", // Allow charging later without customer present
  });
}

/**
 * Create a subscription for a store with trial period.
 * If paymentMethodId is omitted, uses the customer's existing default payment method.
 * Supports multi-currency — pass the store's currency code (e.g. 'GBP', 'USD', 'SAR').
 */
export async function createSubscription(
  customerId: string,
  paymentMethodId: string | null,
  storeId: string,
  userId: string,
  currency?: string,
): Promise<Stripe.Subscription> {
  // Resolve payment method: use provided one, or look up customer's default
  let resolvedPaymentMethodId = paymentMethodId;

  if (!resolvedPaymentMethodId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error("Stripe customer has been deleted");
    }
    const defaultPm = customer.invoice_settings?.default_payment_method;
    if (defaultPm) {
      resolvedPaymentMethodId =
        typeof defaultPm === "string" ? defaultPm : defaultPm.id;
    } else {
      // Fall back to any attached payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      if (paymentMethods.data.length > 0) {
        resolvedPaymentMethodId = paymentMethods.data[0].id;
      }
    }
  }

  if (!resolvedPaymentMethodId) {
    throw new Error(
      "No payment method found. Please add a payment method first.",
    );
  }

  // Set the payment method as default for the customer
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: resolvedPaymentMethodId,
    },
  });

  // Resolve billing currency from card's issuing country (anti-currency-gaming)
  const paymentMethod = await stripe.paymentMethods.retrieve(
    resolvedPaymentMethodId,
  );
  const cardCountry = paymentMethod.card?.country; // ISO 3166-1 alpha-2, e.g. 'GB'
  const billingCurrency = cardCountry
    ? getCurrencyForCountry(cardCountry)
    : currency || "GBP";

  // Get or create the price for the resolved billing currency
  const priceId = await getOrCreatePrice(billingCurrency);

  // Check for volume discount based on user's active store count
  const couponId = await getVolumeDiscountCoupon(userId);

  // Create subscription with trial (idempotency key prevents duplicate subscriptions)
  const idempotencyKey = `create-sub-${storeId}-${userId}`;
  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: resolvedPaymentMethodId,
      trial_period_days: BILLING_CONFIG.TRIAL_DAYS,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      ...(couponId ? { coupon: couponId } : {}),
      metadata: {
        store_id: storeId,
        user_id: userId,
        currency: billingCurrency.toUpperCase(),
        card_country: cardCountry || "unknown",
        store_currency: (currency || "GBP").toUpperCase(),
      },
      expand: ["latest_invoice.payment_intent"],
    },
    { idempotencyKey },
  );

  return subscription;
}

/**
 * Get or create a Stripe coupon for volume discount based on user's active store count.
 * Returns the coupon ID if the user qualifies, or null if no discount applies.
 */
async function getVolumeDiscountCoupon(userId: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient();

  // Count user's active subscriptions (including the one being created)
  const { data: activeStores, error } = await supabaseAdmin
    .from("store_users")
    .select("store_id, store:stores!inner(subscription_status)")
    .eq("user_id", userId)
    .eq("is_billing_owner", true);

  if (error) {
    throw new Error(
      `Failed to query active stores for volume discount: ${error.message}`,
    );
  }

  // Count stores with active/trialing subscriptions + 1 for the new store
  const activeCount =
    (activeStores || []).filter((s) => {
      const store = s.store as unknown as {
        subscription_status: string | null;
      };
      return (
        store?.subscription_status === "active" ||
        store?.subscription_status === "trialing"
      );
    }).length + 1;

  const discount = getVolumeDiscount(activeCount);
  if (!discount) return null;

  // Use a deterministic coupon ID so we reuse existing coupons
  const couponId = `volume-${discount.discountPercent}pct`;

  try {
    await stripe.coupons.retrieve(couponId);
    return couponId;
  } catch (err) {
    // Only create if coupon is genuinely missing; re-throw auth/network/rate-limit errors
    const stripeErr = err as Stripe.errors.StripeError;
    if (stripeErr.code !== "resource_missing") {
      throw err;
    }

    try {
      await stripe.coupons.create({
        id: couponId,
        percent_off: discount.discountPercent,
        duration: "forever",
        name: `Volume Discount: ${discount.label}`,
      });
    } catch (createErr) {
      // Handle race condition: another request created the coupon between retrieve and create
      const createStripeErr = createErr as Stripe.errors.StripeError;
      if (createStripeErr.code !== "resource_already_exists") {
        throw createErr;
      }
    }
    return couponId;
  }
}

/**
 * Get or create the product and price in Stripe.
 * Supports multi-currency: finds or creates a price for the given currency.
 */
async function getOrCreatePrice(currency?: string): Promise<string> {
  // Check environment variable first (legacy single-price mode)
  if (!currency && process.env.STRIPE_PRICE_ID) {
    return process.env.STRIPE_PRICE_ID;
  }

  const tier = getPricingTier(currency || "GBP");
  const amount = tier.amount;
  const stripeCurrency = tier.currency;

  // Get or create the product
  const products = await stripe.products.list({
    active: true,
    limit: 10,
  });

  let productId: string;
  const existingProduct = products.data.find(
    (p) => p.name === BILLING_CONFIG.PRODUCT_NAME,
  );

  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const product = await stripe.products.create({
      name: BILLING_CONFIG.PRODUCT_NAME,
      description: "Complete inventory management solution",
    });
    productId = product.id;
  }

  // Look for an existing price matching this currency + amount
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });

  const matchingPrice = prices.data.find(
    (p) =>
      p.currency === stripeCurrency &&
      p.unit_amount === amount &&
      p.recurring?.interval === "month",
  );

  if (matchingPrice) {
    return matchingPrice.id;
  }

  // Create a new price for this currency + amount
  const nickname = `${stripeCurrency.toUpperCase()} Monthly`;

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: stripeCurrency,
    recurring: {
      interval: "month",
    },
    nickname,
  });

  return price.id;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelImmediately: boolean = false,
): Promise<Stripe.Subscription> {
  if (cancelImmediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a subscription that was set to cancel
 */
export async function reactivateSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Update payment method for a subscription
 */
export async function updatePaymentMethod(
  customerId: string,
  subscriptionId: string,
  paymentMethodId: string,
): Promise<void> {
  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  // Set as default for customer
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // Update subscription's default payment method
  await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: paymentMethodId,
  });
}

/**
 * Get customer's payment methods
 */
export async function getPaymentMethods(
  customerId: string,
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  return paymentMethods.data;
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || "",
  );
}

/**
 * Sync subscription status to database
 */
export async function syncSubscriptionToDatabase(
  stripeSubscription: Stripe.Subscription,
  storeId: string,
): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const now = new Date().toISOString();
  const trialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000).toISOString()
    : null;

  const subscriptionData = {
    stripe_subscription_id: stripeSubscription.id,
    stripe_customer_id: stripeSubscription.customer as string,
    stripe_payment_method_id: stripeSubscription.default_payment_method as
      | string
      | null,
    status: stripeSubscription.status as SubscriptionStatus,
    trial_start: stripeSubscription.trial_start
      ? new Date(stripeSubscription.trial_start * 1000).toISOString()
      : null,
    trial_end: trialEnd,
    current_period_start: new Date(
      stripeSubscription.current_period_start * 1000,
    ).toISOString(),
    current_period_end: new Date(
      stripeSubscription.current_period_end * 1000,
    ).toISOString(),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    updated_at: now,
  };

  // Upsert subscription
  await supabaseAdmin.from("subscriptions").upsert(
    {
      store_id: storeId,
      billing_user_id: stripeSubscription.metadata?.user_id || "",
      ...subscriptionData,
    },
    {
      onConflict: "store_id",
    },
  );

  // Update store's subscription status
  await supabaseAdmin
    .from("stores")
    .update({
      subscription_status: stripeSubscription.status as SubscriptionStatus,
      updated_at: now,
    })
    .eq("id", storeId);
}

/**
 * Log billing event
 */
export async function logBillingEvent(
  eventType: string,
  storeId: string | null,
  userId: string | null,
  data: {
    subscriptionId?: string;
    stripeEventId?: string;
    amountCents?: number;
    currency?: string;
    status?: string;
    metadata?: Json;
  },
): Promise<void> {
  const supabaseAdmin = createAdminClient();

  await supabaseAdmin.from("billing_events").insert({
    event_type: eventType,
    store_id: storeId,
    user_id: userId,
    subscription_id: data.subscriptionId ?? null,
    stripe_event_id: data.stripeEventId ?? null,
    amount_cents: data.amountCents ?? null,
    currency: data.currency || "gbp",
    status: data.status || null,
    metadata: data.metadata ?? {},
  });
}
