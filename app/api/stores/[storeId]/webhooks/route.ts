import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { generateWebhookSecret } from '@/lib/api/api-keys'
import { WEBHOOK_EVENTS } from '@/lib/services/webhooks'
import { auditLog } from '@/lib/audit'

type RouteParams = { params: Promise<{ storeId: string }> }

/**
 * GET /api/stores/[storeId]/webhooks - List webhook endpoints
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Access denied', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('webhook_endpoints')
      .select('id, url, events, is_active, description, created_at, updated_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return apiSuccess(data ?? [], { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to fetch webhooks')
  }
}

/**
 * POST /api/stores/[storeId]/webhooks - Create webhook endpoint
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Only store owners can create webhooks', context.requestId)
    }

    const body = await request.json()
    const { url, events, description } = body

    if (!url || typeof url !== 'string') {
      return apiBadRequest('url is required', context.requestId)
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return apiBadRequest('URL must use HTTP or HTTPS protocol', context.requestId)
      }
    } catch {
      return apiBadRequest('Invalid URL format', context.requestId)
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return apiBadRequest('events array is required', context.requestId)
    }

    // Validate events
    const validEvents = [...Object.keys(WEBHOOK_EVENTS), '*']
    for (const event of events) {
      if (!validEvents.includes(event)) {
        return apiBadRequest(`Invalid event: ${event}. Valid events: ${validEvents.join(', ')}`, context.requestId)
      }
    }

    const secret = generateWebhookSecret()

    const { data, error } = await context.supabase
      .from('webhook_endpoints')
      .insert({
        store_id: storeId,
        created_by: context.user.id,
        url,
        secret,
        events,
        description: description || null,
      })
      .select('id, url, events, is_active, description, created_at')
      .single()

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'webhook_created', url, events },
    })

    return apiSuccess({
      ...data,
      secret, // Only returned once at creation
    }, { requestId: context.requestId, status: 201 })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to create webhook')
  }
}

/**
 * DELETE /api/stores/[storeId]/webhooks?webhookId=<id> - Delete webhook
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('Only store owners can delete webhooks', context.requestId)
    }

    const webhookId = request.nextUrl.searchParams.get('webhookId')
    if (!webhookId) {
      return apiBadRequest('webhookId is required', context.requestId)
    }

    const { error } = await context.supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', webhookId)
      .eq('store_id', storeId)

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'webhook_deleted', webhook_id: webhookId },
    })

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to delete webhook')
  }
}
