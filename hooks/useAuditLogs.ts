'use client'

import { useQuery } from '@tanstack/react-query'

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  action: string
  action_category: string
  store_id: string | null
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogFilters {
  storeId?: string | null
  category?: string | null
  userId?: string | null
  startDate?: string | null
  endDate?: string | null
  limit?: number
  offset?: number
}

interface AuditLogResponse {
  logs: AuditLog[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (filters.storeId) params.set('storeId', filters.storeId)
  if (filters.category) params.set('category', filters.category)
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.limit) params.set('limit', filters.limit.toString())
  if (filters.offset) params.set('offset', filters.offset.toString())

  const response = await fetch(`/api/audit-logs?${params}`)
  if (!response.ok) throw new Error('Failed to fetch audit logs')
  const json = await response.json()
  return json.data
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', filters],
    queryFn: () => fetchAuditLogs(filters),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Human-readable action labels
export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.password_reset': 'Reset password',
  'user.invite': 'Invited team member',
  'user.role_change': 'Changed user role',
  'user.deactivate': 'Deactivated user',
  'store.create': 'Created store',
  'store.update': 'Updated store',
  'store.delete': 'Deleted store',
  'stock.count': 'Submitted stock count',
  'stock.count_submit': 'Submitted stock count',
  'stock.reception': 'Recorded delivery',
  'stock.reception_submit': 'Recorded delivery',
  'stock.adjustment': 'Adjusted stock level',
  'stock.waste_report': 'Logged waste',
  'inventory.create': 'Added inventory item',
  'inventory.item_create': 'Added inventory item',
  'inventory.update': 'Updated inventory item',
  'inventory.item_update': 'Updated inventory item',
  'inventory.delete': 'Deleted inventory item',
  'inventory.item_delete': 'Deleted inventory item',
  'inventory.bulk_import': 'Imported inventory from CSV',
  'inventory.batch_update': 'Updated inventory items',
  'inventory.bulk_delete': 'Deleted inventory items',
  'shift.create': 'Created shift',
  'shift.update': 'Updated shift',
  'shift.delete': 'Deleted shift',
  'shift.clock_in': 'Clocked in',
  'shift.clock_out': 'Clocked out',
  'shift.clock_time_correction': 'Corrected clock times',
  'settings.update': 'Updated settings',
  'report.export': 'Exported report',
  'supplier.create': 'Added supplier',
  'supplier.update': 'Updated supplier',
  'supplier.delete': 'Deleted supplier',
  'purchase_order.create': 'Created purchase order',
  'purchase_order.update': 'Updated purchase order',
  'purchase_order.submit': 'Submitted purchase order',
  'purchase_order.receive': 'Received purchase order',
  'purchase_order.delete': 'Deleted purchase order',
  'waste.submit': 'Logged waste report',
  // Recipes & Menu
  'inventory.recipe_create': 'Created recipe',
  'inventory.recipe_update': 'Updated recipe',
  'inventory.recipe_delete': 'Deleted recipe',
  'inventory.recipe_ingredient_add': 'Added recipe ingredient',
  'inventory.recipe_ingredient_remove': 'Removed recipe ingredient',
  'inventory.menu_item_create': 'Created menu item',
  'inventory.menu_item_update': 'Updated menu item',
  'inventory.menu_item_delete': 'Deleted menu item',
  // User management
  'user.invite_cancel': 'Cancelled invitation',
  'user.invite_resend': 'Resent invitation',
  'user.remove_from_store': 'Removed user from store',
  // Store
  'store.deactivate': 'Deactivated store',
  // Supplier items & POs
  'supplier.item_add': 'Added supplier item',
  'supplier.item_update': 'Updated supplier item',
  'supplier.item_remove': 'Removed supplier item',
  'supplier.po_create': 'Created purchase order',
  'supplier.po_update': 'Updated purchase order',
  'supplier.po_receive': 'Received purchase order',
  'supplier.po_cancel': 'Cancelled purchase order',
  // Settings & POS
  'settings.alert_preferences_update': 'Updated alert preferences',
  'settings.pos_mapping_create': 'Created POS item mapping',
  'settings.pos_mapping_delete': 'Deleted POS item mapping',
  'settings.pos_connection_create': 'Created POS connection',
  'settings.pos_connection_update': 'Updated POS connection',
  'settings.pos_connection_delete': 'Deleted POS connection',
  // Payroll
  'payroll.rate_update': 'Updated hourly rate',
  'payroll.pay_run_create': 'Created pay run',
  'payroll.pay_run_approve': 'Approved pay run',
  'payroll.pay_run_paid': 'Marked pay run as paid',
  'payroll.pay_run_delete': 'Deleted pay run',
  'payroll.adjustment': 'Adjusted pay run item',
}

export const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Authentication',
  user: 'Team Management',
  store: 'Store Management',
  stock: 'Stock Operations',
  inventory: 'Inventory',
  shift: 'Shifts',
  settings: 'Settings',
  report: 'Reports',
  supplier: 'Suppliers',
  purchase_order: 'Purchase Orders',
  waste: 'Waste Tracking',
  payroll: 'Payroll',
}

export const CATEGORY_COLORS: Record<string, string> = {
  auth: 'bg-purple-100 text-purple-800',
  user: 'bg-blue-100 text-blue-800',
  store: 'bg-indigo-100 text-indigo-800',
  stock: 'bg-green-100 text-green-800',
  inventory: 'bg-emerald-100 text-emerald-800',
  shift: 'bg-orange-100 text-orange-800',
  settings: 'bg-gray-100 text-gray-800',
  report: 'bg-cyan-100 text-cyan-800',
  supplier: 'bg-yellow-100 text-yellow-800',
  purchase_order: 'bg-amber-100 text-amber-800',
  waste: 'bg-red-100 text-red-800',
  payroll: 'bg-teal-100 text-teal-800',
}
