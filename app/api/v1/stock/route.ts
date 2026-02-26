import { NextRequest, NextResponse } from 'next/server'
import { withApiKey } from '@/lib/api/with-api-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchWebhookEvent } from '@/lib/services/webhooks'
import { logger } from '@/lib/logger'

/**
 * GET /api/v1/stock - Get stock history
 * Authentication: API Key (scope: stock:read)
 *
 * Query params:
 *   - page (default: 1)
 *   - per_page (default: 50, max: 100)
 *   - action_type (optional: Count, Reception, Waste, Adjustment)
 *   - since (optional: ISO date string)
 */
export async function GET(request: NextRequest) {
  const auth = await withApiKey(request, { scope: 'stock:read' })
  if (!auth.success) return auth.response

  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const actionType = searchParams.get('action_type')
    const since = searchParams.get('since')

    const adminClient = createAdminClient()

    let query = adminClient
      .from('stock_history')
      .select(`
        id, store_id, inventory_item_id, action_type,
        quantity_before, quantity_after, quantity_change,
        notes, created_at,
        inventory_item:inventory_items(name, category, unit_of_measure)
      `, { count: 'exact' })
      .eq('store_id', auth.storeId)
      .order('created_at', { ascending: false })

    if (actionType) {
      query = query.eq('action_type', actionType as 'Count' | 'Reception' | 'Adjustment' | 'Waste' | 'Sale')
    }

    if (since) {
      query = query.gte('created_at', since)
    }

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    const formattedData = (data ?? []).map(entry => {
      const item = entry.inventory_item as { name: string; category: string | null; unit_of_measure: string } | null
      return {
        id: entry.id,
        inventory_item_id: entry.inventory_item_id,
        item_name: item?.name ?? 'Unknown',
        item_category: item?.category,
        action_type: entry.action_type,
        quantity_before: entry.quantity_before,
        quantity_after: entry.quantity_after,
        quantity_change: entry.quantity_change,
        notes: entry.notes,
        created_at: entry.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedData,
      pagination: {
        page,
        per_page: perPage,
        total: count ?? formattedData.length,
        has_more: (count ?? 0) > from + perPage,
      },
    })
  } catch (error) {
    logger.error('Public API stock history error:', { error: error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock history' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/stock - Submit stock count or reception
 * Authentication: API Key (scope: stock:write)
 *
 * Body:
 *   - action: "count" | "reception"
 *   - items: Array<{ inventory_item_id: string, quantity: number }>
 *   - notes?: string
 */
export async function POST(request: NextRequest) {
  const auth = await withApiKey(request, { scope: 'stock:write' })
  if (!auth.success) return auth.response

  try {
    const body = await request.json()
    const { action, items, notes } = body

    if (!action || !['count', 'reception'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "count" or "reception"' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array is required and must not be empty' },
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!item.inventory_item_id || typeof item.quantity !== 'number' || item.quantity < 0) {
        return NextResponse.json(
          { success: false, error: 'Each item must have inventory_item_id (string) and quantity (non-negative number)' },
          { status: 400 }
        )
      }
    }

    const adminClient = createAdminClient()
    const actionType = action === 'count' ? 'Count' : 'Reception'
    const itemIds = items.map((i: { inventory_item_id: string }) => i.inventory_item_id)

    // Batch-fetch all current quantities in one query (avoids N+1)
    const { data: currentInventory } = await adminClient
      .from('store_inventory')
      .select('inventory_item_id, quantity')
      .eq('store_id', auth.storeId)
      .in('inventory_item_id', itemIds)

    const currentQtyMap = new Map(
      (currentInventory || []).map((inv: { inventory_item_id: string; quantity: number }) => [
        inv.inventory_item_id,
        Number(inv.quantity ?? 0),
      ])
    )

    // Prepare batch upsert and history records
    const upsertRecords: Array<{
      store_id: string
      inventory_item_id: string
      quantity: number
      last_updated_at: string
      last_updated_by: string | null
    }> = []
    const historyRecords: Array<{
      store_id: string
      inventory_item_id: string
      action_type: string
      quantity_before: number
      quantity_after: number
      quantity_change: number
      notes: string
      performed_by: string | null
    }> = []
    const now = new Date().toISOString()

    for (const item of items) {
      const currentQty = currentQtyMap.get(item.inventory_item_id) ?? 0
      const newQty = action === 'count' ? item.quantity : currentQty + item.quantity

      upsertRecords.push({
        store_id: auth.storeId,
        inventory_item_id: item.inventory_item_id,
        quantity: newQty,
        last_updated_at: now,
        last_updated_by: null,
      })

      historyRecords.push({
        store_id: auth.storeId,
        inventory_item_id: item.inventory_item_id,
        action_type: actionType,
        quantity_before: currentQty,
        quantity_after: newQty,
        quantity_change: newQty - currentQty,
        notes: notes || `Via API (${action})`,
        performed_by: null,
      })
    }

    // Batch upsert all inventory records
    const { error: upsertError } = await adminClient
      .from('store_inventory')
      .upsert(upsertRecords, { onConflict: 'store_id,inventory_item_id' })

    const results: { inventory_item_id: string; success: boolean; error?: string }[] = []

    if (upsertError) {
      // If batch fails, mark all as failed
      for (const item of items) {
        results.push({ inventory_item_id: item.inventory_item_id, success: false, error: 'Update failed' })
      }
    } else {
      // Batch insert all history records
      await adminClient.from('stock_history').insert(historyRecords)

      for (const item of items) {
        results.push({ inventory_item_id: item.inventory_item_id, success: true })
      }
    }

    // Dispatch webhook event (fire and forget)
    const webhookEvent = action === 'count' ? 'stock.counted' : 'stock.received'
    dispatchWebhookEvent(auth.storeId, webhookEvent, {
      action,
      items_count: items.length,
      items: results,
      notes,
    }).catch(() => {})

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        action,
        processed: succeeded,
        failed,
        results,
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('Public API stock operation error:', { error: error })
    return NextResponse.json(
      { success: false, error: 'Failed to process stock operation' },
      { status: 500 }
    )
  }
}
