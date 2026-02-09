'use client'

import { Suspense, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShiftsTableSkeleton, PageHeaderSkeleton } from '@/components/ui/skeletons'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Calendar, CalendarDays, ClockArrowUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { EditClockTimesDialog } from '@/components/forms/EditClockTimesDialog'
import { format, isSameDay, isToday, startOfWeek, endOfWeek, startOfDay, endOfDay, addWeeks, parseISO, isWithinInterval } from 'date-fns'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'

type QuickFilter = 'today' | 'week' | 'next-week' | null

function getShiftStatus(shift: Shift) {
  const now = new Date()
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)

  if (shift.clock_out_time) {
    return { label: 'Completed', variant: 'secondary' as const, isActive: false }
  }
  if (shift.clock_in_time && !shift.clock_out_time) {
    return { label: 'Active Now', variant: 'default' as const, isActive: true }
  }
  if (now >= start && now <= end && !shift.clock_in_time) {
    return { label: 'Not Clocked In', variant: 'destructive' as const, isActive: true }
  }
  if (now < start) {
    return { label: 'Scheduled', variant: 'outline' as const, isActive: false }
  }
  return { label: 'Missed', variant: 'destructive' as const, isActive: false }
}

function ShiftsPageContent() {
  const { currentStore } = useAuth()
  const currentStoreId = currentStore?.store_id

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('today')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editingClockTimesShift, setEditingClockTimesShift] = useState<Shift | null>(null)
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const { stores, isLoading: storesLoading } = useStores({ status: 'active' })
  const { users, isLoading: usersLoading } = useUsers({ status: 'Active', storeId: currentStoreId || 'all' })
  const { shifts, isLoading: shiftsLoading, createShift, updateShift, deleteShift, refetch: refetchShifts } = useShifts(currentStoreId || null)

  const isLoading = storesLoading || usersLoading || shiftsLoading

  // Get active shifts (happening right now)
  const activeShifts = useMemo(() => {
    const now = new Date()
    return shifts.filter(shift => {
      const start = new Date(shift.start_time)
      const end = new Date(shift.end_time)
      return now >= start && now <= end
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [shifts])

  // Filter shifts based on quick filter
  const filteredShifts = useMemo(() => {
    if (!quickFilter) return shifts

    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (quickFilter) {
      case 'today':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 }) // Monday
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'next-week':
        const nextWeek = addWeeks(now, 1)
        startDate = startOfWeek(nextWeek, { weekStartsOn: 1 })
        endDate = endOfWeek(nextWeek, { weekStartsOn: 1 })
        break
      default:
        return shifts
    }

    return shifts.filter(shift => {
      const shiftStart = new Date(shift.start_time)
      return isWithinInterval(shiftStart, { start: startDate, end: endDate })
    })
  }, [shifts, quickFilter])

  // Group shifts by date
  const groupedShifts = useMemo(() => {
    const groups = new Map<string, Shift[]>()

    filteredShifts.forEach(shift => {
      const dateKey = format(new Date(shift.start_time), 'yyyy-MM-dd')
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(shift)
    })

    // Sort shifts within each day by start time
    groups.forEach(dayShifts => {
      dayShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    })

    // Convert to array and sort by date
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
  }, [filteredShifts])

  const handleCreateShift = async (data: ShiftFormData) => {
    setIsCreating(true)
    try {
      await createShift(data)
      setIsFormOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateShift = async (data: ShiftFormData) => {
    if (!editingShift) return
    setIsUpdating(true)
    try {
      await updateShift({ id: editingShift.id, data })
      setEditingShift(null)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!deleteShiftId) return
    await deleteShift(deleteShiftId)
    setDeleteShiftId(null)
  }

  if (!currentStore) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shifts Management</h1>
          <p className="text-sm text-muted-foreground">
            Please select a store from the sidebar to view its shifts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff shifts at {currentStore.store?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/shifts/timetable">
            <Button variant="outline" className="bg-white">
              <CalendarDays className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Calendar View</span>
              <span className="sm:hidden">Calendar</span>
            </Button>
          </Link>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Create Shift</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </div>
      </div>

      {/* Active Shifts - Right Now */}
      {activeShifts.length > 0 && (
        <Card className="border-blue-500 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-blue-900">
                Active Now ({activeShifts.length} shift{activeShifts.length !== 1 ? 's' : ''})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeShifts.map(shift => {
                const status = getShiftStatus(shift)
                return (
                  <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          {shift.user?.full_name || shift.user?.email || 'Unknown'}
                        </p>
                        <p className="text-xs text-blue-700">
                          {format(new Date(shift.start_time), 'h:mm a')} - {format(new Date(shift.end_time), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {shift.clock_in_time ? (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          ✓ Clocked In
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Clocked In
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingShift(shift)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingClockTimesShift(shift)}>
                            <ClockArrowUp className="mr-2 h-4 w-4" />
                            Edit Clock Times
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={quickFilter === 'today' ? 'default' : 'outline'}
          onClick={() => setQuickFilter('today')}
          size="sm"
          className={quickFilter !== 'today' ? 'bg-white' : ''}
        >
          Today
        </Button>
        <Button
          variant={quickFilter === 'week' ? 'default' : 'outline'}
          onClick={() => setQuickFilter('week')}
          size="sm"
          className={quickFilter !== 'week' ? 'bg-white' : ''}
        >
          This Week
        </Button>
        <Button
          variant={quickFilter === 'next-week' ? 'default' : 'outline'}
          onClick={() => setQuickFilter('next-week')}
          size="sm"
          className={quickFilter !== 'next-week' ? 'bg-white' : ''}
        >
          Next Week
        </Button>
        {quickFilter && (
          <Button
            variant="ghost"
            onClick={() => setQuickFilter(null)}
            size="sm"
            className="text-muted-foreground bg-white"
          >
            View All
          </Button>
        )}
      </div>

      {/* Shifts Grouped by Day */}
      {isLoading ? (
        <ShiftsTableSkeleton rows={5} />
      ) : groupedShifts.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="py-16">
            <EmptyState
              icon={Calendar}
              title="No shifts scheduled"
              description={quickFilter === 'today'
                ? "No shifts scheduled for today."
                : quickFilter === 'week'
                ? "No shifts scheduled for this week."
                : quickFilter === 'next-week'
                ? "No shifts scheduled for next week."
                : "Create shifts to schedule your team members."
              }
              action={{
                label: "Create Shift",
                onClick: () => setIsFormOpen(true),
                icon: Plus,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedShifts.map(([dateKey, dayShifts]) => {
            const date = parseISO(dateKey)
            const isNow = isToday(date)

            return (
              <Card key={dateKey} className={isNow ? 'border-blue-500/50 bg-white' : 'bg-white'}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      {format(date, 'EEEE, MMMM d, yyyy')}
                      {isNow && (
                        <Badge variant="default" className="ml-2 text-xs">
                          Today
                        </Badge>
                      )}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dayShifts.map(shift => {
                      const status = getShiftStatus(shift)
                      return (
                        <div
                          key={shift.id}
                          className="flex items-center justify-between py-3 border-b last:border-0"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-[140px]">
                              <Clock className="h-4 w-4" />
                              {format(new Date(shift.start_time), 'h:mm a')} - {format(new Date(shift.end_time), 'h:mm a')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {shift.user?.full_name || shift.user?.email || 'Unknown'}
                              </p>
                              {(shift.clock_in_time || shift.clock_out_time) && (
                                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                  {shift.clock_in_time && (
                                    <span className="text-green-600">
                                      In: {format(new Date(shift.clock_in_time), 'h:mm a')}
                                    </span>
                                  )}
                                  {shift.clock_out_time && (
                                    <span>
                                      Out: {format(new Date(shift.clock_out_time), 'h:mm a')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={status.variant} className="text-xs">
                              {status.label}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingShift(shift)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Schedule
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingClockTimesShift(shift)}>
                                  <ClockArrowUp className="mr-2 h-4 w-4" />
                                  Edit Clock Times
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteShiftId(shift.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ShiftForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        stores={stores}
        users={users}
        onSubmit={handleCreateShift}
        isLoading={isCreating}
        initialStoreId={currentStoreId}
      />

      <ShiftForm
        open={!!editingShift}
        onOpenChange={(open) => !open && setEditingShift(null)}
        shift={editingShift}
        stores={stores}
        users={users}
        onSubmit={handleUpdateShift}
        isLoading={isUpdating}
        initialStoreId={currentStoreId}
      />

      <AlertDialog open={!!deleteShiftId} onOpenChange={(open) => !open && setDeleteShiftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShift}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditClockTimesDialog
        open={!!editingClockTimesShift}
        onOpenChange={(open) => !open && setEditingClockTimesShift(null)}
        shift={editingClockTimesShift}
        onSuccess={refetchShifts}
      />
    </div>
  )
}

export default function ShiftsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <PageHeaderSkeleton />
        <Card>
          <CardHeader>
            <div className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <ShiftsTableSkeleton rows={5} />
          </CardContent>
        </Card>
      </div>
    }>
      <ShiftsPageContent />
    </Suspense>
  )
}
