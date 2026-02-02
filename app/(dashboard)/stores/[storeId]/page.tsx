'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabaseFetch, supabaseUpdate } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useStockHistory } from '@/hooks/useReports'
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus'
import { canDoStockCount, canDoStockReception, canManageStores } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StoreForm } from '@/components/forms/StoreForm'
import { StatsCard } from '@/components/cards/StatsCard'
import { StoreSetupWizard } from '@/components/store/setup'
import { Store, StoreInventory, InventoryItem } from '@/types'
import { StoreFormData } from '@/lib/validations/store'
import {
  ArrowLeft,
  MapPin,
  Package,
  ClipboardList,
  Truck,
  Users,
  Edit,
  History,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface DailyCount {
  id: string
  store_id: string
  count_date: string
}

interface StoreDetailPageProps {
  params: Promise<{ storeId: string }>
}

export default function StoreDetailPage({ params }: StoreDetailPageProps) {
  const { storeId } = use(params)
  const { role } = useAuth()

  const [store, setStore] = useState<Store | null>(null)
  const [inventory, setInventory] = useState<StoreInventory[]>([])
  const [todayCountDone, setTodayCountDone] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Store setup status - determines if wizard or dashboard is shown
  const {
    status: setupStatus,
    store: setupStore,
    isLoading: setupLoading,
    refetch: refetchSetupStatus,
  } = useStoreSetupStatus(storeId)

  const canManage = canManageStores(role)
  const canCount = canDoStockCount(role)
  const canReceive = canDoStockReception(role)

  // Get today's activity for this store
  const today = new Date().toISOString().split('T')[0]
  const { data: storeActivity, isLoading: activityLoading } = useStockHistory(storeId, today)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch store
        const { data: storeData, error: storeError } = await supabaseFetch<Store>('stores', {
          filter: { id: `eq.${storeId}` },
        })

        if (storeError) throw storeError

        if (cancelled) return
        setStore(storeData && storeData.length > 0 ? storeData[0] : null)

        // Fetch inventory items
        const { data: allItems, error: itemsError } = await supabaseFetch<InventoryItem>('inventory_items', {
          filter: { is_active: 'eq.true' },
          order: 'name',
        })

        if (itemsError) throw itemsError

        // Fetch store inventory
        const { data: storeItems, error: storeInvError } = await supabaseFetch<StoreInventory>('store_inventory', {
          select: '*,inventory_item:inventory_items(*)',
          filter: { store_id: `eq.${storeId}` },
        })

        if (storeInvError) throw storeInvError

        if (cancelled) return

        // Merge inventory
        const storeItemsMap = new Map<string, StoreInventory>()
        for (const item of storeItems || []) {
          storeItemsMap.set(item.inventory_item_id, item)
        }

        const mergedInventory: StoreInventory[] = (allItems || []).map(item => {
          const existing = storeItemsMap.get(item.id)
          if (existing) return existing
          return {
            id: `virtual-${item.id}`,
            store_id: storeId,
            inventory_item_id: item.id,
            quantity: 0,
            par_level: null,
            last_updated_at: new Date().toISOString(),
            last_updated_by: null,
            inventory_item: item,
          }
        })

        setInventory(mergedInventory)

        // Check if stock count was done today
        const today = new Date().toISOString().split('T')[0]
        const { data: countData } = await supabaseFetch<DailyCount>('daily_counts', {
          filter: {
            store_id: `eq.${storeId}`,
            count_date: `eq.${today}`
          },
          range: { from: 0, to: 0 },
        })

        if (cancelled) return
        setTodayCountDone(Boolean(countData && countData.length > 0))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [storeId])

  const lowStockItems = inventory.filter(
    item => item.par_level && item.quantity < item.par_level
  )
  const lowStockCount = lowStockItems.length

  const handleEditSubmit = async (data: StoreFormData) => {
    if (!store) return
    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabaseUpdate('stores', store.id, data)
      if (updateError) throw updateError

      // Update local state
      setStore({ ...store, ...data })
      setEditFormOpen(false)
      toast.success('Store updated successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update store')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || setupLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error}</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
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

  // Show setup wizard if store setup is not complete
  // Use local `store` state for consistency (both are fetched from same storeId)
  if (!setupStatus.isSetupComplete && store) {
    return (
      <StoreSetupWizard
        store={store}
        status={setupStatus}
        onRefresh={refetchSetupStatus}
      />
    )
  }

  // Determine card statuses
  const hasLowStock = lowStockCount > 0
  const needsDelivery = hasLowStock // Show delivery needed if there's low stock

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{store.name}</h1>
            <Badge variant={store.is_active ? 'default' : 'secondary'}>
              {store.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {store.address && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {store.address}
            </p>
          )}
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setEditFormOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Store
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href={`/stores/${storeId}/stock`}>
          <StatsCard
            title="Stock Levels"
            value={hasLowStock ? lowStockCount : '✓'}
            description={hasLowStock ? `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} below PAR` : 'All items stocked'}
            icon={<Package className="h-4 w-4" />}
            variant={hasLowStock ? 'danger' : 'default'}
            className="hover:border-primary/50 transition-colors cursor-pointer"
          />
        </Link>

        {canCount ? (
          <Link href={`/stores/${storeId}/stock-count`}>
            <StatsCard
              title="Stock Count"
              value={todayCountDone ? '✓' : '!'}
              description={todayCountDone ? 'Completed today' : 'Not done today'}
              icon={<ClipboardList className="h-4 w-4" />}
              variant={todayCountDone ? 'success' : 'warning'}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            />
          </Link>
        ) : (
          <StatsCard
            title="Stock Count"
            value="-"
            description="No access"
            icon={<ClipboardList className="h-4 w-4" />}
            className="opacity-40"
          />
        )}

        {canReceive ? (
          <Link href={`/stores/${storeId}/stock-reception`}>
            <StatsCard
              title="Reception"
              value={needsDelivery ? '!' : '✓'}
              description={needsDelivery ? 'Delivery needed' : 'Record deliveries'}
              icon={<Truck className="h-4 w-4" />}
              variant={needsDelivery ? 'warning' : 'default'}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            />
          </Link>
        ) : (
          <StatsCard
            title="Reception"
            value="-"
            description="No access"
            icon={<Truck className="h-4 w-4" />}
            className="opacity-40"
          />
        )}

        {canManage ? (
          <Link href={`/stores/${storeId}/users`}>
            <StatsCard
              title="Users"
              value="→"
              description="Manage staff"
              icon={<Users className="h-4 w-4" />}
              className="hover:border-primary/50 transition-colors cursor-pointer"
            />
          </Link>
        ) : (
          <StatsCard
            title="Users"
            value="-"
            description="No access"
            icon={<Users className="h-4 w-4" />}
            className="opacity-40"
          />
        )}
      </div>

      {/* Today's Activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Today&apos;s Activity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !storeActivity || storeActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No activity recorded today</p>
              <p className="text-xs text-muted-foreground mt-1">
                Stock counts and receptions will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {storeActivity.slice(0, 8).map((activity) => (
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

      <StoreForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        store={store}
        onSubmit={handleEditSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}
