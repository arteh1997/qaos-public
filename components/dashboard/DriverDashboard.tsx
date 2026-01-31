'use client'

import Link from 'next/link'
import { useStores } from '@/hooks/useStores'
import { useStockHistory } from '@/hooks/useReports'
import { useAuth } from '@/hooks/useAuth'
import { StatsCard } from '@/components/cards/StatsCard'
import { StoreCard } from '@/components/cards/StoreCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Store,
  Truck,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function DriverDashboard() {
  const { user } = useAuth()
  const { stores, isLoading: storesLoading } = useStores()
  const { data: recentHistory, isLoading: historyLoading } = useStockHistory()

  const isLoading = storesLoading || historyLoading

  // Filter to only show this driver's receptions
  const myRecentDeliveries = (recentHistory ?? [])
    .filter(h => h.action_type === 'Reception' && h.performed_by === user?.id)
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  const activeStores = stores.filter(s => s.is_active)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Driver Dashboard</h1>
        <p className="text-muted-foreground">
          Record deliveries and view store inventory across all locations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Stores"
          value={activeStores.length}
          description="Available for delivery"
          icon={<Store className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="My Deliveries Today"
          value={myRecentDeliveries.filter(d =>
            new Date(d.created_at).toDateString() === new Date().toDateString()
          ).length}
          description="Receptions recorded"
          icon={<Truck className="h-4 w-4 text-muted-foreground" />}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Select a store to record a delivery
            </p>
            <Link href="/stores">
              <Button className="w-full">
                <Truck className="mr-2 h-4 w-4" />
                Record Delivery
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">My Recent Deliveries</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {myRecentDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent deliveries</p>
            ) : (
              <div className="space-y-3">
                {myRecentDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {delivery.inventory_item?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.store?.name} • +{delivery.quantity_change}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/stores">
              <Button variant="outline" className="w-full justify-between">
                View All Stores
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full justify-between">
                View Reports
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/reports/low-stock">
              <Button variant="outline" className="w-full justify-between">
                Low Stock Report
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">All Stores</h2>
          <Link href="/stores">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeStores.slice(0, 6).map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </div>
    </div>
  )
}
