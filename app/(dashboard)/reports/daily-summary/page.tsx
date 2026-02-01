'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useStores } from '@/hooks/useStores'
import { useStockHistoryRange } from '@/hooks/useReports'
import { DateRange } from 'react-day-picker'
import { StockHistoryTable } from '@/components/tables/StockHistoryTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { ArrowLeft, CheckCircle, XCircle, ClipboardList, Truck, Download, Calendar } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'
import { exportToCSV, generateExportFilename, formatDateTimeForExport } from '@/lib/export'
import { toast } from 'sonner'

export default function DailySummaryPage() {
  const [selectedStore, setSelectedStore] = useState<string>('')
  // Default to "This week" - from Monday to today
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: new Date(),
  }))
  const { stores, isLoading: storesLoading } = useStores()
  const { data: history, isLoading: historyLoading } = useStockHistoryRange(
    selectedStore || undefined,
    dateRange
  )

  const isLoading = storesLoading || historyLoading

  // Separate counts and receptions
  const counts = (history ?? []).filter(h => h.action_type === 'Count')
  const receptions = (history ?? []).filter(h => h.action_type === 'Reception')

  // Get stores that have activity in the date range
  const activeStoreIds = useMemo(() => {
    const ids = new Set<string>()
    history?.forEach(h => ids.add(h.store_id))
    return ids
  }, [history])

  // Filter stores for display
  const displayStores = selectedStore
    ? stores.filter(s => s.id === selectedStore)
    : stores.filter(s => s.is_active)

  // Format date range for display
  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return 'Select dates'
    if (!dateRange?.to || format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
      return format(dateRange.from, 'MMMM d, yyyy')
    }
    return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
  }, [dateRange])

  // Format filename for export
  const exportFilename = useMemo(() => {
    if (!dateRange?.from) return 'stock-summary'
    const fromStr = format(dateRange.from, 'yyyy-MM-dd')
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : fromStr
    if (fromStr === toStr) return `stock-summary-${fromStr}`
    return `stock-summary-${fromStr}-to-${toStr}`
  }, [dateRange])

  const handleExport = () => {
    if (!history || history.length === 0) {
      toast.info('No data to export')
      return
    }

    const columns = [
      { key: 'created_at', header: 'Date/Time', transform: (v: unknown) => formatDateTimeForExport(v as string) },
      { key: 'store.name', header: 'Store' },
      { key: 'inventory_item.name', header: 'Item' },
      { key: 'action_type', header: 'Action' },
      { key: 'quantity_before', header: 'Previous Qty', transform: (v: unknown) => v != null ? String(v) : '0' },
      { key: 'quantity_after', header: 'New Qty', transform: (v: unknown) => v != null ? String(v) : '0' },
      { key: 'quantity_change', header: 'Change', transform: (v: unknown) => {
        const num = v as number
        if (num == null) return '0'
        return num > 0 ? `+${num}` : String(num)
      }},
      { key: 'performer.full_name', header: 'User' },
      { key: 'notes', header: 'Notes', transform: (v: unknown) => String(v || '') },
    ]

    exportToCSV(history, columns, generateExportFilename(exportFilename))
    toast.success(`Exported ${history.length} records`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Summary</h1>
          <p className="text-sm text-muted-foreground">
            View all stock changes for a date range
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <DateRangePicker
          value={dateRange}
          onChange={(range) => setDateRange(range || { from: new Date(), to: new Date() })}
          className="w-auto min-w-[280px]"
        />
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-48">
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
        {history && history.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Date Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">{dateRangeLabel}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Stores with Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeStoreIds.size} / {displayStores.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Stock Counts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Receptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receptions.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Store Activity</h2>
        <div className="flex flex-wrap gap-2">
          {displayStores.map((store) => (
            <Badge
              key={store.id}
              variant={activeStoreIds.has(store.id) ? 'default' : 'outline'}
              className="gap-1"
            >
              {activeStoreIds.has(store.id) ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {store.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold">
          Stock Changes {dateRangeLabel && `(${dateRangeLabel})`}
        </h2>
        {history && history.length > 0 ? (
          <StockHistoryTable history={history} showStore={!selectedStore} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No stock changes found for the selected date range.
          </div>
        )}
      </div>
    </div>
  )
}
