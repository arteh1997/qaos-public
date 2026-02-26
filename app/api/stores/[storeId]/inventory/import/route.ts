import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Map human-friendly CSV headers to internal field names (backward-compatible)
const HEADER_ALIASES: Record<string, string> = {
  'item name': 'name',
  'unit (kg/litres/each/etc)': 'unit',
  'minimum stock level': 'par_level',
  'cost per unit (£)': 'cost_per_unit',
  'unit cost (£)': 'cost_per_unit',
  'current stock': 'current_stock',
  // Technical headers (backward compatibility)
  'name': 'name',
  'category': 'category',
  'unit': 'unit',
  'par_level': 'par_level',
  'cost_per_unit': 'cost_per_unit',
  'cost': 'cost_per_unit',
  'current_stock': 'current_stock',
  'quantity': 'current_stock',
}

function normalizeHeader(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return HEADER_ALIASES[lower] || lower
}

// Validation schema for CSV row
const csvRowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  unit: z.string().max(50).optional(),
  current_stock: z.coerce.number().min(0, 'Current stock cannot be negative').optional(),
  par_level: z.coerce.number().positive('Par level must be positive').optional(),
  cost_per_unit: z.coerce.number().min(0, 'Cost cannot be negative').optional(),
})

type CSVRow = z.infer<typeof csvRowSchema>

interface ParsedRow {
  row: number
  data: CSVRow
  errors: string[]
}

/**
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n')
  const rows: string[][] = []

  for (const line of lines) {
    // Simple CSV parsing (handles basic cases, not complex quoted values)
    const row = line.split(',').map(cell => cell.trim())
    rows.push(row)
  }

  return rows
}

/**
 * POST /api/stores/[storeId]/inventory/import
 * Parse and validate CSV file, then bulk insert inventory items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has permission to manage inventory (Owner or Manager)
    const { data: storeUser } = await supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', session.user.id)
      .single()

    if (!storeUser || !['Owner', 'Manager'].includes(storeUser.role)) {
      return NextResponse.json(
        { success: false, message: 'Access denied. Only Owners and Managers can import inventory.' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Read file content
    const csvText = await file.text()
    const rows = parseCSV(csvText)

    if (rows.length < 2) {
      return NextResponse.json(
        { success: false, message: 'CSV file must contain a header row and at least one data row' },
        { status: 400 }
      )
    }

    // Validate header (normalize human-friendly headers to internal names)
    const header = rows[0].map(h => normalizeHeader(h))
    const expectedHeaders = ['name', 'category', 'current_stock', 'par_level', 'cost_per_unit']
    const requiredHeaders = ['name', 'category']

    const missingHeaders = requiredHeaders.filter(h => !header.includes(h))
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Missing required columns: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Get column indices
    const nameIndex = header.indexOf('name')
    const categoryIndex = header.indexOf('category')
    const unitIndex = header.indexOf('unit')
    const currentStockIndex = header.indexOf('current_stock')
    const parLevelIndex = header.indexOf('par_level')
    const costIndex = header.indexOf('cost_per_unit')

    // Parse and validate data rows
    const parsedRows: ParsedRow[] = []
    const validItems: Array<{
      store_id: string
      name: string
      category: string
      unit_of_measure: string
      is_active: boolean
    }> = []
    const currentStocks: Array<number> = []
    const parLevels: Array<number | null> = []
    const unitCosts: Array<number | null> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1

      // Skip empty rows
      if (row.every(cell => !cell)) continue

      const rowData = {
        name: row[nameIndex] || '',
        category: row[categoryIndex] || '',
        unit: unitIndex >= 0 && row[unitIndex] ? row[unitIndex] : undefined,
        current_stock: currentStockIndex >= 0 && row[currentStockIndex] ? row[currentStockIndex] : undefined,
        par_level: parLevelIndex >= 0 && row[parLevelIndex] ? row[parLevelIndex] : undefined,
        cost_per_unit: costIndex >= 0 && row[costIndex] ? row[costIndex] : undefined,
      }

      const result = csvRowSchema.safeParse(rowData)

      if (result.success) {
        parsedRows.push({
          row: rowNumber,
          data: result.data,
          errors: [],
        })

        validItems.push({
          store_id: storeId,
          name: result.data.name,
          category: result.data.category,
          unit_of_measure: result.data.unit || 'each',
          is_active: true,
        })
        currentStocks.push(result.data.current_stock ?? 0)
        parLevels.push(result.data.par_level ?? null)
        unitCosts.push(result.data.cost_per_unit ?? null)
      } else {
        parsedRows.push({
          row: rowNumber,
          data: rowData as CSVRow,
          errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        })
      }
    }

    const errorRows = parsedRows.filter(r => r.errors.length > 0)

    if (errorRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Found ${errorRows.length} invalid row(s)`,
          errors: errorRows.map(r => ({
            row: r.row,
            errors: r.errors,
            data: r.data,
          })),
          validCount: validItems.length,
        },
        { status: 400 }
      )
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid items to import' },
        { status: 400 }
      )
    }

    // Bulk insert valid items
    const { data: insertedItems, error: insertError } = await supabase
      .from('inventory_items')
      .insert(validItems)
      .select()

    if (insertError) {
      logger.error('[Import] Insert error:', { error: insertError })
      return NextResponse.json(
        { success: false, message: 'Failed to import items', error: insertError.message },
        { status: 500 }
      )
    }

    // Create store_inventory records with par_levels
    if (insertedItems && insertedItems.length > 0) {
      const storeInventoryRecords = insertedItems.map((item, index) => ({
        store_id: storeId,
        inventory_item_id: item.id,
        quantity: currentStocks[index] ?? 0,
        par_level: parLevels[index],
        unit_cost: unitCosts[index] ?? 0,
        cost_currency: 'GBP',
      }))

      const { error: inventoryError } = await supabase
        .from('store_inventory')
        .insert(storeInventoryRecords)

      if (inventoryError) {
        logger.error('[Import] Store inventory error:', { error: inventoryError })
        return NextResponse.json(
          { success: false, message: 'Failed to link items to store', error: inventoryError.message },
          { status: 500 }
        )
      }
    }

    // Get unique categories for the response
    const categories = [...new Set(validItems.map(item => item.category))]

    // Audit log the bulk import
    const admin = createAdminClient()
    await auditLog(admin, {
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'inventory.bulk_import',
      storeId,
      resourceType: 'inventory_import',
      details: {
        itemsImported: insertedItems.length,
        categories,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${insertedItems.length} item(s)`,
      data: {
        itemsImported: insertedItems.length,
        categoriesCreated: categories.length,
        categories: categories,
        items: insertedItems,
      },
    })
  } catch (error) {
    logger.error('[Import] Error:', { error: error })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
