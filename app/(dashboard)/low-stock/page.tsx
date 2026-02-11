'use client'

import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLowStockReport } from '@/hooks/useReports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/cards/StatsCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  XCircle,
  Package,
  TrendingDown,
  Printer,
} from 'lucide-react'
import { format } from 'date-fns'

export default function LowStockPage() {
  const { storeId, currentStore } = useAuth()
  const { data: allLowStockItems, isLoading } = useLowStockReport()

  const lowStockItems = useMemo(() => {
    if (!storeId) return allLowStockItems ?? []
    return (allLowStockItems ?? []).filter(item => item.store_id === storeId)
  }, [allLowStockItems, storeId])

  const criticalItems = useMemo(() =>
    lowStockItems.filter(item => item.current_quantity === 0),
    [lowStockItems]
  )

  const warningItems = useMemo(() =>
    lowStockItems.filter(item => item.current_quantity > 0),
    [lowStockItems]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Please select a store from the sidebar.</p>
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
            <AlertTriangle className="h-6 w-6" />
            Low Stock
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStore?.store?.name} &middot; {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Low Stock"
          value={lowStockItems.length}
          description="Items below PAR level"
          icon={<TrendingDown className="h-4 w-4" />}
          variant={lowStockItems.length > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="Out of Stock"
          value={criticalItems.length}
          description="Need immediate restock"
          icon={<XCircle className="h-4 w-4" />}
          variant={criticalItems.length > 0 ? 'danger' : 'default'}
        />
        <StatsCard
          title="Running Low"
          value={warningItems.length}
          description="Below PAR but available"
          icon={<Package className="h-4 w-4" />}
          variant={warningItems.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Items */}
      {lowStockItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-green-500/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">All Stocked Up!</h2>
            <p className="text-sm text-muted-foreground">Every item is above its PAR level. Nice work.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Critical items (out of stock) */}
          {criticalItems.length > 0 && (
            <Card className="border-red-500/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base">Out of Stock ({criticalItems.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {criticalItems.map((item) => (
                    <div key={item.inventory_item_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.item_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">0 / {item.par_level}</Badge>
                        <p className="text-xs text-red-600 mt-1">Need {item.par_level}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">PAR Level</TableHead>
                        <TableHead className="text-right">Shortage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criticalItems.map((item) => (
                        <TableRow key={item.inventory_item_id} className="bg-red-50/50">
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            <Badge variant="destructive">0</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{item.par_level}</TableCell>
                          <TableCell className="text-right font-mono text-red-600 font-semibold">
                            {item.shortage}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning items (low but not zero) */}
          {warningItems.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-base">Running Low ({warningItems.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {warningItems.map((item) => (
                    <div key={item.inventory_item_id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.item_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                          {item.current_quantity} / {item.par_level}
                        </Badge>
                        <p className="text-xs text-yellow-600 mt-1">
                          Need {item.shortage} more
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">PAR Level</TableHead>
                        <TableHead className="text-right">Shortage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warningItems.map((item) => (
                        <TableRow key={item.inventory_item_id} className="bg-yellow-50/30">
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                              {item.current_quantity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{item.par_level}</TableCell>
                          <TableCell className="text-right font-mono text-yellow-700 font-semibold">
                            {item.shortage}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
