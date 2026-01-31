'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useShifts } from '@/hooks/useShifts'
import { useDailyCounts } from '@/hooks/useReports'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { StatsCard } from '@/components/cards/StatsCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Store,
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'

export function StaffDashboard() {
  const { user, storeId } = useAuth()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { todayShifts, currentShift, clockIn, clockOut, isLoading: shiftsLoading } = useShifts(storeId, user?.id)
  const { data: dailyCounts, isLoading: countsLoading } = useDailyCounts()
  const { lowStockItems, isLoading: inventoryLoading } = useStoreInventory(storeId)

  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)

  const isLoading = storeLoading || shiftsLoading || countsLoading || inventoryLoading

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

  // Check if today's count is completed
  const today = new Date().toISOString().split('T')[0]
  const todayCountCompleted = dailyCounts?.some(c =>
    c.store_id === storeId && c.count_date === today
  ) ?? false

  // Get my today's shift
  const myTodayShift = todayShifts[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your store overview.
        </p>
      </div>

      {store && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <CardTitle className="text-lg">{store.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{store.address}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Today's Stock Count"
          value={todayCountCompleted ? 'Completed' : 'Pending'}
          description={todayCountCompleted ? 'Good job!' : 'Please complete your count'}
          icon={
            todayCountCompleted ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-yellow-500" />
            )
          }
          variant={todayCountCompleted ? 'success' : 'warning'}
        />

        <StatsCard
          title="Low Stock Items"
          value={lowStockItems.length}
          description="Items below PAR level"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          variant={lowStockItems.length > 0 ? 'warning' : 'default'}
        />

        {myTodayShift ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Today&apos;s Shift</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {format(new Date(myTodayShift.start_time), 'h:mm a')} -{' '}
                {format(new Date(myTodayShift.end_time), 'h:mm a')}
              </p>
              <div className="mt-2">
                {myTodayShift.clock_in_time && !myTodayShift.clock_out_time ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setIsClockingOut(true)
                      try {
                        await clockOut(myTodayShift.id)
                      } finally {
                        setIsClockingOut(false)
                      }
                    }}
                    disabled={isClockingOut}
                  >
                    Clock Out
                  </Button>
                ) : !myTodayShift.clock_in_time ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      setIsClockingIn(true)
                      try {
                        await clockIn(myTodayShift.id)
                      } finally {
                        setIsClockingIn(false)
                      }
                    }}
                    disabled={isClockingIn}
                  >
                    Clock In
                  </Button>
                ) : (
                  <Badge variant="secondary">Shift Completed</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <StatsCard
            title="Today's Shift"
            value="No Shift"
            description="No shift scheduled today"
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!todayCountCompleted && storeId && (
              <Link href={`/stores/${storeId}/stock-count`}>
                <Button className="w-full justify-between">
                  <span className="flex items-center">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Complete Stock Count
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {storeId && (
              <Link href={`/stores/${storeId}/stock`}>
                <Button variant="outline" className="w-full justify-between">
                  View Current Stock
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/my-shifts">
              <Button variant="outline" className="w-full justify-between">
                View My Shifts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {lowStockItems.length > 0 && (
          <Card className="border-yellow-500/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-base">Low Stock Items</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">
                      {item.inventory_item?.name}
                    </span>
                    <Badge variant="destructive">
                      {item.quantity} / {item.par_level}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
