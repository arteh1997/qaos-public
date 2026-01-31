'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { ShiftsTable } from '@/components/tables/ShiftsTable'
import { StaffWeeklyView } from '@/components/timetable/StaffWeeklyView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, LogIn, LogOut, Calendar, List } from 'lucide-react'
import { format, isToday, isFuture, isPast } from 'date-fns'

type ViewMode = 'calendar' | 'list'

export default function MyShiftsPage() {
  const { user } = useAuth()
  const {
    shifts,
    currentShift,
    todayShifts,
    clockIn,
    clockOut,
    isLoading,
  } = useShifts(null, user?.id)  // Only filter by user, not store
  const { stores, isLoading: storesLoading } = useStores()

  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)

  if (isLoading || storesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  // Separate shifts into categories
  const now = new Date()

  // Upcoming: starts in the future
  const upcomingShifts = shifts.filter(s => {
    const start = new Date(s.start_time)
    return isFuture(start)
  })

  // Past: ended (end time is past) OR clocked out
  const pastShifts = shifts.filter(s => {
    const end = new Date(s.end_time)
    return isPast(end) || !!s.clock_out_time
  })

  // Current/Active: started but not ended, and not clocked out
  // This includes shifts that span multiple days
  const activeShifts = shifts.filter(s => {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    return start <= now && end >= now && !s.clock_out_time
  })

  // Today's shift for the card display - either active or starting today
  const todayShift = activeShifts[0] || todayShifts[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Shifts</h1>
          <p className="text-sm text-muted-foreground">
            View your schedule and clock in/out
          </p>
        </div>

        {/* View Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="calendar" className="gap-1.5 sm:gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 sm:gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Today's Shift Card */}
      {todayShift && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {activeShifts.includes(todayShift) ? 'Current Shift' : "Today's Shift"}
              </CardTitle>
              {todayShift.clock_in_time && !todayShift.clock_out_time && (
                <Badge variant="default" className="bg-green-600">Clocked In</Badge>
              )}
              {todayShift.clock_out_time && (
                <Badge variant="secondary">Completed</Badge>
              )}
              {!todayShift.clock_in_time && (
                <Badge variant="outline">Not Started</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-xl font-bold">
                {format(new Date(todayShift.start_time), 'MMM d, h:mm a')} -{' '}
                {format(new Date(todayShift.end_time), 'MMM d, h:mm a')}
              </p>
            </div>

            {/* Clock times display */}
            <div className="flex flex-wrap gap-6">
              {todayShift.clock_in_time && (
                <div>
                  <p className="text-sm text-muted-foreground">Clocked In</p>
                  <p className="text-lg font-semibold text-green-600">
                    {format(new Date(todayShift.clock_in_time), 'h:mm a')}
                  </p>
                </div>
              )}
              {todayShift.clock_out_time && (
                <div>
                  <p className="text-sm text-muted-foreground">Clocked Out</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(todayShift.clock_out_time), 'h:mm a')}
                  </p>
                </div>
              )}
            </div>

            {todayShift.notes && (
              <p className="text-sm text-muted-foreground">
                Note: {todayShift.notes}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {!todayShift.clock_in_time && (
                <Button
                  onClick={async () => {
                    setIsClockingIn(true)
                    try {
                      await clockIn(todayShift.id)
                    } finally {
                      setIsClockingIn(false)
                    }
                  }}
                  disabled={isClockingIn}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {isClockingIn ? 'Clocking In...' : 'Clock In'}
                </Button>
              )}
              {todayShift.clock_in_time && !todayShift.clock_out_time && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setIsClockingOut(true)
                    try {
                      await clockOut(todayShift.id)
                    } finally {
                      setIsClockingOut(false)
                    }
                  }}
                  disabled={isClockingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isClockingOut ? 'Clocking Out...' : 'Clock Out'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!todayShift && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active or scheduled shift for today
          </CardContent>
        </Card>
      )}

      {/* Weekly Calendar View */}
      {viewMode === 'calendar' && (
        <StaffWeeklyView
          shifts={shifts}
          stores={stores}
          currentWeek={currentWeek}
          onWeekChange={setCurrentWeek}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upcoming Shifts</h2>
            <ShiftsTable
              shifts={upcomingShifts}
              showUser={false}
              showStore={true}
              canManage={false}
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Past Shifts</h2>
            <ShiftsTable
              shifts={pastShifts}
              showUser={false}
              showStore={true}
              canManage={false}
            />
          </div>
        </>
      )}
    </div>
  )
}
