import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ storeId: string; userId: string }>
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
        console.error('Error auto clocking out shifts:', clockOutError)
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

    return apiSuccess(
      {
        message: 'User removed from store successfully',
        activeShiftsEnded: activeShifts?.length || 0,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error removing user from store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to remove user')
  }
}
