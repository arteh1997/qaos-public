import { NextRequest } from "next/server";
import { withApiAuth, canAccessStore } from "@/lib/api/middleware";
import { apiSuccess, apiError, apiForbidden } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ storeId: string }>;
}

/**
 * GET /api/stores/:storeId/haccp/dashboard - HACCP compliance dashboard
 *
 * Returns aggregated data:
 *   - Today's checks (total, passed, failed)
 *   - Today's out-of-range temperature logs
 *   - Unresolved corrective actions count
 *   - Compliance score
 *   - Recent checks and out-of-range alerts
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

    // HACCP tables are not yet in the generated Database type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Fetch today's checks
    const { data: todayChecks, error: checksError } = await db
      .from("haccp_checks")
      .select("id, status, completed_at, template_id")
      .eq("store_id", storeId)
      .gte("completed_at", todayISO);

    if (checksError) {
      return apiError("Failed to fetch HACCP dashboard data");
    }

    const totalChecks = todayChecks?.length ?? 0;
    const passedChecks =
      todayChecks?.filter((c) => c.status === "pass").length ?? 0;
    const failedChecks =
      todayChecks?.filter((c) => c.status === "fail").length ?? 0;

    // Fetch today's out-of-range temperature logs
    const { data: outOfRangeLogs, error: tempError } = await db
      .from("haccp_temperature_logs")
      .select("id")
      .eq("store_id", storeId)
      .eq("is_in_range", false)
      .gte("recorded_at", todayISO);

    if (tempError) {
      return apiError("Failed to fetch HACCP dashboard data");
    }

    const outOfRangeCount = outOfRangeLogs?.length ?? 0;

    // Fetch unresolved corrective actions count
    const { data: unresolvedActions, error: actionsError } = await db
      .from("haccp_corrective_actions")
      .select("id")
      .eq("store_id", storeId)
      .is("resolved_at", null);

    if (actionsError) {
      return apiError("Failed to fetch HACCP dashboard data");
    }

    const unresolvedCount = unresolvedActions?.length ?? 0;

    // Calculate compliance score
    const compliance_score =
      totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

    // Fetch recent 5 checks
    const { data: recentChecks } = await db
      .from("haccp_checks")
      .select("*, haccp_check_templates(name)")
      .eq("store_id", storeId)
      .order("completed_at", { ascending: false })
      .limit(5);

    // Fetch recent 5 out-of-range temperature alerts
    const { data: recentAlerts } = await db
      .from("haccp_temperature_logs")
      .select("*")
      .eq("store_id", storeId)
      .eq("is_in_range", false)
      .order("recorded_at", { ascending: false })
      .limit(5);

    // Determine which templates are due (not yet completed today)
    const { data: activeTemplates } = await db
      .from("haccp_check_templates")
      .select("id, name, frequency")
      .eq("store_id", storeId)
      .eq("is_active", true);
    const completedTemplateIds = new Set(
      (todayChecks || []).map((c) => c.template_id).filter(Boolean),
    );

    // For weekly templates, also check if completed this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    let weeklyCompletedIds = new Set<string>();
    const weeklyTemplates = (activeTemplates || []).filter(
      (t) => t.frequency === "weekly",
    );
    if (weeklyTemplates.length > 0) {
      const { data: weekChecks } = await db
        .from("haccp_checks")
        .select("template_id")
        .eq("store_id", storeId)
        .gte("completed_at", weekStart.toISOString())
        .in(
          "template_id",
          weeklyTemplates.map((t) => t.id),
        );
      weeklyCompletedIds = new Set(
        (weekChecks || [])
          .map((c) => c.template_id)
          .filter(Boolean) as string[],
      );
    }

    const dueChecks = (activeTemplates || [])
      .filter((t) => {
        if (t.frequency === "weekly") {
          return !weeklyCompletedIds.has(t.id);
        }
        // daily and shift templates — check if done today
        return !completedTemplateIds.has(t.id);
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        frequency: t.frequency,
      }));

    return apiSuccess(
      {
        today: {
          total_checks: totalChecks,
          passed_checks: passedChecks,
          failed_checks: failedChecks,
          out_of_range_temps: outOfRangeCount,
        },
        unresolved_corrective_actions: unresolvedCount,
        compliance_score,
        recent_checks: recentChecks || [],
        recent_temp_alerts: recentAlerts || [],
        due_checks: dueChecks,
      },
      { requestId: context.requestId },
    );
  } catch (error) {
    logger.error("Error fetching HACCP dashboard:", { error: error });
    return apiError(
      error instanceof Error
        ? error.message
        : "Failed to fetch HACCP dashboard",
    );
  }
}
