import { NextRequest } from "next/server";
import {
  withApiAuth,
  canAccessStore,
  canManageStore,
} from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ storeId: string }>;
}

/**
 * GET /api/stores/:storeId/users - List store users with profile data
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager", "Staff"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
    });

    if (!auth.success) return auth.response;
    const { context } = auth;

    if (!canAccessStore(context, storeId)) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    // Use admin client to bypass RLS on profiles (need to read other users' profiles)
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("store_users")
      .select("*, user:profiles(id, email, full_name)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true });

    if (error) {
      return apiError("Failed to fetch store users");
    }

    return apiSuccess(data || [], { requestId: context.requestId });
  } catch (error) {
    logger.error("Error fetching store users:", { error });
    return apiError(
      error instanceof Error ? error.message : "Failed to fetch store users",
    );
  }
}

/**
 * POST /api/stores/:storeId/users - Add a user to a store
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });

    if (!auth.success) return auth.response;
    const { context } = auth;

    if (!canManageStore(context, storeId)) {
      return apiForbidden(
        "You do not have permission to manage users at this store",
        context.requestId,
      );
    }

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return apiBadRequest("user_id and role are required", context.requestId);
    }

    const validRoles = ["Owner", "Manager", "Staff"];
    if (!validRoles.includes(role)) {
      return apiBadRequest(
        `role must be one of: ${validRoles.join(", ")}`,
        context.requestId,
      );
    }

    const adminClient = createAdminClient();

    // Check if user already exists at this store
    const { data: existing } = await adminClient
      .from("store_users")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", user_id)
      .single();

    if (existing) {
      return apiBadRequest(
        "User is already a member of this store",
        context.requestId,
      );
    }

    // Add user to store
    const { data, error } = await adminClient
      .from("store_users")
      .insert({
        store_id: storeId,
        user_id,
        role,
        is_billing_owner: false,
      })
      .select("*, user:profiles(id, email, full_name)")
      .single();

    if (error) {
      if (error.code === "23503") {
        return apiBadRequest("User not found", context.requestId);
      }
      throw error;
    }

    await auditLog(adminClient, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: "user.add_to_store",
      storeId,
      resourceType: "store_users",
      resourceId: data.id,
      details: { addedUserId: user_id, role },
      request,
    });

    return apiSuccess(data, { requestId: context.requestId, status: 201 });
  } catch (error) {
    logger.error("Error adding user to store:", { error });
    return apiError(
      error instanceof Error ? error.message : "Failed to add user",
    );
  }
}
