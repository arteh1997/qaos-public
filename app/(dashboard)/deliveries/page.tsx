'use client'

import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useStockHistory } from '@/hooks/useReports'
import { StockReceptionForm } from '@/components/forms/StockReceptionForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/cards/StatsCard'
import {
  PackageCheck,
  Truck,
  Clock,
  Package,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export default function DeliveriesPage() {
  const { user, storeId } = useAuth()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { data: recentHistory, isLoading: historyLoading } = useStockHistory(storeId || null, undefined)

  const isLoading = storeLoading || historyLoading

  const myDeliveries = useMemo(() => {
    return (recentHistory ?? [])
      .filter(h => h.action_type === 'Reception' && h.performed_by === user?.id)
  }, [recentHistory, user?.id])

  const todayDeliveries = useMemo(() =>
    myDeliveries.filter(d =>
      new Date(d.created_at).toDateString() === new Date().toDateString()
    ),
    [myDeliveries]
  )

  const todayItemsDelivered = useMemo(() =>
    todayDeliveries.reduce((sum, d) => sum + (d.quantity_change ?? 0), 0),
    [todayDeliveries]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
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
          <PackageCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Please select a store from the sidebar to record deliveries.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Stock Reception</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {store?.name} &middot; {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatsCard
          title="Today's Deliveries"
          value={todayDeliveries.length}
          description="Recorded today"
          icon={<Truck className="h-4 w-4" />}
        />
        <StatsCard
          title="Items Received"
          value={todayItemsDelivered}
          description="Units received today"
          icon={<Package className="h-4 w-4" />}
        />
        <StatsCard
          title="All Time"
          value={myDeliveries.length}
          description="Your total deliveries"
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Record Delivery Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Record Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StockReceptionForm storeId={storeId} />
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      {myDeliveries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myDeliveries.slice(0, 15).map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{delivery.inventory_item?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-mono shrink-0 ml-3">
                    +{delivery.quantity_change}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
