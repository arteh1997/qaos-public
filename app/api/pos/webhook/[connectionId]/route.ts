import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import {
  processSaleEvent,
  validateWebhookSignature,
  getAdapter,
  type PosSaleEvent,
  type PosSaleItem,
  type PosProvider,
} from '@/lib/services/pos'

type RouteParams = { params: Promise<{ connectionId: string }> }

/**
 * Signature header names per provider
 */
const SIGNATURE_HEADERS: Record<string, string> = {
  square: 'x-square-hmacsha256-signature',
  toast: 'toast-signature',
  clover: 'x-clover-hmac-sha256',
  lightspeed: 'x-lightspeed-signature',
  zettle: 'x-izettle-signature',
  sumup: 'x-sumup-signature',
  epos_now: 'x-eposnow-signature',
  tevalis: 'x-tevalis-signature',
  custom: 'x-webhook-signature',
}

/**
 * POST /api/pos/webhook/[connectionId] - Receive sale events from POS systems
 *
 * This is a public endpoint (no user auth required).
 * Authentication is done via webhook signature verification.
 *
 * Supports two modes:
 * 1. Generic format (custom provider): structured body with event_id, items, etc.
 * 2. Provider-native format: raw payload from POS, normalized via adapter
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

    const provider = connection.provider as PosProvider
    const credentials = (connection.credentials || {}) as Record<string, unknown>
    const webhookSecret = (credentials.webhook_secret as string) || ''

    // Read raw body for signature verification
    const rawBody = await request.text()

    // Verify webhook signature (if secret is configured)
    if (webhookSecret) {
      const signatureHeader = SIGNATURE_HEADERS[provider] || 'x-webhook-signature'
      const signature = request.headers.get(signatureHeader) || ''

      if (!signature || !validateWebhookSignature(provider, rawBody, signature, webhookSecret)) {
        return NextResponse.json(
          { success: false, error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }
    }

    const body = JSON.parse(rawBody)

    // Try provider-native normalization first, fall back to generic format
    let event: PosSaleEvent | null = null
    const adapter = getAdapter(provider)

    if (adapter && provider !== 'custom') {
      event = adapter.normalizeEvent(body)
    }

    // Fall back to generic format if adapter didn't produce an event
    if (!event) {
      // Validate required generic fields
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

      for (const item of body.items) {
        if (!item.pos_item_id || !item.pos_item_name || typeof item.quantity !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Each item must have pos_item_id, pos_item_name, and quantity' },
            { status: 400 }
          )
        }
      }

      event = {
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
    }

    // Process the sale event
    const result = await processSaleEvent(connection.id, connection.store_id, event)

    const statusCode = result.status === 'skipped' ? 200 : result.status === 'processed' ? 201 : 500

    return NextResponse.json({
      success: result.status !== 'failed',
      data: result,
    }, { status: statusCode })
  } catch (error) {
    logger.error('POS webhook error:', { error: error })
    return NextResponse.json(
      { success: false, error: 'Internal error processing sale event' },
      { status: 500 }
    )
  }
}
