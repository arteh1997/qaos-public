'use client'

import { Suspense, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/cards/StatsCard'
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
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  CalendarDays,
  ClockArrowUp,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { EditClockTimesDialog } from '@/components/forms/EditClockTimesDialog'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { DateRange } from 'react-day-picker'
import {
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addWeeks,
  subWeeks,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'
import { cn } from '@/lib/utils'
import { PageGuide } from '@/components/help/PageGuide'

// ── Thresholds (minutes) ─────────────────────────────────────
const LATE_THRESHOLD = 5
const NO_SHOW_THRESHOLD = 30
const LEFT_EARLY_THRESHOLD = 15
const OVERTIME_THRESHOLD = 15

// ── Avatar colors (warm palette) ─────────────────────────────
const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-cyan-100 text-cyan-700',
]

// ── Helpers ──────────────────────────────────────────────────

function getShiftStatus(shift: Shift) {
  const now = new Date()
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  const clockIn = shift.clock_in_time ? new Date(shift.clock_in_time) : null
  const clockOut = shift.clock_out_time ? new Date(shift.clock_out_time) : null
  const minutesSinceStart = (now.getTime() - start.getTime()) / 60000

  // Before shift
  if (now < start) {
    if (clockIn && clockOut) {
      return { label: 'Completed', variant: 'success' as const, isActive: false }
    }
    if (clockIn) {
      return { label: 'Clocked In Early', variant: 'default' as const, isActive: true }
    }
    return { label: 'Scheduled', variant: 'outline' as const, isActive: false }
  }

  // During shift
  if (now <= end) {
    if (!clockIn) {
      if (clockOut) {
        return { label: 'Completed', variant: 'success' as const, isActive: false }
      }
      if (minutesSinceStart >= NO_SHOW_THRESHOLD) {
        return { label: 'No Show', variant: 'destructive' as const, isActive: false }
      }
      return { label: 'Not Clocked In', variant: 'warning' as const, isActive: true }
    }

    if (clockOut) {
      const minutesBeforeEnd = (end.getTime() - clockOut.getTime()) / 60000
      if (minutesBeforeEnd >= LEFT_EARLY_THRESHOLD) {
        return { label: 'Left Early', variant: 'warning' as const, isActive: false }
      }
      return { label: 'Completed', variant: 'success' as const, isActive: false }
    }

    const minutesLate = (clockIn.getTime() - start.getTime()) / 60000
    if (minutesLate > LATE_THRESHOLD) {
      return { label: 'Active · Late', variant: 'warning' as const, isActive: true }
    }
    return { label: 'Active', variant: 'default' as const, isActive: true }
  }

  // After shift
  if (!clockIn) {
    if (clockOut) {
      return { label: 'Completed', variant: 'success' as const, isActive: false }
    }
    return { label: 'Missed', variant: 'destructive' as const, isActive: false }
  }

  if (!clockOut) {
    return { label: 'No Clock Out', variant: 'warning' as const, isActive: false }
  }

  // Both present — evaluate quality
  const minutesLate = (clockIn.getTime() - start.getTime()) / 60000
  const minutesBeforeEnd = (end.getTime() - clockOut.getTime()) / 60000
  const minutesAfterEnd = (clockOut.getTime() - end.getTime()) / 60000

  if (minutesBeforeEnd >= LEFT_EARLY_THRESHOLD) {
    return { label: 'Left Early', variant: 'warning' as const, isActive: false }
  }
  if (minutesLate > LATE_THRESHOLD) {
    return { label: 'Late Arrival', variant: 'warning' as const, isActive: false }
  }
  if (minutesAfterEnd > OVERTIME_THRESHOLD) {
    return { label: 'Overtime', variant: 'secondary' as const, isActive: false }
  }
  return { label: 'Completed', variant: 'success' as const, isActive: false }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatDuration(startTime: string, endTime: string): string {
  const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const hours = Math.floor(diffMs / 3600000)
  const mins = Math.round((diffMs % 3600000) / 60000)
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function getShiftProgress(shift: Shift): number {
  const now = new Date()
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  const total = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

function formatTimeRemaining(endTime: string): string {
  const end = new Date(endTime)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return 'Ending now'
  const hours = Math.floor(diffMs / 3600000)
  const mins = Math.round((diffMs % 3600000) / 60000)
  if (hours === 0) return `${mins}m left`
  if (mins === 0) return `${hours}h left`
  return `${hours}h ${mins}m left`
}

function formatHours(hours: number): string {
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`
}

// ── Page ─────────────────────────────────────────────────────

function ShiftsPageContent() {
  const { currentStore } = useAuth()
  const currentStoreId = currentStore?.store_id

  const [pickerRange, setPickerRange] = useState<DateRange>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editingClockTimesShift, setEditingClockTimesShift] = useState<Shift | null>(null)
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Convert picker range to ISO strings for the hook
  const dateRange = useMemo(() => {
    const from = pickerRange?.from ?? new Date()
    const to = pickerRange?.to ?? from
    return {
      from: startOfDay(from).toISOString(),
      to: endOfDay(to).toISOString(),
    }
  }, [pickerRange])

  const { stores, isLoading: storesLoading } = useStores({ status: 'active' })
  const { users, isLoading: usersLoading } = useUsers({ status: 'Active', storeId: currentStoreId || 'all' })
  const { shifts, isLoading: shiftsLoading, createShift, updateShift, deleteShift, refetch: refetchShifts } = useShifts(currentStoreId || null, null, dateRange)

  const isLoading = storesLoading || usersLoading || shiftsLoading

  // Does the selected range include today?
  const viewIncludesToday = useMemo(() => {
    if (!pickerRange?.from) return false
    const from = startOfDay(pickerRange.from)
    const to = pickerRange.to ? endOfDay(pickerRange.to) : endOfDay(pickerRange.from)
    return isWithinInterval(new Date(), { start: from, end: to })
  }, [pickerRange])

  // Active shifts (happening right now)
  const activeShifts = useMemo(() => {
    if (!viewIncludesToday) return []
    const now = new Date()
    return shifts
      .filter(shift => {
        const start = new Date(shift.start_time)
        const end = new Date(shift.end_time)
        return now >= start && now <= end
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [shifts, viewIncludesToday])

  // Summary stats
  const stats = useMemo(() => {
    const now = new Date()
    const totalHoursNum = shifts.reduce((acc, s) => {
      return acc + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000
    }, 0)
    const pastShifts = shifts.filter(s => new Date(s.end_time) < now)
    const attendedShifts = pastShifts.filter(s => s.clock_in_time != null)
    const attendanceRate = pastShifts.length > 0
      ? Math.round((attendedShifts.length / pastShifts.length) * 100)
      : null

    return {
      totalHours: Math.round(totalHoursNum * 10) / 10,
      attendanceRate,
      attendedCount: attendedShifts.length,
      pastShiftsCount: pastShifts.length,
    }
  }, [shifts])

  // Group shifts by date
  const groupedShifts = useMemo(() => {
    const groups = new Map<string, Shift[]>()
    shifts.forEach(shift => {
      const dateKey = format(new Date(shift.start_time), 'yyyy-MM-dd')
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey)!.push(shift)
    })
    groups.forEach(dayShifts => {
      dayShifts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [shifts])

  // Week navigation
  const handlePrevWeek = () => {
    const anchor = pickerRange?.from ?? new Date()
    const prevWeekStart = subWeeks(startOfWeek(anchor, { weekStartsOn: 1 }), 1)
    setPickerRange({ from: prevWeekStart, to: endOfWeek(prevWeekStart, { weekStartsOn: 1 }) })
  }

  const handleNextWeek = () => {
    const anchor = pickerRange?.from ?? new Date()
    const nextWeekStart = addWeeks(startOfWeek(anchor, { weekStartsOn: 1 }), 1)
    setPickerRange({ from: nextWeekStart, to: endOfWeek(nextWeekStart, { weekStartsOn: 1 }) })
  }

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
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Shifts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a store to manage shifts
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Shifts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStore.store?.name}&apos;s team schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuide pageKey="shifts" />
          <Link href="/shifts/timetable">
            <Button variant="outline" className="bg-card">
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

      {/* ── Navigation ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-card"
          onClick={handlePrevWeek}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <DateRangePicker
          value={pickerRange}
          onChange={(range) => setPickerRange(range || {
            from: startOfWeek(new Date(), { weekStartsOn: 1 }),
            to: endOfWeek(new Date(), { weekStartsOn: 1 }),
          })}
          presets={['today', 'yesterday', 'thisWeek', 'lastWeek', 'last7days', 'last14days']}
          allowFutureDates
        />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-card"
          onClick={handleNextWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Stats Overview ── */}
      {!isLoading && shifts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCard
            title="Shifts Scheduled"
            value={shifts.length}
            description="for this period"
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <StatsCard
            title="Hours Planned"
            value={formatHours(stats.totalHours)}
            description="across your team"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatsCard
            title="Attendance"
            value={stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '—'}
            description={
              stats.pastShiftsCount > 0
                ? `${stats.attendedCount} of ${stats.pastShiftsCount} past shifts clocked in`
                : 'No completed shifts yet'
            }
            icon={<Users className="h-4 w-4" />}
            variant={stats.attendanceRate !== null && stats.attendanceRate < 80 ? 'warning' : 'default'}
          />
        </div>
      )}

      {/* ── Active Now ── */}
      {!isLoading && viewIncludesToday && activeShifts.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <CardTitle className="text-sm font-semibold">
                {activeShifts.length} team member{activeShifts.length !== 1 ? 's' : ''} on shift right now
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeShifts.map(shift => {
              const progress = getShiftProgress(shift)
              const remaining = formatTimeRemaining(shift.end_time)
              const name = shift.user?.full_name || shift.user?.email || 'Unknown'
              const status = getShiftStatus(shift)

              return (
                <div key={shift.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                        getAvatarColor(name)
                      )}>
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{remaining}</span>
                    </div>
                  </div>
                  <div className="ml-11">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 sm:hidden">{remaining}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Shifts by Day ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groupedShifts.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="py-16">
            {(() => {
              const now = new Date()
              const rangeEnd = pickerRange?.to ?? pickerRange?.from ?? now
              const isPast = endOfDay(rangeEnd) < startOfDay(now)
              const rangeLabel = pickerRange?.from && pickerRange?.to
                ? format(pickerRange.from, 'yyyy-MM-dd') === format(pickerRange.to, 'yyyy-MM-dd')
                  ? format(pickerRange.from, 'EEEE, d MMMM')
                  : `${format(pickerRange.from, 'd MMM')} – ${format(pickerRange.to, 'd MMM')}`
                : null

              if (isPast) {
                return (
                  <EmptyState
                    icon={CalendarDays}
                    title="Nothing was scheduled"
                    description={
                      rangeLabel
                        ? `No one was scheduled to work ${rangeLabel}.`
                        : "No shifts found for this period."
                    }
                    action={{
                      label: "Go to This Week",
                      onClick: () => setPickerRange({
                        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
                        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
                      }),
                      icon: CalendarDays,
                    }}
                  />
                )
              }

              return (
                <EmptyState
                  icon={CalendarDays}
                  title={viewIncludesToday ? "No shifts scheduled yet" : "Nothing planned yet"}
                  description={
                    viewIncludesToday
                      ? "Your team doesn't have any shifts right now. Create shifts to get everyone organised."
                      : rangeLabel
                        ? `No shifts planned for ${rangeLabel}. Schedule ahead to stay prepared.`
                        : "Create shifts to schedule your team."
                  }
                  action={{
                    label: "Create Shift",
                    onClick: () => setIsFormOpen(true),
                    icon: Plus,
                  }}
                />
              )
            })()}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedShifts.map(([dateKey, dayShifts]) => {
            const date = parseISO(dateKey)
            const isNow = isToday(date)
            const dayHours = dayShifts.reduce((acc, s) => {
              return acc + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000
            }, 0)

            return (
              <Card key={dateKey} className={cn('bg-card', isNow && 'border-emerald-500/40')}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {isNow && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
                      <CardTitle className="text-sm font-semibold">
                        {isNow ? 'Today' : format(date, 'EEEE')}
                        <span className="font-normal text-muted-foreground ml-1.5">
                          {format(date, 'd MMMM')}
                        </span>
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} · {formatHours(Math.round(dayHours * 10) / 10)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border/50">
                    {dayShifts.map(shift => {
                      const status = getShiftStatus(shift)
                      const name = shift.user?.full_name || shift.user?.email || 'Unknown'

                      return (
                        <div
                          key={shift.id}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          {/* Avatar */}
                          <div className={cn(
                            'h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                            getAvatarColor(name)
                          )}>
                            {getInitials(name)}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}
                              </span>
                              <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-medium">
                                {formatDuration(shift.start_time, shift.end_time)}
                              </span>
                              {shift.clock_in_time && (
                                <span className="text-emerald-600">
                                  In: {format(new Date(shift.clock_in_time), 'h:mm a')}
                                </span>
                              )}
                              {shift.clock_out_time && (
                                <span>
                                  Out: {format(new Date(shift.clock_out_time), 'h:mm a')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status + Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
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

      {/* ── Dialogs ── */}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[100px]" />)}
        </div>
        <Skeleton className="h-10 w-72" />
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="bg-card">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    }>
      <ShiftsPageContent />
    </Suspense>
  )
}
