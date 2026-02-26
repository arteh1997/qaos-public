'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAuditLogs,
  ACTION_LABELS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  AuditLogFilters,
  AuditLog,
} from '@/hooks/useAuditLogs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Printer,
  Shield,
  Users,
  Store,
  Package,
  Box,
  Clock,
  Settings,
  FileText,
  Truck,
  ShoppingCart,
  Trash2,
  CalendarDays,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { DateRange } from 'react-day-picker'
import {
  format,
  subDays,
  isToday,
  isYesterday,
  formatDistanceToNow,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { PageGuide } from '@/components/help/PageGuide'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Grouped categories — each maps to one or more backend action_category values
const CATEGORY_GROUPS: { value: string; label: string; categories: string[] }[] = [
  { value: 'inventory', label: 'Inventory & Stock', categories: ['stock', 'inventory'] },
  { value: 'team', label: 'Team & Shifts', categories: ['user', 'shift'] },
  { value: 'suppliers', label: 'Suppliers & Orders', categories: ['supplier', 'purchase_order'] },
  { value: 'waste', label: 'Waste', categories: ['waste'] },
  { value: 'payroll', label: 'Payroll', categories: ['payroll'] },
  { value: 'system', label: 'System', categories: ['auth', 'store', 'settings', 'report'] },
]

const PAGE_SIZE = 25

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  auth: Shield,
  user: Users,
  store: Store,
  stock: Package,
  inventory: Box,
  shift: Clock,
  settings: Settings,
  report: FileText,
  supplier: Truck,
  purchase_order: ShoppingCart,
  waste: Trash2,
}

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  auth: 'border-l-purple-400',
  user: 'border-l-blue-400',
  store: 'border-l-indigo-400',
  stock: 'border-l-green-400',
  inventory: 'border-l-emerald-400',
  shift: 'border-l-orange-400',
  settings: 'border-l-gray-400',
  report: 'border-l-cyan-400',
  supplier: 'border-l-yellow-500',
  purchase_order: 'border-l-amber-500',
  waste: 'border-l-red-400',
}

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-pink-600',
  'bg-orange-600',
  'bg-lime-600',
  'bg-fuchsia-600',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getAvatarColor(identifier: string): string {
  return AVATAR_COLORS[hashString(identifier) % AVATAR_COLORS.length]
}

function getInitial(displayName: string): string {
  return displayName.charAt(0).toUpperCase()
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)

  if (isToday(date)) {
    const distance = formatDistanceToNow(date, { addSuffix: false })
    // Convert "less than a minute" to "Just now", "X minutes" to "Xm ago", etc.
    if (distance.includes('less than')) return 'Just now'
    const shortened = distance
      .replace(/ minutes?/, 'm')
      .replace(/ hours?/, 'h')
      .replace(/ seconds?/, 's')
      .replace('about ', '')
    return `${shortened} ago`
  }

  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`
  }

  return format(date, 'MMM d') + ' at ' + format(date, 'h:mm a')
}

function getDisplayName(log: AuditLog): string {
  if (log.user_name) return log.user_name
  if (log.user_email) return log.user_email
  return 'System'
}

// ---------------------------------------------------------------------------
// Field name humanizer — maps raw database column names to clean labels
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  // Store fields
  name: 'Name',
  address: 'Address',
  is_active: 'Active Status',
  opening_time: 'Opening Time',
  closing_time: 'Closing Time',
  weekly_hours: 'Weekly Hours',
  billing_user_id: 'Billing Owner',

  // Inventory / general
  category: 'Category',
  unit_of_measure: 'Unit of Measure',
  quantity: 'Quantity',
  par_level: 'PAR Level',
  cost_per_unit: 'Cost Per Unit',
  unit_cost: 'Unit Cost',
  selling_price: 'Selling Price',
  currency: 'Currency',

  // Supplier fields
  email: 'Email',
  phone: 'Phone',
  contact_person: 'Contact Person',
  payment_terms: 'Payment Terms',
  notes: 'Notes',
  supplier_sku: 'Supplier SKU',
  lead_time_days: 'Lead Time (Days)',
  min_order_quantity: 'Min Order Quantity',
  is_preferred: 'Preferred Supplier',

  // Recipe fields
  description: 'Description',
  yield_quantity: 'Yield Quantity',
  yield_unit: 'Yield Unit',
  prep_time_minutes: 'Prep Time (Minutes)',

  // Menu item fields
  recipe_id: 'Linked Recipe',

  // Purchase order fields
  status: 'Status',
  expected_delivery_date: 'Expected Delivery',

  // Alert preference fields
  low_stock_enabled: 'Low Stock Alerts',
  critical_stock_enabled: 'Critical Stock Alerts',
  missing_count_enabled: 'Missing Count Alerts',
  low_stock_threshold: 'Low Stock Threshold',
  alert_frequency: 'Alert Frequency',
  email_enabled: 'Email Notifications',
  preferred_hour: 'Preferred Alert Hour',

  // HACCP fields
  frequency: 'Frequency',
  items: 'Check Items',

  // POS fields
  provider: 'Provider',
  quantity_per_sale: 'Qty Per Sale',
}

function humanizeFieldName(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  // Fallback: replace underscores with spaces and title-case each word
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function humanizeFieldList(fields: string[]): string {
  return fields.map(humanizeFieldName).join(', ')
}

// ---------------------------------------------------------------------------
// Detail formatting
// ---------------------------------------------------------------------------

interface DetailPair {
  label: string
  value: string
}

function extractDetailPairs(details: Record<string, unknown>): DetailPair[] {
  const pairs: DetailPair[] = []

  if (details.email) pairs.push({ label: 'Email', value: String(details.email) })
  if (details.role) pairs.push({ label: 'Role', value: String(details.role) })
  if (details.previousRole && details.newRole) {
    pairs.push({ label: 'Role Change', value: `${details.previousRole} \u2192 ${details.newRole}` })
  }
  if (details.itemName) pairs.push({ label: 'Item', value: String(details.itemName) })
  if (details.item_name) pairs.push({ label: 'Item', value: String(details.item_name) })
  if (details.supplierName) pairs.push({ label: 'Supplier', value: String(details.supplierName) })
  if (details.recipeName) pairs.push({ label: 'Recipe', value: String(details.recipeName) })
  if (details.menuItemName) pairs.push({ label: 'Menu Item', value: String(details.menuItemName) })
  if (details.ingredientName) pairs.push({ label: 'Ingredient', value: String(details.ingredientName) })
  if (details.poNumber) pairs.push({ label: 'PO Number', value: String(details.poNumber) })
  if (details.categoryName) pairs.push({ label: 'Category', value: String(details.categoryName) })
  if (details.tagName) pairs.push({ label: 'Tag', value: String(details.tagName) })
  if (details.previousQuantity !== undefined && details.quantity !== undefined) {
    pairs.push({ label: 'Quantity', value: `${details.previousQuantity} \u2192 ${details.quantity}` })
  } else if (details.quantity !== undefined) {
    pairs.push({ label: 'Quantity', value: String(details.quantity) })
  }
  if (details.unitCost !== undefined) {
    pairs.push({ label: 'Unit Cost', value: `\u00A3${Number(details.unitCost).toFixed(2)}` })
  }
  if (details.sellingPrice !== undefined) {
    pairs.push({ label: 'Selling Price', value: `\u00A3${Number(details.sellingPrice).toFixed(2)}` })
  }
  if (details.parLevel !== undefined) {
    pairs.push({ label: 'PAR Level', value: details.parLevel === null ? 'Cleared' : String(details.parLevel) })
  }
  if (details.itemCount) pairs.push({ label: 'Items', value: `${details.itemCount} items` })
  if (details.itemsImported) pairs.push({ label: 'Imported', value: `${details.itemsImported} items` })
  if (details.itemsUpdated) pairs.push({ label: 'Updated', value: `${details.itemsUpdated} items` })
  if (details.itemsReceived) pairs.push({ label: 'Received', value: `${details.itemsReceived} items` })
  if (details.hoursWorked) pairs.push({ label: 'Hours Worked', value: `${details.hoursWorked}h` })
  if (details.reason) pairs.push({ label: 'Reason', value: String(details.reason) })
  if (details.storeName) pairs.push({ label: 'Store', value: String(details.storeName) })
  if (details.store_name) pairs.push({ label: 'Store', value: String(details.store_name) })
  if (details.provider) pairs.push({ label: 'Provider', value: String(details.provider) })

  // If no known keys matched, show generic key-value pairs
  if (pairs.length === 0) {
    const entries = Object.entries(details).filter(
      ([key]) => key !== 'changes' && key !== 'summary'
    )
    for (const [key, value] of entries.slice(0, 6)) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        pairs.push({
          label: humanizeFieldName(key),
          value: String(value),
        })
      }
    }
  }

  return pairs
}

function formatItemNames(items: Array<{ name?: string }> | undefined): string {
  if (!items || items.length === 0) return ''
  const names = items.map(i => i.name).filter(Boolean) as string[]
  if (names.length === 0) return ''
  if (names.length <= 2) return names.join(', ')
  return `${names[0]}, ${names[1]} +${names.length - 2} more`
}

function formatCompactDetails(action: string, details: Record<string, unknown>): string {
  const items = details.items as Array<{ name?: string }> | undefined

  switch (action) {
    case 'stock.reception_submit':
    case 'stock.reception': {
      const names = formatItemNames(items)
      if (names) return names
      if (details.itemCount) return `${details.itemCount} items received`
      return ''
    }
    case 'stock.count_submit':
    case 'stock.count': {
      const names = formatItemNames(items)
      if (names) return names
      if (details.itemsUpdated) return `${details.itemsUpdated} items counted`
      return ''
    }
    case 'waste.submit':
    case 'stock.waste_report': {
      const names = formatItemNames(items)
      if (names) return names
      if (details.itemCount) return `${details.itemCount} items`
      return ''
    }
    case 'inventory.batch_update':
      if (details.summary && typeof details.summary === 'string') return String(details.summary)
      if (details.itemCount) return `${details.itemCount} items`
      return ''
    case 'shift.clock_in': {
      const mins = details.minutesFromScheduledStart as number | undefined
      if (mins !== undefined) {
        if (mins < -1) return `${Math.abs(Math.round(mins))} min early`
        if (mins > 1) return `${Math.round(mins)} min late`
        return 'On time'
      }
      return ''
    }
    case 'shift.clock_out':
      if (details.hoursWorked) return `${Number(details.hoursWorked).toFixed(1)}h worked`
      return ''
    case 'shift.create':
    case 'shift.update':
    case 'shift.delete':
    case 'shift.clock_time_correction':
      if (details.employeeName) return String(details.employeeName)
      return ''
    default: {
      // Fallback: show entity names from known fields
      const entityKeys = [
        'itemName', 'item_name', 'supplierName', 'recipeName', 'menuItemName',
        'ingredientName', 'poNumber', 'categoryName', 'tagName', 'storeName',
        'store_name', 'email', 'invitedEmail', 'provider', 'key_name', 'posItemName',
      ]
      const values: string[] = []
      for (const key of entityKeys) {
        if (details[key]) values.push(String(details[key]))
        if (values.length >= 2) break
      }
      if (values.length > 0) return values.join(' \u00B7 ')
      if (details.itemCount) return `${details.itemCount} items`
      if (details.summary && typeof details.summary === 'string') return String(details.summary)
      return ''
    }
  }
}

// ---------------------------------------------------------------------------
// Batch update change type
// ---------------------------------------------------------------------------

interface BatchChange {
  item: string
  change: string
}

function extractBatchChanges(details: Record<string, unknown>): BatchChange[] {
  const changes = details.changes as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(changes)) return []

  return changes.map(change => {
    const item = String(change.item_name || change.itemName || change.name || 'Unknown Item')
    const parts: string[] = []

    if (change.field && change.from !== undefined && change.to !== undefined) {
      parts.push(`${humanizeFieldName(String(change.field))}: ${change.from} \u2192 ${change.to}`)
    }
    if (change.stock_from !== undefined && change.stock_to !== undefined) {
      parts.push(`Stock: ${change.stock_from} \u2192 ${change.stock_to}`)
    }
    if (change.cost_from !== undefined && change.cost_to !== undefined) {
      parts.push(`Cost: \u00A3${Number(change.cost_from).toFixed(2)} \u2192 \u00A3${Number(change.cost_to).toFixed(2)}`)
    }
    if (change.par_from !== undefined && change.par_to !== undefined) {
      parts.push(`PAR: ${change.par_from ?? 'none'} \u2192 ${change.par_to ?? 'none'}`)
    }
    // Generic field changes
    if (parts.length === 0 && typeof change === 'object') {
      const entries = Object.entries(change).filter(
        ([k]) => !['item_name', 'itemName', 'name', 'id', 'item_id'].includes(k)
      )
      for (const [key, value] of entries.slice(0, 2)) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          parts.push(`${humanizeFieldName(key)}: ${value}`)
        }
      }
    }

    return { item, change: parts.join(', ') || 'Updated' }
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Avatar({ name, identifier }: { name: string; identifier: string }) {
  const color = getAvatarColor(identifier)
  return (
    <div
      className={`${color} h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm`}
    >
      {getInitial(name)}
    </div>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] || Activity
  const colorClass = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-800'
  return (
    <div className={`${colorClass} rounded-lg p-1.5 shrink-0`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}

function StatsBar({ logs, totalCount }: { logs: AuditLog[]; totalCount: number }) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const todayCount = logs.filter(l => new Date(l.created_at) >= todayStart).length
  const weekCount = logs.filter(l => new Date(l.created_at) >= weekStart).length

  return (
    <div className="flex items-center gap-6 px-1 text-sm">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-muted-foreground">Today:</span>
        <span className="font-semibold tabular-nums">{todayCount}</span>
        <span className="text-muted-foreground">events</span>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">This week:</span>
        <span className="font-semibold tabular-nums">{weekCount}</span>
        <span className="text-muted-foreground">events</span>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold tabular-nums">{totalCount.toLocaleString()}</span>
      </div>
    </div>
  )
}

function BatchUpdateTable({ changes }: { changes: BatchChange[] }) {
  if (changes.length === 0) return null
  return (
    <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Item
            </th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr
              key={i}
              className={i < changes.length - 1 ? 'border-b border-border/40' : ''}
            >
              <td className="py-2 px-3 font-medium">{c.item}</td>
              <td className="py-2 px-3 text-muted-foreground">{c.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared detail sub-components
// ---------------------------------------------------------------------------

/** Type guard: true if value is a non-empty string, non-zero number, or truthy value */
function has(v: unknown): v is string | number | boolean | object {
  return v !== null && v !== undefined && v !== '' && v !== 0 && v !== false
}

function DetailTable({ headers, rows, rightAlignLast }: {
  headers: string[]
  rows: Array<Array<string | React.ReactNode>>
  rightAlignLast?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            {headers.map((h, i) => (
              <th key={i} className={`py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider ${i === 0 ? 'text-left' : rightAlignLast && i === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? 'border-b border-border/40' : ''}>
              {row.map((cell, j) => (
                <td key={j} className={`py-2 px-3 ${j === 0 ? 'font-medium' : rightAlignLast && j === row.length - 1 ? 'text-right tabular-nums' : ''} ${j > 0 ? 'text-muted-foreground' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field changes display — premium before/after rendering
// ---------------------------------------------------------------------------

interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  // Format time fields (HH:MM:SS or HH:MM)
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [h, m] = value.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  // Format currency-like fields
  if ((field.includes('cost') || field.includes('price')) && typeof value === 'number') {
    return `£${value.toFixed(2)}`
  }
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function FieldChangesDisplay({ changes }: { changes: FieldChange[] }) {
  // Filter out entries where the displayed before/after values are identical
  const meaningful = changes?.filter(c =>
    formatFieldValue(c.field, c.from) !== formatFieldValue(c.field, c.to)
  )
  if (!meaningful || meaningful.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Field
            </th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Before
            </th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {meaningful.map((c, i) => (
            <tr
              key={i}
              className={i < meaningful.length - 1 ? 'border-b border-border/40' : ''}
            >
              <td className="py-2 px-3 font-medium whitespace-nowrap">
                {humanizeFieldName(c.field)}
              </td>
              <td className="py-2 px-3 text-muted-foreground">
                {formatFieldValue(c.field, c.from)}
              </td>
              <td className="py-2 px-3 font-medium">
                {formatFieldValue(c.field, c.to)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
      {children}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  )
}

function NotesDisplay({ notes }: { notes?: unknown }) {
  if (!notes || typeof notes !== 'string') return null
  return (
    <div className="mt-3 text-sm">
      <span className="text-muted-foreground">Notes: </span>
      <span className="italic text-muted-foreground">{notes}</span>
    </div>
  )
}

function DetailFooter({ log }: { log: AuditLog }) {
  return (
    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
      <span>{ACTION_LABELS[log.action] || log.action}</span>
      <span className="ml-auto">{format(new Date(log.created_at), 'PPpp')}</span>
    </div>
  )
}

function fmtTime(iso: string): string {
  try { return format(new Date(iso), 'h:mm a') } catch { return iso }
}

function fmtDateTime(iso: string): string {
  try { return format(new Date(iso), 'EEE, MMM d, h:mm a') } catch { return iso }
}

// ---------------------------------------------------------------------------
// Action-specific renderers
// ---------------------------------------------------------------------------

function renderStockReception(d: Record<string, unknown>, log: AuditLog) {
  const items = d.items as Array<{ name: string; quantity: number; unit: string; totalCost: number | null }> | undefined
  const totalCost = d.totalCost as number | undefined
  const hasCosts = items?.some(i => i.totalCost !== null && i.totalCost !== undefined)

  const parts = [`Received ${d.itemCount || items?.length || '?'} items`]
  if (d.totalQuantity) parts[0] += ` totalling ${d.totalQuantity} units`
  if (totalCost && totalCost > 0) parts.push(`\u00A3${totalCost.toFixed(2)} total cost`)

  return (
    <>
      <p className="text-sm font-medium">{parts.join(' \u2014 ')}</p>
      {has(d.supplierName) && (
        <div className="mt-2">
          <DetailField label="Supplier" value={String(d.supplierName)} />
        </div>
      )}
      {items && items.length > 0 && (
        <DetailTable
          headers={['Item', 'Received', ...(hasCosts ? ['Cost'] : [])]}
          rows={items.map(item => [
            item.name,
            `+${item.quantity} ${item.unit}`,
            ...(hasCosts ? [item.totalCost ? `\u00A3${Number(item.totalCost).toFixed(2)}` : '\u2014'] : []),
          ])}
          rightAlignLast={hasCosts}
        />
      )}
      <NotesDisplay notes={d.notes} />
      <DetailFooter log={log} />
    </>
  )
}

function renderStockCount(d: Record<string, unknown>, log: AuditLog) {
  const items = d.items as Array<{ name: string; previousQuantity: number; newQuantity: number; difference: number }> | undefined
  const changed = items?.filter(i => i.difference !== 0) || []
  const unchanged = items ? items.length - changed.length : 0

  return (
    <>
      <p className="text-sm font-medium">
        {`Counted ${String(d.itemsUpdated || items?.length || '?')} items${has(d.date) ? ` on ${String(d.date)}` : ''}${changed.length > 0 && unchanged > 0 ? ` \u2014 ${changed.length} changed, ${unchanged} confirmed` : ''}`}
      </p>
      {items && items.length > 0 && (
        <DetailTable
          headers={['Item', 'Was', 'Now', 'Change']}
          rows={items.map(item => {
            const diff = item.difference
            const diffStr = diff > 0 ? `+${diff}` : diff === 0 ? '\u2014' : String(diff)
            return [item.name, String(item.previousQuantity), String(item.newQuantity), diffStr]
          })}
        />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderWaste(d: Record<string, unknown>, log: AuditLog) {
  const items = d.items as Array<{ name: string; quantity: number; unit: string; reason: string }> | undefined
  const REASONS: Record<string, string> = {
    expired: 'Expired', spoiled: 'Spoiled', damaged: 'Damaged',
    overproduction: 'Overproduction', preparation: 'Prep waste', other: 'Other',
  }

  return (
    <>
      <p className="text-sm font-medium">
        {`Reported waste for ${String(d.itemCount || items?.length || '?')} items${has(d.totalWasted) ? ` \u2014 ${d.totalWasted} units total` : ''}`}
      </p>
      {items && items.length > 0 && (
        <DetailTable
          headers={['Item', 'Wasted', 'Reason']}
          rows={items.map(item => [
            item.name,
            `${item.quantity} ${item.unit}`,
            REASONS[item.reason] || item.reason,
          ])}
        />
      )}
      <NotesDisplay notes={d.notes} />
      <DetailFooter log={log} />
    </>
  )
}

function renderBatchUpdate(d: Record<string, unknown>, log: AuditLog) {
  const batchChanges = extractBatchChanges(d)
  return (
    <>
      {typeof d.summary === 'string' && <p className="text-sm font-medium">{d.summary}</p>}
      {batchChanges.length > 0 && <BatchUpdateTable changes={batchChanges} />}
      <DetailFooter log={log} />
    </>
  )
}

function renderShiftClockIn(d: Record<string, unknown>, log: AuditLog) {
  const mins = d.minutesFromScheduledStart as number | undefined
  let timingText = ''
  let timingClass = 'text-emerald-600'
  if (mins !== undefined) {
    if (mins < -1) { timingText = `${Math.abs(Math.round(mins))} min early`; timingClass = 'text-emerald-600' }
    else if (mins > 1) { timingText = `${Math.round(mins)} min late`; timingClass = 'text-amber-600' }
    else { timingText = 'On time'; timingClass = 'text-emerald-600' }
  }

  return (
    <>
      <DetailGrid>
        {has(d.scheduledStart) && has(d.scheduledEnd) && (
          <DetailField label="Shift" value={`${fmtTime(String(d.scheduledStart))} \u2014 ${fmtTime(String(d.scheduledEnd))}`} />
        )}
        {has(d.clockInTime) && (
          <DetailField label="Clocked In" value={
            <span>
              {fmtTime(String(d.clockInTime))}
              {timingText && <span className={`ml-2 text-xs font-medium ${timingClass}`}>({timingText})</span>}
            </span>
          } />
        )}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderShiftClockOut(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.scheduledStart) && has(d.scheduledEnd) && (
          <DetailField label="Shift" value={`${fmtTime(String(d.scheduledStart))} \u2014 ${fmtTime(String(d.scheduledEnd))}`} />
        )}
        {has(d.hoursWorked) && (
          <DetailField label="Worked" value={`${Number(d.hoursWorked).toFixed(1)}h`} />
        )}
        {has(d.clockInTime) && <DetailField label="Clocked In" value={fmtTime(String(d.clockInTime))} />}
        {has(d.clockOutTime) && <DetailField label="Clocked Out" value={fmtTime(String(d.clockOutTime))} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderShiftCreate(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.employeeName) && (
          <DetailField label="Employee" value={
            <span>
              {String(d.employeeName)}
              {has(d.employeeEmail) && <span className="text-muted-foreground font-normal ml-1">({String(d.employeeEmail)})</span>}
            </span>
          } />
        )}
        {has(d.startTime) && has(d.endTime) && (
          <DetailField label="Scheduled" value={`${fmtDateTime(String(d.startTime))} \u2014 ${fmtTime(String(d.endTime))}`} />
        )}
        {has(d.notes) && <DetailField label="Notes" value={String(d.notes)} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderShiftUpdate(d: Record<string, unknown>, log: AuditLog) {
  const prev = d.previousSchedule as { startTime?: string; endTime?: string } | undefined
  const next = d.newSchedule as { startTime?: string; endTime?: string } | undefined

  return (
    <>
      <DetailGrid>
        {has(d.employeeName) && <DetailField label="Employee" value={String(d.employeeName)} />}
        {prev?.startTime && prev?.endTime && (
          <DetailField label="Previous" value={`${fmtDateTime(String(prev.startTime))} \u2014 ${fmtTime(String(prev.endTime))}`} />
        )}
        {next?.startTime && next?.endTime && (
          <DetailField label="Updated to" value={`${fmtDateTime(String(next.startTime))} \u2014 ${fmtTime(String(next.endTime))}`} />
        )}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderShiftDelete(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.employeeName) && (
          <DetailField label="Employee" value={
            <span>
              {String(d.employeeName)}
              {has(d.employeeEmail) && <span className="text-muted-foreground font-normal ml-1">({String(d.employeeEmail)})</span>}
            </span>
          } />
        )}
        {has(d.startTime) && (
          <DetailField label="Was" value={`${fmtDateTime(String(d.startTime))}${has(d.endTime) ? ` \u2014 ${fmtTime(String(d.endTime))}` : ''}`} />
        )}
        {has(d.hoursWorked) && <DetailField label="Hours" value={`${Number(d.hoursWorked).toFixed(1)}h worked`} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderClockTimeCorrection(d: Record<string, unknown>, log: AuditLog) {
  const prev = d.previousClockTimes as { clockIn?: string; clockOut?: string } | undefined
  const next = d.newClockTimes as { clockIn?: string; clockOut?: string } | undefined
  const sched = d.scheduledTime as { start?: string; end?: string } | undefined

  return (
    <>
      <DetailGrid>
        {has(d.employeeName) && <DetailField label="Employee" value={String(d.employeeName)} />}
        {sched?.start && sched?.end && (
          <DetailField label="Shift" value={`${fmtTime(String(sched.start))} \u2014 ${fmtTime(String(sched.end))}`} />
        )}
      </DetailGrid>
      {(prev || next) && (
        <DetailTable
          headers={['', 'Before', 'After']}
          rows={[
            ...(prev?.clockIn || next?.clockIn ? [['Clock In', prev?.clockIn ? fmtTime(prev.clockIn) : '\u2014', next?.clockIn ? fmtTime(next.clockIn) : '\u2014']] : []),
            ...(prev?.clockOut || next?.clockOut ? [['Clock Out', prev?.clockOut ? fmtTime(prev.clockOut) : '\u2014', next?.clockOut ? fmtTime(next.clockOut) : '\u2014']] : []),
          ]}
        />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderInventoryCreate(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.itemName) && <DetailField label="Item" value={String(d.itemName)} />}
        {has(d.category) && <DetailField label="Category" value={String(d.category)} />}
        {has(d.unit) && <DetailField label="Unit" value={String(d.unit)} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderInventoryItemUpdate(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  const pairs: DetailPair[] = []
  if (d.itemName || d.item_name) pairs.push({ label: 'Item', value: String(d.itemName || d.item_name) })
  if (d.previousQuantity !== undefined && d.quantity !== undefined) {
    pairs.push({ label: 'Quantity', value: `${d.previousQuantity} \u2192 ${d.quantity}` })
  }
  if (!fieldChanges?.length) {
    if (d.unitCost !== undefined) pairs.push({ label: 'Unit Cost', value: `\u00A3${Number(d.unitCost).toFixed(2)}` })
    if (d.parLevel !== undefined) pairs.push({ label: 'PAR Level', value: d.parLevel === null ? 'Cleared' : String(d.parLevel) })
    if (d.changes && typeof d.changes === 'object' && !Array.isArray(d.changes)) {
      const fields = Object.keys(d.changes as object).filter(k => k !== 'updated_at')
      if (fields.length > 0) pairs.push({ label: 'Changed', value: humanizeFieldList(fields) })
    }
  }

  return (
    <>
      <DetailGrid>
        {pairs.map((p, i) => <DetailField key={i} label={p.label} value={p.value} />)}
      </DetailGrid>
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderInventoryDelete(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.itemName) && <DetailField label="Item" value={String(d.itemName)} />}
        {has(d.category) && <DetailField label="Category" value={String(d.category)} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderBulkDelete(d: Record<string, unknown>, log: AuditLog) {
  const items = d.items as Array<{ name: string; category?: string }> | undefined
  return (
    <>
      {typeof d.summary === 'string' && <p className="text-sm font-medium">{d.summary}</p>}
      {items && items.length > 0 && (
        <div className="mt-2 space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">&bull;</span>
              <span>{item.name}</span>
              {item.category && (
                <span className="text-xs text-muted-foreground">({item.category})</span>
              )}
            </div>
          ))}
        </div>
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderBulkImport(d: Record<string, unknown>, log: AuditLog) {
  const categories = d.categories as string[] | undefined
  return (
    <>
      <DetailGrid>
        {has(d.itemsImported) && <DetailField label="Imported" value={`${d.itemsImported} items`} />}
        {categories && categories.length > 0 && <DetailField label="Categories" value={categories.join(', ')} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderRecipe(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  return (
    <>
      <DetailGrid>
        {has(d.recipeName) && <DetailField label="Recipe" value={String(d.recipeName)} />}
        {!fieldChanges?.length && has(d.updatedFields) && Array.isArray(d.updatedFields) && (
          <DetailField label="Changed" value={humanizeFieldList(d.updatedFields as string[])} />
        )}
      </DetailGrid>
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderRecipeIngredient(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.ingredientName) && <DetailField label="Ingredient" value={String(d.ingredientName)} />}
        {has(d.quantity) && (
          <DetailField label="Quantity" value={`${d.quantity}${has(d.unitOfMeasure) ? ` ${d.unitOfMeasure}` : ''}`} />
        )}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderMenuItem(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  return (
    <>
      <DetailGrid>
        {has(d.menuItemName) && <DetailField label="Menu Item" value={String(d.menuItemName)} />}
        {has(d.sellingPrice) && !fieldChanges?.length && <DetailField label="Price" value={`\u00A3${Number(d.sellingPrice).toFixed(2)}`} />}
        {!fieldChanges?.length && has(d.updatedFields) && Array.isArray(d.updatedFields) && (
          <DetailField label="Changed" value={humanizeFieldList(d.updatedFields as string[])} />
        )}
      </DetailGrid>
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderUserInvite(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        <DetailField label="Email" value={String(d.email || d.invitedEmail || '')} />
        {has(d.role) && <DetailField label="Role" value={String(d.role)} />}
        {has(d.storeName) && <DetailField label="Store" value={String(d.storeName)} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderUserRemove(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.removedUserName) ? (
          <DetailField label="User" value={
            <span>
              {String(d.removedUserName)}
              {has(d.removedUserEmail) && <span className="text-muted-foreground font-normal ml-1">({String(d.removedUserEmail)})</span>}
            </span>
          } />
        ) : d.removedUserEmail ? (
          <DetailField label="Email" value={String(d.removedUserEmail)} />
        ) : null}
        {has(d.role) && <DetailField label="Role" value={String(d.role)} />}
        {has(d.activeShiftsEnded) && Number(d.activeShiftsEnded) > 0 && (
          <DetailField label="Shifts Ended" value={`${d.activeShiftsEnded} active shift${Number(d.activeShiftsEnded) !== 1 ? 's' : ''}`} />
        )}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderSupplier(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  return (
    <>
      <DetailGrid>
        {has(d.supplierName) && <DetailField label="Supplier" value={String(d.supplierName)} />}
        {!fieldChanges?.length && has(d.updatedFields) && Array.isArray(d.updatedFields) && (
          <DetailField label="Changed" value={humanizeFieldList(d.updatedFields as string[])} />
        )}
      </DetailGrid>
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderSupplierItem(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.itemName) && <DetailField label="Item" value={String(d.itemName)} />}
        {has(d.unitCost) && (
          <DetailField label="Cost" value={`\u00A3${Number(d.unitCost).toFixed(2)}${has(d.currency) ? ` (${d.currency})` : ''}`} />
        )}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderPurchaseOrder(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      <DetailGrid>
        {has(d.poNumber) && <DetailField label="PO Number" value={String(d.poNumber)} />}
        {has(d.supplierName) && <DetailField label="Supplier" value={String(d.supplierName)} />}
        {has(d.itemCount) && <DetailField label="Items" value={`${d.itemCount} items`} />}
        {has(d.itemsReceived) && <DetailField label="Received" value={`${d.itemsReceived} items`} />}
        {(has(d.newStatus) || has(d.status)) && <DetailField label="Status" value={String(d.newStatus || d.status)} />}
      </DetailGrid>
      <DetailFooter log={log} />
    </>
  )
}

function renderStore(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  return (
    <>
      <DetailGrid>
        {has(d.storeName) && <DetailField label="Store" value={String(d.storeName)} />}
        {/* Show humanized field list only when no detailed changes available */}
        {!fieldChanges?.length && has(d.updatedFields) && Array.isArray(d.updatedFields) && (
          <DetailField label="Changed" value={humanizeFieldList(d.updatedFields as string[])} />
        )}
        {has(d.cancelledInvites) && Number(d.cancelledInvites) > 0 && (
          <DetailField label="Cancelled" value={`${d.cancelledInvites} pending invitations`} />
        )}
      </DetailGrid>
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderSettings(d: Record<string, unknown>, log: AuditLog) {
  const subAction = d.action as string | undefined
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  const pairs: DetailPair[] = []

  if (subAction === 'api_key_created') {
    if (d.key_name) pairs.push({ label: 'Key Name', value: String(d.key_name) })
    if (d.scopes && Array.isArray(d.scopes)) pairs.push({ label: 'Scopes', value: (d.scopes as string[]).join(', ') })
  } else if (subAction === 'api_key_revoked') {
    pairs.push({ label: 'Action', value: 'API key revoked' })
  } else if (subAction === 'webhook_created') {
    if (d.url) pairs.push({ label: 'URL', value: String(d.url) })
    if (d.events && Array.isArray(d.events)) pairs.push({ label: 'Events', value: (d.events as string[]).join(', ') })
  } else if (subAction === 'webhook_deleted') {
    pairs.push({ label: 'Action', value: 'Webhook deleted' })
  } else if (subAction === 'pos_connection_created') {
    if (d.name) pairs.push({ label: 'Name', value: String(d.name) })
    if (d.provider) pairs.push({ label: 'Provider', value: String(d.provider) })
  } else if (subAction === 'pos_connection_deleted') {
    pairs.push({ label: 'Action', value: 'POS connection deleted' })
  } else {
    if (!fieldChanges?.length && d.updatedFields && Array.isArray(d.updatedFields)) {
      pairs.push({ label: 'Updated', value: humanizeFieldList(d.updatedFields as string[]) })
    }
    if (d.posItemName) pairs.push({ label: 'POS Item', value: String(d.posItemName) })
    if (d.quantityPerSale) pairs.push({ label: 'Qty Per Sale', value: String(d.quantityPerSale) })
  }

  return (
    <>
      {pairs.length > 0 && (
        <DetailGrid>
          {pairs.map((p, i) => <DetailField key={i} label={p.label} value={p.value} />)}
        </DetailGrid>
      )}
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderAuth(d: Record<string, unknown>, log: AuditLog) {
  return (
    <>
      {has(d.method) && (
        <DetailGrid>
          <DetailField label="Method" value={String(d.method).charAt(0).toUpperCase() + String(d.method).slice(1)} />
        </DetailGrid>
      )}
      <DetailFooter log={log} />
    </>
  )
}

function renderGenericFallback(d: Record<string, unknown>, log: AuditLog) {
  const fieldChanges = d.fieldChanges as FieldChange[] | undefined
  const pairs = extractDetailPairs(d)
  return (
    <>
      {pairs.length > 0 && (
        <DetailGrid>
          {pairs.map((p, i) => <DetailField key={i} label={p.label} value={p.value} />)}
        </DetailGrid>
      )}
      {fieldChanges && fieldChanges.length > 0 && (
        <FieldChangesDisplay changes={fieldChanges} />
      )}
      <DetailFooter log={log} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Expanded Details Dispatcher
// ---------------------------------------------------------------------------

function ExpandedDetails({ log }: { log: AuditLog }) {
  const d = log.details || {}

  let content: React.ReactNode

  switch (log.action) {
    case 'stock.reception_submit':
    case 'stock.reception':
      content = renderStockReception(d, log); break
    case 'stock.count_submit':
    case 'stock.count':
      content = renderStockCount(d, log); break
    case 'waste.submit':
    case 'stock.waste_report':
      content = renderWaste(d, log); break
    case 'inventory.batch_update':
      content = renderBatchUpdate(d, log); break
    case 'inventory.item_create':
    case 'inventory.create':
      content = renderInventoryCreate(d, log); break
    case 'inventory.item_update':
    case 'inventory.update':
      content = renderInventoryItemUpdate(d, log); break
    case 'inventory.item_delete':
    case 'inventory.delete':
      content = renderInventoryDelete(d, log); break
    case 'inventory.bulk_delete':
      content = renderBulkDelete(d, log); break
    case 'inventory.bulk_import':
      content = renderBulkImport(d, log); break
    case 'inventory.recipe_create':
    case 'inventory.recipe_update':
    case 'inventory.recipe_delete':
      content = renderRecipe(d, log); break
    case 'inventory.recipe_ingredient_add':
    case 'inventory.recipe_ingredient_remove':
      content = renderRecipeIngredient(d, log); break
    case 'inventory.menu_item_create':
    case 'inventory.menu_item_update':
    case 'inventory.menu_item_delete':
      content = renderMenuItem(d, log); break
    case 'shift.clock_in':
      content = renderShiftClockIn(d, log); break
    case 'shift.clock_out':
      content = renderShiftClockOut(d, log); break
    case 'shift.create':
      content = renderShiftCreate(d, log); break
    case 'shift.update':
      content = renderShiftUpdate(d, log); break
    case 'shift.delete':
      content = renderShiftDelete(d, log); break
    case 'shift.clock_time_correction':
      content = renderClockTimeCorrection(d, log); break
    case 'user.invite':
    case 'user.invite_cancel':
    case 'user.invite_resend':
      content = renderUserInvite(d, log); break
    case 'user.remove_from_store':
    case 'user.deactivate':
      content = renderUserRemove(d, log); break
    case 'supplier.create':
    case 'supplier.update':
    case 'supplier.delete':
      content = renderSupplier(d, log); break
    case 'supplier.item_add':
    case 'supplier.item_update':
    case 'supplier.item_remove':
      content = renderSupplierItem(d, log); break
    case 'purchase_order.create':
    case 'purchase_order.update':
    case 'purchase_order.receive':
    case 'purchase_order.delete':
    case 'supplier.po_create':
    case 'supplier.po_update':
    case 'supplier.po_receive':
    case 'supplier.po_cancel':
      content = renderPurchaseOrder(d, log); break
    case 'store.create':
    case 'store.update':
    case 'store.delete':
    case 'store.deactivate':
      content = renderStore(d, log); break
    case 'settings.update':
    case 'settings.alert_preferences_update':
    case 'settings.pos_mapping_create':
    case 'settings.pos_mapping_delete':
    case 'settings.pos_connection_create':
    case 'settings.pos_connection_update':
    case 'settings.pos_connection_delete':
      content = renderSettings(d, log); break
    case 'auth.login':
    case 'auth.logout':
      content = renderAuth(d, log); break
    default:
      content = renderGenericFallback(d, log)
  }

  return (
    <div className="bg-muted/30 rounded-lg p-4 mt-2 mb-1 border border-border/40 animate-in slide-in-from-top-1 duration-200">
      {content}
    </div>
  )
}

function ActivityRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: AuditLog
  isExpanded: boolean
  onToggle: () => void
}) {
  const displayName = getDisplayName(log)
  const actionLabel = ACTION_LABELS[log.action] || log.action
  const borderColor = CATEGORY_BORDER_COLORS[log.action_category] || 'border-l-gray-300'
  const hasDetails = log.details && Object.keys(log.details).length > 0
  const compactDetail = hasDetails ? formatCompactDetails(log.action, log.details) : ''

  return (
    <div
      className={`border-l-[3px] ${borderColor} transition-colors duration-150 ${
        isExpanded ? 'bg-accent/30' : 'hover:bg-accent/20'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar name={displayName} identifier={log.user_email || displayName} />

          {/* Icon */}
          <CategoryIcon category={log.action_category} />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold truncate">{displayName}</span>
              <span className="text-sm text-muted-foreground truncate">{actionLabel.toLowerCase()}</span>
            </div>
            {compactDetail && !isExpanded && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{compactDetail}</p>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[log.action_category] || 'bg-gray-100 text-gray-800'} hidden sm:inline-flex`}>
              {CATEGORY_LABELS[log.action_category] || log.action_category}
            </Badge>
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[70px] text-right">
              {formatRelativeTime(log.created_at)}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && hasDetails && (
        <div className="px-4 pb-4">
          <ExpandedDetails log={log} />
        </div>
      )}
      {isExpanded && !hasDetails && (
        <div className="px-4 pb-4">
          <div className="bg-muted/30 rounded-lg p-4 border border-border/40 animate-in slide-in-from-top-1 duration-200">
            <p className="text-sm text-muted-foreground">No additional details recorded for this event.</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <span>{ACTION_LABELS[log.action] || log.action}</span>
              <span className="ml-auto">{format(new Date(log.created_at), 'PPpp')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ActivityPage() {
  const { storeId, currentStore, role } = useAuth()

  const [category, setCategory] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 6),
    to: new Date(),
  }))
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filters = useMemo<AuditLogFilters>(() => {
    const startDate = dateRange?.from
      ? startOfDay(dateRange.from).toISOString()
      : subDays(new Date(), 6).toISOString()
    let endDate: string | undefined
    if (dateRange?.to) {
      const end = new Date(dateRange.to)
      end.setHours(23, 59, 59, 999)
      endDate = end.toISOString()
    }

    // Resolve grouped category to comma-separated backend categories
    let resolvedCategory: string | undefined
    if (category !== 'all') {
      const group = CATEGORY_GROUPS.find(g => g.value === category)
      resolvedCategory = group ? group.categories.join(',') : category
    }

    return {
      storeId: storeId || undefined,
      category: resolvedCategory,
      startDate,
      endDate,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }
  }, [storeId, category, dateRange, page])

  const { data, isLoading } = useAuditLogs(filters)

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }, [])

  // Access restriction
  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Shield className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Only Owners and Managers can view the activity log.
              <br />
              Contact your store administrator for access.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No store selected
  if (!storeId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Activity className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Store Selected</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Select a store from the sidebar to view activity.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPages = data?.pagination ? Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStore?.store?.name} &middot; Complete audit trail for your store
          </p>
        </div>
        <div className="flex items-center gap-1">
          <PageGuide pageKey="activity" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {data?.logs && data.logs.length > 0 && (
        <StatsBar logs={data.logs} totalCount={data.pagination?.total ?? 0} />
      )}

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <Select value={category} onValueChange={v => { setCategory(v); setPage(0); setExpandedId(null) }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORY_GROUPS.map(g => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setDateRange(range || { from: subDays(new Date(), 6), to: new Date() })
                setPage(0)
                setExpandedId(null)
              }}
              presets={['today', 'yesterday', 'last7days', 'last14days', 'last30days', 'last90days']}
            />
            {data?.pagination && (
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {data.pagination.total.toLocaleString()} event{data.pagination.total !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-md" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !data?.logs || data.logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Activity className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Activity Found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              No events match your current filters. Try expanding the date range or removing the category filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Timeline rows */}
            <div className="divide-y divide-border/50">
              {data.logs.map((log, idx) => {
                // Date separator logic
                const prevLog = idx > 0 ? data.logs[idx - 1] : null
                const currentDate = format(new Date(log.created_at), 'EEEE, MMMM d')
                const prevDate = prevLog ? format(new Date(prevLog.created_at), 'EEEE, MMMM d') : null
                const showDateSeparator = currentDate !== prevDate

                return (
                  <div key={log.id}>
                    {showDateSeparator && (
                      <div className="px-4 py-2.5 bg-muted/40">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {isToday(new Date(log.created_at))
                            ? 'Today'
                            : isYesterday(new Date(log.created_at))
                              ? 'Yesterday'
                              : currentDate}
                        </span>
                      </div>
                    )}
                    <ActivityRow
                      log={log}
                      isExpanded={expandedId === log.id}
                      onToggle={() => handleToggleExpand(log.id)}
                    />
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {data.pagination && (
              <div className="flex items-center justify-between px-4 py-3 border-t print:hidden bg-muted/20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPage(p => Math.max(0, p - 1)); setExpandedId(null) }}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPage(p => p + 1); setExpandedId(null) }}
                  disabled={!data.pagination.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
