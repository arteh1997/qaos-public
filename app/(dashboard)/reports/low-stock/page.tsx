'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useStores } from '@/hooks/useStores'
import { useLowStockReport } from '@/hooks/useReports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, AlertTriangle, Download, ArrowUp, ArrowDown } from 'lucide-react'
import { exportToCSV, generateExportFilename } from '@/lib/export'
import { toast } from 'sonner'
import { LowStockItem } from '@/types'

// Sort configuration
type SortKey = 'item' | 'current' | 'par' | 'shortage'
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

interface LowStockTableProps {
  items: LowStockItem[]
  storeId: string
}

function LowStockTable({ items, storeId }: LowStockTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items

    return [...items].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'item':
          aVal = a.item_name.toLowerCase()
          bVal = b.item_name.toLowerCase()
          break
        case 'current':
          aVal = a.current_quantity
          bVal = b.current_quantity
          break
        case 'par':
          aVal = a.par_level
          bVal = b.par_level
          break
        case 'shortage':
          aVal = a.shortage
          bVal = b.shortage
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

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedItems.map((item) => (
          <div key={`${storeId}-${item.inventory_item_id}`} className="border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{item.item_name}</p>
              <Badge variant="destructive" className="text-xs flex-shrink-0">
                -{item.shortage.toFixed(1)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Current</div>
                <div className="text-lg font-bold text-red-600">{item.current_quantity}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">PAR Level</div>
                <div className="text-lg font-bold text-muted-foreground">{item.par_level}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border">
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
                label="Current"
                sortKey="current"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="PAR Level"
                sortKey="par"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="Shortage"
                sortKey="shortage"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={`${storeId}-${item.inventory_item_id}`}>
                <TableCell className="font-medium">
                  {item.item_name}
                </TableCell>
                <TableCell className="text-right text-red-600 font-medium">
                  {item.current_quantity}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.par_level}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">
                    -{item.shortage.toFixed(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function LowStockPageContent() {
  const searchParams = useSearchParams()
  const storeParam = searchParams.get('store')
  const [selectedStore, setSelectedStore] = useState<string>(storeParam || '')
  const { stores, isLoading: storesLoading } = useStores()
  const { data: lowStockItems, isLoading: reportLoading } = useLowStockReport()

  // Update selected store when URL param changes
  useEffect(() => {
    if (storeParam) {
      setSelectedStore(storeParam)
    }
  }, [storeParam])

  const isLoading = storesLoading || reportLoading

  // Filter by selected store
  const filteredItems = selectedStore && selectedStore !== 'all'
    ? (lowStockItems ?? []).filter(item => item.store_id === selectedStore)
    : lowStockItems ?? []

  const handleExport = () => {
    if (filteredItems.length === 0) {
      toast.info('No items to export')
      return
    }

    const columns = [
      { key: 'store_name' as const, header: 'Store' },
      { key: 'item_name' as const, header: 'Item' },
      { key: 'current_quantity' as const, header: 'Current Quantity' },
      { key: 'par_level' as const, header: 'PAR Level' },
      { key: 'shortage' as const, header: 'Shortage' },
    ]

    exportToCSV(filteredItems, columns, generateExportFilename('low-stock-report'))
    toast.success(`Exported ${filteredItems.length} items`)
  }

  // Group by store
  const itemsByStore = filteredItems.reduce((acc, item) => {
    if (!acc[item.store_id]) {
      acc[item.store_id] = {
        store_name: item.store_name,
        items: [],
      }
    }
    acc[item.store_id].items.push(item)
    return acc
  }, {} as Record<string, { store_name: string; items: typeof filteredItems }>)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Low Stock Report</h1>
          <p className="text-sm text-muted-foreground">
            Items below their PAR level
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores
              .filter(s => s.is_active)
              .map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Badge variant={filteredItems.length > 0 ? 'destructive' : 'secondary'}>
          {filteredItems.length} low stock items
        </Badge>

        {filteredItems.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto sm:ml-0">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Stock Levels OK</h3>
            <p className="text-muted-foreground">
              No items are currently below their PAR level
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(itemsByStore).map(([storeId, { store_name, items }]) => (
            <Card key={storeId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{store_name}</span>
                  <Badge variant="destructive">{items.length} items</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LowStockTable items={items} storeId={storeId} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LowStockPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    }>
      <LowStockPageContent />
    </Suspense>
  )
}
