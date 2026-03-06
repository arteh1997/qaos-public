import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api/middleware";
import { generateCSVTemplate } from "@/lib/validations/bulk-import";
import { logger } from "@/lib/logger";

/**
 * GET /api/users/bulk-import/template
 * Download CSV template for bulk importing users
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner"],
    });

    if (!auth.success) return auth.response;

    const csvContent = generateCSVTemplate();

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition":
          'attachment; filename="user-import-template.csv"',
      },
    });
  } catch (error) {
    logger.error("[UserBulkImportTemplate] Error:", { error });
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
