'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { StatsCard } from '@/components/cards/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpDown,
  Printer,
} from 'lucide-react'
import { format } from 'date-fns'

type SortField = 'name' | 'quantity' | 'unit_cost' | 'total_value'
type SortDir = 'asc' | 'desc'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function InventoryValuePage() {
  const { storeId, currentStore, role } = useAuth()
  const { inventory, isLoading } = useStoreInventory(storeId)

  const [sortField, setSortField] = useState<SortField>('total_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Compute valuation data
  const valuationData = useMemo(() => {
    if (!inventory) return { items: [], total: 0, byCategory: [], topItems: [], zeroValueCount: 0 }

    const items = inventory.map(item => ({
      id: item.inventory_item_id,
      name: item.inventory_item?.name || 'Unknown',
      category: item.inventory_item?.category || 'Uncategorized',
      unit: item.inventory_item?.unit_of_measure || 'units',
      quantity: item.quantity,
      unit_cost: item.unit_cost || 0,
      total_value: item.quantity * (item.unit_cost || 0),
    }))

    const total = items.reduce((sum, i) => sum + i.total_value, 0)
    const zeroValueCount = items.filter(i => i.unit_cost === 0 && i.quantity > 0).length

    // Group by category
    const categoryMap = new Map<string, { count: number; value: number }>()
    for (const item of items) {
      const existing = categoryMap.get(item.category) || { count: 0, value: 0 }
      existing.count++
      existing.value += item.total_value
      categoryMap.set(item.category, existing)
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data, percentage: total > 0 ? (data.value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)

    // Sort items
    const sorted = [...items].sort((a, b) => {
      const multiplier = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name': return multiplier * a.name.localeCompare(b.name)
        case 'quantity': return multiplier * (a.quantity - b.quantity)
        case 'unit_cost': return multiplier * (a.unit_cost - b.unit_cost)
        case 'total_value': return multiplier * (a.total_value - b.total_value)
        default: return 0
      }
    })

    return { items: sorted, total, byCategory, topItems: items.sort((a, b) => b.total_value - a.total_value).slice(0, 5), zeroValueCount }
  }, [inventory, sortField, sortDir])

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">Only Owners and Managers can view inventory valuation.</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Select a store from the sidebar to view inventory valuation.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Inventory Valuation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStore?.store?.name} &middot; {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Inventory Value"
          value={formatCurrency(valuationData.total)}
          description="Current stock valuation"
          icon={<DollarSign className="h-4 w-4" />}
          variant="default"
        />
        <StatsCard
          title="Total Items"
          value={valuationData.items.length}
          description="Tracked inventory items"
          icon={<Package className="h-4 w-4" />}
        />
        <StatsCard
          title="Categories"
          value={valuationData.byCategory.length}
          description="Item categories"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        {valuationData.zeroValueCount > 0 && (
          <StatsCard
            title="Missing Cost"
            value={valuationData.zeroValueCount}
            description="Items with no unit cost"
            icon={<AlertTriangle className="h-4 w-4" />}
            variant="warning"
          />
        )}
      </div>

      {/* Value by Category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Value by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {valuationData.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No categories found</p>
          ) : (
            <div className="space-y-3">
              {valuationData.byCategory.map(cat => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.category}</span>
                      <Badge variant="secondary" className="text-xs">{cat.count} items</Badge>
                    </div>
                    <span className="text-sm font-semibold font-mono">{formatCurrency(cat.value)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.max(cat.percentage, 1)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.percentage.toFixed(1)}% of total</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Item Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All Items</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {valuationData.items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category} &middot; {item.quantity} {item.unit}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm font-mono">{formatCurrencyPrecise(item.total_value)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrencyPrecise(item.unit_cost)}/ea</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                      Item <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort('quantity')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                      Qty <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort('unit_cost')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                      Unit Cost <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button onClick={() => toggleSort('total_value')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                      Total Value <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuationData.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.quantity} {item.unit}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrencyPrecise(item.unit_cost)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatCurrencyPrecise(item.total_value)}</TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4} className="text-right">Total Inventory Value</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrencyPrecise(valuationData.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
