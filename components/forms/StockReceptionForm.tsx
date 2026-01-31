'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { useInventory } from '@/hooks/useInventory'
import { useStockReception } from '@/hooks/useStockReception'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, AlertTriangle, Plus, ArrowUp, ArrowDown } from 'lucide-react'

// Sort configuration
type SortKey = 'item' | 'category' | 'unit' | 'current' | 'status'
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
        className="flex items-center gap-1 w-full"
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

interface StockReceptionFormProps {
  storeId: string
  onSuccess?: () => void
}

interface ReceptionItem {
  inventory_item_id: string
  name: string
  category: string | null
  unit_of_measure: string
  current_quantity: number
  received_quantity: number | null
  par_level: number | null
  isEditing: boolean
}

export function StockReceptionForm({ storeId, onSuccess }: StockReceptionFormProps) {
  const { inventory, isLoading: inventoryLoading } = useStoreInventory(storeId)
  const { activeItems, isLoading: itemsLoading } = useInventory()
  const { submitReception, isSubmitting } = useStockReception()
  const [receptionItems, setReceptionItems] = useState<ReceptionItem[]>([])
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Track the storeId we initialized for
  const initializedForStore = useRef<string | null>(null)

  // Get unique categories from items
  const categories = useMemo(() => {
    const cats = new Set<string>()
    receptionItems.forEach(item => {
      if (item.category) cats.add(item.category)
    })
    return Array.from(cats).sort()
  }, [receptionItems])

  // Initialize reception items when inventory loads
  useEffect(() => {
    if (
      !inventoryLoading &&
      !itemsLoading &&
      activeItems.length > 0 &&
      initializedForStore.current !== storeId
    ) {
      initializedForStore.current = storeId

      const inventoryMap = new Map(
        inventory.map(inv => [inv.inventory_item_id, inv])
      )

      const items: ReceptionItem[] = activeItems.map(item => {
        const storeInv = inventoryMap.get(item.id)
        return {
          inventory_item_id: item.id,
          name: item.name,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          current_quantity: storeInv?.quantity ?? 0,
          received_quantity: null,
          par_level: storeInv?.par_level ?? null,
          isEditing: false,
        }
      })

      setReceptionItems(items)
    }
  }, [inventoryLoading, itemsLoading, activeItems.length, inventory, activeItems, storeId])

  // Handle clicking to start editing
  const handleStartEditing = useCallback((itemId: string) => {
    setReceptionItems(prev =>
      prev.map(item =>
        item.inventory_item_id === itemId
          ? { ...item, isEditing: true, received_quantity: item.received_quantity ?? 0 }
          : item
      )
    )
  }, [])

  // Handle quantity change (integers only)
  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10)
    setReceptionItems(prev =>
      prev.map(item =>
        item.inventory_item_id === itemId
          ? { ...item, received_quantity: isNaN(numValue as number) ? null : numValue }
          : item
      )
    )
  }, [])

  // Handle blur - stop editing
  const handleBlur = useCallback((itemId: string) => {
    setReceptionItems(prev =>
      prev.map(item => {
        if (item.inventory_item_id !== itemId) return item
        // If value is 0 or null, reset
        if (!item.received_quantity || item.received_quantity === 0) {
          return { ...item, isEditing: false, received_quantity: null }
        }
        return { ...item, isEditing: false }
      })
    )
  }, [])

  const handleSubmit = async () => {
    const itemsToSubmit = receptionItems
      .filter(item => item.received_quantity !== null && item.received_quantity > 0)
      .map(item => ({
        inventory_item_id: item.inventory_item_id,
        quantity: item.received_quantity!,
      }))

    if (itemsToSubmit.length === 0) {
      return
    }

    // Fire and forget - don't wait for response since Supabase may hang
    submitReception({
      store_id: storeId,
      items: itemsToSubmit,
      notes: notes || undefined,
    }).catch(() => {
      // Error already handled by mutation - navigate anyway
    })

    // Navigate immediately - data is likely saved even if response hangs
    onSuccess?.()
  }

  // Sort configuration
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

  // Filter items by search and category, then apply sort
  const filteredItems = useMemo(() => {
    const filtered = receptionItems.filter(item => {
      const matchesSearch = searchQuery
        ? item.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      const matchesCategory = categoryFilter === 'all'
        ? true
        : item.category === categoryFilter
      return matchesSearch && matchesCategory
    })

    // Default sort: low stock items first, then alphabetically
    if (!sortConfig) {
      return filtered.sort((a, b) => {
        const aIsLowStock = a.par_level && a.current_quantity < a.par_level
        const bIsLowStock = b.par_level && b.current_quantity < b.par_level

        if (aIsLowStock && !bIsLowStock) return -1
        if (!aIsLowStock && bIsLowStock) return 1
        return a.name.localeCompare(b.name)
      })
    }

    // User-specified sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'item':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'category':
          // Items without category sort to end
          aVal = (a.category ?? 'zzz').toLowerCase()
          bVal = (b.category ?? 'zzz').toLowerCase()
          break
        case 'unit':
          aVal = a.unit_of_measure.toLowerCase()
          bVal = b.unit_of_measure.toLowerCase()
          break
        case 'current':
          aVal = a.current_quantity
          bVal = b.current_quantity
          break
        case 'status':
          // Low stock (1) first, then OK (2), then no PAR set (3)
          const getStatusPriority = (item: ReceptionItem) => {
            if (!item.par_level) return 3
            if (item.current_quantity < item.par_level) return 1
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
  }, [receptionItems, searchQuery, categoryFilter, sortConfig])

  const receivedItemsCount = receptionItems.filter(
    item => item.received_quantity !== null && item.received_quantity > 0
  ).length

  const totalUnitsReceived = receptionItems.reduce(
    (sum, item) => sum + (item.received_quantity ?? 0),
    0
  )

  if (inventoryLoading || itemsLoading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-9 px-3 flex items-center">
          {receivedItemsCount} items
        </Badge>
      </div>

      {/* Item table with sortable columns */}
      <div className="rounded-md border">
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
                className="hidden sm:table-cell"
              />
              <SortableHeader
                label="Unit"
                sortKey="unit"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
              <SortableHeader
                label="Current Stock"
                sortKey="current"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <TableHead>Received</TableHead>
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sortConfig}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-[200px] text-center text-muted-foreground">
                  No items found
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const isLowStock = item.par_level && item.current_quantity < item.par_level
                const hasReceived = item.received_quantity !== null && item.received_quantity > 0

                return (
                  <TableRow
                    key={item.inventory_item_id}
                    className={hasReceived ? 'bg-green-50 dark:bg-green-950/20' : ''}
                  >
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {item.category || '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.unit_of_measure}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.current_quantity}
                    </TableCell>
                    <TableCell>
                      {item.isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={item.received_quantity ?? ''}
                          onChange={(e) => handleQuantityChange(item.inventory_item_id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleBlur(item.inventory_item_id)}
                          onKeyDown={(e) => {
                            // Prevent decimal point
                            if (e.key === '.') {
                              e.preventDefault()
                            }
                            if (e.key === 'Enter') {
                              e.currentTarget.blur()
                            }
                          }}
                          className="w-20 h-8 text-center text-sm"
                          aria-label={`Received quantity for ${item.name}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditing(item.inventory_item_id)}
                          className={`min-w-16 h-8 px-3 text-sm font-medium rounded-md border cursor-pointer transition-colors flex items-center justify-center gap-1
                            ${hasReceived
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-muted/50 hover:bg-muted border-input'
                            }`}
                          aria-label={`Add received quantity for ${item.name}`}
                        >
                          {hasReceived ? (
                            `+${item.received_quantity}`
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </button>
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

      {/* Notes and Submit */}
      <div className="space-y-3 pt-3 border-t">
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add delivery notes, supplier info, etc..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button
            onClick={handleSubmit}
            disabled={receivedItemsCount === 0 || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Reception ({receivedItemsCount} items, {totalUnitsReceived} units)
          </Button>
        </div>
      </div>
    </div>
  )
}
