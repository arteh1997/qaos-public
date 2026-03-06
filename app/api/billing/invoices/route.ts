import { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, apiForbidden } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/config";
import { logger } from "@/lib/logger";

/**
 * GET /api/billing/invoices
 * Fetch real invoices from Stripe for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
    });

    if (!auth.success) return auth.response;

    const { context } = auth;

    // Only the billing owner can view invoices
    const isBillingOwner = context.stores.some((s) => s.is_billing_owner);
    if (!isBillingOwner && !context.profile.is_platform_admin) {
      return apiForbidden(
        "Only the billing owner can view invoices",
        context.requestId,
      );
    }

    const supabase = createAdminClient();

    // Get Stripe customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Fallback: check subscriptions
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("billing_user_id", context.user.id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .single();

      customerId = subscription?.stripe_customer_id;
    }

    if (!customerId) {
      return apiSuccess([], { requestId: context.requestId });
    }

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
    });

    // Build store name lookup from subscriptions table
    const stripeSubIds = [
      ...new Set(
        invoices.data
          .map((inv) =>
            typeof inv.subscription === "string"
              ? inv.subscription
              : inv.subscription?.id,
          )
          .filter(Boolean) as string[],
      ),
    ];

    const storeNameMap = new Map<string, string>();

    if (stripeSubIds.length > 0) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, store:stores(name)")
        .in("stripe_subscription_id", stripeSubIds);

      if (subs) {
        for (const sub of subs) {
          const storeName = (sub.store as { name: string } | null)?.name;
          if (sub.stripe_subscription_id && storeName) {
            storeNameMap.set(sub.stripe_subscription_id, storeName);
          }
        }
      }
    }

    // Map to our Invoice type
    const mapped = invoices.data.map((inv) => {
      const subId =
        typeof inv.subscription === "string"
          ? inv.subscription
          : inv.subscription?.id;
      return {
        id: inv.id,
        number: inv.number,
        date: new Date(inv.created * 1000).toISOString(),
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status || "unknown",
        invoice_pdf: inv.invoice_pdf,
        hosted_invoice_url: inv.hosted_invoice_url,
        store_name: subId ? storeNameMap.get(subId) || null : null,
      };
    });

    return apiSuccess(mapped, { requestId: context.requestId });
  } catch (error) {
    logger.error("Failed to fetch invoices:", { error: error });
    return apiError(
      error instanceof Error ? error.message : "Failed to fetch invoices",
      { status: 500 },
    );
  }
}
