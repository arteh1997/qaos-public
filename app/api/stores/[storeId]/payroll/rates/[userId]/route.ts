import { NextRequest } from "next/server";
import { withApiAuth, canManageStore } from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { hourlyRateSchema } from "@/lib/validations/payroll";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ storeId: string; userId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, userId } = await params;
    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });
    if (!auth.success) return auth.response;
    const { context } = auth;

    if (!canManageStore(context, storeId)) {
      return apiForbidden(
        "You do not have permission to update payroll rates",
        context.requestId,
      );
    }

    const body = await request.json();
    const validation = hourlyRateSchema.safeParse(body);
    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map((e) => e.message).join(", "),
        context.requestId,
      );
    }

    // Verify the user belongs to this store
    const { data: storeUser } = await context.supabase
      .from("store_users")
      .select(
        "id, user_id, hourly_rate, role, user:profiles!store_users_user_id_fkey(full_name, email)",
      )
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .single();

    if (!storeUser) {
      return apiNotFound("Staff member", context.requestId);
    }

    // Prevent setting rates for Owners (they don't take hourly wages)
    if (storeUser.role === "Owner") {
      return apiForbidden(
        "Cannot set hourly rate for an Owner",
        context.requestId,
      );
    }

    // Managers can only edit Staff rates, not other Managers
    const { data: callerRecord } = await context.supabase
      .from("store_users")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", context.user.id)
      .single();

    if (callerRecord?.role === "Manager" && storeUser.role !== "Staff") {
      return apiForbidden(
        "Managers can only set rates for Staff members",
        context.requestId,
      );
    }

    const previousRate = storeUser.hourly_rate;
    const { hourly_rate } = validation.data;

    const { error } = await context.supabase
      .from("store_users")
      .update({ hourly_rate })
      .eq("store_id", storeId)
      .eq("user_id", userId);

    if (error) throw error;

    const admin = createAdminClient();
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: "payroll.rate_update",
      storeId,
      resourceType: "store_user",
      resourceId: storeUser.id,
      details: {
        employeeId: userId,
        employeeName: (storeUser.user as { full_name?: string | null } | null)
          ?.full_name,
        previousRate,
        newRate: hourly_rate,
      },
      request,
    });

    return apiSuccess({ hourly_rate }, { requestId: context.requestId });
  } catch (error) {
    logger.error("Error updating hourly rate:", { error: error });
    return apiError(
      error instanceof Error ? error.message : "Failed to update hourly rate",
    );
  }
}
