import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { haccpCorrectiveActionSchema } from '@/lib/validations/haccp'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/haccp/corrective-actions - List corrective actions
 *
 * Query params:
 *   - unresolved_only (boolean) - Only show unresolved actions
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const searchParams = request.nextUrl.searchParams
    const unresolvedOnly = searchParams.get('unresolved_only') === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('haccp_corrective_actions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (unresolvedOnly) {
      query = query.is('resolved_at', null)
    }

    query = query.limit(100)

    const { data, error } = await query

    if (error) {
      return apiError('Failed to fetch corrective actions')
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching corrective actions:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch corrective actions')
  }
}

/**
 * POST /api/stores/:storeId/haccp/corrective-actions - Create a corrective action
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const validation = haccpCorrectiveActionSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { check_id, temp_log_id, description, action_taken } = validation.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('haccp_corrective_actions')
      .insert({
        store_id: storeId,
        check_id: check_id || null,
        temp_log_id: temp_log_id || null,
        description,
        action_taken: action_taken || null,
      })
      .select()
      .single()

    if (error) {
      return apiError('Failed to create corrective action')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'haccp.corrective_action_create',
      storeId,
      resourceType: 'haccp_corrective_action',
      resourceId: data.id,
      details: {
        description,
        checkId: check_id || null,
        tempLogId: temp_log_id || null,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error creating corrective action:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create corrective action')
  }
}
