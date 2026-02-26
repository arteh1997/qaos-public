import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { xeroAdapter, getXeroCredentials } from '@/lib/services/accounting/xero'
import { triggerSyncSchema } from '@/lib/validations/accounting'
import { auditLog } from '@/lib/audit'
import type { AccountingCredentials, AccountingBill } from '@/lib/services/accounting/types'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * POST /api/stores/:storeId/accounting/sync
 * Trigger a sync of invoices/POs to the connected accounting system.
 */
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
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const body = await request.json()
    const parsed = triggerSyncSchema.safeParse(body)
    if (!parsed.success) {
      return apiBadRequest(
        `Invalid sync request: ${parsed.error.issues.map(i => i.message).join(', ')}`,
        context.requestId
      )
    }

    const supabase = createAdminClient()

    // Get active Xero connection
    const { data: connection } = await supabase
      .from('accounting_connections')
      .select('*')
      .eq('store_id', storeId)
      .eq('provider', 'xero')
      .eq('is_active', true)
      .single()

    if (!connection) {
      return apiBadRequest('No active Xero connection found', context.requestId)
    }

    // Mark as syncing
    await supabase
      .from('accounting_connections')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('id', connection.id)

    const rawCredentials = connection.credentials as unknown as AccountingCredentials
    const credentials = await getXeroCredentials(connection.id, rawCredentials)
    const config = (connection.config || {}) as Record<string, unknown>
    const glMappings = (config.gl_mappings || {}) as Record<string, string>
    const defaultAccountCode = glMappings['_default'] || '5000' // Cost of Goods Sold

    const results: { entity_id: string; success: boolean; external_id?: string; error?: string }[] = []

    // If a specific entity was requested, sync just that
    if (parsed.data.entity_id) {
      const result = await syncSingleInvoice(
        supabase, credentials, connection.id, storeId, parsed.data.entity_id, glMappings, defaultAccountCode
      )
      results.push(result)
    } else {
      // Sync all applied invoices that haven't been synced yet
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('store_id', storeId)
        .eq('status', 'applied')

      if (invoices) {
        // Check which have already been synced
        const { data: existingSyncs } = await supabase
          .from('accounting_sync_log')
          .select('entity_id')
          .eq('connection_id', connection.id)
          .eq('entity_type', 'invoice')
          .eq('status', 'success')

        const syncedIds = new Set((existingSyncs || []).map(s => s.entity_id))
        const unsyncedInvoices = invoices.filter(inv => !syncedIds.has(inv.id))

        for (const invoice of unsyncedInvoices) {
          const result = await syncSingleInvoice(
            supabase, credentials, connection.id, storeId, invoice.id, glMappings, defaultAccountCode
          )
          results.push(result)
        }
      }
    }

    // Update connection status
    const hasErrors = results.some(r => !r.success)
    await supabase
      .from('accounting_connections')
      .update({
        sync_status: hasErrors ? 'error' : 'idle',
        sync_error: hasErrors ? `${results.filter(r => !r.success).length} sync(s) failed` : null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'accounting.sync_triggered',
      details: {
        provider: 'xero',
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    })

    return apiSuccess(
      {
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
      { requestId: context.requestId }
    )
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to sync',
      { status: 500 }
    )
  }
}

// ── Sync Helper ──

async function syncSingleInvoice(
  supabase: ReturnType<typeof createAdminClient>,
  credentials: AccountingCredentials,
  connectionId: string,
  storeId: string,
  invoiceId: string,
  glMappings: Record<string, string>,
  defaultAccountCode: string
) {
  try {
    // Get invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (!invoice) {
      return { entity_id: invoiceId, success: false, error: 'Invoice not found' }
    }

    // Get supplier info if linked
    let supplierName = 'Unknown Supplier'
    let supplierEmail: string | undefined
    let supplierPhone: string | undefined
    let contactId: string | undefined

    if (invoice.supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, name, email, phone')
        .eq('id', invoice.supplier_id)
        .single()

      if (supplier) {
        supplierName = supplier.name
        supplierEmail = supplier.email || undefined
        supplierPhone = supplier.phone || undefined
        contactId = await xeroAdapter.findOrCreateContact(credentials, {
          name: supplier.name,
          email: supplierEmail,
          phone: supplierPhone,
        })
      }
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order')

    // Build bill
    const bill: AccountingBill = {
      contact_name: supplierName,
      contact_external_id: contactId,
      reference: invoice.invoice_number || `INV-${invoiceId.slice(0, 8)}`,
      date: invoice.invoice_date || new Date().toISOString().split('T')[0],
      due_date: invoice.due_date ?? undefined,
      currency: invoice.currency || 'GBP',
      total: Number(invoice.total_amount) || 0,
      status: 'AUTHORISED',
      line_items: (lineItems || [])
        .filter(li => li.match_status !== 'skipped')
        .map(li => {
          const accountCode = glMappings['_default'] || defaultAccountCode

          return {
            description: li.description || 'Unknown item',
            quantity: Number(li.quantity) || 1,
            unit_amount: Number(li.unit_price) || 0,
            account_code: accountCode,
          }
        }),
    }

    const result = await xeroAdapter.createBill(credentials, bill)

    // Log sync result
    await supabase.from('accounting_sync_log').insert({
      connection_id: connectionId,
      store_id: storeId,
      entity_type: 'invoice',
      entity_id: invoiceId,
      external_id: result.external_id || null,
      direction: 'push',
      status: result.success ? 'success' : 'failed',
      error_message: result.error || null,
      payload: bill as unknown as import('@/types/database').Json,
    })

    return {
      entity_id: invoiceId,
      success: result.success,
      external_id: result.external_id,
      error: result.error,
    }
  } catch (err) {
    // Log failure
    await supabase.from('accounting_sync_log').insert({
      connection_id: connectionId,
      store_id: storeId,
      entity_type: 'invoice',
      entity_id: invoiceId,
      direction: 'push',
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown error',
    })

    return {
      entity_id: invoiceId,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
