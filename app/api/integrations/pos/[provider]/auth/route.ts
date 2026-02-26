import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter } from '@/lib/services/pos'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ provider: string }>
}

/**
 * GET /api/integrations/pos/[provider]/auth?store_id=xxx
 * Initiates POS OAuth flow for the given provider.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { provider } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const adapter = getAdapter(provider)
    if (!adapter || !adapter.getAuthUrl) {
      return apiBadRequest(
        `Provider "${provider}" does not support OAuth. Use API key authentication instead.`,
        context.requestId
      )
    }

    // Generate state token
    const stateToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    const supabase = createAdminClient()
    const { error: insertError } = await supabase
      .from('integration_oauth_states')
      .insert({
        store_id: storeId,
        provider,
        state_token: stateToken,
        redirect_data: { store_id: storeId, provider },
        expires_at: expiresAt,
        created_by: context.user.id,
      })

    if (insertError) {
      return apiError('Failed to initiate OAuth flow', {
        status: 500,
        requestId: context.requestId,
      })
    }

    const authUrl = adapter.getAuthUrl(storeId, stateToken)
    return Response.redirect(authUrl, 302)
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to start POS OAuth',
      { status: 500 }
    )
  }
}
