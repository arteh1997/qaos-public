import { NextRequest } from 'next/server'
import { withSupplierAuth } from '@/lib/api/with-supplier-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logPortalActivity } from '@/lib/services/supplier-portal'

/**
 * GET  /api/supplier-portal/invoices
 * List invoices uploaded by (or for) this supplier.
 *
 * POST /api/supplier-portal/invoices
 * Upload an invoice from the supplier side.
 */
export async function GET(request: NextRequest) {
  const auth = await withSupplierAuth(request, { permission: 'can_upload_invoices' })
  if (!auth.success) return auth.response

  const { supplierId, storeId } = auth
  const supabase = createAdminClient()

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, due_date, total_amount, currency, status, file_name, created_at')
    .eq('supplier_id', supplierId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }

  return Response.json({ success: true, data: invoices })
}

export async function POST(request: NextRequest) {
  const auth = await withSupplierAuth(request, { permission: 'can_upload_invoices' })
  if (!auth.success) return auth.response

  const { supplierId, storeId, tokenId } = auth
  const supabase = createAdminClient()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type & size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { success: false, error: 'File must be JPEG, PNG, WebP, or PDF' },
        { status: 400 }
      )
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return Response.json(
        { success: false, error: 'File must be under 10MB' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${storeId}/${supplierId}/${timestamp}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      return Response.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create invoice record
    const invoiceNumber = formData.get('invoice_number') as string | null
    const purchaseOrderId = formData.get('purchase_order_id') as string | null

    const { data: invoice, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        store_id: storeId,
        supplier_id: supplierId,
        purchase_order_id: purchaseOrderId || null,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        invoice_number: invoiceNumber || null,
        status: 'pending',
        currency: 'GBP',
        created_by: supplierId, // Supplier as creator
      })
      .select('id, file_name, status, created_at')
      .single()

    if (insertErr) {
      return Response.json(
        { success: false, error: 'Failed to create invoice record' },
        { status: 500 }
      )
    }

    await logPortalActivity({
      supplierId,
      storeId,
      tokenId,
      action: 'invoice.uploaded',
      details: { invoiceId: invoice.id, fileName: file.name },
    })

    return Response.json({ success: true, data: invoice }, { status: 201 })
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to upload invoice' },
      { status: 500 }
    )
  }
}
