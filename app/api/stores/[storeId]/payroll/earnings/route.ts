import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager', 'Staff'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!from || !to) {
      return apiBadRequest('from and to date parameters are required', context.requestId)
    }

    // Build date range boundaries
    const fromDate = `${from}T00:00:00.000Z`
    const toDate = `${to}T23:59:59.999Z`

    // Get store user role to determine if staff (can only see own data)
    const { data: storeUserRecord } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    const isStaff = storeUserRecord?.role === 'Staff'

    // Query completed shifts (have both clock_in and clock_out)
    let query = context.supabase
      .from('shifts')
      .select('id, user_id, start_time, end_time, clock_in_time, clock_out_time, user:profiles(id, full_name, email)')
      .eq('store_id', storeId)
      .not('clock_in_time', 'is', null)
      .not('clock_out_time', 'is', null)
      .gte('clock_in_time', fromDate)
      .lte('clock_in_time', toDate)
      .order('clock_in_time', { ascending: true })

    // Staff can only see their own shifts
    if (isStaff) {
      query = query.eq('user_id', context.user.id)
    }

    const { data: shifts, error: shiftsError } = await query
    if (shiftsError) throw shiftsError

    // Exclude shifts already included in non-draft pay runs
    const { data: existingPayRuns } = await context.supabase
      .from('pay_runs')
      .select('id, items:pay_run_items(shift_ids)')
      .eq('store_id', storeId)
      .neq('status', 'draft')

    const usedShiftIds = new Set<string>()
    for (const pr of existingPayRuns ?? []) {
      for (const item of pr.items ?? []) {
        for (const sid of (item as { shift_ids: string[] }).shift_ids ?? []) {
          usedShiftIds.add(sid)
        }
      }
    }

    const availableShifts = (shifts ?? []).filter(s => !usedShiftIds.has(s.id))

    // Get hourly rates for all relevant users
    const userIds = [...new Set(availableShifts.map(s => s.user_id))]
    const { data: storeUsers } = await context.supabase
      .from('store_users')
      .select('user_id, hourly_rate')
      .eq('store_id', storeId)
      .in('user_id', userIds.length > 0 ? userIds : ['_none_'])

    const rateMap = new Map<string, number | null>()
    for (const su of storeUsers ?? []) {
      rateMap.set(su.user_id, su.hourly_rate)
    }

    // Group shifts by user and calculate earnings
    const earningsMap = new Map<string, {
      user_id: string
      user_name: string
      hourly_rate: number | null
      total_hours: number
      gross_pay: number
      shift_count: number
      shifts: Array<{
        shift_id: string
        date: string
        clock_in: string
        clock_out: string
        hours: number
        pay: number
      }>
    }>()

    for (const shift of availableShifts) {
      const clockIn = new Date(shift.clock_in_time!)
      const clockOut = new Date(shift.clock_out_time!)
      const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
      const rate = rateMap.get(shift.user_id) ?? null
      const pay = rate ? Math.round(hours * rate * 100) / 100 : 0

      const user = shift.user as unknown as { id: string; full_name: string; email: string } | null

      if (!earningsMap.has(shift.user_id)) {
        earningsMap.set(shift.user_id, {
          user_id: shift.user_id,
          user_name: user?.full_name ?? user?.email ?? 'Unknown',
          hourly_rate: rate,
          total_hours: 0,
          gross_pay: 0,
          shift_count: 0,
          shifts: [],
        })
      }

      const entry = earningsMap.get(shift.user_id)!
      entry.total_hours = Math.round((entry.total_hours + hours) * 100) / 100
      entry.gross_pay = Math.round((entry.gross_pay + pay) * 100) / 100
      entry.shift_count++
      entry.shifts.push({
        shift_id: shift.id,
        date: shift.clock_in_time!.split('T')[0],
        clock_in: shift.clock_in_time!,
        clock_out: shift.clock_out_time!,
        hours,
        pay,
      })
    }

    const earnings = Array.from(earningsMap.values()).sort((a, b) => b.gross_pay - a.gross_pay)
    const totals = {
      total_hours: earnings.reduce((sum, e) => sum + e.total_hours, 0),
      total_pay: earnings.reduce((sum, e) => sum + e.gross_pay, 0),
      staff_count: earnings.length,
      shift_count: earnings.reduce((sum, e) => sum + e.shift_count, 0),
    }

    return apiSuccess({ earnings, totals }, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching earnings:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch earnings')
  }
}
