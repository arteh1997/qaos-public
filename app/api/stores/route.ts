import { NextRequest } from 'next/server'
import { withApiAuth, parsePaginationParams, parseFilterParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  createPaginationMeta,
  sanitizeSearchQuery,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { storeSchema } from '@/lib/validations/store'
import { Store } from '@/types'

/**
 * GET /api/stores - List all stores with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { page, pageSize, from, to } = parsePaginationParams(request)
    const { search, status } = parseFilterParams(request)

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('stores')
      .select('*', { count: 'exact' })

    // Apply search filter (sanitized to prevent query manipulation)
    if (search) {
      const sanitizedSearch = sanitizeSearchQuery(search)
      if (sanitizedSearch) {
        query = query.or(`name.ilike.%${sanitizedSearch}%,address.ilike.%${sanitizedSearch}%`)
      }
    }

    // Apply status filter
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // For Staff, only show their store
    if (context.profile.role === 'Staff' && context.profile.store_id) {
      query = query.eq('id', context.profile.store_id)
    }

    const { data, error, count } = await query
      .order('name')
      .range(from, to)

    if (error) throw error

    const stores = data as Store[]
    const totalItems = count ?? 0

    return apiSuccess(stores, {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, totalItems),
    })
  } catch (error) {
    console.error('Error listing stores:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to list stores')
  }
}

/**
 * POST /api/stores - Create a new store
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Admin'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Validate input
    const validationResult = storeSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store, error } = await (context.supabase as any)
      .from('stores')
      .insert(validationResult.data)
      .select()
      .single()

    if (error) throw error

    return apiSuccess(store as Store, {
      requestId: context.requestId,
      status: 201,
    })
  } catch (error) {
    console.error('Error creating store:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create store')
  }
}
