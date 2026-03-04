import { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/api/middleware";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from "@/lib/api/response";
import { createCategorySchema } from "@/lib/validations/categories-tags";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ storeId: string }>;
}

/**
 * GET /api/stores/:storeId/categories
 * List all categories for a store
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params;

    const auth = await withApiAuth(request, {
      allowedRoles: ["Owner", "Manager", "Staff"],
      rateLimit: { key: "api", config: RATE_LIMITS.api },
      requireCSRF: false, // GET requests don't need CSRF
    });

    if (!auth.success) return auth.response;

    const { context } = auth;

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from("store_users")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", context.user.id)
      .single();

    if (!storeAccess) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    // Fetch categories with item counts
    const { data: categories, error } = await context.supabase
      .from("item_categories")
      .select(
        `
        id,
        name,
        description,
        color,
        sort_order,
        created_at,
        updated_at
      `,
      )
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    // Get item count for each category (scoped to this store to prevent cross-tenant data leak)
    const { data: itemCounts } = await context.supabase
      .from("inventory_items")
      .select("category_id")
      .eq("store_id", storeId)
      .eq("is_active", true);

    const countMap = new Map<string, number>();
    itemCounts?.forEach((item) => {
      if (item.category_id) {
        countMap.set(
          item.category_id,
          (countMap.get(item.category_id) || 0) + 1,
        );
      }
    });

    const categoriesWithCounts = categories?.map((cat) => ({
      ...cat,
      item_count: countMap.get(cat.id) || 0,
    }));

    return apiSuccess(
      { categories: categoriesWithCounts || [] },
      {
        requestId: context.requestId,
        cacheControl: "private, max-age=60, stale-while-revalidate=300",
      },
    );
  } catch (error) {
    logger.error("Error fetching categories:", { error: error });
    return apiError(
      error instanceof Error ? error.message : "Failed to fetch categories",
    );
  }
}

/**
 * POST /api/stores/:storeId/categories
 * Create a new category
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

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from("store_users")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", context.user.id)
      .single();

    if (!storeAccess) {
      return apiForbidden(
        "You do not have access to this store",
        context.requestId,
      );
    }

    if (!["Owner", "Manager"].includes(storeAccess.role)) {
      return apiForbidden(
        "Only Owners and Managers can create categories",
        context.requestId,
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCategorySchema.safeParse(body);

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map((e) => e.message).join(", "),
        context.requestId,
      );
    }

    const { name, description, color, sort_order } = validationResult.data;

    // Check for duplicate name
    const { data: existing } = await context.supabase
      .from("item_categories")
      .select("id")
      .eq("store_id", storeId)
      .eq("name", name)
      .single();

    if (existing) {
      return apiBadRequest(
        "A category with this name already exists",
        context.requestId,
      );
    }

    // Create the category
    const { data: category, error } = await context.supabase
      .from("item_categories")
      .insert({
        store_id: storeId,
        name,
        description: description || null,
        color: color || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return apiSuccess(
      {
        message: "Category created successfully",
        category,
      },
      { requestId: context.requestId, status: 201 },
    );
  } catch (error) {
    logger.error("Error creating category:", { error: error });
    return apiError(
      error instanceof Error ? error.message : "Failed to create category",
    );
  }
}
