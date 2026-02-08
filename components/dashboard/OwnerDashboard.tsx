'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useMissingCounts, useLowStockReport, useStockHistory } from '@/hooks/useReports'
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus'
import { supabaseFetch, supabaseUpdate } from '@/lib/supabase/client'
import { canDoStockCount, canDoStockReception, canManageStores } from '@/lib/auth'
import { StatsCard } from '@/components/cards/StatsCard'
import { StoreForm } from '@/components/forms/StoreForm'
import { StoreSetupWizard } from '@/components/store/setup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Package,
  ArrowRight,
  Clock,
  CheckCircle,
  Truck,
  Edit,
  ClipboardList,
  XCircle,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { Store, StoreInventory } from '@/types'
import { StoreFormData } from '@/lib/validations/store'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export function OwnerDashboard() {
  // Get current store from auth context
  const { currentStore, role, refreshProfile } = useAuth()
  const currentStoreId = currentStore?.store_id

  // Store setup status - determines if wizard or dashboard is shown
  const {
    status: setupStatus,
    store: setupStore,
    isLoading: setupLoading,
    refetch: refetchSetupStatus,
  } = useStoreSetupStatus(currentStoreId || null)

  // Edit store state
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Permission checks
  const canManage = canManageStores(role)
  const canCount = canDoStockCount(role)
  const canReceive = canDoStockReception(role)

  // Fetch users for current store only
  const { users, isLoading: usersLoading } = useUsers({
    storeId: currentStoreId || 'all'
  })

  // Fetch missing counts (we'll filter to current store)
  const { data: allMissingCounts, isLoading: missingLoading } = useMissingCounts()

  // Fetch low stock items (we'll filter to current store)
  const { data: allLowStockItems, isLoading: lowStockLoading } = useLowStockReport()

  // Fetch store inventory to calculate out of stock
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)

  // Get today's date for recent activity - filter to current store
  const today = new Date().toISOString().split('T')[0]
  const { data: recentActivity, isLoading: activityLoading } = useStockHistory(currentStoreId || null, today)

  // Fetch store inventory for out of stock calculation
  useEffect(() => {
    async function fetchStoreInventory() {
      if (!currentStoreId) return

      setInventoryLoading(true)
      try {
        const { data, error } = await supabaseFetch<StoreInventory>('store_inventory', {
          select: '*,inventory_item:inventory_items(*)',
          filter: { store_id: `eq.${currentStoreId}` },
        })

        if (error) throw error
        setStoreInventory(data || [])
      } catch (err) {
        console.error('Failed to fetch store inventory:', err)
      } finally {
        setInventoryLoading(false)
      }
    }

    fetchStoreInventory()
  }, [currentStoreId])

  const isLoading = usersLoading || missingLoading || lowStockLoading || activityLoading || setupLoading || inventoryLoading

  // Filter data to current store only
  const missingCounts = useMemo(() => {
    if (!currentStoreId) return allMissingCounts ?? []
    return (allMissingCounts ?? []).filter(s => s.id === currentStoreId)
  }, [allMissingCounts, currentStoreId])

  const lowStockItems = useMemo(() => {
    if (!currentStoreId) return allLowStockItems ?? []
    return (allLowStockItems ?? []).filter(item => item.store_id === currentStoreId)
  }, [allLowStockItems, currentStoreId])

  // Calculate inventory metrics
  const inventoryMetrics = useMemo(() => {
    const total = storeInventory.length
    const outOfStock = storeInventory.filter(item => item.quantity === 0).length
    const low = lowStockItems.length - outOfStock // Low but not out
    const healthy = total - low - outOfStock
    const healthPercentage = total > 0 ? Math.round((healthy / total) * 100) : 0

    return {
      total,
      outOfStock,
      low,
      healthy,
      healthPercentage,
    }
  }, [storeInventory, lowStockItems])

  // Get out of stock items for urgent alerts
  const outOfStockItems = useMemo(() => {
    return storeInventory
      .filter(item => item.quantity === 0)
      .slice(0, 5)
      .map(item => item.inventory_item?.name || 'Unknown item')
  }, [storeInventory])

  // Check if stock count was done
  const isMissingCount = missingCounts.length > 0

  // Get last delivery info from recent activity
  const lastDelivery = useMemo(() => {
    if (!recentActivity) return null
    const deliveries = recentActivity.filter(a => a.action_type === 'Reception')
    if (deliveries.length === 0) return null

    const latest = deliveries[0]
    return {
      time: latest.created_at,
      itemCount: deliveries.length,
    }
  }, [recentActivity])

  // Memoize computed values
  const activeUsers = useMemo(() => users.filter(u => u.status === 'Active').length, [users])

  // Handle edit store submit
  const handleEditSubmit = async (data: StoreFormData) => {
    if (!currentStore?.store) return
    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabaseUpdate('stores', currentStore.store.id, data)
      if (updateError) throw updateError

      setEditFormOpen(false)
      toast.success('Store updated successfully')
      refreshProfile()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update store')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Memoize recent activity slice
  const recentActivityItems = useMemo(() => recentActivity?.slice(0, 6) ?? [], [recentActivity])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  // No store selected - prompt user to select one
  if (!currentStore) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Please select a store from the sidebar to view its dashboard.
          </p>
        </div>
      </div>
    )
  }

  // Show setup wizard if store setup is not complete
  if (!setupStatus.isSetupComplete && setupStore) {
    return (
      <StoreSetupWizard
        store={setupStore}
        status={setupStatus}
        onRefresh={refetchSetupStatus}
      />
    )
  }

  const hasUrgentIssues = inventoryMetrics.outOfStock > 0 || isMissingCount

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{currentStore.store?.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setEditFormOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Edit Store</span>
          </Button>
        )}
      </div>

      {/* URGENT ATTENTION SECTION - Only shows if there are issues */}
      {hasUrgentIssues && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold">Needs Attention</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Out of Stock Alert */}
            {inventoryMetrics.outOfStock > 0 && (
              <Card className="border-red-500 bg-red-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-base font-semibold text-red-900">
                      {inventoryMetrics.outOfStock} Item{inventoryMetrics.outOfStock !== 1 ? 's' : ''} Out of Stock
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-red-800">
                      {outOfStockItems.slice(0, 3).map((name, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                          <span>{name}</span>
                        </div>
                      ))}
                      {inventoryMetrics.outOfStock > 3 && (
                        <div className="text-xs text-red-700 mt-1">
                          +{inventoryMetrics.outOfStock - 3} more items
                        </div>
                      )}
                    </div>
                    <Link href="/inventory?category=all">
                      <Button size="sm" variant="destructive" className="w-full mt-2">
                        View & Order Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Missing Stock Count Alert */}
            {isMissingCount && (
              <Card className="border-yellow-500 bg-yellow-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-yellow-700" />
                    <CardTitle className="text-base font-semibold text-yellow-900">
                      Stock Count Pending
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-800 mb-3">
                    Today&apos;s stock count hasn&apos;t been completed yet. Complete it to ensure accurate inventory tracking.
                  </p>
                  {canCount && (
                    <Link href={`/stores/${currentStoreId}/stock-count`}>
                      <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-700">
                        Do Stock Count Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* INVENTORY STATUS - 4 Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Inventory Status</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Link href="/inventory">
            <StatsCard
              title="Total Items"
              value={inventoryMetrics.total}
              description="Being tracked"
              icon={<Package className="h-4 w-4" />}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-white"
            />
          </Link>

          <Link href="/inventory?category=all">
            <StatsCard
              title="Low Stock"
              value={inventoryMetrics.low}
              description={inventoryMetrics.low > 0 ? 'Below PAR level' : 'All items stocked'}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={inventoryMetrics.low > 0 ? 'warning' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-white"
            />
          </Link>

          <Link href="/inventory?category=all">
            <StatsCard
              title="Out of Stock"
              value={inventoryMetrics.outOfStock}
              description={inventoryMetrics.outOfStock > 0 ? 'Need immediate restock' : 'No items empty'}
              icon={<XCircle className="h-4 w-4" />}
              variant={inventoryMetrics.outOfStock > 0 ? 'danger' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-white"
            />
          </Link>

          <Link href="/inventory">
            <StatsCard
              title="Healthy Stock"
              value={inventoryMetrics.healthy}
              description={`${inventoryMetrics.healthPercentage}% inventory health`}
              icon={<CheckCircle className="h-4 w-4" />}
              variant={inventoryMetrics.healthPercentage >= 80 ? 'success' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-white"
            />
          </Link>
        </div>
      </div>

      {/* TODAY'S STATUS */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Today&apos;s Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Stock Count Status */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Stock Count</span>
              </div>
              <div className="flex items-center gap-2">
                {isMissingCount ? (
                  <>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                      Not done yet
                    </Badge>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </>
                )}
              </div>
            </div>

            {/* Last Delivery */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Delivery</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {lastDelivery
                  ? `${formatDistanceToNow(new Date(lastDelivery.time), { addSuffix: true })} (${lastDelivery.itemCount} items)`
                  : 'None today'
                }
              </span>
            </div>

            {/* Inventory Health */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Inventory Health</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{inventoryMetrics.healthPercentage}%</span>
                <Badge
                  variant={inventoryMetrics.healthPercentage >= 80 ? 'default' : inventoryMetrics.healthPercentage >= 60 ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {inventoryMetrics.healthPercentage >= 80 ? 'Excellent' : inventoryMetrics.healthPercentage >= 60 ? 'Good' : 'Needs Work'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QUICK ACTIONS */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {canCount && (
              <Link href={`/stores/${currentStoreId}/stock-count`}>
                <Button
                  variant={isMissingCount ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  {isMissingCount ? 'Do Stock Count' : 'Update Stock Count'}
                </Button>
              </Link>
            )}
            {canReceive && (
              <Link href={`/stores/${currentStoreId}/stock-reception`}>
                <Button variant="outline" className="w-full" size="lg">
                  <Truck className="h-4 w-4 mr-2" />
                  Record Delivery
                </Button>
              </Link>
            )}
            <Link href="/inventory">
              <Button variant="outline" className="w-full" size="lg">
                <Package className="h-4 w-4 mr-2" />
                View Inventory
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* RECENT ACTIVITY - Compact */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
            <Link href="/reports/daily-summary">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivityItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Clock className="h-6 w-6 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivityItems.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant={activity.action_type === 'Reception' ? 'secondary' : 'default'}
                      className="w-16 justify-center text-xs shrink-0"
                    >
                      {activity.action_type === 'Reception' ? 'In' : 'Count'}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.inventory_item?.name || 'Unknown Item'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-mono font-medium ${
                      activity.quantity_change && activity.quantity_change > 0
                        ? 'text-green-600'
                        : activity.quantity_change && activity.quantity_change < 0
                        ? 'text-red-600'
                        : ''
                    }`}>
                      {activity.quantity_change && activity.quantity_change > 0 ? '+' : ''}
                      {activity.quantity_change ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Store Form */}
      {currentStore?.store && (
        <StoreForm
          open={editFormOpen}
          onOpenChange={setEditFormOpen}
          store={currentStore.store as Store}
          onSubmit={handleEditSubmit}
          isLoading={isSubmitting}
        />
      )}
    </div>
  )
}
