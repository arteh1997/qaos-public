import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have permission to view payroll rates', context.requestId)
    }

    // Determine caller's role to filter appropriately
    const { data: callerRecord } = await context.supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', context.user.id)
      .single()

    const callerRole = callerRecord?.role

    // Owners see Staff + Manager rates; Managers see Staff rates only
    // Owners never appear — they don't take hourly wages
    // Owners see Staff + Manager rates; Managers see Staff rates only
    // Owners never appear — they don't take hourly wages
    let query = context.supabase
      .from('store_users')
      .select('id, user_id, role, hourly_rate, is_billing_owner, user:profiles!store_users_user_id_fkey(id, full_name, email)')
      .eq('store_id', storeId)
      .neq('role', 'Owner' as const)
      .order('role')

    if (callerRole === 'Manager') {
      query = query.eq('role', 'Staff' as const)
    }

    const { data: staff, error: dbError } = await query

    if (dbError) {
      logger.error('Supabase query error (payroll rates):', { error: dbError })
      throw dbError
    }

    return apiSuccess(staff ?? [], { requestId: context.requestId })
  } catch (error) {
    logger.error('Error fetching payroll rates:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to fetch payroll rates')
  }
}
