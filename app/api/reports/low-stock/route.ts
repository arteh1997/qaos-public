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

    // Get params
    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('store_id')

    // Build query
    let query = context.supabase
      .from('store_inventory')
      .select(`
        *,
        store:stores(id, name),
        inventory_item:inventory_items(id, name, unit_of_measure)
      `)
      .not('par_level', 'is', null)

    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data, error } = await query

    if (error) throw error

    // Define type for store inventory with relations
    type StoreInventoryItem = {
      store_id: string
      inventory_item_id: string
      quantity: number
      par_level: number | null
      store: { id: string; name: string } | null
      inventory_item: { id: string; name: string; unit_of_measure: string } | null
    }

    const inventoryData = data as StoreInventoryItem[] | null

    // Filter items below PAR level and format
    const lowStockItems = (inventoryData ?? [])
      .filter(item => item.par_level && item.quantity < item.par_level)
      .map(item => ({
        store_id: item.store_id,
        store_name: item.store?.name ?? 'Unknown',
        inventory_item_id: item.inventory_item_id,
        item_name: item.inventory_item?.name ?? 'Unknown',
        unit_of_measure: item.inventory_item?.unit_of_measure ?? '',
        current_quantity: item.quantity,
        par_level: item.par_level!,
        shortage: item.par_level! - item.quantity,
      }))
      .sort((a, b) => b.shortage - a.shortage)

    return apiSuccess(
      {
        total_low_stock_items: lowStockItems.length,
        items: lowStockItems,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    console.error('Error fetching low stock report:', error)
    return apiError(error instanceof Error ? error.message : 'Failed to fetch report')
  }
}
