'use client'

import { memo, useState, useMemo } from 'react'
import { StockHistory } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { History, ArrowUp, ArrowDown } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

const actionColors = {
  Count: 'default' as const,
  Reception: 'secondary' as const,
  Adjustment: 'outline' as const,
  Waste: 'destructive' as const,
  Sale: 'secondary' as const,
}

// Sort configuration
type SortKey = 'time' | 'item' | 'action' | 'store' | 'before' | 'after' | 'change' | 'by'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  currentSort: SortConfig | null
  onSort: (key: SortKey) => void
  className?: string
}

function SortableHeader({ label, sortKey, currentSort, onSort, className = '' }: SortableHeaderProps) {
  const isActive = currentSort?.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}>
          {direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </TableHead>
  )
}

interface StockHistoryRowProps {
  record: StockHistory
  showStore: boolean
}

const StockHistoryRow = memo(function StockHistoryRow({ record, showStore }: StockHistoryRowProps) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">
        {format(new Date(record.created_at), 'h:mm a')}
      </TableCell>
      <TableCell className="font-medium">
        {record.inventory_item?.name || '-'}
      </TableCell>
      <TableCell>
        <Badge variant={actionColors[record.action_type]}>
          {record.action_type}
        </Badge>
      </TableCell>
      {showStore && (
        <TableCell className="hidden sm:table-cell text-muted-foreground">
          {record.store?.name || '-'}
        </TableCell>
      )}
      <TableCell className="text-right font-mono text-muted-foreground">
        {record.quantity_before ?? 0}
      </TableCell>
      <TableCell className="text-right font-mono font-medium">
        {record.quantity_after ?? 0}
      </TableCell>
      <TableCell className="text-right font-mono">
        <span
          className={`inline-flex items-center justify-end px-2 py-0.5 rounded text-sm font-medium ${
            record.quantity_change && record.quantity_change > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-green-900/30 dark:text-green-400'
              : record.quantity_change && record.quantity_change < 0
              ? 'bg-destructive/10 text-destructive/70 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {record.quantity_change && record.quantity_change > 0 ? '+' : ''}
          {record.quantity_change ?? 0}
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-muted-foreground">
        {record.performer?.full_name || record.performer?.email || '-'}
      </TableCell>
    </TableRow>
  )
})

interface StockHistoryTableProps {
  history: StockHistory[]
  showStore?: boolean
}

export const StockHistoryTable = memo(function StockHistoryTable({ history, showStore = false }: StockHistoryTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        // Toggle direction if same key
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      // New key - start with ascending
      return { key, direction: 'asc' }
    })
  }

  const sortedHistory = useMemo(() => {
    if (!sortConfig) return history

    return [...history].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'time':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        case 'item':
          aVal = (a.inventory_item?.name || '').toLowerCase()
          bVal = (b.inventory_item?.name || '').toLowerCase()
          break
        case 'action':
          aVal = a.action_type.toLowerCase()
          bVal = b.action_type.toLowerCase()
          break
        case 'store':
          aVal = (a.store?.name || '').toLowerCase()
          bVal = (b.store?.name || '').toLowerCase()
          break
        case 'before':
          aVal = a.quantity_before ?? 0
          bVal = b.quantity_before ?? 0
          break
        case 'after':
          aVal = a.quantity_after ?? 0
          bVal = b.quantity_after ?? 0
          break
        case 'change':
          aVal = a.quantity_change ?? 0
          bVal = b.quantity_change ?? 0
          break
        case 'by':
          aVal = (a.performer?.full_name || a.performer?.email || '').toLowerCase()
          bVal = (b.performer?.full_name || b.performer?.email || '').toLowerCase()
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier
      }

      if (aVal < bVal) return -1 * multiplier
      if (aVal > bVal) return 1 * multiplier
      return 0
    })
  }, [history, sortConfig])

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedHistory.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center border rounded-md">
            <EmptyState
              icon={History}
              title="No stock history"
              description="Stock changes from counts and receptions will appear here."
            />
          </div>
        ) : (
          sortedHistory.map((record) => (
            <div key={record.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{record.inventory_item?.name || '-'}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{format(new Date(record.created_at), 'h:mm a')}</span>
                    {showStore && record.store?.name && (
                      <>
                        <span>•</span>
                        <span>{record.store.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant={actionColors[record.action_type]} className="text-xs flex-shrink-0">
                  {record.action_type}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 pt-2 border-t">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Before</div>
                  <div className="text-sm font-mono text-muted-foreground">{record.quantity_before ?? 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">After</div>
                  <div className="text-sm font-mono font-medium">{record.quantity_after ?? 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Change</div>
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      record.quantity_change && record.quantity_change > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-green-900/30 dark:text-green-400'
                        : record.quantity_change && record.quantity_change < 0
                        ? 'bg-destructive/10 text-destructive/70 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {record.quantity_change && record.quantity_change > 0 ? '+' : ''}
                    {record.quantity_change ?? 0}
                  </span>
                </div>
              </div>
              {record.performer && (
                <div className="mt-1.5 text-xs text-muted-foreground truncate">
                  By {record.performer.full_name || record.performer.email || '-'}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Time"
                sortKey="time"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Item"
                sortKey="item"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Action"
                sortKey="action"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              {showStore && (
                <SortableHeader
                  label="Store"
                  sortKey="store"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  className="hidden md:table-cell"
                />
              )}
              <SortableHeader
                label="Before"
                sortKey="before"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="After"
                sortKey="after"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="Change"
                sortKey="change"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="By"
                sortKey="by"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showStore ? 8 : 7} className="h-[250px]">
                  <EmptyState
                    icon={History}
                    title="No stock history"
                    description="Stock changes from counts and receptions will appear here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              sortedHistory.map((record) => (
                <StockHistoryRow key={record.id} record={record} showStore={showStore} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
})
