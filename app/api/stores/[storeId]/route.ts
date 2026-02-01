import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { storeSchema } from '@/lib/validations/store'
import { Store } from '@/types'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId - Get a single store
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check store access (uses store_users membership)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store, error } = await (context.supabase as any)
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()

    if (error || !store) {
      return apiNotFound('Store', context.requestId)
    }

    return apiSuccess(store as Store, { requestId: context.requestId })
  } catch (error) {
    console.error('Error getting store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to get store')
  }
}

/**
 * PATCH /api/stores/:storeId - Update a store
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input (partial)
    const validationResult = storeSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store, error } = await (context.supabase as any)
      .from('stores')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storeId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Store', context.requestId)
      }
      throw error
    }

    return apiSuccess(store as Store, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to update store')
  }
}

/**
 * DELETE /api/stores/:storeId - Delete a store
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check if store has any users assigned
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: userCount } = await (context.supabase as any)
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)

    if (userCount && userCount > 0) {
      return apiBadRequest(
        'Cannot delete store with assigned users. Reassign users first.',
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from('stores')
      .delete()
      .eq('id', storeId)

    if (error) throw error

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete store')
  }
}
