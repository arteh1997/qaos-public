/**
 * Invoice OCR Service
 *
 * Handles invoice file processing via Google Document AI,
 * extraction of structured invoice data, and fuzzy matching
 * of line items to inventory.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// ── Types ──

export interface OCRLineItem {
  description: string
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  unit_of_measure: string | null
}

export interface OCRResult {
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  tax_amount: number | null
  total_amount: number | null
  currency: string | null
  supplier_name: string | null
  line_items: OCRLineItem[]
  confidence: number
  raw_response: Record<string, unknown>
}

export interface MatchResult {
  line_item_index: number
  inventory_item_id: string | null
  inventory_item_name: string | null
  confidence: number
  match_status: 'auto_matched' | 'unmatched'
}

// ── OCR Processing ──

/**
 * Process an invoice through OCR and update the database with results.
 * Called asynchronously after upload.
 */
export async function processInvoice(invoiceId: string, storeId: string): Promise<void> {
  const supabase = createAdminClient()

  // 1. Mark as processing
  await supabase
    .from('invoices')
    .update({ status: 'processing' })
    .eq('id', invoiceId)

  try {
    // 2. Get invoice record
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (fetchError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }

    // 3. Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices')
      .download(invoice.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download invoice file: ${downloadError?.message}`)
    }

    // 4. Run OCR
    const fileBuffer = Buffer.from(await fileData.arrayBuffer())
    const ocrResult = await extractInvoiceData(fileBuffer, invoice.file_type)

    // 5. Auto-match line items to inventory
    const matches = await matchLineItemsToInventory(
      ocrResult.line_items,
      storeId,
      invoice.supplier_id
    )

    // 6. Insert line items with match results
    if (ocrResult.line_items.length > 0) {
      const lineItems = ocrResult.line_items.map((item, index) => {
        const match = matches.find(m => m.line_item_index === index)
        return {
          invoice_id: invoiceId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          unit_of_measure: item.unit_of_measure,
          inventory_item_id: match?.inventory_item_id || null,
          match_confidence: match?.confidence || null,
          match_status: match?.match_status || 'unmatched',
          sort_order: index,
        }
      })

      await supabase.from('invoice_line_items').insert(lineItems)
    }

    // 7. Update invoice with OCR results
    await supabase
      .from('invoices')
      .update({
        invoice_number: ocrResult.invoice_number,
        invoice_date: ocrResult.invoice_date,
        due_date: ocrResult.due_date,
        subtotal: ocrResult.subtotal,
        tax_amount: ocrResult.tax_amount,
        total_amount: ocrResult.total_amount,
        extracted_data: ocrResult.raw_response,
        ocr_provider: 'google_document_ai',
        ocr_confidence: ocrResult.confidence,
        ocr_processed_at: new Date().toISOString(),
        status: 'review',
      })
      .eq('id', invoiceId)

  } catch (error) {
    // Mark as failed — user can retry or enter manually
    logger.error(`OCR processing failed for invoice ${invoiceId}:`, error)
    await supabase
      .from('invoices')
      .update({
        status: 'review', // Still let user enter data manually
        notes: `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
  }
}

// ── Google Document AI ──

/**
 * Extract structured invoice data using Google Document AI.
 * Falls back to empty results if Document AI is not configured.
 */
async function extractInvoiceData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'eu'

  // If not configured, return empty result (manual entry fallback)
  if (!projectId || !processorId) {
    logger.warn('Google Document AI not configured — returning empty OCR result')
    return {
      invoice_number: null,
      invoice_date: null,
      due_date: null,
      subtotal: null,
      tax_amount: null,
      total_amount: null,
      currency: null,
      supplier_name: null,
      line_items: [],
      confidence: 0,
      raw_response: { warning: 'OCR not configured' },
    }
  }

  try {
    // @ts-expect-error — optional dependency, installed in production only
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai')
    const client = new DocumentProcessorServiceClient()

    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType,
      },
    })

    const document = result.document
    if (!document) {
      throw new Error('No document returned from Document AI')
    }

    return parseDocumentAIResponse(document)
  } catch (error) {
    logger.error('Document AI processing error:', error)
    throw error
  }
}

/**
 * Parse Google Document AI response into structured invoice data.
 */
function parseDocumentAIResponse(document: Record<string, unknown>): OCRResult {
  const entities = (document.entities as Array<{
    type?: string
    mentionText?: string
    normalizedValue?: { text?: string }
    confidence?: number
    properties?: Array<{
      type?: string
      mentionText?: string
      normalizedValue?: { text?: string }
      confidence?: number
    }>
  }>) || []

  let invoiceNumber: string | null = null
  let invoiceDate: string | null = null
  let dueDate: string | null = null
  let subtotal: number | null = null
  let taxAmount: number | null = null
  let totalAmount: number | null = null
  let currency: string | null = null
  let supplierName: string | null = null
  const lineItems: OCRLineItem[] = []
  let totalConfidence = 0
  let entityCount = 0

  for (const entity of entities) {
    const type = entity.type || ''
    const text = entity.mentionText || entity.normalizedValue?.text || ''
    const confidence = entity.confidence || 0

    totalConfidence += confidence
    entityCount++

    switch (type) {
      case 'invoice_id':
        invoiceNumber = text
        break
      case 'invoice_date':
        invoiceDate = parseDate(text)
        break
      case 'due_date':
        dueDate = parseDate(text)
        break
      case 'net_amount':
        subtotal = parseAmount(text)
        break
      case 'total_tax_amount':
        taxAmount = parseAmount(text)
        break
      case 'total_amount':
      case 'amount_due':
        totalAmount = parseAmount(text)
        break
      case 'currency':
        currency = text.toUpperCase()
        break
      case 'supplier_name':
        supplierName = text
        break
      case 'line_item':
        lineItems.push(parseLineItem(entity))
        break
    }
  }

  return {
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    currency,
    supplier_name: supplierName,
    line_items: lineItems,
    confidence: entityCount > 0 ? (totalConfidence / entityCount) * 100 : 0,
    raw_response: { entityCount, entities: entities.map(e => ({ type: e.type, text: e.mentionText })) },
  }
}

function parseLineItem(entity: {
  properties?: Array<{
    type?: string
    mentionText?: string
    normalizedValue?: { text?: string }
  }>
  mentionText?: string
}): OCRLineItem {
  const props = entity.properties || []
  let description = ''
  let quantity: number | null = null
  let unitPrice: number | null = null
  let totalPrice: number | null = null
  let unitOfMeasure: string | null = null

  for (const prop of props) {
    const type = prop.type || ''
    const text = prop.mentionText || prop.normalizedValue?.text || ''

    switch (type) {
      case 'line_item/description':
        description = text
        break
      case 'line_item/quantity':
        quantity = parseFloat(text) || null
        break
      case 'line_item/unit_price':
        unitPrice = parseAmount(text)
        break
      case 'line_item/amount':
        totalPrice = parseAmount(text)
        break
      case 'line_item/unit':
        unitOfMeasure = text
        break
    }
  }

  // Fallback: use entity text as description if no properties
  if (!description && entity.mentionText) {
    description = entity.mentionText
  }

  return {
    description,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    unit_of_measure: unitOfMeasure,
  }
}

// ── Item Matching ──

/**
 * Match OCR-extracted line items to inventory items using fuzzy string matching.
 * Checks supplier items first (if supplier is known) for exact/close matches,
 * then falls back to matching against all inventory item names.
 */
export async function matchLineItemsToInventory(
  lineItems: OCRLineItem[],
  storeId: string,
  supplierId: string | null
): Promise<MatchResult[]> {
  if (lineItems.length === 0) return []

  const supabase = createAdminClient()
  const results: MatchResult[] = []

  // Get inventory items for this store
  const { data: inventoryItems } = await supabase
    .from('store_inventory')
    .select('inventory_item_id, inventory_items(id, name)')
    .eq('store_id', storeId)

  const inventory = (inventoryItems || []).map((si: Record<string, unknown>) => {
    const item = si.inventory_items as { id: string; name: string } | null
    return {
      id: item?.id || '',
      name: (item?.name || '').toLowerCase(),
    }
  }).filter(i => i.id)

  // If supplier known, get supplier item catalog for better matching
  let supplierItems: Array<{ inventory_item_id: string; supplier_sku: string | null; item_name: string }> = []
  if (supplierId) {
    const { data: si } = await supabase
      .from('supplier_items')
      .select('inventory_item_id, supplier_sku, inventory_items(name)')
      .eq('supplier_id', supplierId)
      .eq('is_active', true)

    supplierItems = (si || []).map((s: Record<string, unknown>) => {
      const item = s.inventory_items as { name: string } | null
      return {
        inventory_item_id: s.inventory_item_id as string,
        supplier_sku: s.supplier_sku as string | null,
        item_name: (item?.name || '').toLowerCase(),
      }
    })
  }

  for (let i = 0; i < lineItems.length; i++) {
    const lineItem = lineItems[i]
    const description = (lineItem.description || '').toLowerCase().trim()

    if (!description) {
      results.push({
        line_item_index: i,
        inventory_item_id: null,
        inventory_item_name: null,
        confidence: 0,
        match_status: 'unmatched',
      })
      continue
    }

    // Try supplier items first (higher confidence)
    let bestMatch: MatchResult | null = null

    if (supplierItems.length > 0) {
      for (const si of supplierItems) {
        // Check supplier SKU exact match
        if (si.supplier_sku && description.includes(si.supplier_sku.toLowerCase())) {
          bestMatch = {
            line_item_index: i,
            inventory_item_id: si.inventory_item_id,
            inventory_item_name: si.item_name,
            confidence: 95,
            match_status: 'auto_matched',
          }
          break
        }

        // Fuzzy match against supplier item name
        const score = fuzzyMatch(description, si.item_name)
        if (score > (bestMatch?.confidence || 0)) {
          bestMatch = {
            line_item_index: i,
            inventory_item_id: si.inventory_item_id,
            inventory_item_name: si.item_name,
            confidence: Math.min(score + 10, 100), // Supplier match bonus
            match_status: score + 10 >= 80 ? 'auto_matched' : 'unmatched',
          }
        }
      }
    }

    // Fall back to general inventory matching
    if (!bestMatch || bestMatch.confidence < 80) {
      for (const item of inventory) {
        const score = fuzzyMatch(description, item.name)
        if (score > (bestMatch?.confidence || 0)) {
          bestMatch = {
            line_item_index: i,
            inventory_item_id: item.id,
            inventory_item_name: item.name,
            confidence: score,
            match_status: score >= 80 ? 'auto_matched' : 'unmatched',
          }
        }
      }
    }

    results.push(bestMatch || {
      line_item_index: i,
      inventory_item_id: null,
      inventory_item_name: null,
      confidence: 0,
      match_status: 'unmatched',
    })
  }

  return results
}

// ── Apply Invoice to Inventory ──

/**
 * Apply an approved invoice to inventory by creating stock reception records.
 */
export async function applyInvoiceToInventory(
  invoiceId: string,
  storeId: string,
  userId: string,
  notes?: string
): Promise<{ itemsUpdated: number }> {
  const supabase = createAdminClient()

  // Get invoice with matched line items
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error('Invoice not found')
  }

  if (invoice.status === 'applied') {
    throw new Error('Invoice has already been applied to inventory')
  }

  if (!['review', 'approved'].includes(invoice.status)) {
    throw new Error(`Cannot apply invoice with status: ${invoice.status}`)
  }

  const lineItems = (invoice.invoice_line_items || []).filter(
    (li: { match_status: string; inventory_item_id: string | null; quantity: number | null }) =>
      li.match_status !== 'skipped' &&
      li.match_status !== 'unmatched' &&
      li.inventory_item_id &&
      li.quantity && li.quantity > 0
  )

  if (lineItems.length === 0) {
    throw new Error('No matched line items to apply')
  }

  let itemsUpdated = 0
  const now = new Date().toISOString()

  for (const lineItem of lineItems) {
    // Get current inventory level
    const { data: currentInventory } = await supabase
      .from('store_inventory')
      .select('quantity')
      .eq('store_id', storeId)
      .eq('inventory_item_id', lineItem.inventory_item_id!)
      .single()

    const currentQty = currentInventory?.quantity || 0
    const newQty = currentQty + lineItem.quantity!

    // Update inventory quantity
    const itemId = lineItem.inventory_item_id!
    await supabase
      .from('store_inventory')
      .upsert({
        store_id: storeId,
        inventory_item_id: itemId,
        quantity: newQty,
        last_updated_at: now,
        last_updated_by: userId,
      }, { onConflict: 'store_id,inventory_item_id' })

    // Update unit_cost if invoice has price data
    if (lineItem.unit_price) {
      await supabase
        .from('store_inventory')
        .update({ unit_cost: lineItem.unit_price })
        .eq('store_id', storeId)
        .eq('inventory_item_id', itemId)
    }

    // Record stock history
    await supabase
      .from('stock_history')
      .insert({
        store_id: storeId,
        inventory_item_id: itemId,
        action_type: 'Reception',
        quantity_before: currentQty,
        quantity_after: newQty,
        quantity_change: lineItem.quantity,
        performed_by: userId,
        notes: `Invoice #${invoice.invoice_number || invoiceId.slice(0, 8)} — ${lineItem.description || 'item'}${notes ? ` | ${notes}` : ''}`,
      })

    itemsUpdated++
  }

  // Mark invoice as applied
  await supabase
    .from('invoices')
    .update({
      status: 'applied',
      reviewed_by: userId,
      reviewed_at: now,
    })
    .eq('id', invoiceId)

  return { itemsUpdated }
}

// ── Utility Functions ──

/**
 * Simple fuzzy string matching score (0-100).
 * Uses token overlap + containment for practical invoice matching.
 */
function fuzzyMatch(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 100

  // Direct containment
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length)
    const longer = Math.max(a.length, b.length)
    return Math.round((shorter / longer) * 100)
  }

  // Token overlap
  const tokensA = a.split(/\s+/).filter(Boolean)
  const tokensB = b.split(/\s+/).filter(Boolean)

  if (tokensA.length === 0 || tokensB.length === 0) return 0

  let matches = 0
  for (const tokenA of tokensA) {
    for (const tokenB of tokensB) {
      if (tokenA === tokenB) {
        matches++
        break
      }
      // Partial token match (e.g., "tomato" vs "tomatoes")
      if (tokenA.length > 3 && tokenB.length > 3) {
        const shorter = tokenA.length <= tokenB.length ? tokenA : tokenB
        const longer = tokenA.length > tokenB.length ? tokenA : tokenB
        if (longer.startsWith(shorter) || shorter.startsWith(longer.slice(0, shorter.length))) {
          matches += 0.7
          break
        }
      }
    }
  }

  const maxTokens = Math.max(tokensA.length, tokensB.length)
  return Math.round((matches / maxTokens) * 100)
}

function parseAmount(text: string): number | null {
  if (!text) return null
  // Remove currency symbols, commas, spaces
  const cleaned = text.replace(/[£$€,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseDate(text: string): string | null {
  if (!text) return null
  try {
    const date = new Date(text)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}
