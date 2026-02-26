'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useInventory } from '@/hooks/useInventory'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { InventoryItemForm } from '@/components/forms/InventoryItemForm'
import { CSVImport } from '@/components/inventory/CSVImport'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { InventoryItem, StoreInventory } from '@/types'
import { InventoryItemFormData } from '@/lib/validations/inventory'
import { Plus, Search, MoreVertical, MoreHorizontal, Edit, Trash2, Package, X, FileUp, FileDown, Save, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV, generateExportFilename } from '@/lib/export'
import { supabaseFetch } from '@/lib/supabase/client'
import { useCSRF } from '@/hooks/useCSRF'
import { PageGuide } from '@/components/help/PageGuide'

const FILTER_DEFAULTS = {
  search: '',
  category: '',
}

// Pending change for a single item
interface PendingChange {
  quantity?: number
  par_level?: number | null
  unit_cost?: number
  // Original values for comparison
  originalQuantity: number
  originalPar: number | null
  originalCost: number
}

// Skeleton for table
function InventoryTableSkeleton() {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(8)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell>
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20 mt-1" />
                </div>
              </TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Extended type for inventory with quantities
interface InventoryWithQuantity extends InventoryItem {
  quantity: number
  par_level: number | null
  unit_cost: number
}

function InventoryPageContent() {
  const { currentStore, refreshProfile } = useAuth()
  const currentStoreId = currentStore?.store_id
  const { items, isLoading, error, createItem, updateItem, refetch: refetchItems } = useInventory()
  const { csrfFetch } = useCSRF()

  // URL-based filter state
  const { filters, setFilter } = useUrlFilters({ defaults: FILTER_DEFAULTS })

  // Local search input for immediate feedback
  const [searchInput, setSearchInput] = useState(filters.search)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteItemState, setDeleteItemState] = useState<InventoryItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  // Pending changes system - track all unsaved edits
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map())
  const [isSavingBatch, setIsSavingBatch] = useState(false)

  // Inline editing state (one field at a time)
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'stock' | 'par' | 'cost' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Store inventory data (quantities)
  const [storeInventoryMap, setStoreInventoryMap] = useState<Map<string, StoreInventory>>(new Map())
  const [storeInventoryLoading, setStoreInventoryLoading] = useState(false)

  // Fetch store inventory when store changes
  const fetchStoreInventory = useCallback(async (storeId: string) => {
    if (!storeId) {
      setStoreInventoryMap(new Map())
      return
    }

    setStoreInventoryLoading(true)
    try {
      const { data, error: fetchError } = await supabaseFetch<StoreInventory>('store_inventory', {
        select: '*',
        filter: { store_id: `eq.${storeId}` },
      })

      if (fetchError) throw fetchError

      const map = new Map<string, StoreInventory>()
      for (const si of data || []) {
        map.set(si.inventory_item_id, si)
      }
      setStoreInventoryMap(map)
    } catch (err) {
      console.error('Failed to fetch store inventory:', err)
      toast.error('Failed to load inventory quantities')
    } finally {
      setStoreInventoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentStoreId) {
      fetchStoreInventory(currentStoreId)
    } else {
      setStoreInventoryMap(new Map())
    }
  }, [currentStoreId, fetchStoreInventory])

  // Sync search input when URL changes
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  // Debounce search updates to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilter('search', searchInput)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.search, setFilter])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Filter and enrich items with quantities
  const inventoryWithQuantities = useMemo((): InventoryWithQuantity[] => {
    return items
      .filter((item) => {
        if (!item.is_active) return false
        if (currentStoreId && !storeInventoryMap.has(item.id)) return false
        const matchesSearch = filters.search
          ? item.name.toLowerCase().includes(filters.search.toLowerCase())
          : true
        const matchesCategory = filters.category && filters.category !== 'all'
          ? item.category === filters.category
          : true
        return matchesSearch && matchesCategory
      })
      .map((item) => {
        const storeInv = storeInventoryMap.get(item.id)
        const pending = pendingChanges.get(item.id)
        return {
          ...item,
          quantity: pending?.quantity ?? storeInv?.quantity ?? 0,
          par_level: pending?.par_level !== undefined ? pending.par_level : (storeInv?.par_level ?? null),
          unit_cost: pending?.unit_cost ?? Number(storeInv?.unit_cost ?? 0),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, filters, currentStoreId, storeInventoryMap, pendingChanges])

  // Get unique categories from current store's inventory
  const existingCategories = useMemo(() => {
    const categories = inventoryWithQuantities.map(item => item.category).filter((c): c is string => c !== null && c !== undefined)
    return [...new Set(categories)].sort()
  }, [inventoryWithQuantities])

  // Count pending changes
  const pendingCount = pendingChanges.size
  const totalFieldChanges = useMemo(() => {
    let count = 0
    for (const change of pendingChanges.values()) {
      if (change.quantity !== undefined && change.quantity !== change.originalQuantity) count++
      if (change.par_level !== undefined && change.par_level !== change.originalPar) count++
      if (change.unit_cost !== undefined && change.unit_cost !== change.originalCost) count++
    }
    return count
  }, [pendingChanges])

  // Check if a specific item has pending changes
  const hasItemChange = useCallback((itemId: string) => {
    return pendingChanges.has(itemId)
  }, [pendingChanges])

  // Selection handlers
  const allSelected = inventoryWithQuantities.length > 0 && selectedIds.size === inventoryWithQuantities.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < inventoryWithQuantities.length

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(inventoryWithQuantities.map(item => item.id)))
    }
  }, [allSelected, inventoryWithQuantities])

  const handleSelectItem = useCallback((itemId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }, [])

  // Start editing a cell
  const startEdit = useCallback((itemId: string, field: 'stock' | 'par' | 'cost', currentValue: number | null) => {
    if (field === 'cost') {
      setEditingValue(currentValue && currentValue > 0 ? currentValue.toFixed(2) : '')
    } else if (field === 'par') {
      setEditingValue(currentValue !== null ? String(currentValue) : '')
    } else {
      setEditingValue(String(currentValue ?? 0))
    }
    setEditingCell({ itemId, field })
  }, [])

  // Commit the current inline edit to pending changes
  const commitEdit = useCallback(() => {
    if (!editingCell) return

    const { itemId, field } = editingCell
    const storeInv = storeInventoryMap.get(itemId)
    const originalQuantity = storeInv?.quantity ?? 0
    const originalPar = storeInv?.par_level ?? null
    const originalCost = Number(storeInv?.unit_cost ?? 0)

    const existing = pendingChanges.get(itemId) || {
      originalQuantity,
      originalPar,
      originalCost,
    }

    let newChange: PendingChange | null = null

    if (field === 'stock') {
      const parsed = parseInt(editingValue)
      if (!isNaN(parsed) && parsed >= 0 && parsed !== originalQuantity) {
        newChange = { ...existing, quantity: parsed }
      } else if (parsed === originalQuantity) {
        // Value reverted to original - remove this field from pending
        newChange = { ...existing }
        delete newChange.quantity
      }
    } else if (field === 'par') {
      const parsed = editingValue === '' ? null : parseInt(editingValue)
      if (parsed === null || (!isNaN(parsed) && parsed >= 0)) {
        if (parsed !== originalPar) {
          newChange = { ...existing, par_level: parsed }
        } else {
          newChange = { ...existing }
          delete newChange.par_level
        }
      }
    } else if (field === 'cost') {
      const parsed = parseFloat(editingValue)
      if (!isNaN(parsed) && parsed >= 0 && parsed !== originalCost) {
        newChange = { ...existing, unit_cost: parsed }
      } else if (parsed === originalCost) {
        newChange = { ...existing }
        delete newChange.unit_cost
      }
    }

    if (newChange) {
      // Check if the change actually has any real changes
      const hasRealChanges =
        (newChange.quantity !== undefined && newChange.quantity !== newChange.originalQuantity) ||
        (newChange.par_level !== undefined && newChange.par_level !== newChange.originalPar) ||
        (newChange.unit_cost !== undefined && newChange.unit_cost !== newChange.originalCost)

      setPendingChanges(prev => {
        const next = new Map(prev)
        if (hasRealChanges) {
          next.set(itemId, newChange)
        } else {
          next.delete(itemId)
        }
        return next
      })
    }

    setEditingCell(null)
  }, [editingCell, editingValue, storeInventoryMap, pendingChanges])

  // Handle keyboard in inline edit
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }, [commitEdit])

  // Save all pending changes via batch API
  const handleSaveAll = useCallback(async () => {
    if (!currentStoreId || pendingChanges.size === 0) return

    setIsSavingBatch(true)
    try {
      const updates = Array.from(pendingChanges.entries()).map(([itemId, change]) => {
        const update: Record<string, unknown> = { itemId }
        if (change.quantity !== undefined) update.quantity = change.quantity
        if (change.par_level !== undefined) update.par_level = change.par_level
        if (change.unit_cost !== undefined) update.unit_cost = change.unit_cost
        return update
      })

      const response = await csrfFetch(`/api/stores/${currentStoreId}/inventory/batch`, {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to save changes')
      }

      const result = await response.json()
      toast.success(`Saved ${result.data?.changes || totalFieldChanges} changes across ${pendingCount} items`)
      setPendingChanges(new Map())
      fetchStoreInventory(currentStoreId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSavingBatch(false)
    }
  }, [currentStoreId, pendingChanges, totalFieldChanges, pendingCount, csrfFetch, fetchStoreInventory])

  // Discard all pending changes
  const handleDiscardAll = useCallback(() => {
    setPendingChanges(new Map())
    setEditingCell(null)
  }, [])

  const handleSubmit = async (data: InventoryItemFormData, options?: { costPerUnit?: number }) => {
    setIsSubmitting(true)
    try {
      let itemId: string | undefined

      if (editItem) {
        await updateItem({ id: editItem.id, data })
        itemId = editItem.id
      } else {
        const createdItem = await createItem(data)
        itemId = createdItem?.id
      }

      // Set cost via PATCH API if provided
      if (options?.costPerUnit !== undefined && itemId && currentStoreId) {
        try {
          await csrfFetch(`/api/stores/${currentStoreId}/inventory/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify({ unit_cost: options.costPerUnit }),
          })
          fetchStoreInventory(currentStoreId)
        } catch {
          toast.error('Item saved but failed to set cost')
        }
      }

      setFormOpen(false)
      setEditItem(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditItem(item)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteItemState || !currentStoreId) return
    try {
      const response = await csrfFetch(`/api/stores/${currentStoreId}/inventory/${deleteItemState.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete item')
      }
      const result = await response.json()
      toast.success('Item deleted')

      // If setup was reset (all inventory gone), refresh auth so sidebar locks
      if (result.data?.setupReset) {
        await refreshProfile()
      }

      refetchItems()
      fetchStoreInventory(currentStoreId)
      // Remove from pending changes if exists
      setPendingChanges(prev => {
        const next = new Map(prev)
        next.delete(deleteItemState.id)
        return next
      })
    } catch {
      toast.error('Failed to delete item')
    } finally {
      setDeleteItemState(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!currentStoreId) return
    try {
      const response = await csrfFetch(`/api/stores/${currentStoreId}/inventory/batch`, {
        method: 'DELETE',
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to delete items')
      }

      const result = await response.json()
      const deletedCount = result.data?.deleted ?? selectedIds.size
      toast.success(`Deleted ${deletedCount} item${deletedCount !== 1 ? 's' : ''}`)

      // If setup was reset (all inventory gone), refresh auth so sidebar locks
      if (result.data?.setupReset) {
        await refreshProfile()
      }

      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      refetchItems()
      fetchStoreInventory(currentStoreId)
      // Clear pending changes for deleted items
      setPendingChanges(prev => {
        const next = new Map(prev)
        for (const id of selectedIds) next.delete(id)
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete items')
    }
  }

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleExport = () => {
    const columns = [
      { key: 'name', header: 'Item Name' },
      { key: 'category', header: 'Category', transform: (v: unknown) => String(v || '') },
      { key: 'quantity', header: 'Current Stock' },
      { key: 'par_level', header: 'Minimum Stock Level', transform: (v: unknown) => v ? String(v) : '' },
      { key: 'unit_cost', header: 'Unit Cost (£)', transform: (v: unknown) => Number(v) > 0 ? Number(v).toFixed(2) : '' },
    ]
    exportToCSV(inventoryWithQuantities, columns, generateExportFilename('inventory'))
    toast.success(`Exported ${inventoryWithQuantities.length} items`)
  }

  const handleCSVImportSuccess = () => {
    setCsvImportOpen(false)
    refetchItems()
    if (currentStoreId) fetchStoreInventory(currentStoreId)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-destructive">Error loading inventory. Please try again.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <InventoryTableSkeleton />
      </div>
    )
  }

  if (!currentStore) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Please select a store from the sidebar to view inventory.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your store&apos;s items and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card">
                <MoreVertical className="h-4 w-4 mr-2" />
                More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCsvImportOpen(true)}>
                <FileUp className="mr-2 h-4 w-4" />
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport} disabled={inventoryWithQuantities.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
          <PageGuide pageKey="inventory" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilter('category', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 bg-card">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {existingCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 bg-card rounded-lg border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      {storeInventoryLoading ? (
        <InventoryTableSkeleton />
      ) : inventoryWithQuantities.length === 0 ? (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium mb-1">No items found</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              {filters.search || filters.category
                ? 'Try adjusting your search or filters'
                : 'Get started by adding items individually or import multiple items at once from a CSV file'}
            </p>
            {!filters.search && !filters.category && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add item
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCsvImportOpen(true)}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    data-indeterminate={someSelected ? true : undefined}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right w-[100px]">In Stock</TableHead>
                <TableHead className="text-right w-[100px]">PAR</TableHead>
                <TableHead className="text-right w-[100px]">Unit Cost</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryWithQuantities.map((item) => {
                const isLow = item.par_level !== null && item.quantity > 0 && item.quantity < item.par_level
                const isNoStock = item.quantity === 0
                const isPending = hasItemChange(item.id)
                const isEditingThis = editingCell?.itemId === item.id

                return (
                  <TableRow
                    key={item.id}
                    className={
                      selectedIds.has(item.id)
                        ? 'bg-primary/5'
                        : isPending
                          ? 'bg-amber-50/50 dark:bg-amber-950/10'
                          : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0 flex items-center gap-2">
                        <div>
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          {item.category && (
                            <p className="text-xs text-muted-foreground truncate">{item.category}</p>
                          )}
                        </div>
                        {isPending && (
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
                        )}
                      </div>
                    </TableCell>

                    {/* In Stock */}
                    <TableCell className="text-right">
                      {isEditingThis && editingCell.field === 'stock' ? (
                        <Input
                          ref={inputRef}
                          type="number"
                          min="0"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={commitEdit}
                          className="h-7 w-16 text-right text-sm ml-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(item.id, 'stock', item.quantity)}
                          className="flex items-center justify-end gap-1.5 w-full cursor-pointer hover:underline"
                        >
                          {isNoStock && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              No Stock
                            </Badge>
                          )}
                          {isLow && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Low
                            </Badge>
                          )}
                          <span className={isLow ? 'text-destructive font-medium' : isNoStock ? 'text-muted-foreground' : ''}>
                            {item.quantity}
                          </span>
                        </button>
                      )}
                    </TableCell>

                    {/* PAR */}
                    <TableCell className="text-right">
                      {isEditingThis && editingCell.field === 'par' ? (
                        <Input
                          ref={inputRef}
                          type="number"
                          min="0"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={commitEdit}
                          className="h-7 w-16 text-right text-sm ml-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : item.par_level !== null ? (
                        <button
                          onClick={() => startEdit(item.id, 'par', item.par_level)}
                          className="text-sm hover:underline cursor-pointer"
                        >
                          {item.par_level}
                        </button>
                      ) : (
                        <button onClick={() => startEdit(item.id, 'par', null)}>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted">
                            Set
                          </Badge>
                        </button>
                      )}
                    </TableCell>

                    {/* Unit Cost */}
                    <TableCell className="text-right">
                      {isEditingThis && editingCell.field === 'cost' ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-muted-foreground">£</span>
                          <Input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={commitEdit}
                            className="h-7 w-16 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      ) : item.unit_cost > 0 ? (
                        <button
                          onClick={() => startEdit(item.id, 'cost', item.unit_cost)}
                          className="text-sm hover:underline cursor-pointer"
                        >
                          £{item.unit_cost.toFixed(2)}
                        </button>
                      ) : (
                        <button onClick={() => startEdit(item.id, 'cost', 0)}>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50">
                            Set
                          </Badge>
                        </button>
                      )}
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteItemState(item)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Item count */}
      <p className="text-sm text-muted-foreground">
        {inventoryWithQuantities.length} item{inventoryWithQuantities.length !== 1 ? 's' : ''}
      </p>

      {/* Floating Save Bar */}
      {pendingCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 print:hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-card border rounded-xl shadow-lg max-w-[calc(100vw-2rem)]">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium">
              {totalFieldChanges} unsaved change{totalFieldChanges !== 1 ? 's' : ''} across {pendingCount} item{pendingCount !== 1 ? 's' : ''}
            </span>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscardAll}
              disabled={isSavingBatch}
              className="h-8"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={isSavingBatch}
              className="h-8"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSavingBatch ? 'Saving...' : 'Save All'}
            </Button>
          </div>
        </div>
      )}

      {/* Forms and Dialogs */}
      <InventoryItemForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditItem(null)
        }}
        item={editItem}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        existingCategories={existingCategories}
        currentCost={editItem ? (storeInventoryMap.get(editItem.id)?.unit_cost ?? null) : null}
      />

      <ConfirmDialog
        open={!!deleteItemState}
        onOpenChange={() => setDeleteItemState(null)}
        title="Delete item"
        description={`Are you sure you want to delete "${deleteItemState?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete items"
        description={`Are you sure you want to delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />

      <Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from CSV</DialogTitle>
          </DialogHeader>
          {currentStoreId && (
            <CSVImport
              storeId={currentStoreId}
              onSuccess={handleCSVImportSuccess}
              showCard={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <InventoryTableSkeleton />
      </div>
    }>
      <InventoryPageContent />
    </Suspense>
  )
}
