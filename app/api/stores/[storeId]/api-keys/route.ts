import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { generateApiKey, API_SCOPES } from '@/lib/api/api-keys'
import { auditLog } from '@/lib/audit'

type RouteParams = { params: Promise<{ storeId: string }> }

/**
 * GET /api/stores/[storeId]/api-keys - List API keys for a store
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
      return apiForbidden('You cannot manage API keys for this store', context.requestId)
    }

    const { data, error } = await context.supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return apiSuccess(data ?? [], { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to fetch API keys')
  }
}

/**
 * POST /api/stores/[storeId]/api-keys - Create a new API key
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
      return apiForbidden('Only store owners can create API keys', context.requestId)
    }

    const body = await request.json()
    const { name, scopes, expires_in_days } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiBadRequest('name is required', context.requestId)
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return apiBadRequest('scopes array is required', context.requestId)
    }

    // Validate scopes
    const validScopes = Object.keys(API_SCOPES)
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        return apiBadRequest(`Invalid scope: ${scope}. Valid scopes: ${validScopes.join(', ')}`, context.requestId)
      }
    }

    const { key, keyHash, keyPrefix } = generateApiKey()

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await context.supabase
      .from('api_keys')
      .insert({
        store_id: storeId,
        created_by: context.user.id,
        name: name.trim(),
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        expires_at: expiresAt,
      })
      .select('id, name, key_prefix, scopes, expires_at, created_at')
      .single()

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'api_key_created', key_name: name, scopes },
    })

    return apiSuccess({
      ...data,
      key, // IMPORTANT: Only returned once at creation
    }, { requestId: context.requestId, status: 201 })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to create API key')
  }
}

/**
 * DELETE /api/stores/[storeId]/api-keys?keyId=<id> - Revoke an API key
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
      return apiForbidden('Only store owners can revoke API keys', context.requestId)
    }

    const keyId = request.nextUrl.searchParams.get('keyId')
    if (!keyId) {
      return apiBadRequest('keyId is required', context.requestId)
    }

    const { error } = await context.supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('store_id', storeId)

    if (error) throw error

    await auditLog(context.supabase, {
      userId: context.user.id,
      storeId,
      action: 'settings.update',
      details: { action: 'api_key_revoked', key_id: keyId },
    })

    return apiSuccess({ revoked: true }, { requestId: context.requestId })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to revoke API key')
  }
}
