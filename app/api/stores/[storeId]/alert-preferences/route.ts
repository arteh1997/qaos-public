import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { computeFieldChanges } from '@/lib/audit'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const updatePreferencesSchema = z.object({
  low_stock_enabled: z.boolean().optional(),
  critical_stock_enabled: z.boolean().optional(),
  missing_count_enabled: z.boolean().optional(),
  low_stock_threshold: z.number().min(0.1).max(2.0).optional(),
  alert_frequency: z.enum(['daily', 'weekly', 'never']).optional(),
  email_enabled: z.boolean().optional(),
  preferred_hour: z.number().int().min(0).max(23).optional(),
})

/**
 * GET /api/stores/[storeId]/alert-preferences
 * Returns the current user's alert preferences for this store
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('alert_preferences')
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
        low_stock_enabled: true,
        critical_stock_enabled: true,
        missing_count_enabled: true,
        low_stock_threshold: 1.0,
        alert_frequency: 'daily',
        email_enabled: true,
        preferred_hour: 8,
        is_default: true,
      }, { requestId: context.requestId })
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching alert preferences:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch alert preferences')
  }
}

/**
 * PUT /api/stores/[storeId]/alert-preferences
 * Update (or create) the current user's alert preferences for this store
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('Access denied to this store', context.requestId)
    }

    const body = await request.json()
    const validation = updatePreferencesSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const updates = validation.data

    // Upsert with admin client (bypasses RLS — auth already verified above)
    const adminClient = createAdminClient()

    // Fetch current state for before/after tracking
    const { data: beforePrefs } = await adminClient
      .from('alert_preferences')
      .select('*')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .maybeSingle()

    const { data, error } = await adminClient
      .from('alert_preferences')
      .upsert({
        store_id: storeId,
        user_id: context.user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'store_id,user_id',
      })
      .select()
      .single()

    if (error) throw error

    const fieldChanges = beforePrefs
      ? computeFieldChanges(beforePrefs, updates)
      : Object.entries(updates).map(([field, to]) => ({ field, from: null, to }))
    void auditLog(adminClient, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'settings.alert_preferences_update',
      storeId,
      resourceType: 'alert_preferences',
      resourceId: data.id,
      details: {
        updatedFields: Object.keys(updates),
        fieldChanges,
        ...updates,
      },
      request,
    }).catch(err => logger.error('Audit log error:', { error: err }))

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating alert preferences:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update alert preferences')
  }
}
