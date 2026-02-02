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
import { Shift } from '@/types'

interface RouteParams {
  params: Promise<{ shiftId: string }>
}

/**
 * POST /api/shifts/:shiftId/clock-out - Clock out from a shift
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { shiftId } = await params

    const auth = await withApiAuth(request, {
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
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
      return apiForbidden('You can only clock out from your own shifts', context.requestId)
    }

    // Check if clocked in
    if (!shift.clock_in_time) {
      return apiBadRequest('Must clock in before clocking out', context.requestId)
    }

    // Check if already clocked out
    if (shift.clock_out_time) {
      return apiBadRequest('Already clocked out from this shift', context.requestId)
    }

    const now = new Date()

    // Update shift with clock out time - use WHERE clause to prevent race condition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedShift, error: updateError } = await (context.supabase as any)
      .from('shifts')
      .update({
        clock_out_time: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', shiftId)
      .is('clock_out_time', null) // Prevents race condition - only update if not already clocked out
      .select(`
        *,
        store:stores(*),
        user:profiles(id, full_name, email)
      `)
      .single()

    // If no row was updated, someone else clocked out first (race condition)
    if (updateError?.code === 'PGRST116' || !updatedShift) {
      return apiBadRequest('Already clocked out from this shift', context.requestId)
    }

    if (updateError) throw updateError

    // Calculate hours worked
    const clockIn = new Date(shift.clock_in_time)
    const hoursWorked = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60)

    return apiSuccess(
      {
        shift: updatedShift as Shift,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error clocking out:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to clock out')
  }
}
