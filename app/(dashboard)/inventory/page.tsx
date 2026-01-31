'use client'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useInventory } from '@/hooks/useInventory'
import { useStores } from '@/hooks/useStores'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { InventoryTable } from '@/components/tables/InventoryTable'
import { InventoryItemForm } from '@/components/forms/InventoryItemForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeaderSkeleton, InventoryTableSkeleton } from '@/components/ui/skeletons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InventoryItem, StoreInventory } from '@/types'
import { InventoryItemFormData } from '@/lib/validations/inventory'
import { INVENTORY_CATEGORIES } from '@/lib/constants'
import { Plus, Search, Upload, Download, Store } from 'lucide-react'
import { toast } from 'sonner'
import { exportToCSV, generateExportFilename } from '@/lib/export'
import { supabaseFetch } from '@/lib/supabase/client'

const FILTER_DEFAULTS = {
  search: '',
  category: '',
  store: '',
}

function InventoryPageContent() {
  const { items, isLoading, error, createItem, updateItem, deleteItem } = useInventory()
  const { stores, isLoading: storesLoading } = useStores({ status: 'active' })

  // URL-based filter state
  const { filters, setFilter } = useUrlFilters({ defaults: FILTER_DEFAULTS })

  // Local search input for immediate feedback
  const [searchInput, setSearchInput] = useState(filters.search)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Store inventory items (items assigned to selected store)
  const [storeInventoryItems, setStoreInventoryItems] = useState<Set<string>>(new Set())
  const [storeInventoryLoading, setStoreInventoryLoading] = useState(false)

  // Fetch store inventory when store filter changes
  const fetchStoreInventory = useCallback(async (storeId: string) => {
    if (!storeId) {
      setStoreInventoryItems(new Set())
      return
    }

    setStoreInventoryLoading(true)
    try {
      const { data, error: fetchError } = await supabaseFetch<StoreInventory>('store_inventory', {
        select: 'inventory_item_id',
        filter: { store_id: `eq.${storeId}` },
      })

      if (fetchError) throw fetchError

      // Create a set of inventory item IDs that belong to this store
      const itemIds = new Set((data || []).map(si => si.inventory_item_id))
      setStoreInventoryItems(itemIds)
    } catch (err) {
      console.error('Failed to fetch store inventory:', err)
      toast.error('Failed to load store inventory')
    } finally {
      setStoreInventoryLoading(false)
    }
  }, [])

  // Fetch store inventory when store filter changes
  useEffect(() => {
    if (filters.store && filters.store !== 'all') {
      fetchStoreInventory(filters.store)
    } else {
      setStoreInventoryItems(new Set())
    }
  }, [filters.store, fetchStoreInventory])

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

  const filteredItems = items.filter((item) => {
    const matchesSearch = filters.search
      ? item.name.toLowerCase().includes(filters.search.toLowerCase())
      : true

    const matchesCategory = filters.category && filters.category !== 'all'
      ? item.category === filters.category
      : true

    // Filter by store if a store is selected
    const matchesStore = filters.store && filters.store !== 'all'
      ? storeInventoryItems.has(item.id)
      : true

    return matchesSearch && matchesCategory && matchesStore
  })

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

  const handleDelete = (item: InventoryItem) => {
    deleteItem(item.id)
  }

  const handleExport = () => {
    const columns = [
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category', transform: (v: unknown) => String(v || '') },
      { key: 'unit_of_measure', header: 'Unit of Measure' },
      { key: 'is_active', header: 'Status', transform: (v: unknown) => v ? 'Active' : 'Inactive' },
    ]

    const dataToExport = filteredItems.length > 0 ? filteredItems : items
    exportToCSV(dataToExport, columns, generateExportFilename('inventory'))
    toast.success(`Exported ${dataToExport.length} items`)
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const toastId = toast.loading(`Importing ${file.name}...`)

    try {
      // Dynamic import to reduce bundle size
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
        Name?: string
        name?: string
        Category?: string
        category?: string
        Unit?: string
        unit?: string
        'Unit of Measure'?: string
      }>

      let successCount = 0
      let errorCount = 0

      for (const row of jsonData) {
        const name = row.Name || row.name
        const category = row.Category || row.category
        const unit = row.Unit || row.unit || row['Unit of Measure']

        if (name && unit) {
          try {
            await createItem({
              name: String(name),
              category: category ? String(category) : undefined,
              unit_of_measure: String(unit),
              is_active: true,
            })
            successCount++
          } catch {
            errorCount++
          }
        } else {
          errorCount++
        }
      }

      toast.success(`Imported ${successCount} items${errorCount > 0 ? `, ${errorCount} failed` : ''}`, { id: toastId })
    } catch (err) {
      toast.error('Failed to import file: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-red-500">
            Error loading inventory. Please try again.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading || storesLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <InventoryTableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-muted-foreground">
            Manage your master inventory list
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Import
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.store || 'all'}
          onValueChange={(value) => setFilter('store', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <Store className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => setFilter('category', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {INVENTORY_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show indicator when filtering by store */}
      {filters.store && filters.store !== 'all' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" />
          <span>
            Showing {storeInventoryLoading ? '...' : filteredItems.length} items assigned to{' '}
            <span className="font-medium text-foreground">
              {stores.find(s => s.id === filters.store)?.name || 'selected store'}
            </span>
          </span>
        </div>
      )}

      <InventoryTable
        items={filteredItems}
        onAdd={() => setFormOpen(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <InventoryItemForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditItem(null)
        }}
        item={editItem}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <InventoryTableSkeleton rows={8} />
      </div>
    }>
      <InventoryPageContent />
    </Suspense>
  )
}
