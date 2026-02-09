import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { UNITS_OF_MEASURE } from '@/lib/constants'

// Validation schema for CSV row
const csvRowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  category: z.string().min(1, 'Category is required').max(100),
  unit: z.string().min(1, 'Unit is required').max(50),
  par_level: z.coerce.number().positive('Par level must be positive').optional(),
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

    // Validate header
    const header = rows[0].map(h => h.toLowerCase())
    const expectedHeaders = ['name', 'category', 'unit', 'par_level']
    const requiredHeaders = ['name', 'category', 'unit']

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
    const parLevelIndex = header.indexOf('par_level')

    // Parse and validate data rows
    const parsedRows: ParsedRow[] = []
    const validItems: Array<{
      name: string
      category: string
      unit_of_measure: string
      is_active: boolean
    }> = []
    const parLevels: Array<number | null> = [] // Track par levels separately

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1

      // Skip empty rows
      if (row.every(cell => !cell)) continue

      const rowData = {
        name: row[nameIndex] || '',
        category: row[categoryIndex] || '',
        unit: row[unitIndex] || '',
        par_level: parLevelIndex >= 0 && row[parLevelIndex] ? row[parLevelIndex] : undefined,
      }

      const result = csvRowSchema.safeParse(rowData)

      if (result.success) {
        parsedRows.push({
          row: rowNumber,
          data: result.data,
          errors: [],
        })

        validItems.push({
          name: result.data.name,
          category: result.data.category,
          unit_of_measure: result.data.unit,
          is_active: true,
        })
        parLevels.push(result.data.par_level ?? null)
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
      console.error('[Import] Insert error:', insertError)
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
        quantity: 0, // Start with 0 quantity
        par_level: parLevels[index], // Use the par_level from CSV
      }))

      const { error: inventoryError } = await supabase
        .from('store_inventory')
        .insert(storeInventoryRecords)

      if (inventoryError) {
        console.error('[Import] Store inventory error:', inventoryError)
        return NextResponse.json(
          { success: false, message: 'Failed to link items to store', error: inventoryError.message },
          { status: 500 }
        )
      }
    }

    // Get unique categories for the response
    const categories = [...new Set(validItems.map(item => item.category))]

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
    console.error('[Import] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
