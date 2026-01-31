'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { InventoryItem } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { MoreHorizontal, Edit, Trash2, Package, Plus, CheckSquare, XSquare, ArrowUp, ArrowDown } from 'lucide-react'
import { InventoryTableSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'

// Sort configuration
type SortKey = 'name' | 'category' | 'unit' | 'status'
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

interface InventoryTableProps {
  items: InventoryItem[]
  isLoading?: boolean
  onAdd?: () => void
  onEdit?: (item: InventoryItem) => void
  onDelete?: (item: InventoryItem) => void
  onBulkDeactivate?: (items: InventoryItem[]) => void
  onBulkActivate?: (items: InventoryItem[]) => void
}

export const InventoryTable = memo(function InventoryTable({
  items,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onBulkDeactivate,
  onBulkActivate,
}: InventoryTableProps) {
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'deactivate' | 'activate' | null>(null)
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

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items

    return [...items].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'category':
          // Put items without category ("-") at the end
          aVal = a.category?.toLowerCase() || 'zzz'
          bVal = b.category?.toLowerCase() || 'zzz'
          break
        case 'unit':
          aVal = a.unit_of_measure.toLowerCase()
          bVal = b.unit_of_measure.toLowerCase()
          break
        case 'status':
          // Active first (1), Inactive second (2)
          aVal = a.is_active ? 1 : 2
          bVal = b.is_active ? 1 : 2
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
  }, [items, sortConfig])

  const selectedItems = useMemo(
    () => items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(item => item.id)))
    }
  }, [allSelected, items])

  const handleSelectItem = useCallback((itemId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }
      return next
    })
  }, [])

  const handleDelete = () => {
    if (deleteItem && onDelete) {
      onDelete(deleteItem)
      setDeleteItem(null)
    }
  }

  const handleBulkAction = () => {
    if (bulkAction === 'deactivate' && onBulkDeactivate) {
      onBulkDeactivate(selectedItems)
    } else if (bulkAction === 'activate' && onBulkActivate) {
      onBulkActivate(selectedItems)
    }
    setSelectedIds(new Set())
    setBulkAction(null)
  }

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Count active/inactive in selection
  const activeInSelection = selectedItems.filter(i => i.is_active).length
  const inactiveInSelection = selectedItems.filter(i => !i.is_active).length

  if (isLoading) {
    return <InventoryTableSkeleton />
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 mb-4 bg-muted/50 rounded-lg border animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {activeInSelection > 0 && onBulkDeactivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('deactivate')}
                className="h-8"
              >
                <XSquare className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Deactivate ({activeInSelection})
              </Button>
            )}
            {inactiveInSelection > 0 && onBulkActivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('activate')}
                className="h-8"
              >
                <CheckSquare className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Activate ({inactiveInSelection})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedItems.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center border rounded-md">
            <EmptyState
              icon={Package}
              title="No inventory items"
              description="Add items to your master inventory list to start tracking stock across stores."
              action={onAdd ? {
                label: "Add Item",
                onClick: onAdd,
                icon: Plus,
              } : undefined}
            />
          </div>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.id}
              className={`border rounded-lg p-3 ${selectedIds.has(item.id) ? 'bg-muted/50 border-primary/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                  aria-label={`Select ${item.name}`}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {item.category && <span>{item.category}</span>}
                        <span>•</span>
                        <span>{item.unit_of_measure}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(item)}>
                          <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteItem(item)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-2">
                    <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  data-indeterminate={someSelected ? true : undefined}
                  onCheckedChange={handleSelectAll}
                  aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
                />
              </TableHead>
              <SortableHeader
                label="Name"
                sortKey="name"
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
                label="Unit"
                sortKey="unit"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-[300px]">
                  <EmptyState
                    icon={Package}
                    title="No inventory items"
                    description="Add items to your master inventory list to start tracking stock across stores."
                    action={onAdd ? {
                      label: "Add Item",
                      onClick: onAdd,
                      icon: Plus,
                    } : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={selectedIds.has(item.id) ? 'bg-muted/50' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                      aria-label={`Select ${item.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.category || '-'}
                  </TableCell>
                  <TableCell>{item.unit_of_measure}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? 'default' : 'secondary'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(item)}>
                          <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteItem(item)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Single item deactivate dialog */}
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(null)}
        title="Deactivate Item"
        description={`Are you sure you want to deactivate "${deleteItem?.name}"? The item will no longer appear in stock counts and reports.`}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Bulk action dialog */}
      <ConfirmDialog
        open={!!bulkAction}
        onOpenChange={() => setBulkAction(null)}
        title={bulkAction === 'deactivate' ? 'Deactivate Items' : 'Activate Items'}
        description={
          bulkAction === 'deactivate'
            ? `Are you sure you want to deactivate ${activeInSelection} item${activeInSelection !== 1 ? 's' : ''}? They will no longer appear in stock counts and reports.`
            : `Are you sure you want to activate ${inactiveInSelection} item${inactiveInSelection !== 1 ? 's' : ''}? They will appear in stock counts and reports.`
        }
        confirmLabel={bulkAction === 'deactivate' ? 'Deactivate All' : 'Activate All'}
        variant={bulkAction === 'deactivate' ? 'destructive' : 'default'}
        onConfirm={handleBulkAction}
      />
    </>
  )
})
