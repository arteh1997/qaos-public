import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { RATE_LIMITS } from '@/lib/rate-limit'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { updateCategorySchema } from '@/lib/validations/categories-tags'

interface RouteParams {
  params: Promise<{ storeId: string; categoryId: string }>
}

/**
 * PATCH /api/stores/:storeId/categories/:categoryId
 * Update a category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, categoryId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (!storeAccess) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    if (!['Owner', 'Manager'].includes(storeAccess.role)) {
      return apiForbidden('Only Owners and Managers can update categories', context.requestId)
    }

    // Verify category exists and belongs to this store
    const { data: existingCategory } = await context.supabase
      .from('item_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('store_id', storeId)
      .single()

    if (!existingCategory) {
      return apiNotFound('Category not found', context.requestId)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateCategorySchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map((e) => e.message).join(', '),
        context.requestId
      )
    }

    const updates = validationResult.data

    // If name is being changed, check for duplicates
    if (updates.name) {
      const { data: duplicate } = await context.supabase
        .from('item_categories')
        .select('id')
        .eq('store_id', storeId)
        .eq('name', updates.name)
        .neq('id', categoryId)
        .single()

      if (duplicate) {
        return apiBadRequest('A category with this name already exists', context.requestId)
      }
    }

    // Update the category
    const { data: category, error } = await context.supabase
      .from('item_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return apiSuccess(
      {
        message: 'Category updated successfully',
        category,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error updating category:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update category')
  }
}

/**
 * DELETE /api/stores/:storeId/categories/:categoryId
 * Delete a category
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, categoryId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Verify user has access to this store
    const { data: storeAccess } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    if (!storeAccess) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    if (storeAccess.role !== 'Owner') {
      return apiForbidden('Only Owners can delete categories', context.requestId)
    }

    // Verify category exists and belongs to this store
    const { data: existingCategory } = await context.supabase
      .from('item_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('store_id', storeId)
      .single()

    if (!existingCategory) {
      return apiNotFound('Category not found', context.requestId)
    }

    // Check if any items are using this category
    const { data: itemsUsingCategory } = await context.supabase
      .from('inventory_items')
      .select('id')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .limit(1)

    if (itemsUsingCategory && itemsUsingCategory.length > 0) {
      return apiBadRequest(
        'Cannot delete category that is assigned to active items. Please reassign or remove the items first.',
        context.requestId
      )
    }

    // Delete the category
    const { error } = await context.supabase
      .from('item_categories')
      .delete()
      .eq('id', categoryId)
      .eq('store_id', storeId)

    if (error) {
      throw error
    }

    return apiSuccess(
      { message: 'Category deleted successfully' },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error deleting category:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete category')
  }
}
