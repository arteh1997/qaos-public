import { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/config";
import { getPaymentMethods } from "@/lib/stripe/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

const setDefaultSchema = z.object({
  action: z.literal("set_default"),
});

interface RouteParams {
  params: Promise<{ pmId: string }>;
}

/**
 * Get the Stripe customer ID for the current user
 */
async function getCustomerId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("billing_user_id", userId)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .single();

  return subscription?.stripe_customer_id || null;
}

/**
 * DELETE /api/billing/payment-methods/[pmId]
 * Remove a payment method
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { pmId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });

    if (!auth.success) return auth.response;

    const { context } = auth;

    // Only the billing owner can remove payment methods
    const isBillingOwner = context.stores.some((s) => s.is_billing_owner);
    if (!isBillingOwner && !context.profile.is_platform_admin) {
      return apiForbidden(
        "Only the billing owner can manage payment methods",
        context.requestId,
      );
    }

    const customerId = await getCustomerId(context.user.id);

    if (!customerId) {
      return apiBadRequest("No billing account found", context.requestId);
    }

    // Verify the payment method belongs to this customer
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customerId) {
      return apiForbidden(
        "This payment method does not belong to your account",
        context.requestId,
      );
    }

    // Check if this is the last payment method and user has active subs
    const supabase = createAdminClient();
    const { count: activeSubCount } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("billing_user_id", context.user.id)
      .in("status", ["active", "trialing"]);

    if (activeSubCount && activeSubCount > 0) {
      const allMethods = await getPaymentMethods(customerId);
      if (allMethods.length <= 1) {
        return apiBadRequest(
          "Cannot remove your only payment method while you have active subscriptions. Add a new card first.",
          context.requestId,
        );
      }
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(pmId);

    return apiSuccess({ detached: true }, { requestId: context.requestId });
  } catch (error) {
    logger.error("Failed to remove payment method:", { error: error });
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to remove payment method",
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/billing/payment-methods/[pmId]
 * Set a payment method as default
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { pmId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });

    if (!auth.success) return auth.response;

    const { context } = auth;

    // Only the billing owner can set a default payment method
    const isBillingOwnerPatch = context.stores.some((s) => s.is_billing_owner);
    if (!isBillingOwnerPatch && !context.profile.is_platform_admin) {
      return apiForbidden(
        "Only the billing owner can manage payment methods",
        context.requestId,
      );
    }

    const body = await request.json();

    const validation = setDefaultSchema.safeParse(body);
    if (!validation.success) {
      return apiBadRequest("Invalid action", context.requestId);
    }

    const customerId = await getCustomerId(context.user.id);

    if (!customerId) {
      return apiBadRequest("No billing account found", context.requestId);
    }

    // Verify ownership
    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (pm.customer !== customerId) {
      return apiForbidden(
        "This payment method does not belong to your account",
        context.requestId,
      );
    }

    // Set as default on customer
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    // Update all active subscriptions
    const supabase = createAdminClient();
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("billing_user_id", context.user.id)
      .in("status", ["active", "trialing", "past_due"])
      .not("stripe_subscription_id", "is", null);

    if (subscriptions) {
      await Promise.all(
        subscriptions.map((sub) =>
          stripe.subscriptions.update(sub.stripe_subscription_id!, {
            default_payment_method: pmId,
          }),
        ),
      );
    }

    return apiSuccess(
      {
        id: pm.id,
        brand: pm.card?.brand || "unknown",
        last4: pm.card?.last4 || "****",
        exp_month: pm.card?.exp_month || 0,
        exp_year: pm.card?.exp_year || 0,
        is_default: true,
      },
      { requestId: context.requestId },
    );
  } catch (error) {
    logger.error("Failed to set default payment method:", { error: error });
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to set default payment method",
      { status: 500 },
    );
  }
}
