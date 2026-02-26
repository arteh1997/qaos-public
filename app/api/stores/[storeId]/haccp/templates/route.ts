import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { haccpCheckTemplateSchema } from '@/lib/validations/haccp'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/haccp/templates - List HACCP check templates
 *
 * Query params:
 *   - active_only (boolean) - Filter to only active templates
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
    const activeOnly = searchParams.get('active_only') === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('haccp_check_templates')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      return apiError('Failed to fetch HACCP templates')
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching HACCP templates:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch HACCP templates')
  }
}

/**
 * POST /api/stores/:storeId/haccp/templates - Create a HACCP check template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const validation = haccpCheckTemplateSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { name, description, frequency, items, is_active } = validation.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('haccp_check_templates')
      .insert({
        store_id: storeId,
        name,
        description: description || null,
        frequency,
        items,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('A template with this name already exists', context.requestId)
      }
      return apiError('Failed to create HACCP template')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'haccp.template_create',
      storeId,
      resourceType: 'haccp_check_template',
      resourceId: data.id,
      details: { templateName: name, frequency, itemCount: items.length },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error creating HACCP template:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create HACCP template')
  }
}
