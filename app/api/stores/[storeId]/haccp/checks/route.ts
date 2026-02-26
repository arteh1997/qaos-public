import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { haccpCheckSchema } from '@/lib/validations/haccp'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/haccp/checks - List completed HACCP checks
 *
 * Query params:
 *   - from (ISO date string) - Filter checks from this date
 *   - to (ISO date string) - Filter checks until this date
 *   - status (string) - Filter by check status (e.g. 'pass', 'fail')
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
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const status = searchParams.get('status')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('haccp_checks')
      .select('*, haccp_check_templates(name)')
      .eq('store_id', storeId)
      .order('completed_at', { ascending: false })

    if (fromDate) {
      query = query.gte('completed_at', fromDate)
    }

    if (toDate) {
      query = query.lte('completed_at', toDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    query = query.limit(100)

    const { data, error } = await query

    if (error) {
      return apiError('Failed to fetch HACCP checks')
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching HACCP checks:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch HACCP checks')
  }
}

/**
 * POST /api/stores/:storeId/haccp/checks - Submit a completed HACCP check
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
    const validation = haccpCheckSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { template_id, items, status, notes } = validation.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('haccp_checks')
      .insert({
        store_id: storeId,
        template_id: template_id || null,
        items,
        status,
        notes: notes || null,
        completed_by: context.user.id,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return apiError('Failed to submit HACCP check')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'haccp.check_submit',
      storeId,
      resourceType: 'haccp_check',
      resourceId: data.id,
      details: {
        templateId: template_id || null,
        status,
        itemCount: items.length,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error submitting HACCP check:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to submit HACCP check')
  }
}
