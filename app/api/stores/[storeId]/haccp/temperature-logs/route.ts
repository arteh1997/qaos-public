import { NextRequest } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { haccpTemperatureLogSchema } from '@/lib/validations/haccp'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/haccp/temperature-logs - List temperature logs
 *
 * Query params:
 *   - from (ISO date string) - Filter logs from this date
 *   - to (ISO date string) - Filter logs until this date
 *   - location (string) - Filter by location name
 *   - out_of_range_only (boolean) - Only show out-of-range readings
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
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const location = searchParams.get('location')
    const outOfRangeOnly = searchParams.get('out_of_range_only') === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (context.supabase as any)
      .from('haccp_temperature_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('recorded_at', { ascending: false })

    if (fromDate) {
      query = query.gte('recorded_at', fromDate)
    }

    if (toDate) {
      query = query.lte('recorded_at', toDate)
    }

    if (location) {
      query = query.eq('location_name', location)
    }

    if (outOfRangeOnly) {
      query = query.eq('is_in_range', false)
    }

    query = query.limit(100)

    const { data, error } = await query

    if (error) {
      return apiError('Failed to fetch temperature logs')
    }

    return apiSuccess(data, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching temperature logs:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch temperature logs')
  }
}

/**
 * POST /api/stores/:storeId/haccp/temperature-logs - Log a temperature reading
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response
    const { context } = auth

    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const validation = haccpTemperatureLogSchema.safeParse(body)

    if (!validation.success) {
      return apiBadRequest(
        validation.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const { location_name, temperature_celsius, min_temp, max_temp, corrective_action } = validation.data

    // Compute whether temperature is within range
    let is_in_range = true
    if (min_temp != null && max_temp != null) {
      is_in_range = temperature_celsius >= min_temp && temperature_celsius <= max_temp
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from('haccp_temperature_logs')
      .insert({
        store_id: storeId,
        location_name,
        temperature_celsius,
        min_temp: min_temp ?? null,
        max_temp: max_temp ?? null,
        is_in_range,
        corrective_action: corrective_action || null,
        recorded_by: context.user.id,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return apiError('Failed to log temperature')
    }

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'haccp.temperature_log',
      storeId,
      resourceType: 'haccp_temperature_log',
      resourceId: data.id,
      details: {
        locationName: location_name,
        temperatureCelsius: temperature_celsius,
        isInRange: is_in_range,
        minTemp: min_temp ?? null,
        maxTemp: max_temp ?? null,
      },
      request,
    })

    return apiSuccess(data, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error logging temperature:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to log temperature')
  }
}
