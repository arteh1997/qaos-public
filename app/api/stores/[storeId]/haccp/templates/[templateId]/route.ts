import { NextRequest } from "next/server";
import { withApiAuth, canAccessStore } from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { haccpCheckTemplateSchema } from "@/lib/validations/haccp";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog, computeFieldChanges } from "@/lib/audit";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ storeId: string; templateId: string }>;
}

/**
 * GET /api/stores/:storeId/haccp/templates/:templateId - Get a single HACCP template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, templateId } = await params;

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

    const { data, error } = await context.supabase
      .from("haccp_check_templates")
      .select("*")
      .eq("id", templateId)
      .eq("store_id", storeId)
      .single();

    if (error || !data) {
      return apiNotFound("HACCP template", context.requestId);
    }

    return apiSuccess(data, { requestId: context.requestId });
  } catch (error) {
    logger.error("Error fetching HACCP template:", { error: error });
    return apiError(
      error instanceof Error ? error.message : "Failed to fetch HACCP template",
    );
  }
}

/**
 * PUT /api/stores/:storeId/haccp/templates/:templateId - Update a HACCP template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, templateId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });

    if (!auth.success) return auth.response;
    const { context } = auth;

    if (!canAccessStore(context, storeId)) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    const body = await request.json();
    const validation = haccpCheckTemplateSchema.safeParse(body);

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map((e) => e.message).join(", "),
        context.requestId,
      );
    }

    // Fetch current state for before/after tracking
    const { data: beforeTemplate } = await context.supabase
      .from("haccp_check_templates")
      .select("*")
      .eq("id", templateId)
      .eq("store_id", storeId)
      .single();

    const { data, error } = await context.supabase
      .from("haccp_check_templates")
      .update(validation.data)
      .eq("id", templateId)
      .eq("store_id", storeId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiBadRequest(
          "A template with this name already exists",
          context.requestId,
        );
      }
      return apiError("Failed to update HACCP template");
    }

    if (!data) {
      return apiNotFound("HACCP template", context.requestId);
    }

    const admin = createAdminClient();
    const fieldChanges = beforeTemplate
      ? computeFieldChanges(beforeTemplate, validation.data)
      : [];
    void auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: "haccp.template_update",
      storeId,
      resourceType: "haccp_check_template",
      resourceId: templateId,
      details: {
        templateName: data.name,
        updatedFields: Object.keys(validation.data),
        fieldChanges,
      },
      request,
    }).catch((err) => logger.error("Audit log error:", { error: err }));

    return apiSuccess(data, { requestId: context.requestId });
  } catch (error) {
    logger.error("Error updating HACCP template:", { error: error });
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to update HACCP template",
    );
  }
}

/**
 * DELETE /api/stores/:storeId/haccp/templates/:templateId - Soft delete (deactivate) a HACCP template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, templateId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: true,
    });

    if (!auth.success) return auth.response;
    const { context } = auth;

    if (!canAccessStore(context, storeId)) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    // Fetch template name before deactivating for audit log
    const { data: existing } = await context.supabase
      .from("haccp_check_templates")
      .select("name")
      .eq("id", templateId)
      .eq("store_id", storeId)
      .single();

    if (!existing) {
      return apiNotFound("HACCP template", context.requestId);
    }

    const { error } = await context.supabase
      .from("haccp_check_templates")
      .update({ is_active: false })
      .eq("id", templateId)
      .eq("store_id", storeId);

    if (error) {
      return apiError("Failed to deactivate HACCP template");
    }

    const admin = createAdminClient();
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: "haccp.template_delete",
      storeId,
      resourceType: "haccp_check_template",
      resourceId: templateId,
      details: { templateName: existing.name },
      request,
    });

    return apiSuccess(
      { message: "HACCP template deactivated successfully" },
      { requestId: context.requestId },
    );
  } catch (error) {
    logger.error("Error deactivating HACCP template:", { error: error });
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to deactivate HACCP template",
    );
  }
}
