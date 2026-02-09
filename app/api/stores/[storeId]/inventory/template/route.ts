import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Generate CSV template with example rows
    const csvContent = `name,category,unit,par_level
Chicken Breast,Proteins,kg,10
Tomatoes,Produce,kg,5
Olive Oil,Oils & Condiments,liters,3
Mozzarella Cheese,Dairy,kg,8
Paper Towels,Supplies,pack,20`

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="inventory-template.csv"',
      },
    })
  } catch (error) {
    console.error('[Inventory Template] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
