import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden, apiNotFound } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { applyInvoiceSchema } from '@/lib/validations/invoices'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { applyInvoiceToInventory } from '@/lib/services/invoice-ocr'

interface RouteParams {
  params: Promise<{ storeId: string; invoiceId: string }>
}

/**
 * POST /api/stores/:storeId/invoices/:invoiceId/apply
 *
 * Apply an approved invoice to inventory — creates stock reception records
 * for all matched line items.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, invoiceId } = await params

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

    // Parse optional notes
    let notes: string | undefined
    try {
      const body = await request.json()
      const parsed = applyInvoiceSchema.safeParse(body)
      if (parsed.success) {
        notes = parsed.data.notes
      }
    } catch {
      // No body is fine — notes are optional
    }

    const supabase = createAdminClient()

    // Verify invoice exists and belongs to this store
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, status, invoice_number')
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .single()

    if (fetchError || !invoice) {
      return apiNotFound('Invoice', context.requestId)
    }

    if (invoice.status === 'applied') {
      return apiBadRequest('Invoice has already been applied to inventory', context.requestId)
    }

    if (!['review', 'approved'].includes(invoice.status)) {
      return apiBadRequest(
        `Cannot apply invoice with status "${invoice.status}". Invoice must be in review or approved status.`,
        context.requestId
      )
    }

    const result = await applyInvoiceToInventory(
      invoiceId,
      storeId,
      context.user.id,
      notes
    )

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'invoice.apply',
      details: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        items_updated: result.itemsUpdated,
      },
    })

    return apiSuccess({
      invoice_id: invoiceId,
      items_updated: result.itemsUpdated,
      status: 'applied',
    }, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to apply invoice',
      { status: 500 }
    )
  }
}
