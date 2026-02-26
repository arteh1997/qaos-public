import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden, apiNotFound } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { updateInvoiceSchema } from '@/lib/validations/invoices'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ storeId: string; invoiceId: string }>
}

/**
 * GET /api/stores/:storeId/invoices/:invoiceId - Get invoice detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId, invoiceId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const supabase = createAdminClient()

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        suppliers(id, name, email, contact_person),
        purchase_orders(id, po_number, status, total_amount),
        invoice_line_items(
          *,
          inventory_items(id, name, unit)
        )
      `)
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .single()

    if (error || !invoice) {
      return apiNotFound('Invoice', context.requestId)
    }

    // Generate a signed URL for the file (valid for 1 hour)
    const { data: signedUrl } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.file_path, 3600)

    return apiSuccess({
      ...invoice,
      file_url: signedUrl?.signedUrl || null,
    }, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch invoice',
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/stores/:storeId/invoices/:invoiceId - Update invoice
 *
 * Used to correct OCR data, update line item matches, and change status.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const parsed = updateInvoiceSchema.safeParse(body)

    if (!parsed.success) {
      return apiBadRequest(
        parsed.error.issues.map(e => e.message).join(', '),
        context.requestId
      )
    }

    const supabase = createAdminClient()

    // Verify invoice exists and belongs to this store
    const { data: existing, error: fetchError } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('store_id', storeId)
      .single()

    if (fetchError || !existing) {
      return apiNotFound('Invoice', context.requestId)
    }

    if (existing.status === 'applied') {
      return apiBadRequest('Cannot modify an applied invoice', context.requestId)
    }

    const { line_items, ...invoiceFields } = parsed.data

    // Update invoice fields
    if (Object.keys(invoiceFields).length > 0) {
      const updateData: Record<string, unknown> = { ...invoiceFields }

      // Track reviewer if status is being changed to approved
      if (invoiceFields.status === 'approved') {
        updateData.reviewed_by = context.user.id
        updateData.reviewed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId)

      if (updateError) {
        return apiError('Failed to update invoice', { status: 500, requestId: context.requestId })
      }
    }

    // Update line items if provided
    if (line_items && line_items.length > 0) {
      for (const item of line_items) {
        if (item.id) {
          // Update existing line item
          const { id: lineItemId, ...updateFields } = item
          // If user manually matched, set match_status
          if (updateFields.inventory_item_id && !updateFields.match_status) {
            updateFields.match_status = 'manually_matched'
          }
          await supabase
            .from('invoice_line_items')
            .update(updateFields)
            .eq('id', lineItemId)
            .eq('invoice_id', invoiceId)
        } else {
          // Insert new line item
          await supabase
            .from('invoice_line_items')
            .insert({
              invoice_id: invoiceId,
              ...item,
              match_status: item.inventory_item_id ? 'manually_matched' : 'unmatched',
            })
        }
      }
    }

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'invoice.update',
      details: {
        invoice_id: invoiceId,
        fields_updated: Object.keys(invoiceFields),
        line_items_updated: line_items?.length || 0,
      },
    })

    // Fetch updated invoice
    const { data: updated } = await supabase
      .from('invoices')
      .select(`
        *,
        suppliers(id, name),
        invoice_line_items(*, inventory_items(id, name, unit))
      `)
      .eq('id', invoiceId)
      .single()

    return apiSuccess(updated, { requestId: context.requestId })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to update invoice',
      { status: 500 }
    )
  }
}
