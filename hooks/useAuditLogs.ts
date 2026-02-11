'use client'

import { useQuery } from '@tanstack/react-query'

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
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
  'stock.reception': 'Recorded delivery',
  'stock.adjustment': 'Adjusted stock',
  'inventory.create': 'Added inventory item',
  'inventory.update': 'Updated inventory item',
  'inventory.delete': 'Deleted inventory item',
  'shift.create': 'Created shift',
  'shift.update': 'Updated shift',
  'shift.clock_in': 'Clocked in',
  'shift.clock_out': 'Clocked out',
  'settings.update': 'Updated settings',
  'report.export': 'Exported report',
  'supplier.create': 'Added supplier',
  'supplier.update': 'Updated supplier',
  'supplier.delete': 'Deleted supplier',
  'purchase_order.create': 'Created purchase order',
  'purchase_order.update': 'Updated purchase order',
  'purchase_order.submit': 'Submitted purchase order',
  'purchase_order.receive': 'Received purchase order',
  'waste.submit': 'Logged waste report',
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
}
