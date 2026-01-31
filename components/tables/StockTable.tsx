'use client'

import { useState, useCallback, useMemo, memo } from 'react'
import { StoreInventory } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, AlertTriangle, Package, ArrowUp, ArrowDown } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

// Sort configuration
type SortKey = 'item' | 'category' | 'quantity' | 'parLevel' | 'status'
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
  const ariaSort = isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
      aria-sort={ariaSort}
      role="columnheader"
    >
      <button
        type="button"
        className={`flex items-center gap-1 w-full ${className.includes('text-right') ? 'justify-end' : ''}`}
        aria-label={`Sort by ${label}${isActive ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      >
        <span>{label}</span>
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
          {direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
    </TableHead>
  )
}

interface StockTableProps {
  inventory: StoreInventory[]
  categoryFilter?: string
  canEditParLevel?: boolean
  onUpdateParLevel?: (item: StoreInventory, parLevel: number) => void
}

interface EditingState {
  itemId: string
  value: string
}

export const StockTable = memo(function StockTable({
  inventory,
  categoryFilter,
  canEditParLevel = false,
  onUpdateParLevel
}: StockTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    const filtered = inventory.filter((item) => {
      const matchesSearch = searchQuery
        ? item.inventory_item?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        : true

      const matchesCategory = categoryFilter
        ? item.inventory_item?.category === categoryFilter
        : true

      return matchesSearch && matchesCategory
    })

    // Apply user sort if set, otherwise default sort (low stock first, then alphabetically)
    if (!sortConfig) {
      return filtered.sort((a, b) => {
        const aIsLowStock = a.par_level && a.quantity < a.par_level
        const bIsLowStock = b.par_level && b.quantity < b.par_level

        if (aIsLowStock && !bIsLowStock) return -1
        if (!aIsLowStock && bIsLowStock) return 1
        return (a.inventory_item?.name ?? '').localeCompare(b.inventory_item?.name ?? '')
      })
    }

    // User-specified sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'item':
          aVal = (a.inventory_item?.name ?? '').toLowerCase()
          bVal = (b.inventory_item?.name ?? '').toLowerCase()
          break
        case 'category':
          // Items without category sort to end
          aVal = (a.inventory_item?.category ?? 'zzz').toLowerCase()
          bVal = (b.inventory_item?.category ?? 'zzz').toLowerCase()
          break
        case 'quantity':
          aVal = a.quantity
          bVal = b.quantity
          break
        case 'parLevel':
          // Items without PAR level sort to end
          aVal = a.par_level ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity)
          bVal = b.par_level ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity)
          break
        case 'status':
          // Low stock (1) first, then OK (2), then no PAR set (3)
          const getStatusPriority = (item: StoreInventory) => {
            if (!item.par_level) return 3
            if (item.quantity < item.par_level) return 1
            return 2
          }
          aVal = getStatusPriority(a)
          bVal = getStatusPriority(b)
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
  }, [inventory, searchQuery, categoryFilter, sortConfig])

  const handleStartEditing = useCallback((itemId: string, currentValue: number | null) => {
    if (!canEditParLevel) return
    setEditing({
      itemId,
      value: currentValue?.toString() ?? ''
    })
  }, [canEditParLevel])

  const handleChange = useCallback((value: string) => {
    setEditing(prev => prev ? { ...prev, value } : null)
  }, [])

  const handleBlur = useCallback((item: StoreInventory) => {
    if (!editing || !onUpdateParLevel) return

    const numValue = parseInt(editing.value, 10)

    if (!isNaN(numValue) && numValue >= 0 && numValue !== item.par_level) {
      onUpdateParLevel(item, numValue)
    }

    setEditing(null)
  }, [editing, onUpdateParLevel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, item: StoreInventory) => {
    if (e.key === '.') {
      e.preventDefault()
    }
    if (e.key === 'Enter') {
      handleBlur(item)
    }
    if (e.key === 'Escape') {
      setEditing(null)
    }
  }, [handleBlur])

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {filteredInventory.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center border rounded-md">
            <EmptyState
              icon={Package}
              title="No inventory items"
              description={searchQuery
                ? "No items match your search. Try a different search term."
                : "This store doesn't have any inventory items yet."
              }
            />
          </div>
        ) : (
          filteredInventory.map((item) => {
            const isLowStock = item.par_level && item.quantity < item.par_level
            const isEditingParLevel = editing?.itemId === item.id

            return (
              <div key={item.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.inventory_item?.name}</p>
                      {isLowStock ? (
                        <Badge variant="destructive" className="gap-1 text-[10px] h-5 flex-shrink-0">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Low
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-5 flex-shrink-0">OK</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {item.inventory_item?.category && <span>{item.inventory_item.category}</span>}
                      <span>•</span>
                      <span>{item.inventory_item?.unit_of_measure}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Qty</div>
                    <div className="text-lg font-bold">{item.quantity}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">PAR</div>
                    {canEditParLevel && onUpdateParLevel ? (
                      isEditingParLevel ? (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={editing?.value ?? ''}
                          onChange={(e) => handleChange(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleBlur(item)}
                          onKeyDown={(e) => handleKeyDown(e, item)}
                          className="w-16 h-8 text-center text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditing(item.id, item.par_level)}
                          className="text-lg font-bold text-left"
                        >
                          {item.par_level ?? '-'}
                        </button>
                      )
                    ) : (
                      <div className="text-lg font-bold">{item.par_level ?? '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Item"
                sortKey="item"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Category"
                sortKey="category"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
              <SortableHeader
                label="Quantity"
                sortKey="quantity"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="PAR Level"
                sortKey="parLevel"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-[250px]">
                  <EmptyState
                    icon={Package}
                    title="No inventory items"
                    description={searchQuery
                      ? "No items match your search. Try a different search term."
                      : "This store doesn't have any inventory items yet. Add items from the master inventory list."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((item) => {
                const isLowStock = item.par_level && item.quantity < item.par_level
                const isEditingParLevel = editing?.itemId === item.id

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.inventory_item?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.inventory_item?.unit_of_measure}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.inventory_item?.category || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {canEditParLevel && onUpdateParLevel ? (
                        isEditingParLevel ? (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            autoFocus
                            value={editing?.value ?? ''}
                            onChange={(e) => handleChange(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleBlur(item)}
                            onKeyDown={(e) => handleKeyDown(e, item)}
                            className="w-20 h-8 text-center text-sm"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditing(item.id, item.par_level)}
                            className="min-w-16 h-8 px-3 text-sm font-medium rounded-md border cursor-pointer transition-colors bg-muted/50 hover:bg-muted border-input"
                          >
                            {item.par_level ?? '-'}
                          </button>
                        )
                      ) : (
                        <span className="text-muted-foreground">{item.par_level ?? '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Low
                        </Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
})
