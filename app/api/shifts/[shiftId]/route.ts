import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiNotFound,
  apiForbidden,
} from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { shiftSchema, shiftUpdateSchema, editClockTimesSchema } from '@/lib/validations/shift'
import { sanitizeNotes } from '@/lib/utils'
import { Shift } from '@/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { sendNotification } from '@/lib/services/notifications'
import { formatShiftDate, formatShiftTime } from '@/lib/utils/format-shift'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ shiftId: string }>
}

/**
 * GET /api/shifts/:shiftId - Get a single shift
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shift, error } = await (context.supabase as any)
      .from('shifts')
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .eq('id', shiftId)
      .single()

    if (error || !shift) {
      return apiNotFound('Shift', context.requestId)
    }

    // Staff can only see their own shifts
    const isStaffOnly = context.stores?.every(s => s.role === 'Staff') ?? false
    if (isStaffOnly && shift.user_id !== context.user.id) {
      return apiForbidden('You can only view your own shifts', context.requestId)
    }

    return apiSuccess(shift as Shift, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error getting shift:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to get shift')
  }
}

/**
 * PATCH /api/shifts/:shiftId - Update a shift
 *
 * Two types of updates:
 * 1. Schedule update (start_time, end_time, notes) - uses shiftSchema
 * 2. Clock time correction (clock_in_time, clock_out_time) - uses editClockTimesSchema
 *    This is for managers/owners to correct times when employees forget to clock out
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth
    const body = await request.json()

    // Determine if this is a clock time edit or schedule edit
    const isClockTimeEdit = 'clock_in_time' in body || 'clock_out_time' in body

    // Get the existing shift first (need it for validation and audit)
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    const { data: existingShift, error: fetchError } = await supabaseAdmin
      .from('shifts')
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .eq('id', shiftId)
      .single()

    if (fetchError || !existingShift) {
      return apiNotFound('Shift', context.requestId)
    }

    // Verify user can manage this store
    if (!canManageStore(context, existingShift.store_id)) {
      return apiForbidden('You do not have permission to edit shifts at this store', context.requestId)
    }

    let updateData: Record<string, unknown> = {}

    if (isClockTimeEdit) {
      // Validate clock time edit
      const validationResult = editClockTimesSchema.safeParse(body)
      if (!validationResult.success) {
        return apiBadRequest(
          validationResult.error.issues.map(e => e.message).join(', '),
          context.requestId
        )
      }

      const data = validationResult.data

      // Additional validation: clock times should be within reasonable bounds of the shift
      // Allow some flexibility (e.g., 4 hours before/after scheduled times)
      const shiftStart = new Date(existingShift.start_time)
      const shiftEnd = new Date(existingShift.end_time)
      const fourHours = 4 * 60 * 60 * 1000

      if (data.clock_in_time) {
        const clockIn = new Date(data.clock_in_time)
        const earliestAllowed = new Date(shiftStart.getTime() - fourHours)
        const latestAllowed = new Date(shiftEnd.getTime() + fourHours)
        if (clockIn < earliestAllowed || clockIn > latestAllowed) {
          return apiBadRequest(
            'Clock-in time is too far from the scheduled shift time',
            context.requestId
          )
        }
      }

      if (data.clock_out_time) {
        const clockOut = new Date(data.clock_out_time)
        const earliestAllowed = new Date(shiftStart.getTime() - fourHours)
        const latestAllowed = new Date(shiftEnd.getTime() + fourHours)
        if (clockOut < earliestAllowed || clockOut > latestAllowed) {
          return apiBadRequest(
            'Clock-out time is too far from the scheduled shift time',
            context.requestId
          )
        }
      }

      updateData = {
        clock_in_time: data.clock_in_time,
        clock_out_time: data.clock_out_time,
        notes: data.notes !== undefined ? sanitizeNotes(data.notes) : existingShift.notes,
        updated_at: new Date().toISOString(),
      }

      // Only include fields that were actually provided
      if (data.clock_in_time === undefined) delete updateData.clock_in_time
      if (data.clock_out_time === undefined) delete updateData.clock_out_time
      if (data.notes === undefined) delete updateData.notes

    } else {
      // Validate schedule edit (partial)
      const validationResult = shiftUpdateSchema.safeParse(body)
      if (!validationResult.success) {
        return apiBadRequest(
          validationResult.error.issues.map(e => e.message).join(', '),
          context.requestId
        )
      }

      const data = validationResult.data

      // If updating times, check for overlapping shifts
      const newStartTime = data.start_time || existingShift.start_time
      const newEndTime = data.end_time || existingShift.end_time
      const userId = data.user_id || existingShift.user_id

      if (data.start_time || data.end_time || data.user_id) {
        // Check for overlapping shifts (excluding this shift)
        const { data: existingShifts, error: overlapCheckError } = await supabaseAdmin
          .from('shifts')
          .select('id, start_time, end_time')
          .eq('user_id', userId)
          .neq('id', shiftId) // Exclude the current shift
          .lt('start_time', newEndTime)
          .gt('end_time', newStartTime)

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
      }

      // Sanitize notes if present
      updateData = {
        ...data,
        notes: data.notes !== undefined ? sanitizeNotes(data.notes) : undefined,
        updated_at: new Date().toISOString(),
      }
    }

    // Perform the update
    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .update(updateData)
      .eq('id', shiftId)
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Shift', context.requestId)
      }
      throw error
    }

    // Audit log for clock time corrections (important for accountability)
    if (isClockTimeEdit) {
      await auditLog(supabaseAdmin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: 'shift.clock_time_correction',
        storeId: existingShift.store_id,
        resourceType: 'shift',
        resourceId: shiftId,
        details: {
          shiftId,
          employeeId: existingShift.user_id,
          employeeEmail: existingShift.user?.email,
          employeeName: existingShift.user?.full_name,
          scheduledTime: {
            start: existingShift.start_time,
            end: existingShift.end_time,
          },
          previousClockTimes: {
            clockIn: existingShift.clock_in_time,
            clockOut: existingShift.clock_out_time,
          },
          newClockTimes: {
            clockIn: shift.clock_in_time,
            clockOut: shift.clock_out_time,
          },
        },
        request,
      })
    } else {
      await auditLog(supabaseAdmin, {
        userId: context.user.id,
        userEmail: context.user.email,
        action: 'shift.update',
        storeId: existingShift.store_id,
        resourceType: 'shift',
        resourceId: shiftId,
        details: {
          employeeId: existingShift.user_id,
          employeeName: existingShift.user?.full_name,
          employeeEmail: existingShift.user?.email,
          previousSchedule: {
            startTime: existingShift.start_time,
            endTime: existingShift.end_time,
          },
          newSchedule: {
            startTime: shift.start_time,
            endTime: shift.end_time,
          },
          notes: shift.notes || undefined,
        },
        request,
      })
    }

    // Send shift updated notification if schedule changed (fire-and-forget)
    const scheduleChanged = !isClockTimeEdit && (
      existingShift.start_time !== shift.start_time || existingShift.end_time !== shift.end_time
    )
    if (scheduleChanged) {
      // Look up manager's name for the email
      const { data: managerProfile } = await context.supabase
        .from('profiles')
        .select('full_name')
        .eq('id', context.user.id)
        .single()

      const { date, dayOfWeek } = formatShiftDate(shift.start_time)
      sendNotification({
        type: 'shift_updated',
        storeId: existingShift.store_id,
        recipientUserId: existingShift.user_id,
        triggeredByUserId: context.user.id,
        data: {
          managerName: managerProfile?.full_name || 'Your manager',
          storeName: shift.store?.name || 'your store',
          date,
          dayOfWeek,
          previousStartTime: formatShiftTime(existingShift.start_time),
          previousEndTime: formatShiftTime(existingShift.end_time),
          newStartTime: formatShiftTime(shift.start_time),
          newEndTime: formatShiftTime(shift.end_time),
          notes: shift.notes || null,
        },
      }).catch(() => {})
    }

    return apiSuccess(shift as Shift, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error updating shift:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to update shift')
  }
}

/**
 * DELETE /api/shifts/:shiftId - Delete a shift
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
      requireCSRF: true,
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Fetch shift details before deleting for audit log
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAdmin = adminClient as any

    const { data: existingShift } = await supabaseAdmin
      .from('shifts')
      .select('*, user:profiles(id, full_name, email)')
      .eq('id', shiftId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from('shifts')
      .delete()
      .eq('id', shiftId)

    if (error) throw error

    await auditLog(supabaseAdmin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'shift.delete',
      storeId: existingShift?.store_id,
      resourceType: 'shift',
      resourceId: shiftId,
      details: {
        employeeId: existingShift?.user_id,
        employeeName: existingShift?.user?.full_name,
        employeeEmail: existingShift?.user?.email,
        startTime: existingShift?.start_time,
        endTime: existingShift?.end_time,
      },
      request,
    })

    // Send shift cancelled notification (fire-and-forget)
    if (existingShift) {
      // Look up manager's name for the email
      const { data: cancellerProfile } = await context.supabase
        .from('profiles')
        .select('full_name')
        .eq('id', context.user.id)
        .single()

      const { date, dayOfWeek } = formatShiftDate(existingShift.start_time)
      sendNotification({
        type: 'shift_cancelled',
        storeId: existingShift.store_id,
        recipientUserId: existingShift.user_id,
        triggeredByUserId: context.user.id,
        data: {
          managerName: cancellerProfile?.full_name || 'Your manager',
          storeName: existingShift.store?.name || 'your store',
          date,
          dayOfWeek,
          startTime: formatShiftTime(existingShift.start_time),
          endTime: formatShiftTime(existingShift.end_time),
        },
      }).catch(() => {})
    }

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error deleting shift:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to delete shift')
  }
}
