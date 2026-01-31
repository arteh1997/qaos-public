import { NextRequest } from 'next/server'
import { withApiAuth, parsePaginationParams, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  createPaginationMeta,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { shiftSchema } from '@/lib/validations/shift'
import { sanitizeNotes } from '@/lib/utils'
import { Shift } from '@/types'

/**
 * GET /api/shifts - List shifts with filters
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
    const storeId = searchParams.get('store_id')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('shifts')
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `, { count: 'exact' })

    // Staff can only see their own shifts
    if (context.profile.role === 'Staff') {
      query = query.eq('user_id', context.user.id)
      if (context.profile.store_id) {
        query = query.eq('store_id', context.profile.store_id)
      }
    } else {
      // Apply filters for Admin/Driver
      if (storeId) {
        query = query.eq('store_id', storeId)
      }
      if (userId) {
        query = query.eq('user_id', userId)
      }
    }

    // Date filters
    if (startDate) {
      query = query.gte('start_time', `${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      query = query.lte('end_time', `${endDate}T23:59:59.999Z`)
    }

    const { data, error, count } = await query
      .order('start_time', { ascending: false })
      .range(from, to)

    if (error) throw error

    return apiSuccess(data as Shift[], {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count ?? 0),
    })
  } catch (error) {
    console.error('Error listing shifts:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to list shifts')
  }
}

/**
 * POST /api/shifts - Create a new shift
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
    const validationResult = shiftSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const data = validationResult.data

    // Check for overlapping shifts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingShifts } = await (context.supabase as any)
      .from('shifts')
      .select('id')
      .eq('user_id', data.user_id)
      .or(`and(start_time.lte.${data.end_time},end_time.gte.${data.start_time})`)

    if (existingShifts && existingShifts.length > 0) {
      return apiBadRequest(
        'User already has a shift during this time',
        context.requestId
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shift, error } = await (context.supabase as any)
      .from('shifts')
      .insert({
        store_id: data.store_id,
        user_id: data.user_id,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: sanitizeNotes(data.notes),
      })
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .single()

    if (error) throw error

    return apiSuccess(shift as Shift, {
      requestId: context.requestId,
      status: 201,
    })
  } catch (error) {
    console.error('Error creating shift:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to create shift')
  }
}
