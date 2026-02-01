'use client'

import { useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { useMissingCounts, useLowStockReport, useStockHistory } from '@/hooks/useReports'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { StatsCard } from '@/components/cards/StatsCard'
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
  Store,
  Users,
  AlertTriangle,
  Package,
  ArrowRight,
  History,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export function OwnerDashboard() {
  const { stores, isLoading: storesLoading, error: storesError, refetch: refetchStores } = useStores()
  const { users, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers()
  const { data: missingCounts, isLoading: missingLoading, error: missingError, refetch: refetchMissing } = useMissingCounts()
  const { data: lowStockItems, isLoading: lowStockLoading, error: lowStockError, refetch: refetchLowStock } = useLowStockReport()

  // Get today's date for recent activity
  const today = new Date().toISOString().split('T')[0]
  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = useStockHistory(null, today)

  const isLoading = storesLoading || usersLoading || missingLoading || lowStockLoading || activityLoading

  // Combine all refetch functions
  const refreshAll = useCallback(() => {
    refetchStores()
    refetchUsers()
    refetchMissing()
    refetchLowStock()
    refetchActivity()
  }, [refetchStores, refetchUsers, refetchMissing, refetchLowStock, refetchActivity])

  // Auto-refresh every 60 seconds
  const { lastRefreshed, isRefreshing, refresh, isAutoRefreshEnabled, toggleAutoRefresh } = useAutoRefresh({
    interval: 60000, // 1 minute
    enabled: true,
    onRefresh: refreshAll,
  })

  // Memoize computed values - must be before any conditional returns
  const activeStores = useMemo(() => stores.filter(s => s.is_active).length, [stores])
  const activeUsers = useMemo(() => users.filter(u => u.status === 'Active').length, [users])
  const missingCount = missingCounts?.length ?? 0
  const lowStockCount = lowStockItems?.length ?? 0

  // Memoize low stock grouping - expensive reduce operation
  const lowStockStores = useMemo(() => {
    const byStore = (lowStockItems ?? []).reduce((acc, item) => {
      if (!acc[item.store_id]) {
        acc[item.store_id] = {
          store_id: item.store_id,
          store_name: item.store_name,
          count: 0,
        }
      }
      acc[item.store_id].count++
      return acc
    }, {} as Record<string, { store_id: string; store_name: string; count: number }>)

    return Object.values(byStore).sort((a, b) => b.count - a.count)
  }, [lowStockItems])

  // Memoize recent activity slice
  const recentActivityItems = useMemo(() => recentActivity?.slice(0, 8) ?? [], [recentActivity])

  // Show error if any query failed - after all hooks
  const hasError = storesError || usersError || missingError || lowStockError
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview for {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <Link href="/stores">
          <StatsCard
            title="Active Stores"
            value={activeStores}
            description={stores.length - activeStores > 0 ? `${stores.length - activeStores} inactive` : 'All stores active'}
            icon={<Store className="h-4 w-4 text-muted-foreground" />}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
        <Link href="/users">
          <StatsCard
            title="Active Users"
            value={activeUsers}
            description={users.length - activeUsers > 0 ? `${users.length - activeUsers} inactive/invited` : 'All users active'}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
        <Link href="/reports/daily-summary">
          <StatsCard
            title="Missing Counts"
            value={missingCount}
            description={missingCount === 0
              ? 'All stores counted today'
              : missingCounts?.slice(0, 2).map(s => s.name).join(', ') + (missingCount > 2 ? ` +${missingCount - 2} more` : '')
            }
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            variant={missingCount > 0 ? 'warning' : 'success'}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
        <Link href="/reports/low-stock">
          <StatsCard
            title="Low Stock Alerts"
            value={lowStockCount}
            description={lowStockCount === 0
              ? 'All items above PAR level'
              : `${lowStockStores.length} store${lowStockStores.length !== 1 ? 's' : ''} affected`
            }
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            variant={lowStockCount > 0 ? 'danger' : 'success'}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>
      </div>

      {/* Action Cards - Only show if there are issues needing attention */}
      {(missingCount > 0 || lowStockCount > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Missing Counts - Quick Actions */}
          {missingCount > 0 && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <CardTitle className="text-sm font-medium">Submit Count</CardTitle>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {missingCount} store{missingCount !== 1 ? 's haven\'t' : ' hasn\'t'} submitted today&apos;s count
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {missingCounts?.slice(0, 4).map(store => (
                    <Link key={store.id} href={`/stores/${store.id}/stock-count`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs border-yellow-500/50 hover:bg-yellow-500/10">
                        {store.name}
                      </Button>
                    </Link>
                  ))}
                  {missingCount > 4 && (
                    <Link href="/reports/daily-summary">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        +{missingCount - 4} more
                      </Button>
                    </Link>
                  )}
                </div>
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
                  {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} below PAR level across {lowStockStores.length} store{lowStockStores.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {lowStockStores.slice(0, 4).map(store => (
                    <Link key={store.store_id} href={`/reports/low-stock?store=${store.store_id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs border-red-500/50 hover:bg-red-500/10">
                        {store.store_name}
                        <Badge variant="destructive" className="ml-1.5 h-4 min-w-[1.25rem] px-1.5 text-[10px]">
                          {store.count}
                        </Badge>
                      </Button>
                    </Link>
                  ))}
                  {lowStockStores.length > 4 && (
                    <Link href="/reports/low-stock">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        +{lowStockStores.length - 4} more
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
                        {activity.store?.name || 'Unknown Store'}
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
    </div>
  )
}
