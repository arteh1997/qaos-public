import { NextRequest } from 'next/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { withApiAuth } from '@/lib/api/middleware'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(request, {
      allowedRoles: ['Admin', 'Driver'],
      rateLimit: { key: 'reports', config: RATE_LIMITS.reports },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Get the date from query params or use yesterday
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') ??
      new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Get all active stores
    const { data: storesData, error: storesError } = await context.supabase
      .from('stores')
      .select('id, name')
      .eq('is_active', true)

    if (storesError) throw storesError
    const stores = storesData as { id: string; name: string }[] | null

    // Get stores that submitted counts
    const { data: countsData, error: countsError } = await context.supabase
      .from('daily_counts')
      .select('store_id')
      .eq('count_date', date)

    if (countsError) throw countsError
    const counts = countsData as { store_id: string }[] | null

    const countedStoreIds = new Set((counts ?? []).map(c => c.store_id))

    // Filter stores that haven't submitted
    const missingStores = (stores ?? []).filter(
      store => !countedStoreIds.has(store.id)
    )

    return apiSuccess(
      {
        date,
        missing_count: missingStores.length,
        total_stores: stores?.length ?? 0,
        missing_stores: missingStores,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error fetching missing counts:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch report')
  }
}
