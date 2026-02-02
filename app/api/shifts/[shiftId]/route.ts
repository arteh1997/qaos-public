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
import { shiftSchema, editClockTimesSchema } from '@/lib/validations/shift'
import { sanitizeNotes } from '@/lib/utils'
import { Shift } from '@/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'

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
    console.error('Error getting shift:', error)
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
      const validationResult = shiftSchema.partial().safeParse(body)
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
          console.error('Error checking for overlapping shifts:', overlapCheckError)
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
    }

    return apiSuccess(shift as Shift, { requestId: context.requestId })
  } catch (error) {
    console.error('Error updating shift:', error)
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
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from('shifts')
      .delete()
      .eq('id', shiftId)

    if (error) throw error

    return apiSuccess({ deleted: true }, { requestId: context.requestId })
  } catch (error) {
    console.error('Error deleting shift:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to delete shift')
  }
}
