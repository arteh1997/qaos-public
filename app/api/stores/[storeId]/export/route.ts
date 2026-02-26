import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth, canAccessStore } from '@/lib/api/middleware'
import { apiError, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { RATE_LIMITS } from '@/lib/rate-limit'
// SECURITY NOTE: xlsx@0.18.5 has known prototype pollution (GHSA-4r6h-8v6p-xvw6)
// and ReDoS (GHSA-5pgg-2g8v-p4x9) vulnerabilities with no upstream fix.
// Accepted risk: this endpoint is auth-gated (Owner only), rate-limited, and only
// processes trusted data from our own database — no user-supplied spreadsheet parsing.
import * as XLSX from 'xlsx'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/:storeId/export
 * Export store data as Excel file
 *
 * Query params:
 * - start_date: Optional start date (YYYY-MM-DD)
 * - end_date: Optional end date (YYYY-MM-DD)
 *
 * Available to store Owners even if subscription is expired
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { storeId } = await params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const auth = await withApiAuth(request, {
      allowedRoles: ['Owner'],
      rateLimit: { key: 'export', config: RATE_LIMITS.api },
    })

    if (!auth.success) return auth.response

    const { context } = auth

    // Check if user has access to this store (Owner role)
    if (!canAccessStore(context, storeId)) {
      return apiForbidden('You do not have access to this store', context.requestId)
    }

    // Get store info
    const { data: store } = await context.supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single()

    if (!store) {
      return apiBadRequest('Store not found', context.requestId)
    }

    // Build date filters
    const dateFilters = {
      start: startDate ? `${startDate}T00:00:00.000Z` : null,
      end: endDate ? `${endDate}T23:59:59.999Z` : null,
    }

    // Fetch all data in parallel
    const [shiftsResult, stockHistoryResult, inventoryResult, usersResult] = await Promise.all([
      fetchShifts(context.supabase, storeId, dateFilters),
      fetchStockHistory(context.supabase, storeId, dateFilters),
      fetchInventory(context.supabase, storeId),
      fetchUsers(context.supabase, storeId),
    ])

    // Create Excel workbook
    const workbook = XLSX.utils.book_new()

    // Add Shifts sheet
    if (shiftsResult.length > 0) {
      const shiftsData = shiftsResult.map(s => ({
        'Date': s.start_time ? new Date(s.start_time).toLocaleDateString('en-GB') : '',
        'Employee': s.user?.full_name || s.user?.email || 'Unknown',
        'Scheduled Start': s.start_time ? new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        'Scheduled End': s.end_time ? new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        'Clock In': s.clock_in_time ? new Date(s.clock_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        'Clock Out': s.clock_out_time ? new Date(s.clock_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        'Notes': s.notes || '',
      }))
      const shiftsSheet = XLSX.utils.json_to_sheet(shiftsData)
      XLSX.utils.book_append_sheet(workbook, shiftsSheet, 'Shifts')
    }

    // Add Stock History sheet
    if (stockHistoryResult.length > 0) {
      const stockData = stockHistoryResult.map(s => ({
        'Date': s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB') : '',
        'Time': s.created_at ? new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        'Item': s.inventory_item?.name || 'Unknown',
        'Action': s.action_type,
        'Quantity Before': s.quantity_before ?? '',
        'Quantity After': s.quantity_after ?? '',
        'Change': s.quantity_change ?? '',
        'Performed By': s.performer?.full_name || s.performer?.email || 'Unknown',
        'Notes': s.notes || '',
      }))
      const stockSheet = XLSX.utils.json_to_sheet(stockData)
      XLSX.utils.book_append_sheet(workbook, stockSheet, 'Stock History')
    }

    // Add Inventory sheet
    if (inventoryResult.length > 0) {
      const inventoryData = inventoryResult.map(i => ({
        'Item Name': i.inventory_item?.name || 'Unknown',
        'Category': i.inventory_item?.category || '',
        'Unit': i.inventory_item?.unit_of_measure || '',
        'Current Quantity': i.quantity,
        'Par Level': i.par_level ?? '',
        'Last Updated': i.last_updated_at ? new Date(i.last_updated_at).toLocaleDateString('en-GB') : '',
      }))
      const inventorySheet = XLSX.utils.json_to_sheet(inventoryData)
      XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventory')
    }

    // Add Users sheet
    if (usersResult.length > 0) {
      const usersData = usersResult.map(u => ({
        'Name': u.user?.full_name || '',
        'Email': u.user?.email || '',
        'Phone': u.user?.phone || '',
        'Role': u.role,
        'Status': u.user?.status || '',
        'Joined': u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '',
      }))
      const usersSheet = XLSX.utils.json_to_sheet(usersData)
      XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users')
    }

    // Add Summary sheet
    const summaryData = [
      { 'Field': 'Store Name', 'Value': store.name },
      { 'Field': 'Export Date', 'Value': new Date().toLocaleDateString('en-GB') },
      { 'Field': 'Date Range', 'Value': startDate && endDate ? `${startDate} to ${endDate}` : 'All Time' },
      { 'Field': 'Total Shifts', 'Value': shiftsResult.length },
      { 'Field': 'Total Stock Records', 'Value': stockHistoryResult.length },
      { 'Field': 'Total Inventory Items', 'Value': inventoryResult.length },
      { 'Field': 'Total Users', 'Value': usersResult.length },
    ]
    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Create filename
    const sanitizedStoreName = store.name.replace(/[^a-zA-Z0-9]/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `${sanitizedStoreName}_Export_${dateStr}.xlsx`

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Error exporting store data:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to export data')
  }
}

// Helper functions to fetch data
interface DateFilters {
  start: string | null
  end: string | null
}

// Type definitions for fetched data
interface ShiftRecord {
  start_time: string | null
  end_time: string | null
  clock_in_time: string | null
  clock_out_time: string | null
  notes: string | null
  user?: { full_name: string | null; email: string | null } | null
}

interface StockHistoryRecord {
  created_at: string | null
  action_type: string
  quantity_before: number | null
  quantity_after: number | null
  quantity_change: number | null
  notes: string | null
  inventory_item?: { name: string | null; category: string | null; unit_of_measure: string | null } | null
  performer?: { full_name: string | null; email: string | null } | null
}

interface InventoryRecord {
  quantity: number
  par_level: number | null
  last_updated_at: string | null
  inventory_item?: { name: string | null; category: string | null; unit_of_measure: string | null; is_active: boolean } | null
}

interface StoreUserRecord {
  role: string
  created_at: string | null
  user?: { full_name: string | null; email: string | null; phone: string | null; status: string | null } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchShifts(supabase: any, storeId: string, filters: DateFilters): Promise<ShiftRecord[]> {
  let query = supabase
    .from('shifts')
    .select(`
      *,
      user:profiles(full_name, email)
    `)
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })

  if (filters.start) {
    query = query.gte('start_time', filters.start)
  }
  if (filters.end) {
    query = query.lte('start_time', filters.end)
  }

  const { data } = await query
  return (data || []) as ShiftRecord[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStockHistory(supabase: any, storeId: string, filters: DateFilters): Promise<StockHistoryRecord[]> {
  let query = supabase
    .from('stock_history')
    .select(`
      *,
      inventory_item:inventory_items(name, category, unit_of_measure),
      performer:profiles(full_name, email)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (filters.start) {
    query = query.gte('created_at', filters.start)
  }
  if (filters.end) {
    query = query.lte('created_at', filters.end)
  }

  const { data } = await query
  return (data || []) as StockHistoryRecord[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInventory(supabase: any, storeId: string): Promise<InventoryRecord[]> {
  const { data } = await supabase
    .from('store_inventory')
    .select(`
      *,
      inventory_item:inventory_items(name, category, unit_of_measure, is_active)
    `)
    .eq('store_id', storeId)
    .order('inventory_item(name)', { ascending: true })

  return (data || []) as InventoryRecord[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchUsers(supabase: any, storeId: string): Promise<StoreUserRecord[]> {
  const { data } = await supabase
    .from('store_users')
    .select(`
      *,
      user:profiles(full_name, email, phone, status)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: true })

  return (data || []) as StoreUserRecord[]
}
