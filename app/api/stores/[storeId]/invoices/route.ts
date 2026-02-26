import { NextRequest } from 'next/server'
import { withApiAuth, canManageStore } from '@/lib/api/middleware'
import { apiSuccess, apiError, apiBadRequest, apiForbidden, createPaginationMeta } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { INVOICE_FILE_CONFIG } from '@/lib/validations/invoices'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { processInvoice } from '@/lib/services/invoice-ocr'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/invoices - List invoices
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner', 'Manager'],
      rateLimit: { key: 'api', config: RATE_LIMITS.api },
    })
    if (!auth.success) return auth.response
    const { context } = auth

    if (!canManageStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplier_id')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const offset = (page - 1) * pageSize

    const supabase = createAdminClient()

    let query = supabase
      .from('invoices')
      .select('*, suppliers(id, name)', { count: 'exact' })
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (status) {
      query = query.eq('status', status)
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    const { data, error, count } = await query

    if (error) {
      return apiError('Failed to fetch invoices', { status: 500, requestId: context.requestId })
    }

    return apiSuccess(data, {
      requestId: context.requestId,
      pagination: createPaginationMeta(page, pageSize, count || 0),
    })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch invoices',
      { status: 500 }
    )
  }
}

/**
 * POST /api/stores/:storeId/invoices - Upload an invoice
 *
 * Accepts multipart form data with:
 * - file: The invoice image/PDF
 * - supplier_id (optional): Link to a supplier
 * - purchase_order_id (optional): Link to a PO
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

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const supplierId = formData.get('supplier_id') as string | null
    const purchaseOrderId = formData.get('purchase_order_id') as string | null

    if (!file) {
      return apiBadRequest('No file provided', context.requestId)
    }

    // Validate file
    if (!INVOICE_FILE_CONFIG.allowedMimeTypes.includes(file.type as typeof INVOICE_FILE_CONFIG.allowedMimeTypes[number])) {
      return apiBadRequest(
        `Invalid file type: ${file.type}. Allowed: ${INVOICE_FILE_CONFIG.allowedMimeTypes.join(', ')}`,
        context.requestId
      )
    }

    if (file.size > INVOICE_FILE_CONFIG.maxSizeBytes) {
      return apiBadRequest(
        `File too large. Maximum size: ${INVOICE_FILE_CONFIG.maxSizeBytes / (1024 * 1024)}MB`,
        context.requestId
      )
    }

    const supabase = createAdminClient()

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop() || 'jpg'
    const filePath = `${storeId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`

    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(INVOICE_FILE_CONFIG.storageBucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return apiError(`Failed to upload file: ${uploadError.message}`, {
        status: 500,
        requestId: context.requestId,
      })
    }

    // Create invoice record
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        store_id: storeId,
        supplier_id: supplierId || null,
        purchase_order_id: purchaseOrderId || null,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        status: 'pending',
        created_by: context.user.id,
      })
      .select()
      .single()

    if (insertError || !invoice) {
      // Clean up uploaded file on failure
      await supabase.storage.from(INVOICE_FILE_CONFIG.storageBucket).remove([filePath])
      return apiError('Failed to create invoice record', {
        status: 500,
        requestId: context.requestId,
      })
    }

    await auditLog(supabase, {
      userId: context.user.id,
      storeId,
      action: 'invoice.upload',
      details: {
        invoice_id: invoice.id,
        file_name: file.name,
        supplier_id: supplierId,
        purchase_order_id: purchaseOrderId,
      },
    })

    // Kick off OCR processing asynchronously (don't await)
    processInvoice(invoice.id, storeId).catch(err => {
      logger.error(`Background OCR processing failed for invoice ${invoice.id}:`, err)
    })

    return apiSuccess(invoice, { requestId: context.requestId, status: 201 })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Failed to upload invoice',
      { status: 500 }
    )
  }
}
