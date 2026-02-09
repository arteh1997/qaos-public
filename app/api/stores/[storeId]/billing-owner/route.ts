import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

const transferSchema = z.object({
  newBillingOwnerId: z.string().uuid('Invalid user ID'),
})

/**
 * PUT /api/stores/:storeId/billing-owner - Transfer billing ownership
 *
 * Safeguards:
 * - Only current billing owner or platform admin can transfer
 * - New billing owner must have Owner role at this store
 * - Transfer is atomic (both updates happen together)
 * - Store always has exactly one billing owner
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check if user can manage this store
    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage this store', context.requestId)
    }

    const body = await request.json()
    const validationResult = transferSchema.safeParse(body)

    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { newBillingOwnerId } = validationResult.data

    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    // Get current billing owner at this store
    const { data: currentBillingOwner } = await supabaseAdmin
      .from('store_users')
      .select('id, user_id, user:profiles(email, full_name)')
      .eq('store_id', storeId)
      .eq('is_billing_owner', true)
      .single()

    // Verify the requester is the current billing owner or platform admin
    const isCurrentBillingOwner = currentBillingOwner?.user_id === context.user.id
    const isPlatformAdmin = context.profile?.is_platform_admin

    if (!isCurrentBillingOwner && !isPlatformAdmin) {
      return apiForbidden(
        'Only the current billing owner can transfer ownership',
        context.requestId
      )
    }

    // Get the new billing owner's store_users entry
    const { data: newOwnerEntry, error: newOwnerError } = await supabaseAdmin
      .from('store_users')
      .select('id, role, user_id, user:profiles(email, full_name)')
      .eq('store_id', storeId)
      .eq('user_id', newBillingOwnerId)
      .single()

    if (newOwnerError || !newOwnerEntry) {
      return apiBadRequest(
        'The specified user is not a member of this store',
        context.requestId
      )
    }

    // Verify new billing owner has Owner role
    if (newOwnerEntry.role !== 'Owner') {
      return apiBadRequest(
        'Billing owner must have the Owner role. Please change their role to Owner first.',
        context.requestId
      )
    }

    // Can't transfer to yourself
    if (newBillingOwnerId === currentBillingOwner?.user_id) {
      return apiBadRequest('You are already the billing owner', context.requestId)
    }

    const now = new Date().toISOString()

    // Perform the transfer atomically using a transaction-like pattern
    // Remove billing owner from current owner
    const { error: removeError } = await supabaseAdmin
      .from('store_users')
      .update({ is_billing_owner: false, updated_at: now })
      .eq('id', currentBillingOwner.id)

    if (removeError) {
      throw new Error('Failed to remove billing ownership from current owner')
    }

    // Add billing owner to new owner
    const { error: addError } = await supabaseAdmin
      .from('store_users')
      .update({ is_billing_owner: true, updated_at: now })
      .eq('id', newOwnerEntry.id)

    if (addError) {
      // Rollback: restore billing owner to previous owner
      await supabaseAdmin
        .from('store_users')
        .update({ is_billing_owner: true, updated_at: now })
        .eq('id', currentBillingOwner.id)

      throw new Error('Failed to assign billing ownership to new owner')
    }

    // Also update the stores table billing_user_id
    await supabaseAdmin
      .from('stores')
      .update({ billing_user_id: newBillingOwnerId, updated_at: now })
      .eq('id', storeId)

    // Audit log
    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'store.transfer_billing',
      storeId,
      resourceType: 'store',
      details: {
        previousBillingOwner: {
          userId: currentBillingOwner?.user_id,
          email: currentBillingOwner?.user?.email,
          name: currentBillingOwner?.user?.full_name,
        },
        newBillingOwner: {
          userId: newBillingOwnerId,
          email: newOwnerEntry.user?.email,
          name: newOwnerEntry.user?.full_name,
        },
      },
      request,
    })

    return apiSuccess(
      {
        message: 'Billing ownership transferred successfully',
        previousOwner: currentBillingOwner?.user?.email,
        newOwner: newOwnerEntry.user?.email,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error transferring billing ownership:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to transfer billing ownership')
  }
}
