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
 * GET /api/inventory - List inventory items scoped to user's accessible stores
 * Query params:
 *   - store_id: (required) Filter items by specific store
 *   - search: Search by name or category
 *   - category: Filter by category
 *   - include_inactive: Include inactive items (default: false)
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
    const storeId = searchParams.get('store_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Require store_id parameter
    if (!storeId) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    // Verify user has access to this store
    const hasAccess = context.stores.some(s => s.store_id === storeId)
    if (!hasAccess && !context.profile?.is_platform_admin) {
      return apiError('Access denied to this store', { status: 403, requestId: context.requestId })
    }

    // Build query - now filtered by store_id for multi-tenant isolation
    let query = context.supabase
      .from('inventory_items')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId) // Multi-tenant filter

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
 * POST /api/inventory - Create a new inventory item for a specific store
 * Body must include:
 *   - store_id: Store to create item for
 *   - name: Item name (unique within store)
 *   - unit_of_measure: Unit (e.g., 'kg', 'lbs', 'units')
 *   - category: Optional category
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Require store_id in request body
    if (!body.store_id) {
      return apiBadRequest('store_id is required', context.requestId)
    }

    // Verify user has Owner/Manager access to this store
    const userRole = context.stores.find(s => s.store_id === body.store_id)?.role
    if (!userRole || !['Owner', 'Manager'].includes(userRole)) {
      if (!context.profile?.is_platform_admin) {
        return apiError('Only Owners and Managers can create inventory items', { status: 403, requestId: context.requestId })
      }
    }

    // Validate input
    const validationResult = inventoryItemSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    // Check for duplicate name within this store (case-insensitive)
    const { data: existing } = await context.supabase
      .from('inventory_items')
      .select('id')
      .eq('store_id', body.store_id)
      .ilike('name', validationResult.data.name)
      .eq('is_active', true)
      .single()

    if (existing) {
      return apiBadRequest(
        'An inventory item with this name already exists in this store',
        context.requestId
      )
    }

    // Insert with store_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item, error } = await (context.supabase as any)
      .from('inventory_items')
      .insert({
        ...validationResult.data,
        store_id: body.store_id, // Ensure store_id is set
      })
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
