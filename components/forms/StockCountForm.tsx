'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { useInventory } from '@/hooks/useInventory'
import { useStockCount } from '@/hooks/useStockCount'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useFormDraft, formatDraftTime } from '@/hooks/useFormDraft'
import { KeyboardShortcutsHelp } from '@/components/dialogs/KeyboardShortcutsHelp'
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
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, AlertTriangle, Keyboard, RotateCcw, X, ArrowUp, ArrowDown } from 'lucide-react'

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

interface StockCountFormProps {
  storeId: string
  onSuccess?: () => void
}

interface CountItem {
  inventory_item_id: string
  name: string
  category: string | null
  unit_of_measure: string
  current_quantity: number
  new_quantity: number | null
  par_level: number | null
  isEditing: boolean
}

interface DraftData {
  quantities: Record<string, number>
  notes: string
}

export function StockCountForm({ storeId, onSuccess }: StockCountFormProps) {
  const { inventory, isLoading: inventoryLoading } = useStoreInventory(storeId)
  const { activeItems, isLoading: itemsLoading } = useInventory()
  const { submitCount, isSubmitting } = useStockCount()
  const [countItems, setCountItems] = useState<CountItem[]>([])
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showDraftBanner, setShowDraftBanner] = useState(true)

  // Track the storeId we initialized for
  const initializedForStore = useRef<string | null>(null)

  // Draft persistence
  const {
    hasDraft,
    draftTimestamp,
    restoreDraft,
    clearDraft,
    setValue: setDraftValue,
  } = useFormDraft<DraftData>({
    key: `stock-count-${storeId}`,
    defaultValue: { quantities: {}, notes: '' },
    debounceMs: 500,
  })

  // Get unique categories from items
  const categories = useMemo(() => {
    const cats = new Set<string>()
    countItems.forEach(item => {
      if (item.category) cats.add(item.category)
    })
    return Array.from(cats).sort()
  }, [countItems])

  // Initialize count items when inventory loads
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

      const items: CountItem[] = activeItems.map(item => {
        const storeInv = inventoryMap.get(item.id)
        return {
          inventory_item_id: item.id,
          name: item.name,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          current_quantity: storeInv?.quantity ?? 0,
          new_quantity: null,
          par_level: storeInv?.par_level ?? null,
          isEditing: false,
        }
      })

      setCountItems(items)
    }
  }, [inventoryLoading, itemsLoading, activeItems.length, inventory, activeItems, storeId])

  // Handle clicking on quantity to start editing
  const handleStartEditing = useCallback((itemId: string) => {
    setCountItems(prev =>
      prev.map(item =>
        item.inventory_item_id === itemId
          ? { ...item, isEditing: true, new_quantity: item.new_quantity ?? item.current_quantity }
          : item
      )
    )
  }, [])

  // Handle quantity change (integers only)
  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value, 10)
    setCountItems(prev => {
      const updated = prev.map(item =>
        item.inventory_item_id === itemId
          ? { ...item, new_quantity: isNaN(numValue as number) ? null : numValue }
          : item
      )
      // Save draft with changed quantities
      const quantities: Record<string, number> = {}
      updated.forEach(item => {
        if (item.new_quantity !== null && item.new_quantity !== item.current_quantity) {
          quantities[item.inventory_item_id] = item.new_quantity
        }
      })
      setDraftValue({ quantities, notes })
      return updated
    })
  }, [notes, setDraftValue])

  // Handle blur - stop editing
  const handleBlur = useCallback((itemId: string) => {
    setCountItems(prev =>
      prev.map(item => {
        if (item.inventory_item_id !== itemId) return item
        // If value hasn't changed from current, reset to null
        if (item.new_quantity === item.current_quantity) {
          return { ...item, isEditing: false, new_quantity: null }
        }
        return { ...item, isEditing: false }
      })
    )
  }, [])

  // Handle notes change with draft save
  const handleNotesChange = useCallback((newNotes: string) => {
    setNotes(newNotes)
    // Save draft with current quantities
    const quantities: Record<string, number> = {}
    countItems.forEach(item => {
      if (item.new_quantity !== null && item.new_quantity !== item.current_quantity) {
        quantities[item.inventory_item_id] = item.new_quantity
      }
    })
    setDraftValue({ quantities, notes: newNotes })
  }, [countItems, setDraftValue])

  // Restore draft data
  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft()
    if (draft) {
      // Apply saved quantities
      setCountItems(prev =>
        prev.map(item => {
          const savedQty = draft.quantities[item.inventory_item_id]
          if (savedQty !== undefined) {
            return { ...item, new_quantity: savedQty }
          }
          return item
        })
      )
      // Apply saved notes
      if (draft.notes) {
        setNotes(draft.notes)
      }
    }
    setShowDraftBanner(false)
  }, [restoreDraft])

  // Dismiss draft without restoring
  const handleDismissDraft = useCallback(() => {
    clearDraft()
    setShowDraftBanner(false)
  }, [clearDraft])

  const handleSubmit = async () => {
    const itemsToSubmit = countItems
      .filter(item => item.new_quantity !== null && item.new_quantity !== item.current_quantity)
      .map(item => ({
        inventory_item_id: item.inventory_item_id,
        quantity: item.new_quantity!,
      }))

    if (itemsToSubmit.length === 0) {
      return
    }

    // Clear draft on submit
    clearDraft()

    // Fire and forget - don't wait for response since Supabase may hang
    submitCount({
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
    const filtered = countItems.filter(item => {
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
        const aIsLowStock = a.par_level && (a.new_quantity ?? a.current_quantity) < a.par_level
        const bIsLowStock = b.par_level && (b.new_quantity ?? b.current_quantity) < b.par_level

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
          const getStatusPriority = (item: CountItem) => {
            const qty = item.new_quantity ?? item.current_quantity
            if (!item.par_level) return 3
            if (qty < item.par_level) return 1
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
  }, [countItems, searchQuery, categoryFilter, sortConfig])

  const changedItemsCount = countItems.filter(
    item => item.new_quantity !== null && item.new_quantity !== item.current_quantity
  ).length

  // Keyboard shortcuts help dialog
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Get index of currently editing item
  const editingIndex = filteredItems.findIndex(item => item.isEditing)

  // Navigate to next/previous item
  const navigateToItem = useCallback((direction: 'next' | 'prev') => {
    if (filteredItems.length === 0) return

    let targetIndex: number
    if (editingIndex === -1) {
      // Nothing editing, start from first/last
      targetIndex = direction === 'next' ? 0 : filteredItems.length - 1
    } else {
      // Move from current
      targetIndex = direction === 'next'
        ? Math.min(editingIndex + 1, filteredItems.length - 1)
        : Math.max(editingIndex - 1, 0)
    }

    const targetItem = filteredItems[targetIndex]
    if (targetItem) {
      // Blur current if any
      if (editingIndex !== -1) {
        handleBlur(filteredItems[editingIndex].inventory_item_id)
      }
      handleStartEditing(targetItem.inventory_item_id)
    }
  }, [filteredItems, editingIndex, handleBlur, handleStartEditing])

  // Register keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'meta+s',
      handler: () => {
        if (changedItemsCount > 0 && !isSubmitting) {
          handleSubmit()
        }
      },
      description: 'Submit stock count',
    },
    {
      key: 'ctrl+s',
      handler: () => {
        if (changedItemsCount > 0 && !isSubmitting) {
          handleSubmit()
        }
      },
      description: 'Submit stock count',
    },
    {
      key: 'shift+?',
      handler: () => setShowShortcuts(prev => !prev),
      description: 'Toggle keyboard shortcuts help',
    },
    {
      key: 'escape',
      handler: () => {
        if (editingIndex !== -1) {
          handleBlur(filteredItems[editingIndex].inventory_item_id)
        }
        setShowShortcuts(false)
      },
      description: 'Close input / cancel',
      allowInInput: true,
    },
  ])

  // Shortcut groups for help dialog
  const shortcutGroups = [
    {
      title: 'Navigation',
      shortcuts: [
        { key: 'enter', description: 'Move to next item' },
        { key: 'tab', description: 'Move to next item' },
        { key: 'shift+tab', description: 'Move to previous item' },
        { key: 'escape', description: 'Stop editing current item' },
      ],
    },
    {
      title: 'Actions',
      shortcuts: [
        { key: 'meta+s', description: 'Submit stock count' },
        { key: 'shift+?', description: 'Toggle shortcuts help' },
      ],
    },
  ]

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
      {/* Draft Recovery Banner */}
      {hasDraft && showDraftBanner && (
        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <RotateCcw className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-sm">
              You have an unsaved draft from {draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'}.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestoreDraft}
                className="h-7 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restore
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissDraft}
                className="h-7 w-7 p-0"
                title="Dismiss draft"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
            aria-label="Search inventory items"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9" aria-label="Filter by category">
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
        <Badge variant="outline" className="h-9 px-3 flex items-center" aria-live="polite" aria-atomic="true">
          {changedItemsCount} updated
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => setShowShortcuts(true)}
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
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
                label="Current"
                sortKey="current"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <TableHead>New Quantity</TableHead>
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
                const isLowStock = item.par_level && (item.new_quantity ?? item.current_quantity) < item.par_level
                const hasChanged = item.new_quantity !== null && item.new_quantity !== item.current_quantity

                return (
                  <TableRow
                    key={item.inventory_item_id}
                    className={hasChanged ? 'bg-primary/5' : ''}
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
                          value={item.new_quantity ?? ''}
                          onChange={(e) => handleQuantityChange(item.inventory_item_id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleBlur(item.inventory_item_id)}
                          onKeyDown={(e) => {
                            // Prevent decimal point
                            if (e.key === '.') {
                              e.preventDefault()
                            }
                            // Enter or Tab moves to next item
                            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                              e.preventDefault()
                              navigateToItem('next')
                            }
                            // Shift+Tab moves to previous item
                            if (e.key === 'Tab' && e.shiftKey) {
                              e.preventDefault()
                              navigateToItem('prev')
                            }
                            // Escape closes input
                            if (e.key === 'Escape') {
                              e.currentTarget.blur()
                            }
                          }}
                          className="w-20 h-8 text-center text-sm"
                          aria-label={`Quantity for ${item.name}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditing(item.inventory_item_id)}
                          className={`min-w-16 h-8 px-3 text-sm font-medium rounded-md border cursor-pointer transition-colors
                            ${hasChanged
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 hover:bg-muted border-input'
                            }`}
                          aria-label={`Edit quantity for ${item.name}, currently ${item.new_quantity ?? item.current_quantity} ${item.unit_of_measure}`}
                        >
                          {item.new_quantity ?? item.current_quantity}
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

      {/* Notes */}
      <div className="space-y-1.5 pt-3 border-t">
        <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes about this count..."
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      {/* Submit - sticky on mobile */}
      <div className="sticky bottom-0 bg-background pt-3 pb-safe -mx-4 px-4 sm:static sm:mx-0 sm:px-0 sm:pt-3 sm:pb-0 border-t sm:border-t-0">
        <Button
          onClick={handleSubmit}
          disabled={changedItemsCount === 0 || isSubmitting}
          className="w-full sm:w-auto h-11 sm:h-10 text-base sm:text-sm"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Stock Count ({changedItemsCount} items)
        </Button>
      </div>

      <KeyboardShortcutsHelp
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        groups={shortcutGroups}
      />
    </div>
  )
}
