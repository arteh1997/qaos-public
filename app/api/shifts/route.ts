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
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { sendNotification } from '@/lib/services/notifications'
import { formatShiftDate, formatShiftTime, calculateDuration } from '@/lib/utils/format-shift'
import { Shift } from '@/types'
import { logger } from '@/lib/logger'

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

    // Staff can only see their own shifts at their assigned stores
    const isStaffOnly = context.stores?.every(s => s.role === 'Staff') ?? false
    if (isStaffOnly) {
      query = query.eq('user_id', context.user.id)
      // Filter to only their stores
      const staffStoreIds = context.stores?.filter(s => s.role === 'Staff').map(s => s.store_id) ?? []
      if (staffStoreIds.length > 0) {
        query = query.in('store_id', staffStoreIds)
      }
    } else {
      // Owner/Manager: scope to their accessible stores
      if (storeId) {
        query = query.eq('store_id', storeId)
      } else {
        // No store_id specified — scope to all stores the user belongs to
        const userStoreIds = context.stores?.map(s => s.store_id) ?? []
        if (userStoreIds.length > 0) {
          query = query.in('store_id', userStoreIds)
        }
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
    logger.error('Error listing shifts:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to list shifts')
  }
}

/**
 * POST /api/shifts - Create a new shift
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

    // Validate input
    const validationResult = shiftSchema.safeParse(body)
    if (!validationResult.success) {
      return apiBadRequest(
        validationResult.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const data = validationResult.data

    // Prevent creating shifts in the past (allow a 5-minute grace period for timezone differences)
    const shiftStart = new Date(data.start_time)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    if (shiftStart < fiveMinutesAgo) {
      return apiBadRequest(
        'Cannot create shifts in the past',
        context.requestId
      )
    }

    // Check for overlapping shifts for this user
    // Two shifts overlap if: new.start < existing.end AND new.end > existing.start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingShifts, error: overlapCheckError } = await (context.supabase as any)
      .from('shifts')
      .select('id, start_time, end_time')
      .eq('user_id', data.user_id)
      .lt('start_time', data.end_time)
      .gt('end_time', data.start_time)

    if (overlapCheckError) {
      logger.error('Error checking for overlapping shifts:', { error: overlapCheckError })
      throw overlapCheckError
    }

    if (existingShifts && existingShifts.length > 0) {
      const overlapping = existingShifts[0]
      const overlapStart = new Date(overlapping.start_time).toLocaleString()
      const overlapEnd = new Date(overlapping.end_time).toLocaleString()
      return apiBadRequest(
        `This user already has a shift scheduled from ${overlapStart} to ${overlapEnd}. Shifts cannot overlap.`,
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

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'shift.create',
      storeId: data.store_id,
      resourceType: 'shift',
      resourceId: shift.id,
      details: {
        employeeId: data.user_id,
        employeeName: shift.user?.full_name || undefined,
        employeeEmail: shift.user?.email || undefined,
        startTime: data.start_time,
        endTime: data.end_time,
        notes: shift.notes || undefined,
      },
      request,
    })

    // Send shift assigned notification (fire-and-forget)
    // Look up manager's name for the email
    const { data: managerProfile } = await context.supabase
      .from('profiles')
      .select('full_name')
      .eq('id', context.user.id)
      .single()

    const { date, dayOfWeek } = formatShiftDate(data.start_time)
    sendNotification({
      type: 'shift_assigned',
      storeId: data.store_id,
      recipientUserId: data.user_id,
      triggeredByUserId: context.user.id,
      data: {
        managerName: managerProfile?.full_name || 'Your manager',
        storeName: shift.store?.name || 'your store',
        date,
        dayOfWeek,
        startTime: formatShiftTime(data.start_time),
        endTime: formatShiftTime(data.end_time),
        duration: calculateDuration(data.start_time, data.end_time),
        notes: shift.notes || null,
      },
    }).catch(() => {}) // Swallow errors — notification is best-effort

    return apiSuccess(shift as Shift, {
      requestId: context.requestId,
      status: 201,
    })
  } catch (error) {
    logger.error('Error creating shift:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create shift')
  }
}
