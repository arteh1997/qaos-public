'use client'

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react'
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { InventoryItem, StoreInventory } from '@/types'
import { InventoryItemFormData } from '@/lib/validations/inventory'
import { Plus, Search, Download, MoreVertical, MoreHorizontal, Edit, Trash2, Package, X, FileUp, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV, generateExportFilename } from '@/lib/export'
import { supabaseFetch } from '@/lib/supabase/client'

const FILTER_DEFAULTS = {
  search: '',
  category: '',
}

// Skeleton for Shopify-style table
function InventoryTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(8)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
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
}

function InventoryPageContent() {
  const { currentStore } = useAuth()
  const currentStoreId = currentStore?.store_id
  const { items, isLoading, error, createItem, updateItem, deleteItem } = useInventory()

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

  // Filter and enrich items with quantities
  const inventoryWithQuantities = useMemo((): InventoryWithQuantity[] => {
    return items
      .filter((item) => {
        // Only show items that are in this store's inventory
        if (currentStoreId && !storeInventoryMap.has(item.id)) {
          return false
        }

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
        return {
          ...item,
          quantity: storeInv?.quantity ?? 0,
          par_level: storeInv?.par_level ?? null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, filters, currentStoreId, storeInventoryMap])

  // Get unique categories from current store's inventory
  const existingCategories = useMemo(() => {
    const categories = inventoryWithQuantities.map(item => item.category).filter((c): c is string => c !== null && c !== undefined)
    return [...new Set(categories)].sort()
  }, [inventoryWithQuantities])

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
      if (checked) {
        next.add(itemId)
      } else {
        next.delete(itemId)
      }
      return next
    })
  }, [])

  const handleSubmit = async (data: InventoryItemFormData) => {
    setIsSubmitting(true)
    try {
      if (editItem) {
        await updateItem({ id: editItem.id, data })
      } else {
        await createItem(data)
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

  const handleDelete = () => {
    if (deleteItemState) {
      deleteItem(deleteItemState.id)
      setDeleteItemState(null)
    }
  }

  const handleBulkDelete = async () => {
    const itemsToDelete = Array.from(selectedIds)
    let successCount = 0

    for (const id of itemsToDelete) {
      try {
        await deleteItem(id)
        successCount++
      } catch {
        // Continue with remaining items
      }
    }

    toast.success(`Deleted ${successCount} item${successCount !== 1 ? 's' : ''}`)
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
  }

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleExport = () => {
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category', transform: (v: unknown) => String(v || '') },
      { key: 'unit_of_measure', header: 'Unit' },
      { key: 'quantity', header: 'On Hand' },
      { key: 'par_level', header: 'PAR Level', transform: (v: unknown) => v ? String(v) : '' },
    ]

    exportToCSV(inventoryWithQuantities, columns, generateExportFilename('inventory'))
    toast.success(`Exported ${inventoryWithQuantities.length} items`)
  }

  const handleCSVImportSuccess = () => {
    setCsvImportOpen(false)
    // Inventory will auto-refresh via useInventory hook
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-red-500">Error loading inventory. Please try again.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
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
    )
  }

  if (!currentStore) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground">Please select a store from the sidebar to view inventory.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white">
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
            className="pl-9 h-9 bg-white"
          />
        </div>
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilter('category', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-44 h-9 bg-white">
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
        <div className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border shadow-sm">
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
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
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
        <div className="rounded-lg border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="w-[40px] h-12 bg-white">
                  <Checkbox
                    checked={allSelected}
                    data-indeterminate={someSelected ? true : undefined}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="h-12 font-semibold bg-white">Item</TableHead>
                <TableHead className="hidden md:table-cell h-12 font-semibold bg-white">Category</TableHead>
                <TableHead className="text-right w-[100px] h-12 font-semibold bg-white">On hand</TableHead>
                <TableHead className="text-right w-[100px] h-12 font-semibold bg-white">PAR level</TableHead>
                <TableHead className="w-[50px] h-12 bg-white"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryWithQuantities.map((item) => {
                const isLowStock = item.par_level !== null && item.quantity < item.par_level
                return (
                  <TableRow
                    key={item.id}
                    className={selectedIds.has(item.id) ? 'bg-blue-50' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/* Item thumbnail placeholder */}
                        <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.unit_of_measure}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.category || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isLowStock && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Low
                          </Badge>
                        )}
                        <span className={isLowStock ? 'text-red-600 font-medium' : ''}>
                          {item.quantity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.par_level ?? '—'}
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
                            className="text-red-600"
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

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete items"
        description={`Are you sure you want to delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />

      {/* CSV Import Dialog */}
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
