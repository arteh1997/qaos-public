'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useStores } from '@/hooks/useStores'
import { useShifts } from '@/hooks/useShifts'
import { useStockHistory } from '@/hooks/useReports'
import { StatsCard } from '@/components/cards/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PackageCheck,
  Truck,
  Store,
  Clock,
  ArrowRight,
  CheckCircle,
  Activity,
  FileText,
  AlertTriangle,
  Package,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export function DriverDashboard() {
  const { user, storeId } = useAuth()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { stores, isLoading: storesLoading } = useStores()
  const { todayShifts, clockIn, clockOut, isLoading: shiftsLoading } = useShifts(storeId, user?.id)
  const { data: recentHistory, isLoading: historyLoading } = useStockHistory(null, undefined)

  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)

  const isLoading = storeLoading || storesLoading || historyLoading || shiftsLoading

  // Filter to this driver's receptions
  const myDeliveries = useMemo(() =>
    (recentHistory ?? [])
      .filter(h => h.action_type === 'Reception' && h.performed_by === user?.id),
    [recentHistory, user?.id]
  )

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

  const activeStores = useMemo(() =>
    stores.filter(s => s.is_active),
    [stores]
  )

  const myTodayShift = todayShifts[0]

  // Get first name for greeting
  const firstName = user?.email?.split('@')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {store?.name ? `${store.name} \u00B7 ` : ''}{format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* TODAY'S SHIFT */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Today&apos;s Shift</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {myTodayShift ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {format(new Date(myTodayShift.start_time), 'h:mm a')} &ndash;{' '}
                  {format(new Date(myTodayShift.end_time), 'h:mm a')}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {myTodayShift.clock_in_time
                    ? `Clocked in ${formatDistanceToNow(new Date(myTodayShift.clock_in_time), { addSuffix: true })}`
                    : 'Not yet clocked in'}
                </p>
              </div>
              <div>
                {myTodayShift.clock_in_time && !myTodayShift.clock_out_time ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsClockingOut(true)
                      try { await clockOut(myTodayShift.id) } finally { setIsClockingOut(false) }
                    }}
                    disabled={isClockingOut}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                ) : !myTodayShift.clock_in_time ? (
                  <Button
                    onClick={async () => {
                      setIsClockingIn(true)
                      try { await clockIn(myTodayShift.id) } finally { setIsClockingIn(false) }
                    }}
                    disabled={isClockingIn}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Clock In
                  </Button>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Shift Complete
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <p className="text-sm">No shift scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Today's Deliveries"
          value={todayDeliveries.length}
          description="Receptions recorded"
          icon={<Truck className="h-4 w-4" />}
          className="bg-white"
        />
        <StatsCard
          title="Items Delivered"
          value={todayItemsDelivered}
          description="Total units today"
          icon={<Package className="h-4 w-4" />}
          className="bg-white"
        />
        <StatsCard
          title="Active Stores"
          value={activeStores.length}
          description="Available for delivery"
          icon={<Store className="h-4 w-4" />}
          className="bg-white"
        />
      </div>

      {/* QUICK ACTIONS */}
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/deliveries">
              <Button className="w-full" size="lg">
                <PackageCheck className="h-4 w-4 mr-2" />
                Record Delivery
              </Button>
            </Link>
            <Link href="/reports/low-stock">
              <Button variant="outline" className="w-full" size="lg">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Low Stock Report
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full" size="lg">
                <FileText className="h-4 w-4 mr-2" />
                View Reports
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* BOTTOM SECTION: Recent Deliveries + Store List */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Deliveries */}
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Recent Deliveries</CardTitle>
              </div>
              <Link href="/deliveries">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {myDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <PackageCheck className="h-6 w-6 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No deliveries recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myDeliveries.slice(0, 6).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {delivery.inventory_item?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.store?.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        +{delivery.quantity_change}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stores */}
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Your Stores</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {activeStores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Store className="h-6 w-6 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No active stores assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeStores.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      {s.address && (
                        <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                      )}
                    </div>
                    <Link href={`/stores/${s.id}/stock-reception`}>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <Truck className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
