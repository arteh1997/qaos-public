import { NextRequest } from 'next/server'
import { withApiAuth, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  createPaginationMeta,
  sanitizeSearchQuery,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { inventoryItemSchema } from '@/lib/validations/inventory'
import { InventoryItem } from '@/types'

/**
 * GET /api/inventory - List all inventory items
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const { page, pageSize, from, to } = parsePaginationParams(request)
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Build query
    let query = context.supabase
      .from('inventory_items')
      .select('*', { count: 'exact' })

    // Filter by active status (default: only active)
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    // Apply search filter (sanitized to prevent query manipulation)
    if (search) {
      const sanitizedSearch = sanitizeSearchQuery(search)
      if (sanitizedSearch) {
        query = query.or(`name.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`)
      }
    }

    // Filter by category
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error, count } = await query
      .order('name')
      .range(from, to)

    if (error) throw error

    return apiSuccess(data as InventoryItem[], {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count ?? 0),
    })
  } catch (error) {
    console.error('Error listing inventory items:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to list inventory items')
  }
}

/**
 * POST /api/inventory - Create a new inventory item
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
    const validationResult = inventoryItemSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Check for duplicate name
    const { data: existing } = await context.supabase
      .from('inventory_items')
      .select('id')
      .ilike('name', validationResult.data.name)
      .single()

    if (existing) {
      return apiBadRequest(
        'An inventory item with this name already exists',
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item, error } = await (context.supabase as any)
      .from('inventory_items')
      .insert(validationResult.data)
      .select()
      .single()

    if (error) throw error

    return apiSuccess(item as InventoryItem, {
      requestId: context.requestId,
      status: 201,
    })
  } catch (error) {
    console.error('Error creating inventory item:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create inventory item')
  }
}
