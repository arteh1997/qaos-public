import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { storeSchema } from '@/lib/validations/store'
import { Store } from '@/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId - Get a single store
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check store access (uses store_users membership)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store, error } = await (context.supabase as any)
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()

    if (error || !store) {
      return apiNotFound('Store', context.requestId)
    }

    return apiSuccess(store as Store, { requestId: context.requestId })
  } catch (error) {
    console.error('Error getting store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to get store')
  }
}

/**
 * PATCH /api/stores/:storeId - Update a store
 *
 * When deactivating a store (is_active = false):
 * - All pending invites for this store are automatically cancelled
 * - Audit log records the deactivation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Verify user can manage this store
    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage this store', context.requestId)
    }

    // Validate input (partial)
    const validationResult = storeSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const updateData = validationResult.data
    const isDeactivating = updateData.is_active === false

    // If deactivating, cancel all pending invites for this store
    let cancelledInvites = 0
    if (isDeactivating) {
      const adminClient = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAdmin = adminClient as any

      // Get pending invites before deleting (for audit)
      const { data: pendingInvites } = await supabaseAdmin
        .from('user_invites')
        .select('id, email, role')
        .eq('store_id', storeId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())

      cancelledInvites = pendingInvites?.length || 0

      // Delete pending invites for this store
      if (cancelledInvites > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('user_invites')
          .delete()
          .eq('store_id', storeId)
          .is('used_at', null)

        if (deleteError) {
          console.error('Error cancelling invites:', deleteError)
          // Continue with deactivation even if invite cancellation fails
        }
      }

      // Also handle invites for Drivers that include this store in store_ids array
      const { data: driverInvites } = await supabaseAdmin
        .from('user_invites')
        .select('id, store_ids')
        .is('used_at', null)
        .contains('store_ids', [storeId])

      // Remove this store from driver invite store_ids
      if (driverInvites && driverInvites.length > 0) {
        for (const invite of driverInvites) {
          const updatedStoreIds = (invite.store_ids || []).filter((id: string) => id !== storeId)
          if (updatedStoreIds.length === 0) {
            // Delete invite if no stores left
            await supabaseAdmin
              .from('user_invites')
              .delete()
              .eq('id', invite.id)
            cancelledInvites++
          } else {
            // Update invite with remaining stores
            await supabaseAdmin
              .from('user_invites')
              .update({ store_ids: updatedStoreIds })
              .eq('id', invite.id)
          }
        }
      }

      // Audit log the deactivation
      await auditLog(supabaseAdmin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: 'store.deactivate',
        storeId,
        resourceType: 'store',
        details: {
          cancelledInvites,
          cancelledInviteEmails: pendingInvites?.map((i: { email: string }) => i.email) || [],
        },
        request,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store, error } = await (context.supabase as any)
      .from('stores')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Store', context.requestId)
      }
      throw error
    }

    // Include cancelled invite count in response if deactivating
    const response = isDeactivating && cancelledInvites > 0
      ? { ...store, _meta: { cancelledInvites } }
      : store

    return apiSuccess(response as Store, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update store')
  }
}

/**
 * DELETE /api/stores/:storeId - Delete a store
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check if store has any users assigned via store_users table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: userCount } = await (context.supabase as any)
      .from('store_users')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)

    if (userCount && userCount > 0) {
      return apiBadRequest(
        'Cannot delete store with assigned users. Remove all users from the store first.',
        context.requestId
      )
    }

    // Also check for pending invitations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: inviteCount } = await (context.supabase as any)
      .from('user_invites')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('used_at', null)

    if (inviteCount && inviteCount > 0) {
      return apiBadRequest(
        'Cannot delete store with pending invitations. Cancel invitations first.',
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from('stores')
      .delete()
      .eq('id', storeId)

    if (error) throw error

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete store')
  }
}
