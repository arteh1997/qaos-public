import { NextRequest } from 'next/server'
import { withSupplierAuth } from '@/lib/api/with-supplier-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateCatalogSchema } from '@/lib/validations/supplier-portal'
import { logPortalActivity } from '@/lib/services/supplier-portal'

/**
 * GET /api/supplier-portal/catalog
 * List the supplier's items (their catalog for this store).
 *
 * PUT /api/supplier-portal/catalog
 * Bulk-update pricing / lead times for supplier items.
 */
export async function GET(request: NextRequest) {
  const auth = await withSupplierAuth(request, { permission: 'can_update_catalog' })
  if (!auth.success) return auth.response

  const { supplierId } = auth
  const supabase = createAdminClient()

  const { data: items, error } = await supabase
    .from('supplier_items')
    .select(`
      id, supplier_sku, unit_cost, currency, lead_time_days,
      min_order_quantity, is_preferred, is_active,
      inventory_items ( id, name, unit_of_measure, category )
    `)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch catalog' },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: items })
}

export async function PUT(request: NextRequest) {
  const auth = await withSupplierAuth(request, { permission: 'can_update_catalog' })
  if (!auth.success) return auth.response

  const { supplierId, storeId, tokenId } = auth
  const supabase = createAdminClient()

  const body = await request.json()
  const parsed = updateCatalogSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
      { status: 400 }
    )
  }

  const updates = parsed.data.items
  const results: Array<{ id: string; success: boolean; error?: string }> = []

  for (const item of updates) {
    // Verify item belongs to this supplier
    const { data: existing } = await supabase
      .from('supplier_items')
      .select('id')
      .eq('id', item.id)
      .eq('supplier_id', supplierId)
      .single()

    if (!existing) {
      results.push({ id: item.id, success: false, error: 'Item not found' })
      continue
    }

    const updateData: Record<string, unknown> = {}
    if (item.unit_cost !== undefined) updateData.unit_cost = item.unit_cost
    if (item.lead_time_days !== undefined) updateData.lead_time_days = item.lead_time_days
    if (item.min_order_quantity !== undefined) updateData.min_order_quantity = item.min_order_quantity

    const { error: updateErr } = await supabase
      .from('supplier_items')
      .update(updateData)
      .eq('id', item.id)

    results.push({ id: item.id, success: !updateErr, error: updateErr?.message })
  }

  await logPortalActivity({
    supplierId,
    storeId,
    tokenId,
    action: 'catalog.updated',
    details: { itemCount: updates.length },
  })

  return Response.json({
    success: true,
    data: results,
  })
}
