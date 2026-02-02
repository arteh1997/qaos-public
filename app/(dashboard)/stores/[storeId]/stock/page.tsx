'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { useAuth } from '@/hooks/useAuth'
import { StockTable } from '@/components/tables/StockTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Download } from 'lucide-react'
import { StoreInventory } from '@/types'
import { exportToCSV, generateExportFilename } from '@/lib/export'
import { toast } from 'sonner'

interface StockPageProps {
  params: Promise<{ storeId: string }>
}

export default function StockPage({ params }: StockPageProps) {
  const { storeId } = use(params)
  const { role, canManageCurrentStore } = useAuth()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { inventory, isLoading: inventoryLoading, setParLevel } = useStoreInventory(storeId)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const isLoading = storeLoading || inventoryLoading
  // Owner and Manager can manage (canManageCurrentStore uses store context)
  const canManage = canManageCurrentStore || role === 'Owner' || role === 'Manager'

  // Get unique categories from actual inventory data
  const categories = useMemo(() => {
    const cats = new Set<string>()
    inventory.forEach(item => {
      if (item.inventory_item?.category) {
        cats.add(item.inventory_item.category)
      }
    })
    return Array.from(cats).sort()
  }, [inventory])

  const handleUpdateParLevel = (item: StoreInventory, parLevel: number) => {
    // Fire and forget - don't wait for response since Supabase may hang
    setParLevel({
      inventoryItemId: item.inventory_item_id,
      parLevel,
    }).catch(() => {
      toast.error('Failed to update PAR level')
    })
  }

  const handleExport = () => {
    if (inventory.length === 0) {
      toast.info('No stock data to export')
      return
    }

    // Filter by category if needed
    const dataToExport = categoryFilter === 'all'
      ? inventory
      : inventory.filter(item => item.inventory_item?.category === categoryFilter)

    const columns = [
      { key: 'inventory_item.name', header: 'Item' },
      { key: 'inventory_item.category', header: 'Category', transform: (v: unknown) => String(v || '') },
      { key: 'inventory_item.unit_of_measure', header: 'Unit' },
      { key: 'quantity', header: 'Current Quantity' },
      { key: 'par_level', header: 'PAR Level', transform: (v: unknown) => v != null ? String(v) : '' },
      {
        key: 'quantity',
        header: 'Status',
        transform: (v: unknown, row: StoreInventory) => {
          const qty = v as number
          const par = row.par_level
          if (!par) return 'No PAR set'
          if (qty < par) return 'Low Stock'
          return 'OK'
        }
      },
    ]

    const storeName = store?.name?.replace(/\s+/g, '-').toLowerCase() || 'store'
    exportToCSV(dataToExport, columns, generateExportFilename(`${storeName}-stock`))
    toast.success(`Exported ${dataToExport.length} items`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href={`/stores/${storeId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Levels</h1>
          <p className="text-sm text-muted-foreground">{store.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto sm:ml-0">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      <StockTable
        inventory={inventory}
        categoryFilter={categoryFilter === 'all' ? undefined : categoryFilter}
        canEditParLevel={canManage}
        onUpdateParLevel={canManage ? handleUpdateParLevel : undefined}
      />
    </div>
  )
}
