import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSaleEvent, type PosSaleEvent, type PosSaleItem } from '@/lib/services/pos'

type RouteParams = { params: Promise<{ connectionId: string }> }

/**
 * POST /api/pos/webhook/[connectionId] - Receive sale events from POS systems
 *
 * This is a public endpoint (no user auth required).
 * Authentication is done via the connection's credentials.
 *
 * Body format (generic - POS adapters normalize to this):
 * {
 *   "event_id": "unique-id-from-pos",
 *   "event_type": "sale" | "refund" | "void",
 *   "items": [
 *     { "pos_item_id": "...", "pos_item_name": "...", "quantity": 1, "unit_price": 9.99 }
 *   ],
 *   "total_amount": 29.97,
 *   "currency": "USD",
 *   "occurred_at": "2026-02-10T14:30:00Z"
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { connectionId } = await params

    // Validate connection exists and is active
    const adminClient = createAdminClient()
    const { data: connection, error: connError } = await adminClient
      .from('pos_connections')
      .select('id, store_id, provider, is_active, credentials')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { success: false, error: 'Invalid connection' },
        { status: 404 }
      )
    }

    if (!connection.is_active) {
      return NextResponse.json(
        { success: false, error: 'Connection is inactive' },
        { status: 403 }
      )
    }

    // Parse the sale event
    const body = await request.json()

    // Validate required fields
    if (!body.event_id || typeof body.event_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      )
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.pos_item_id || !item.pos_item_name || typeof item.quantity !== 'number') {
        return NextResponse.json(
          { success: false, error: 'Each item must have pos_item_id, pos_item_name, and quantity' },
          { status: 400 }
        )
      }
    }

    const event: PosSaleEvent = {
      external_event_id: body.event_id,
      event_type: body.event_type ?? 'sale',
      items: body.items.map((item: PosSaleItem) => ({
        pos_item_id: item.pos_item_id,
        pos_item_name: item.pos_item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      total_amount: body.total_amount,
      currency: body.currency,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
    }

    // Process the sale event
    const result = await processSaleEvent(connection.id, connection.store_id, event)

    const statusCode = result.status === 'skipped' ? 200 : result.status === 'processed' ? 201 : 500

    return NextResponse.json({
      success: result.status !== 'failed',
      data: result,
    }, { status: statusCode })
  } catch (error) {
    console.error('POS webhook error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal error processing sale event' },
      { status: 500 }
    )
  }
}
