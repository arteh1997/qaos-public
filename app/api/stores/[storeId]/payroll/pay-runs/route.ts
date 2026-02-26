import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createPayRunSchema } from '@/lib/validations/payroll'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
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

    const { data: storeUserRecord } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    const isStaff = storeUserRecord?.role === 'Staff'

    const { data: payRuns, error } = await context.supabase
      .from('pay_runs')
      .select(`
        *,
        items:pay_run_items(
          id, user_id, hourly_rate, total_hours, overtime_hours,
          adjustments, adjustment_notes, gross_pay, shift_ids,
          user:profiles(id, full_name, email)
        ),
        creator:profiles!pay_runs_created_by_fkey(id, full_name),
        approver:profiles!pay_runs_approved_by_fkey(id, full_name)
      `)
      .eq('store_id', storeId)
      .order('period_start', { ascending: false })

    if (error) throw error

    let result = payRuns ?? []

    // Staff can only see paid pay runs, and only their own items
    if (isStaff) {
      result = result
        .filter(pr => pr.status === 'paid')
        .map(pr => ({
          ...pr,
          items: (pr.items ?? []).filter((item: { user_id: string }) => item.user_id === context.user.id),
        }))
        .filter(pr => (pr.items ?? []).length > 0)
    }

    return apiSuccess(result, { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching pay runs:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch pay runs')
  }
}

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
      return apiForbidden('You do not have permission to create pay runs', context.requestId)
    }

    const body = await request.json()
    const validation = createPayRunSchema.safeParse(body)
    if (!validation.success) {
      return apiBadRequest(validation.error.issues.map(e => e.message).join(', '), context.requestId)
    }

    const { period_start, period_end, notes } = validation.data
    const fromDate = `${period_start}T00:00:00.000Z`
    const toDate = `${period_end}T23:59:59.999Z`

    // Get completed shifts in the date range
    const { data: shifts, error: shiftsError } = await context.supabase
      .from('shifts')
      .select('id, user_id')
      .eq('store_id', storeId)
      .not('clock_in_time', 'is', null)
      .not('clock_out_time', 'is', null)
      .gte('clock_in_time', fromDate)
      .lte('clock_in_time', toDate)

    if (shiftsError) throw shiftsError

    if (!shifts || shifts.length === 0) {
      return apiBadRequest('No completed shifts found in the selected period', context.requestId)
    }

    const shiftIds = shifts.map(s => s.id)

    // Check for overlapping pay runs (shifts already included in another pay run)
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

    const overlapping = shiftIds.filter(id => usedShiftIds.has(id))
    if (overlapping.length > 0) {
      return apiBadRequest(
        `${overlapping.length} shift(s) are already included in another pay run`,
        context.requestId
      )
    }

    // Get full shift data for calculations
    const { data: fullShifts } = await context.supabase
      .from('shifts')
      .select('id, user_id, clock_in_time, clock_out_time')
      .in('id', shiftIds)

    // Get hourly rates
    const userIds = [...new Set((fullShifts ?? []).map(s => s.user_id))]
    const { data: storeUsers } = await context.supabase
      .from('store_users')
      .select('user_id, hourly_rate')
      .eq('store_id', storeId)
      .in('user_id', userIds)

    const rateMap = new Map<string, number>()
    for (const su of storeUsers ?? []) {
      rateMap.set(su.user_id, su.hourly_rate ?? 0)
    }

    // Group by user and calculate
    const itemsMap = new Map<string, {
      user_id: string
      hourly_rate: number
      total_hours: number
      gross_pay: number
      shift_ids: string[]
    }>()

    for (const shift of fullShifts ?? []) {
      const clockIn = new Date(shift.clock_in_time!)
      const clockOut = new Date(shift.clock_out_time!)
      const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
      const rate = rateMap.get(shift.user_id) ?? 0

      if (!itemsMap.has(shift.user_id)) {
        itemsMap.set(shift.user_id, {
          user_id: shift.user_id,
          hourly_rate: rate,
          total_hours: 0,
          gross_pay: 0,
          shift_ids: [],
        })
      }

      const entry = itemsMap.get(shift.user_id)!
      entry.total_hours = Math.round((entry.total_hours + hours) * 100) / 100
      entry.gross_pay = Math.round((entry.gross_pay + hours * rate) * 100) / 100
      entry.shift_ids.push(shift.id)
    }

    const items = Array.from(itemsMap.values())
    const totalAmount = Math.round(items.reduce((sum, i) => sum + i.gross_pay, 0) * 100) / 100

    // Create pay run
    const { data: payRun, error: createError } = await context.supabase
      .from('pay_runs')
      .insert({
        store_id: storeId,
        period_start,
        period_end,
        status: 'draft',
        notes: notes ?? null,
        total_amount: totalAmount,
        currency: 'GBP',
        created_by: context.user.id,
      })
      .select()
      .single()

    if (createError) throw createError

    // Create pay run items
    const payRunItems = items.map(item => ({
      pay_run_id: payRun.id,
      user_id: item.user_id,
      hourly_rate: item.hourly_rate,
      total_hours: item.total_hours,
      overtime_hours: 0,
      adjustments: 0,
      gross_pay: item.gross_pay,
      shift_ids: item.shift_ids,
    }))

    const { error: itemsError } = await context.supabase
      .from('pay_run_items')
      .insert(payRunItems)

    if (itemsError) throw itemsError

    // Audit log
    const admin = createAdminClient()
    await auditLog(admin, {
      userId: context.user.id,
      userEmail: context.user.email,
      action: 'payroll.pay_run_create',
      storeId,
      resourceType: 'pay_run',
      resourceId: payRun.id,
      details: {
        periodStart: period_start,
        periodEnd: period_end,
        employeeCount: items.length,
        totalAmount,
        shiftCount: shiftIds.length,
      },
      request,
    })

    return apiSuccess(payRun, { requestId: context.requestId, status: 201 })
  } catch (error) {
    logger.error('Error creating pay run:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to create pay run')
  }
}
