import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { sendNotification } from '@/lib/services/notifications'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; userId: string }>
}

/**
 * PATCH /api/stores/:storeId/users/:userId - Update a user's role at a store
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, userId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage users at this store', context.requestId)
    }

    const body = await request.json()
    const { role } = body

    if (!role) {
      return apiBadRequest('role is required', context.requestId)
    }

    const validRoles = ['Owner', 'Manager', 'Staff']
    if (!validRoles.includes(role)) {
      return apiBadRequest(`role must be one of: ${validRoles.join(', ')}`, context.requestId)
    }

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Get the store_users entry
    const { data: storeUser, error: fetchError } = await supabaseAdmin
      .from('store_users')
      .select('id, role, is_billing_owner')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !storeUser) {
      return apiNotFound('User', context.requestId)
    }

    // Prevent changing billing owner's role away from Owner
    if (storeUser.is_billing_owner && role !== 'Owner') {
      return apiBadRequest(
        'Cannot change the billing owner\'s role. Transfer billing ownership first.',
        context.requestId
      )
    }

    const previousRole = storeUser.role

    const { data, error } = await supabaseAdmin
      .from('store_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', storeUser.id)
      .select('*, user:profiles(id, email, full_name)')
      .single()

    if (error) {
      throw error
    }

    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'user.role_update',
      storeId,
      resourceType: 'store_users',
      resourceId: storeUser.id,
      details: {
        targetUserId: userId,
        previousRole,
        newRole: role,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating user role:', { error })
    return apiError(error instanceof Error ? error.message : 'Failed to update user role')
  }
}

/**
 * DELETE /api/stores/:storeId/users/:userId - Remove a user from a store
 * Handles:
 * - Preventing removal of billing owner
 * - Auto-ending any active shifts for the user
 * - Removing the store_users entry
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, userId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check if user can manage this store
    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage users at this store', context.requestId)
    }

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Get the store_users entry
    const { data: storeUser, error: fetchError } = await supabaseAdmin
      .from('store_users')
      .select('id, role, is_billing_owner, user:profiles(email, full_name)')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !storeUser) {
      return apiNotFound('User', context.requestId)
    }

    // Prevent removing billing owner
    if (storeUser.is_billing_owner) {
      return apiBadRequest(
        'Cannot remove the billing owner. Transfer billing ownership first.',
        context.requestId
      )
    }

    // Check for any active shifts (clocked in but not clocked out)
    const { data: activeShifts } = await supabaseAdmin
      .from('shifts')
      .select('id, start_time, clock_in_time')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .not('clock_in_time', 'is', null)
      .is('clock_out_time', null)

    // Auto clock out any active shifts
    if (activeShifts && activeShifts.length > 0) {
      const now = new Date().toISOString()
      const shiftIds = activeShifts.map((s: { id: string }) => s.id)

      const { error: clockOutError } = await supabaseAdmin
        .from('shifts')
        .update({
          clock_out_time: now,
          notes: 'Auto clocked out - user removed from store',
          updated_at: now,
        })
        .in('id', shiftIds)

      if (clockOutError) {
        logger.error('Error auto clocking out shifts:', { error: clockOutError })
        // Continue with removal even if clock out fails
      }
    }

    // Delete the store_users entry
    const { error: deleteError } = await supabaseAdmin
      .from('store_users')
      .delete()
      .eq('id', storeUser.id)

    if (deleteError) {
      throw deleteError
    }

    // Audit log
    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'user.remove_from_store',
      storeId,
      resourceType: 'store_users',
      details: {
        removedUserId: userId,
        removedUserEmail: storeUser.user?.email,
        removedUserName: storeUser.user?.full_name,
        role: storeUser.role,
        activeShiftsEnded: activeShifts?.length || 0,
      },
      request,
    })

    // Send removed-from-store notification (fire-and-forget)
    // Get store name for the email
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single()

    // Get the remover's name
    const { data: removerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', context.user.id)
      .single()

    sendNotification({
      type: 'removed_from_store',
      storeId,
      recipientUserId: userId,
      triggeredByUserId: context.user.id,
      data: {
        storeName: store?.name || 'the store',
        removedByName: removerProfile?.full_name || 'A manager',
        activeShiftsEnded: activeShifts?.length || 0,
      },
    }).catch(() => {})

    return apiSuccess(
      {
        message: 'User removed from store successfully',
        activeShiftsEnded: activeShifts?.length || 0,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    logger.error('Error removing user from store:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to remove user')
  }
}
