import { NextRequest } from "next/server";
import { withApiAuth, canManageStore } from "@/lib/api/middleware";
import { apiError, apiBadRequest, apiForbidden } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFreshbooksAuthUrl } from "@/lib/services/accounting/freshbooks";
import crypto from "crypto";

const STATE_EXPIRY_MINUTES = 10;

/**
 * GET /api/integrations/freshbooks/auth?store_id=xxx
 * Initiates FreshBooks OAuth flow — generates state token and redirects.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
    });
    if (!auth.success) return auth.response;
    const { context } = auth;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("store_id");

    if (!storeId) {
      return apiBadRequest("store_id is required", context.requestId);
    }

    if (!canManageStore(context, storeId)) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    const stateToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    const supabase = createAdminClient();
    const { error: insertError } = await supabase
      .from("integration_oauth_states")
      .insert({
        store_id: storeId,
        provider: "freshbooks",
        state_token: stateToken,
        redirect_data: { store_id: storeId },
        expires_at: expiresAt,
        created_by: context.user.id,
      });

    if (insertError) {
      return apiError("Failed to initiate OAuth flow", {
        status: 500,
        requestId: context.requestId,
      });
    }

    const authUrl = getFreshbooksAuthUrl(stateToken);

    return Response.redirect(authUrl, 302);
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to start FreshBooks OAuth",
      { status: 500 },
    );
  }
}
