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
import { addTagsToItemSchema, removeTagsFromItemSchema } from '@/lib/validations/categories-tags'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; itemId: string }>
}

/**
 * GET /api/stores/:storeId/inventory/:itemId/tags
 * Get all tags for an inventory item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, itemId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: false,
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

    // Verify item exists and belongs to this store
    const { data: itemExists } = await context.supabase
      .from('store_inventory')
      .select('id')
      .eq('inventory_item_id', itemId)
      .eq('store_id', storeId)
      .single()

    if (!itemExists) {
      return apiNotFound('Inventory item not found', context.requestId)
    }

    // Get all tags for this item
    const { data: itemTags, error } = await context.supabase
      .from('inventory_item_tags')
      .select('tag_id, item_tags(id, name, description, color)')
      .eq('inventory_item_id', itemId)

    if (error) {
      throw error
    }

    // Format the response
    const tags = itemTags?.map((it) => {
      const tag = Array.isArray(it.item_tags) ? it.item_tags[0] : it.item_tags
      return tag
    }).filter(Boolean) || []

    return apiSuccess(
      { tags },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error fetching item tags:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch item tags')
  }
}

/**
 * POST /api/stores/:storeId/inventory/:itemId/tags
 * Add tags to an inventory item
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, itemId } = await params

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
      return apiForbidden('Only Owners and Managers can manage item tags', context.requestId)
    }

    // Verify item exists and belongs to this store
    const { data: itemExists } = await context.supabase
      .from('store_inventory')
      .select('id')
      .eq('inventory_item_id', itemId)
      .eq('store_id', storeId)
      .single()

    if (!itemExists) {
      return apiNotFound('Inventory item not found', context.requestId)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = addTagsToItemSchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map((e) => e.message).join(', '),
        context.requestId
      )
    }

    const { tagIds } = validationResult.data

    // Verify all tags belong to this store
    const { data: storeTags } = await context.supabase
      .from('item_tags')
      .select('id')
      .eq('store_id', storeId)
      .in('id', tagIds)

    if (!storeTags || storeTags.length !== tagIds.length) {
      return apiBadRequest(
        'One or more tags do not belong to this store',
        context.requestId
      )
    }

    // Get existing tags to avoid duplicates
    const { data: existingTags } = await context.supabase
      .from('inventory_item_tags')
      .select('tag_id')
      .eq('inventory_item_id', itemId)

    const existingTagIds = new Set(existingTags?.map((t) => t.tag_id) || [])
    const newTagIds = tagIds.filter((id) => !existingTagIds.has(id))

    if (newTagIds.length === 0) {
      return apiBadRequest('All specified tags are already assigned to this item', context.requestId)
    }

    // Insert new tag assignments
    const { error } = await context.supabase
      .from('inventory_item_tags')
      .insert(
        newTagIds.map((tagId) => ({
          inventory_item_id: itemId,
          tag_id: tagId,
        }))
      )

    if (error) {
      throw error
    }

    // Fetch updated tags list
    const { data: updatedTags } = await context.supabase
      .from('inventory_item_tags')
      .select('tag_id, item_tags(id, name, description, color)')
      .eq('inventory_item_id', itemId)

    const tags = updatedTags?.map((it) => {
      const tag = Array.isArray(it.item_tags) ? it.item_tags[0] : it.item_tags
      return tag
    }).filter(Boolean) || []

    return apiSuccess(
      {
        message: `${newTagIds.length} tag(s) added successfully`,
        tags,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error adding item tags:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to add item tags')
  }
}

/**
 * DELETE /api/stores/:storeId/inventory/:itemId/tags
 * Remove tags from an inventory item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, itemId } = await params

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
      return apiForbidden('Only Owners and Managers can manage item tags', context.requestId)
    }

    // Verify item exists and belongs to this store
    const { data: itemExists } = await context.supabase
      .from('store_inventory')
      .select('id')
      .eq('inventory_item_id', itemId)
      .eq('store_id', storeId)
      .single()

    if (!itemExists) {
      return apiNotFound('Inventory item not found', context.requestId)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = removeTagsFromItemSchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map((e) => e.message).join(', '),
        context.requestId
      )
    }

    const { tagIds } = validationResult.data

    // If no tagIds specified, remove all tags
    if (!tagIds || tagIds.length === 0) {
      const { error } = await context.supabase
        .from('inventory_item_tags')
        .delete()
        .eq('inventory_item_id', itemId)

      if (error) {
        throw error
      }

      return apiSuccess(
        { message: 'All tags removed successfully', tags: [] },
        { requestId: context.requestId }
      )
    }

    // Remove specific tags
    const { error } = await context.supabase
      .from('inventory_item_tags')
      .delete()
      .eq('inventory_item_id', itemId)
      .in('tag_id', tagIds)

    if (error) {
      throw error
    }

    // Fetch remaining tags
    const { data: remainingTags } = await context.supabase
      .from('inventory_item_tags')
      .select('tag_id, item_tags(id, name, description, color)')
      .eq('inventory_item_id', itemId)

    const tags = remainingTags?.map((it) => {
      const tag = Array.isArray(it.item_tags) ? it.item_tags[0] : it.item_tags
      return tag
    }).filter(Boolean) || []

    return apiSuccess(
      {
        message: `${tagIds.length} tag(s) removed successfully`,
        tags,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error removing item tags:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to remove item tags')
  }
}
