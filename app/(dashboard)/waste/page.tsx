'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWasteTracking } from '@/hooks/useWasteTracking'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { EmptyState } from '@/components/ui/empty-state'
import { WasteLogForm } from '@/components/waste/WasteLogForm'
import { WasteAnalyticsCharts } from '@/components/waste/WasteAnalyticsCharts'
import { Trash2, DollarSign, AlertTriangle, TrendingDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { WasteReason } from '@/types'

const REASON_COLORS: Record<string, string> = {
  spoilage: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  damaged: 'bg-yellow-100 text-yellow-800',
  overproduction: 'bg-blue-100 text-blue-800',
  other: 'bg-gray-100 text-gray-800',
}

export default function WastePage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null

  const {
    submitWasteReport,
    isSubmitting,
    wasteHistory,
    isLoadingHistory,
    fetchWasteHistory,
    analytics,
    isLoadingAnalytics,
    fetchAnalytics,
  } = useWasteTracking(storeId)

  const { inventory } = useStoreInventory(storeId)

  const [showLogForm, setShowLogForm] = useState(false)
  const [reasonFilter, setReasonFilter] = useState<string>('all')

  useEffect(() => {
    if (storeId) {
      fetchAnalytics()
      fetchWasteHistory()
    }
  }, [storeId, fetchAnalytics, fetchWasteHistory])

  if (role !== 'Owner' && role !== 'Manager' && role !== 'Staff') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Waste Tracking</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is not available for your role.
          </CardContent>
        </Card>
      </div>
    )
  }

  const isManagement = role === 'Owner' || role === 'Manager'

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Waste Tracking</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to view waste tracking.
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmitWaste = async (data: { items: Array<{ inventory_item_id: string; quantity: number; reason?: WasteReason }>; notes?: string }) => {
    try {
      await submitWasteReport(data)
      toast.success('Waste report submitted successfully')
      fetchWasteHistory()
      fetchAnalytics()
    } catch {
      toast.error('Failed to submit waste report')
    }
  }

  const handleReasonFilter = (value: string) => {
    setReasonFilter(value)
    fetchWasteHistory({ reason: value === 'all' ? undefined : value as WasteReason })
  }

  const inventoryOptions = inventory
    .filter(item => item.inventory_item)
    .map(item => ({
      id: item.inventory_item_id,
      name: item.inventory_item!.name,
      unit_of_measure: item.inventory_item!.unit_of_measure,
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6" />
            Waste Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor and reduce waste across {currentStore?.store?.name ?? 'your store'}
          </p>
        </div>
        <Button onClick={() => setShowLogForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log Waste
        </Button>
      </div>

      {/* Summary Cards */}
      {/* Analytics section - Owner/Manager only */}
      {isManagement && (
        <>
          {isLoadingAnalytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Total Waste Cost
                  </div>
                  <p className="text-2xl font-bold mt-1 text-red-600">
                    ${analytics.summary.total_estimated_cost.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Total Incidents
                  </div>
                  <p className="text-2xl font-bold mt-1">{analytics.summary.total_incidents}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                    Top Reason
                  </div>
                  <p className="text-2xl font-bold mt-1 capitalize">
                    {analytics.by_reason[0]?.reason ?? 'N/A'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4" />
                    Avg Cost/Day
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    ${analytics.daily_trend.length > 0
                      ? (analytics.summary.total_estimated_cost / analytics.daily_trend.length).toFixed(2)
                      : '0.00'}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Charts */}
          {analytics && (
            <WasteAnalyticsCharts
              dailyTrend={analytics.daily_trend}
              byReason={analytics.by_reason}
            />
          )}

          {/* Top Wasted Items */}
          {analytics && analytics.top_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Wasted Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Incidents</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.top_items.map((item) => (
                      <TableRow key={item.inventory_item_id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell>{item.category ?? '-'}</TableCell>
                        <TableCell className="text-right">{item.total_quantity} {item.unit_of_measure}</TableCell>
                        <TableCell className="text-right text-red-600">${item.total_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.incident_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Waste History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Waste History</CardTitle>
            <Select value={reasonFilter} onValueChange={handleReasonFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="spoilage">Spoilage</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="overproduction">Overproduction</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : wasteHistory.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="No waste records"
              description="Start logging waste to track and reduce losses."
              action={{ label: 'Log Waste', onClick: () => setShowLogForm(true), icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(entry.reported_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{entry.inventory_item?.name ?? 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={REASON_COLORS[entry.reason] || ''}>
                        {entry.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{entry.quantity}</TableCell>
                    <TableCell className="text-right text-red-600">${entry.estimated_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{entry.notes ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Log Form Dialog */}
      <WasteLogForm
        open={showLogForm}
        onOpenChange={setShowLogForm}
        inventoryItems={inventoryOptions}
        onSubmit={handleSubmitWaste}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
