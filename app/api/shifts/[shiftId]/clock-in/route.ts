import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { Shift } from '@/types'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ shiftId: string }>
}

/**
 * POST /api/shifts/:shiftId/clock-in - Clock in to a shift
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Get the shift
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shift, error: fetchError } = await (context.supabase as any)
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .single()

    if (fetchError || !shift) {
      return apiNotFound('Shift', context.requestId)
    }

    // Verify user owns this shift (unless Owner/Manager at this store or platform admin)
    const canManageShifts = context.stores?.some(s =>
      s.store_id === shift.store_id && ['Owner', 'Manager'].includes(s.role)
    ) || context.profile.is_platform_admin
    if (!canManageShifts && shift.user_id !== context.user.id) {
      return apiForbidden('You can only clock in to your own shifts', context.requestId)
    }

    // Check if already clocked in
    if (shift.clock_in_time) {
      return apiBadRequest('Already clocked in to this shift', context.requestId)
    }

    // Verify timing - allow clock in within 15 minutes before or after shift start
    const now = new Date()
    const shiftStart = new Date(shift.start_time)
    const diffMinutes = (now.getTime() - shiftStart.getTime()) / (1000 * 60)

    if (diffMinutes < -15) {
      return apiBadRequest(
        'Too early to clock in. You can clock in up to 15 minutes before your shift.',
        context.requestId
      )
    }

    // Update shift with clock in time - use WHERE clause to prevent race condition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedShift, error: updateError } = await (context.supabase as any)
      .from('shifts')
      .update({
        clock_in_time: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', shiftId)
      .is('clock_in_time', null) // Prevents race condition - only update if not already clocked in
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .single()

    // If no row was updated, someone else clocked in first (race condition)
    if (updateError?.code === 'PGRST116' || !updatedShift) {
      return apiBadRequest('Already clocked in to this shift', context.requestId)
    }

    if (updateError) throw updateError

    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'shift.clock_in',
      storeId: shift.store_id,
      resourceType: 'shift',
      resourceId: shiftId,
      details: {
        employeeId: shift.user_id,
        clockInTime: now.toISOString(),
        scheduledStart: shift.start_time,
        scheduledEnd: shift.end_time,
        minutesFromScheduledStart: Math.round(diffMinutes),
      },
      request,
    })

    return apiSuccess(updatedShift as Shift, {
      requestId: context.requestId,
    })
  } catch (error) {
    logger.error('Error clocking in:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to clock in')
  }
}
