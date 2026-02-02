'use client'

import { useMemo, useCallback, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useMissingCounts, useLowStockReport, useStockHistory } from '@/hooks/useReports'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus'
import { supabaseUpdate } from '@/lib/supabase/client'
import { canDoStockReception, canManageStores } from '@/lib/auth'
import { StatsCard } from '@/components/cards/StatsCard'
import { StoreForm } from '@/components/forms/StoreForm'
import { StoreSetupWizard } from '@/components/store/setup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Users,
  AlertTriangle,
  Package,
  ArrowRight,
  History,
  Clock,
  RefreshCw,
  CheckCircle,
  Truck,
  Edit,
} from 'lucide-react'
import { Store } from '@/types'
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
  const canReceive = canDoStockReception(role)

  // Fetch users for current store only
  const { users, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers({
    storeId: currentStoreId || 'all'
  })

  // Fetch missing counts (we'll filter to current store)
  const { data: allMissingCounts, isLoading: missingLoading, error: missingError, refetch: refetchMissing } = useMissingCounts()

  // Fetch low stock items (we'll filter to current store)
  const { data: allLowStockItems, isLoading: lowStockLoading, error: lowStockError, refetch: refetchLowStock } = useLowStockReport()

  // Get today's date for recent activity - filter to current store
  const today = new Date().toISOString().split('T')[0]
  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = useStockHistory(currentStoreId || null, today)

  const isLoading = usersLoading || missingLoading || lowStockLoading || activityLoading || setupLoading

  // Combine all refetch functions
  const refreshAll = useCallback(() => {
    refetchUsers()
    refetchMissing()
    refetchLowStock()
    refetchActivity()
  }, [refetchUsers, refetchMissing, refetchLowStock, refetchActivity])

  // Auto-refresh every 60 seconds
  const { lastRefreshed, isRefreshing, refresh, isAutoRefreshEnabled, toggleAutoRefresh } = useAutoRefresh({
    interval: 60000, // 1 minute
    enabled: true,
    onRefresh: refreshAll,
  })

  // Filter data to current store only
  const missingCounts = useMemo(() => {
    if (!currentStoreId) return allMissingCounts ?? []
    return (allMissingCounts ?? []).filter(s => s.id === currentStoreId)
  }, [allMissingCounts, currentStoreId])

  const lowStockItems = useMemo(() => {
    if (!currentStoreId) return allLowStockItems ?? []
    return (allLowStockItems ?? []).filter(item => item.store_id === currentStoreId)
  }, [allLowStockItems, currentStoreId])

  // Memoize computed values - must be before any conditional returns
  const activeUsers = useMemo(() => users.filter(u => u.status === 'Active').length, [users])
  const isMissingCount = missingCounts.length > 0
  const lowStockCount = lowStockItems.length
  const needsDelivery = lowStockCount > 0 // Show delivery needed if there's low stock

  // Handle edit store submit
  const handleEditSubmit = async (data: StoreFormData) => {
    if (!currentStore?.store) return
    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabaseUpdate('stores', currentStore.store.id, data)
      if (updateError) throw updateError

      setEditFormOpen(false)
      toast.success('Store updated successfully')
      // Refetch profile to update the store selector and dashboard
      refreshProfile()
      refreshAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update store')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Memoize recent activity slice
  const recentActivityItems = useMemo(() => recentActivity?.slice(0, 8) ?? [], [recentActivity])

  // Show error if any query failed - after all hooks
  const hasError = usersError || missingError || lowStockError
  if (hasError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-red-500">
            Error loading dashboard data. Please try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{currentStore.store?.name}</h1>
          <p className="text-muted-foreground">
            Overview for {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditFormOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Edit Store</span>
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Last updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}</p>
                <p className="text-xs text-muted-foreground">
                  Auto-refresh: {isAutoRefreshEnabled ? 'On (every 60s)' : 'Off'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant={isAutoRefreshEnabled ? 'default' : 'ghost'}
            size="sm"
            onClick={toggleAutoRefresh}
            className="hidden sm:flex"
          >
            {isAutoRefreshEnabled ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canReceive ? (
          <Link href={`/stores/${currentStoreId}/stock-reception`}>
            <StatsCard
              title="Reception"
              value={needsDelivery ? '!' : '✓'}
              description={needsDelivery ? 'Delivery needed' : 'Record deliveries'}
              icon={<Truck className="h-4 w-4 text-muted-foreground" />}
              variant={needsDelivery ? 'warning' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            />
          </Link>
        ) : (
          <StatsCard
            title="Reception"
            value="-"
            description="No access"
            icon={<Truck className="h-4 w-4 text-muted-foreground" />}
            className="opacity-40"
          />
        )}
        <Link href="/users">
          <StatsCard
            title="Team Members"
            value={activeUsers}
            description={users.length - activeUsers > 0 ? `${users.length - activeUsers} inactive/invited` : 'All members active'}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
        <Link href={`/stores/${currentStoreId}/stock-count`}>
          <StatsCard
            title="Today's Count"
            value={isMissingCount ? 'Pending' : 'Done'}
            description={isMissingCount ? 'Stock count not submitted yet' : 'Stock count submitted'}
            icon={isMissingCount
              ? <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              : <CheckCircle className="h-4 w-4 text-muted-foreground" />
            }
            variant={isMissingCount ? 'warning' : 'success'}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
        <Link href="/reports/low-stock">
          <StatsCard
            title="Low Stock Alerts"
            value={lowStockCount}
            description={lowStockCount === 0
              ? 'All items above PAR level'
              : `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} need restocking`
            }
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            variant={lowStockCount > 0 ? 'danger' : 'success'}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
      </div>

      {/* Action Cards - Only show if there are issues needing attention */}
      {(isMissingCount || lowStockCount > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Missing Count - Quick Action */}
          {isMissingCount && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <CardTitle className="text-sm font-medium">Submit Stock Count</CardTitle>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Today&apos;s stock count hasn&apos;t been submitted yet
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={`/stores/${currentStoreId}/stock-count`}>
                  <Button variant="outline" size="sm" className="border-yellow-500/50 hover:bg-yellow-500/10">
                    Submit Count Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Low Stock - Quick View */}
          {lowStockCount > 0 && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-red-600" />
                    <CardTitle className="text-sm font-medium">Restock Needed</CardTitle>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} below PAR level
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {lowStockItems.slice(0, 3).map(item => (
                    <div key={`${item.store_id}-${item.inventory_item_id}`} className="flex items-center justify-between text-sm">
                      <span>{item.item_name}</span>
                      <Badge variant="destructive" className="text-xs">
                        {item.current_quantity} / {item.par_level}
                      </Badge>
                    </div>
                  ))}
                  {lowStockCount > 3 && (
                    <Link href="/reports/low-stock">
                      <Button variant="ghost" size="sm" className="w-full text-xs">
                        View all {lowStockCount} items
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Today&apos;s Activity</CardTitle>
            </div>
            <Link href="/reports/daily-summary">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivityItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded today</p>
              <p className="text-xs text-muted-foreground mt-1">
                Stock counts and receptions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivityItems.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={activity.action_type === 'Reception' ? 'secondary' : 'default'}
                      className="w-20 justify-center text-xs"
                    >
                      {activity.action_type}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {activity.inventory_item?.name || 'Unknown Item'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {activity.performer?.full_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
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
