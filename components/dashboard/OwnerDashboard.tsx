'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useMissingCounts, useLowStockReport, useStockHistory } from '@/hooks/useReports'
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useAuditLogs, ACTION_LABELS, CATEGORY_COLORS, AuditLog } from '@/hooks/useAuditLogs'
import { useHACCPDashboard } from '@/hooks/useHACCP'
import { supabaseFetch } from '@/lib/supabase/client'
import { canDoStockCount, canDoStockReception, canManageStores } from '@/lib/auth'
import { StatsCard } from '@/components/cards/StatsCard'
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
  ClipboardList,
  XCircle,
  TrendingUp,
  Activity,
  Shield,
} from 'lucide-react'
import { StoreInventory } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { PageGuide } from '@/components/help/PageGuide'

/** Short label for category badges */
function getCategoryShortLabel(category: string): string {
  const labels: Record<string, string> = {
    auth: 'Auth',
    user: 'Team',
    store: 'Store',
    stock: 'Stock',
    inventory: 'Items',
    shift: 'Shift',
    settings: 'Settings',
    report: 'Report',
    supplier: 'Supplier',
    purchase_order: 'PO',
    waste: 'Waste',
  }
  return labels[category] || category
}

/** Extract a short detail string from an audit log entry */
function getAuditLogDetail(log: AuditLog): string {
  const d = log.details
  if (!d || typeof d !== 'object') return ''

  // Batch update summary
  if (d.summary && typeof d.summary === 'string') return d.summary

  // Item-related
  if (d.itemName) return String(d.itemName)
  if (d.item_name) return String(d.item_name)

  // Supplier/recipe/menu
  if (d.supplierName) return String(d.supplierName)
  if (d.recipeName) return String(d.recipeName)
  if (d.menuItemName) return String(d.menuItemName)

  // User-related
  if (d.email) return String(d.email)

  // Stock count
  if (d.itemCount) return `${d.itemCount} items`

  // PO
  if (d.poNumber) return `PO #${d.poNumber}`

  return ''
}

export function OwnerDashboard() {
  const { currentStore } = useAuth()
  const currentStoreId = currentStore?.store_id

  // Store setup status - determines if wizard or dashboard is shown
  const {
    status: setupStatus,
    store: setupStore,
    isLoading: setupLoading,
    refetch: refetchSetupStatus,
  } = useStoreSetupStatus(currentStoreId || null)

  if (setupLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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

  // Dashboard content is a separate component so hooks only fire
  // AFTER setup is complete — prevents stale empty data on first load
  return <DashboardContent />
}

/** Inner dashboard — only mounts when setup is complete, so all hooks fetch fresh data */
function DashboardContent() {
  const { currentStore, role, refreshProfile } = useAuth()
  const currentStoreId = currentStore?.store_id

  // Permission checks
  const canManage = canManageStores(role)
  const canCount = canDoStockCount(role)
  const canReceive = canDoStockReception(role)

  // Fetch users for current store only
  const { isLoading: usersLoading } = useUsers({
    storeId: currentStoreId || 'all'
  })

  // Fetch missing counts for current store
  const { data: missingCounts, isLoading: missingLoading } = useMissingCounts(currentStoreId)

  // Fetch low stock items for current store
  const { data: lowStockItems, isLoading: lowStockLoading } = useLowStockReport(currentStoreId)

  // Fetch store inventory to calculate out of stock
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([])
  const [inventoryLoading, setInventoryLoading] = useState(false)

  // Analytics data (30-day lookback) — used for "busiest items"
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(currentStoreId || null, 30)

  // Get today's date for recent activity - filter to current store
  const today = new Date().toISOString().split('T')[0]
  const { data: recentActivity, isLoading: activityLoading } = useStockHistory(currentStoreId || null, today)

  // HACCP due checks
  const { data: haccpDashboard } = useHACCPDashboard(currentStoreId || null)

  // Audit logs for "What Happened Today"
  const { data: todayAuditData, isLoading: auditLoading } = useAuditLogs({
    storeId: currentStoreId || null,
    startDate: today,
    limit: 8,
  })

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

  const isLoading = usersLoading || missingLoading || lowStockLoading || activityLoading || inventoryLoading || auditLoading

  // Data is already filtered by storeId at the hook level
  const storeMissingCounts = missingCounts ?? []
  const storeLowStockItems = lowStockItems ?? []

  // Calculate inventory metrics
  const inventoryMetrics = useMemo(() => {
    const total = storeInventory.length
    const outOfStock = storeInventory.filter(item => item.quantity === 0).length
    const low = storeLowStockItems.length - outOfStock // Low but not out
    const healthy = total - low - outOfStock
    const healthPercentage = total > 0 ? Math.round((healthy / total) * 100) : 0
    const totalValue = storeInventory.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0)

    return {
      total,
      outOfStock,
      low,
      healthy,
      healthPercentage,
      totalValue,
    }
  }, [storeInventory, storeLowStockItems])

  // Get out of stock items for urgent alerts
  const outOfStockItems = useMemo(() => {
    return storeInventory
      .filter(item => item.quantity === 0)
      .slice(0, 5)
      .map(item => item.inventory_item?.name || 'Unknown item')
  }, [storeInventory])

  // Items running low — sorted by most critical (lowest % remaining)
  const runningLowItems = useMemo(() => {
    return storeLowStockItems
      .map(item => ({
        name: item.item_name,
        current: item.current_quantity,
        needed: item.par_level,
        percentFull: item.par_level > 0 ? Math.round((item.current_quantity / item.par_level) * 100) : 0,
        isOut: item.current_quantity === 0,
      }))
      .sort((a, b) => a.percentFull - b.percentFull)
      .slice(0, 8)
  }, [storeLowStockItems])

  // Top moving items from analytics
  const busiestItems = useMemo(() => {
    if (!analytics?.topMovingItems) return []
    return analytics.topMovingItems
      .slice(0, 5)
      .map((item, idx) => ({
        rank: idx + 1,
        name: item.name,
        used: Math.abs(item.totalChange),
      }))
  }, [analytics])

  // HACCP due checks for the main dashboard
  const haccpDueChecks = haccpDashboard?.due_checks ?? []

  // Check if stock count was done
  const isMissingCount = storeMissingCounts.length > 0

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

  // Memoize today's audit log entries
  const todayAuditItems = useMemo(() => todayAuditData?.logs ?? [], [todayAuditData])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!currentStore) return null

  const hasUrgentIssues = inventoryMetrics.outOfStock > 0 || isMissingCount || haccpDueChecks.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{currentStore.store?.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <PageGuide pageKey="dashboard" />
      </div>

      {/* URGENT ATTENTION SECTION - Only shows if there are issues */}
      {hasUrgentIssues && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Needs Attention</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Out of Stock Alert */}
            {inventoryMetrics.outOfStock > 0 && (
              <Card className="border-destructive/40 bg-destructive/5 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-base font-semibold text-destructive">
                      {inventoryMetrics.outOfStock} Item{inventoryMetrics.outOfStock !== 1 ? 's' : ''} Out of Stock
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="text-sm text-destructive/80 flex-1">
                    {outOfStockItems.slice(0, 3).map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        <span>{name}</span>
                      </div>
                    ))}
                    {inventoryMetrics.outOfStock > 3 && (
                      <div className="text-xs text-destructive/70 mt-1">
                        +{inventoryMetrics.outOfStock - 3} more items
                      </div>
                    )}
                  </div>
                  <Link href="/inventory?category=all">
                    <Button size="sm" variant="destructive" className="w-full mt-3">
                      View & Order Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Missing Stock Count Alert */}
            {isMissingCount && (
              <Card className="border-amber-500/40 bg-amber-50/60 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-amber-700" />
                    <CardTitle className="text-base font-semibold text-amber-800">
                      Stock Count Pending
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <p className="text-sm text-amber-700 flex-1">
                    Today&apos;s stock count hasn&apos;t been completed yet. Complete it to ensure accurate inventory tracking.
                  </p>
                  {canCount && (
                    <Link href="/stock-count">
                      <Button size="sm" className="w-full mt-3 bg-amber-600 hover:bg-amber-700">
                        Do Stock Count Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* HACCP Due Checks Alert */}
            {haccpDueChecks.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-50/60 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-700" />
                    <CardTitle className="text-base font-semibold text-amber-800">
                      {haccpDueChecks.length} Food Safety Check{haccpDueChecks.length !== 1 ? 's' : ''} Due
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="text-sm text-amber-700 flex-1 space-y-1">
                    {haccpDueChecks.slice(0, 3).map((check) => (
                      <div key={check.id} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                        <span>{check.name}</span>
                        <span className="text-xs text-amber-600 capitalize">({check.frequency})</span>
                      </div>
                    ))}
                    {haccpDueChecks.length > 3 && (
                      <div className="text-xs text-amber-600/80 mt-1">
                        +{haccpDueChecks.length - 3} more
                      </div>
                    )}
                  </div>
                  <Link href="/haccp/checks">
                    <Button size="sm" className="w-full mt-3 bg-amber-600 hover:bg-amber-700">
                      Run Checks Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* AT A GLANCE — 3 simple cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">At a Glance</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          <Link href="/inventory">
            <StatsCard
              title="Items Tracked"
              value={inventoryMetrics.total}
              description={`You're tracking ${inventoryMetrics.total} item${inventoryMetrics.total !== 1 ? 's' : ''}`}
              icon={<Package className="h-4 w-4" />}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-card"
            />
          </Link>

          <Link href="/inventory?category=all">
            <StatsCard
              title="Running Low"
              value={inventoryMetrics.low}
              description={inventoryMetrics.low > 0 ? `${inventoryMetrics.low} item${inventoryMetrics.low !== 1 ? 's' : ''} below PAR level` : 'Everything well stocked'}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={inventoryMetrics.low > 0 ? 'warning' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-card"
            />
          </Link>

          <Link href="/inventory?category=all">
            <StatsCard
              title="Out of Stock"
              value={inventoryMetrics.outOfStock}
              description={inventoryMetrics.outOfStock > 0 ? 'Need to reorder now' : 'Nothing is empty'}
              icon={<XCircle className="h-4 w-4" />}
              variant={inventoryMetrics.outOfStock > 0 ? 'danger' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer bg-card"
            />
          </Link>
        </div>
      </div>

      {/* TODAY'S CHECKLIST */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Today&apos;s Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Stock Count Status */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Stock count</span>
              </div>
              <div className="flex items-center gap-2">
                {isMissingCount ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                    Not done yet
                  </Badge>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700">Done</span>
                  </>
                )}
              </div>
            </div>

            {/* Last Delivery */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last delivery</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {lastDelivery
                  ? `${formatDistanceToNow(new Date(lastDelivery.time), { addSuffix: true })} (${lastDelivery.itemCount} items)`
                  : 'None today'
                }
              </span>
            </div>

            {/* HACCP Checks Status */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Food safety checks</span>
              </div>
              <div className="flex items-center gap-2">
                {haccpDueChecks.length > 0 ? (
                  <Link href="/haccp/checks">
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 cursor-pointer">
                      {haccpDueChecks.length} due
                    </Badge>
                  </Link>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700">All done</span>
                  </>
                )}
              </div>
            </div>

            {/* Overall Status */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Overall status</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {inventoryMetrics.healthy} of {inventoryMetrics.total} items well stocked
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TWO INSIGHT CARDS instead of 5 charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Items Running Low */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Items Running Low</CardTitle>
              <Link href="/inventory?category=all">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  View all
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {runningLowItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500 mb-3" />
                <p className="text-sm font-medium text-emerald-700">Everything&apos;s well stocked</p>
                <p className="text-xs text-muted-foreground mt-1">Nice work!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {runningLowItems.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.isOut ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Out</Badge>
                        ) : (
                          <span className={`text-xs ${item.percentFull < 30 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                            {item.current} left (need {item.needed})
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.isOut
                            ? 'bg-destructive'
                            : item.percentFull < 30
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(item.percentFull, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Your Busiest Items */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Your Busiest Items</CardTitle>
              <Link href="/reports">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Full reports
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {busiestItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Start counting stock to see usage trends</p>
              </div>
            ) : (
              <div className="space-y-3">
                {busiestItems.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 py-1">
                    <span className="text-sm font-semibold text-muted-foreground w-5 text-right shrink-0">
                      {item.rank}.
                    </span>
                    <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Used {item.used} this month
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QUICK ACTIONS */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {canCount && (
            <Link href="/stock-count">
              <Card className={`group h-full py-4 gap-2 transition-all hover:shadow-md ${isMissingCount ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'hover:border-primary/30'}`}>
                <CardContent className="flex flex-col items-center text-center gap-2">
                  <div className={`rounded-full p-2.5 ${isMissingCount ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'} transition-colors`}>
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">
                    {isMissingCount ? 'Do Stock Count' : 'Stock Count'}
                  </span>
                </CardContent>
              </Card>
            </Link>
          )}
          {canReceive && (
            <Link href="/deliveries">
              <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md hover:border-primary/30">
                <CardContent className="flex flex-col items-center text-center gap-2">
                  <div className="rounded-full p-2.5 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Truck className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Record Delivery</span>
                </CardContent>
              </Card>
            </Link>
          )}
          <Link href="/inventory">
            <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="flex flex-col items-center text-center gap-2">
                <div className="rounded-full p-2.5 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Package className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">View Inventory</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* WHAT HAPPENED TODAY */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">What Happened Today</CardTitle>
            </div>
            <Link href="/activity">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todayAuditItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Clock className="h-6 w-6 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayAuditItems.map((log: AuditLog) => {
                const label = ACTION_LABELS[log.action] || log.action
                const detail = getAuditLogDetail(log)
                const categoryColor = CATEGORY_COLORS[log.action_category] || 'bg-gray-100 text-gray-800'
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        className={`shrink-0 text-xs ${categoryColor}`}
                      >
                        {getCategoryShortLabel(log.action_category)}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        {detail && (
                          <p className="text-xs text-muted-foreground truncate">{detail}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'h:mm a')}
                      </p>
                      {log.user_name && (
                        <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {log.user_name.split(' ')[0]}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
