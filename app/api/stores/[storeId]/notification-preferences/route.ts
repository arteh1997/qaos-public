import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { updateNotificationPreferencesSchema } from '@/lib/validations/notifications'
import { logger } from '@/lib/logger'

/**
 * GET /api/stores/[storeId]/notification-preferences
 * Returns the current user's notification preferences for this store
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('notification_preferences')
      .select('*')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .maybeSingle()

    if (error) throw error

    // Return defaults if no preferences exist yet
    if (!data) {
      return apiSuccess({
        store_id: storeId,
        user_id: context.user.id,
        shift_assigned: true,
        shift_updated: true,
        shift_cancelled: true,
        payslip_available: true,
        po_supplier_update: true,
        delivery_received: true,
        removed_from_store: true,
        is_default: true,
      }, { requestId: context.requestId })
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching notification preferences:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch notification preferences')
  }
}

/**
 * PUT /api/stores/[storeId]/notification-preferences
 * Update (or create) the current user's notification preferences for this store
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    const body = await request.json()
    const validation = updateNotificationPreferencesSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const updates = validation.data

    // Upsert with admin client (bypasses RLS — auth already verified above)
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient as any)
      .from('notification_preferences')
      .upsert({
        store_id: storeId,
        user_id: context.user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,store_id',
      })
      .select()
      .single()

    if (error) throw error

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating notification preferences:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update notification preferences')
  }
}
