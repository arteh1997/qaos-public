import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'

/**
 * EDI (Electronic Data Interchange) Service
 *
 * Modern REST-based EDI framework for sending purchase orders
 * to suppliers via signed webhook delivery.
 *
 * When a PO is submitted, this service:
 * 1. Fetches PO data and supplier configuration
 * 2. Checks if EDI is enabled for the supplier
 * 3. Builds a structured PO payload
 * 4. Signs it with HMAC-SHA256 using the supplier's secret
 * 5. POSTs it to the supplier's configured webhook URL
 * 6. Logs the delivery result via audit log
 */

const USER_AGENT = 'RestaurantInventory/1.0'
const FETCH_TIMEOUT_MS = 15000

export interface EdiDeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}

export interface EdiPurchaseOrderPayload {
  event: 'purchase_order.submitted'
  timestamp: string
  purchase_order: {
    po_number: string
    store_name: string
    status: string
    expected_delivery_date: string | null
    items: Array<{
      name: string
      sku: string | null
      quantity: number
      unit: string
      unit_price: number
    }>
    total: number
    currency: string
    notes: string | null
  }
}

/**
 * Generate an HMAC-SHA256 hex digest for a payload
 */
export function generateEdiSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify an EDI signature using timing-safe comparison
 */
export function verifyEdiSignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateEdiSignature(payload, secret)

  // Both must be the same length for timingSafeEqual
  if (signature.length !== expected.length) {
    return false
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Send a submitted purchase order to the supplier via EDI webhook
 *
 * Returns silently (success: true) if EDI is not enabled for the supplier.
 * Returns the delivery result with status code on attempt.
 */
export async function sendPurchaseOrderToSupplier(
  storeId: string,
  poId: string
): Promise<EdiDeliveryResult> {
  const adminClient = createAdminClient()

  // Fetch the purchase order with its items
  const { data: po, error: poError } = await adminClient
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .eq('id', poId)
    .eq('store_id', storeId)
    .single()

  if (poError || !po) {
    return { success: false, error: poError?.message || 'Purchase order not found' }
  }

  // Fetch the supplier to check EDI configuration
  // Select specific fields including EDI columns added by migration 057
  const { data: supplier, error: supplierError } = await adminClient
    .from('suppliers')
    .select('id, name, edi_enabled, edi_webhook_url, edi_webhook_secret')
    .eq('id', po.supplier_id)
    .single() as { data: { id: string; name: string; edi_enabled: boolean; edi_webhook_url: string | null; edi_webhook_secret: string | null } | null; error: { message: string } | null }

  if (supplierError || !supplier) {
    return { success: false, error: supplierError?.message || 'Supplier not found' }
  }

  // If EDI is not enabled or no webhook URL, return silently
  if (!supplier.edi_enabled || !supplier.edi_webhook_url) {
    return { success: true }
  }

  // Fetch the store name for the payload
  const { data: store } = await adminClient
    .from('stores')
    .select('name')
    .eq('id', storeId)
    .single()

  // Fetch inventory item details for each PO item
  const itemIds = po.purchase_order_items.map(
    (item: { inventory_item_id: string }) => item.inventory_item_id
  )

  const { data: inventoryItems } = await adminClient
    .from('inventory_items')
    .select('id, name, unit_of_measure')
    .in('id', itemIds)

  // Build a lookup map for inventory items
  const itemMap = new Map(
    (inventoryItems || []).map((item: { id: string; name: string; unit_of_measure: string }) => [
      item.id,
      item,
    ])
  )

  // Fetch supplier SKUs for the items
  const { data: supplierItems } = await adminClient
    .from('supplier_items')
    .select('inventory_item_id, supplier_sku')
    .eq('supplier_id', supplier.id)
    .in('inventory_item_id', itemIds)

  const skuMap = new Map(
    (supplierItems || []).map((si: { inventory_item_id: string; supplier_sku: string | null }) => [
      si.inventory_item_id,
      si.supplier_sku,
    ])
  )

  // Build the EDI payload
  const timestamp = new Date().toISOString()

  const payload: EdiPurchaseOrderPayload = {
    event: 'purchase_order.submitted',
    timestamp,
    purchase_order: {
      po_number: po.po_number,
      store_name: store?.name || 'Unknown Store',
      status: po.status,
      expected_delivery_date: po.expected_delivery_date,
      items: po.purchase_order_items.map(
        (item: {
          inventory_item_id: string
          quantity_ordered: number
          unit_price: number
        }) => {
          const invItem = itemMap.get(item.inventory_item_id)
          return {
            name: invItem?.name || 'Unknown Item',
            sku: skuMap.get(item.inventory_item_id) || null,
            quantity: item.quantity_ordered,
            unit: invItem?.unit_of_measure || 'unit',
            unit_price: item.unit_price,
          }
        }
      ),
      total: po.total_amount,
      currency: po.currency || 'GBP',
      notes: po.notes,
    },
  }

  const payloadStr = JSON.stringify(payload)
  const signature = generateEdiSignature(payloadStr, supplier.edi_webhook_secret || '')

  // Send the signed payload to the supplier's webhook
  try {
    const response = await fetch(supplier.edi_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-EDI-Signature': signature,
        'X-EDI-Timestamp': timestamp,
        'User-Agent': USER_AGENT,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    const responseBody = await response.text().catch(() => '')

    // Log the delivery result via audit
    await auditLog(adminClient, {
      userId: po.created_by,
      storeId,
      action: 'supplier.edi_po_delivered',
      resourceType: 'purchase_order',
      resourceId: poId,
      details: {
        po_number: po.po_number,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        webhook_url: supplier.edi_webhook_url,
        status_code: response.status,
        success: response.ok,
        response_preview: responseBody.slice(0, 500),
      },
    })

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `Supplier webhook returned ${response.status}: ${responseBody.slice(0, 200)}`,
      }
    }

    return { success: true, statusCode: response.status }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'EDI delivery failed'

    // Log the failure
    await auditLog(adminClient, {
      userId: po.created_by,
      storeId,
      action: 'supplier.edi_po_delivery_failed',
      resourceType: 'purchase_order',
      resourceId: poId,
      details: {
        po_number: po.po_number,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        webhook_url: supplier.edi_webhook_url,
        error: errorMessage,
      },
    })

    return { success: false, error: errorMessage }
  }
}
