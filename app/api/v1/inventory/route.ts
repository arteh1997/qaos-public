import { NextRequest, NextResponse } from 'next/server'
import { withApiKey } from '@/lib/api/with-api-key'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/v1/inventory - List inventory items
 * Authentication: API Key (scope: inventory:read)
 *
 * Query params:
 *   - page (default: 1)
 *   - per_page (default: 50, max: 100)
 *   - category (optional filter)
 *   - search (optional name search)
 *   - active_only (default: true)
 */
export async function GET(request: NextRequest) {
  const auth = await withApiKey(request, { scope: 'inventory:read' })
  if (!auth.success) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('active_only') !== 'false'

    const adminClient = createAdminClient()

    let query = adminClient
      .from('store_inventory')
      .select(`
        id, store_id, quantity, par_level, unit_cost, cost_currency, last_updated_at,
        inventory_item:inventory_items(id, name, category, unit_of_measure, is_active)
      `, { count: 'exact' })
      .eq('store_id', auth.storeId)

    if (activeOnly) {
      query = query.eq('inventory_items.is_active', true)
    }

    // Pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    // Filter by category/search in memory (Supabase doesn't support filtering on joined columns well)
    let items = (data ?? []).filter(item => {
      const inv = item.inventory_item as { id: string; name: string; category: string | null; unit_of_measure: string; is_active: boolean } | null
      if (!inv) return false
      if (activeOnly && !inv.is_active) return false
      if (category && inv.category !== category) return false
      if (search && !inv.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    const formattedItems = items.map(item => {
      const inv = item.inventory_item as { id: string; name: string; category: string | null; unit_of_measure: string; is_active: boolean }
      return {
        id: inv.id,
        name: inv.name,
        category: inv.category,
        unit_of_measure: inv.unit_of_measure,
        quantity: item.quantity,
        par_level: item.par_level,
        unit_cost: item.unit_cost,
        cost_currency: item.cost_currency,
        last_updated_at: item.last_updated_at,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedItems,
      pagination: {
        page,
        per_page: perPage,
        total: count ?? formattedItems.length,
        has_more: (count ?? 0) > from + perPage,
      },
    })
  } catch (error) {
    console.error('Public API inventory error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}
