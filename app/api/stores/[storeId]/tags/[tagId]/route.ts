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
import { updateTagSchema } from '@/lib/validations/categories-tags'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; tagId: string }>
}

/**
 * PATCH /api/stores/:storeId/tags/:tagId
 * Update a tag
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, tagId } = await params

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
      return apiForbidden('Only Owners and Managers can update tags', context.requestId)
    }

    // Verify tag exists and belongs to this store
    const { data: existingTag } = await context.supabase
      .from('item_tags')
      .select('id')
      .eq('id', tagId)
      .eq('store_id', storeId)
      .single()

    if (!existingTag) {
      return apiNotFound('Tag not found', context.requestId)
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateTagSchema.safeParse(body)

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
        .from('item_tags')
        .select('id')
        .eq('store_id', storeId)
        .eq('name', updates.name)
        .neq('id', tagId)
        .single()

      if (duplicate) {
        return apiBadRequest('A tag with this name already exists', context.requestId)
      }
    }

    // Update the tag
    const { data: tag, error } = await context.supabase
      .from('item_tags')
      .update(updates)
      .eq('id', tagId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return apiSuccess(
      {
        message: 'Tag updated successfully',
        tag,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error updating tag:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update tag')
  }
}

/**
 * DELETE /api/stores/:storeId/tags/:tagId
 * Delete a tag
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, tagId } = await params

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
      return apiForbidden('Only Owners can delete tags', context.requestId)
    }

    // Verify tag exists and belongs to this store
    const { data: existingTag } = await context.supabase
      .from('item_tags')
      .select('id')
      .eq('id', tagId)
      .eq('store_id', storeId)
      .single()

    if (!existingTag) {
      return apiNotFound('Tag not found', context.requestId)
    }

    // Delete the tag (cascade will remove from inventory_item_tags)
    const { error } = await context.supabase
      .from('item_tags')
      .delete()
      .eq('id', tagId)
      .eq('store_id', storeId)

    if (error) {
      throw error
    }

    return apiSuccess(
      { message: 'Tag deleted successfully' },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error deleting tag:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete tag')
  }
}
