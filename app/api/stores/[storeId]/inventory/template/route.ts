import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/stores/[storeId]/inventory/template
 * Download CSV template for bulk importing inventory items
 */
export async function GET(
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

    // Verify user has access to this store
    const { data: storeUser } = await supabase
      .from('store_users')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', session.user.id)
      .single()

    if (!storeUser) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      )
    }

    // Generate CSV template with example rows (human-friendly headers)
    const csvContent = `Item Name,Category,Current Stock,Minimum Stock Level,Unit Cost (£)
Chicken Breast,Proteins,15,10,5.50
Tomatoes,Produce,8,5,2.00
Olive Oil,Oils & Condiments,2,3,8.99
Mozzarella Cheese,Dairy,12,8,12.50
Paper Towels,Supplies,25,20,3.75`

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="inventory-template.csv"',
      },
    })
  } catch (error) {
    logger.error('[Inventory Template] Error:', { error: error })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
