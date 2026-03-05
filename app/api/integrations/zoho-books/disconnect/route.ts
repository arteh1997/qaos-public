import { NextRequest } from "next/server";
import { withApiAuth, canManageStore } from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeZohoBooksToken } from "@/lib/services/accounting/zoho-books";
import { auditLog } from "@/lib/audit";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

/**
 * POST /api/integrations/zoho-books/disconnect
 * Disconnect Zoho Books — revoke token and deactivate connection.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });
    if (!auth.success) return auth.response;
    const { context } = auth;

    const body = await request.json();
    const storeId = body.store_id;

    if (!storeId) {
      return apiBadRequest("store_id is required", context.requestId);
    }

    if (!canManageStore(context, storeId)) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    const supabase = createAdminClient();

    const { data: connection } = await supabase
      .from("accounting_connections")
      .select("*")
      .eq("store_id", storeId)
      .eq("provider", "zoho_books")
      .single();

    if (!connection) {
      return apiBadRequest("No Zoho Books connection found", context.requestId);
    }

    const credentials =
      connection.credentials as unknown as AccountingCredentials;
    await revokeZohoBooksToken(credentials);

    await supabase
      .from("accounting_connections")
      .update({
        is_active: false,
        credentials: {},
        sync_status: "idle",
      })
      .eq("id", connection.id);

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: "zoho_books.disconnected",
      details: {},
    });

    return apiSuccess({ disconnected: true }, { requestId: context.requestId });
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to disconnect Zoho Books",
      { status: 500 },
    );
  }
}
