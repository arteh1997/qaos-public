import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { haccpCorrectiveActionResolveSchema } from '@/lib/validations/haccp'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string; actionId: string }>
}

/**
 * PUT /api/stores/:storeId/haccp/corrective-actions/:actionId - Resolve a corrective action
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, actionId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const validation = haccpCorrectiveActionResolveSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { action_taken } = validation.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('haccp_corrective_actions')
      .update({
        action_taken,
        resolved_by: context.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error || !data) {
      return apiNotFound('Corrective action', context.requestId)
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'haccp.corrective_action_resolve',
      storeId,
      resourceType: 'haccp_corrective_action',
      resourceId: actionId,
      details: {
        actionTaken: action_taken,
        description: data.description,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error resolving corrective action:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to resolve corrective action')
  }
}
