import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore, canManageStore, parsePaginationParams } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createSupplierSchema } from '@/lib/validations/suppliers'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/suppliers - List suppliers
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

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { page, pageSize, from, to } = parsePaginationParams(request)
    const searchParams = request.nextUrl.searchParams
    const active = searchParams.get('active')
    const search = searchParams.get('search')

    let query = context.supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .order('name', { ascending: true })

    if (active === 'true') {
      query = query.eq('is_active', true)
    } else if (active === 'false') {
      query = query.eq('is_active', false)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch suppliers')
    }

    const pagination = createPaginationMeta(page, pageSize, count ?? 0)

    return apiSuccess(data, {
      requestId: context.requestId,
      pagination,
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch suppliers')
  }
}

/**
 * POST /api/stores/:storeId/suppliers - Create a supplier
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

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to manage suppliers', context.requestId)
    }

    const body = await request.json()
    const validation = createSupplierSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const d = validation.data
    const { data, error } = await context.supabase
      .from('suppliers')
      .insert({
        store_id: storeId,
        name: d.name,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        contact_person: d.contact_person || null,
        payment_terms: d.payment_terms || null,
        notes: d.notes || null,
        is_active: d.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiBadRequest('A supplier with this name already exists', context.requestId)
      }
      return apiError('Failed to create supplier')
    }

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create supplier')
  }
}
