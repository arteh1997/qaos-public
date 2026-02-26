'use client'

import { useMemo, useState } from 'react'
import { Shift, Store, Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Clock, Users, LogIn, LogOut, Timer, FileText } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  addDays,
} from 'date-fns'
import { guessShiftPattern, formatShiftTime } from '@/lib/shift-patterns'

interface TimelineViewProps {
  shifts: Shift[]
  stores: Store[]
  staff: Profile[]
  viewMode: 'store' | 'staff'
  selectedStoreId?: string
  currentWeek: Date
  onWeekChange: (date: Date) => void
  onAddShift?: (date: Date, storeId?: string, staffId?: string) => void
}

const TIMELINE_START_HOUR = 6
const TIMELINE_END_HOUR = 30

// Shift bar colors — warm palette
const SHIFT_COLORS: Record<string, { bar: string; border: string }> = {
  opening: { bar: 'bg-emerald-500', border: 'border-emerald-300' },
  mid:     { bar: 'bg-amber-500',   border: 'border-amber-300' },
  closing: { bar: 'bg-violet-500',  border: 'border-violet-300' },
  custom:  { bar: 'bg-foreground/60', border: 'border-border' },
}

// Shift status thresholds (minutes)
const LATE_THRESHOLD = 5
const NO_SHOW_THRESHOLD = 30
const LEFT_EARLY_THRESHOLD = 15
const OVERTIME_THRESHOLD = 15

function getShiftStatus(shift: Shift) {
  const now = new Date()
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  const clockIn = shift.clock_in_time ? new Date(shift.clock_in_time) : null
  const clockOut = shift.clock_out_time ? new Date(shift.clock_out_time) : null
  const minutesSinceStart = (now.getTime() - start.getTime()) / 60000

  if (now < start) {
    if (clockIn && clockOut) return { label: 'Completed', variant: 'success' as const }
    if (clockIn) return { label: 'Clocked In Early', variant: 'default' as const }
    return { label: 'Scheduled', variant: 'outline' as const }
  }

  if (now <= end) {
    if (!clockIn) {
      if (clockOut) return { label: 'Completed', variant: 'success' as const }
      if (minutesSinceStart >= NO_SHOW_THRESHOLD) return { label: 'No Show', variant: 'destructive' as const }
      return { label: 'Not Clocked In', variant: 'warning' as const }
    }
    if (clockOut) {
      const minutesBeforeEnd = (end.getTime() - clockOut.getTime()) / 60000
      if (minutesBeforeEnd >= LEFT_EARLY_THRESHOLD) return { label: 'Left Early', variant: 'warning' as const }
      return { label: 'Completed', variant: 'success' as const }
    }
    const minutesLate = (clockIn.getTime() - start.getTime()) / 60000
    if (minutesLate > LATE_THRESHOLD) return { label: 'Active · Late', variant: 'warning' as const }
    return { label: 'Active', variant: 'default' as const }
  }

  if (!clockIn) {
    if (clockOut) return { label: 'Completed', variant: 'success' as const }
    return { label: 'Missed', variant: 'destructive' as const }
  }
  if (!clockOut) return { label: 'No Clock Out', variant: 'warning' as const }

  const minutesLate = (clockIn.getTime() - start.getTime()) / 60000
  const minutesBeforeEnd = (end.getTime() - clockOut.getTime()) / 60000
  const minutesAfterEnd = (clockOut.getTime() - end.getTime()) / 60000

  if (minutesBeforeEnd >= LEFT_EARLY_THRESHOLD) return { label: 'Left Early', variant: 'warning' as const }
  if (minutesLate > LATE_THRESHOLD) return { label: 'Late Arrival', variant: 'warning' as const }
  if (minutesAfterEnd > OVERTIME_THRESHOLD) return { label: 'Overtime', variant: 'secondary' as const }
  return { label: 'Completed', variant: 'success' as const }
}

function formatVariance(actual: Date, scheduled: Date, type: 'in' | 'out'): { text: string; className: string } {
  const diffMin = Math.round((actual.getTime() - scheduled.getTime()) / 60000)
  if (Math.abs(diffMin) <= 2) return { text: 'On time', className: 'text-emerald-600' }

  if (type === 'in') {
    // Clock in: early = fine, late = bad
    if (diffMin < 0) return { text: `${Math.abs(diffMin)}m early`, className: 'text-emerald-600' }
    return { text: `${diffMin}m late`, className: 'text-amber-600' }
  }
  // Clock out: early = bad, overtime = neutral
  if (diffMin < 0) return { text: `${Math.abs(diffMin)}m early`, className: 'text-amber-600' }
  return { text: `${diffMin}m over`, className: 'text-muted-foreground' }
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function TimelineView({
  shifts,
  stores,
  staff,
  viewMode,
  selectedStoreId,
  currentWeek,
  onWeekChange,
  onAddShift,
}: TimelineViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const hours = useMemo(() =>
    Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }, (_, i) => TIMELINE_START_HOUR + i),
  [])

  // Shifts for selected day
  const dayShifts = useMemo(() =>
    shifts.filter(shift => isSameDay(new Date(shift.start_time), selectedDay)),
  [shifts, selectedDay])

  // Group shifts by entity
  const groupedShifts = useMemo(() => {
    const groups: Record<string, { entity: Store | Profile; shifts: Shift[] }> = {}

    if (viewMode === 'store') {
      const filtered = selectedStoreId
        ? stores.filter(s => s.id === selectedStoreId)
        : stores.filter(s => s.is_active)
      filtered.forEach(store => {
        groups[store.id] = { entity: store, shifts: dayShifts.filter(s => s.store_id === store.id) }
      })
    } else {
      const staffWithShifts = new Set(dayShifts.map(s => s.user_id))
      // selectedStoreId is actually a member ID when viewMode is 'staff'
      const relevant = selectedStoreId
        ? staff.filter(s => s.id === selectedStoreId)
        : staff.filter(s => staffWithShifts.has(s.id))
      relevant.forEach(person => {
        groups[person.id] = { entity: person, shifts: dayShifts.filter(s => s.user_id === person.id) }
      })
    }

    return groups
  }, [viewMode, dayShifts, stores, staff, selectedStoreId])

  // Calculate shift bar position
  const getShiftStyle = (shift: Shift) => {
    const start = new Date(shift.start_time)
    const end = new Date(shift.end_time)

    if (!isSameDay(start, selectedDay)) return null

    let startHour = start.getHours() + start.getMinutes() / 60
    let endHour = !isSameDay(start, end)
      ? 24 + end.getHours() + end.getMinutes() / 60
      : end.getHours() + end.getMinutes() / 60

    startHour = Math.max(startHour, TIMELINE_START_HOUR)
    endHour = Math.min(endHour, TIMELINE_END_HOUR)

    const totalHours = TIMELINE_END_HOUR - TIMELINE_START_HOUR
    const left = ((startHour - TIMELINE_START_HOUR) / totalHours) * 100
    const width = ((endHour - startHour) / totalHours) * 100

    return {
      left: `${left}%`,
      width: `${Math.max(width, 2)}%`,
      isOvernight: !isSameDay(start, end),
    }
  }

  const getShiftColor = (shift: Shift) => {
    const store = stores.find(s => s.id === shift.store_id)
    const pattern = guessShiftPattern(new Date(shift.start_time), store?.opening_time || '06:00')
    return SHIFT_COLORS[pattern] || SHIFT_COLORS.custom
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatHour = (hour: number) => {
    const h = hour >= 24 ? hour - 24 : hour
    if (h === 0) return '12am'
    if (h === 12) return '12pm'
    if (h > 12) return `${h - 12}pm`
    return `${h}am`
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDay(date)
      onWeekChange(date)
      setDatePickerOpen(false)
    }
  }

  const entries = Object.entries(groupedShifts)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Navigation header */}
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b space-y-3">
        {/* Week nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onWeekChange(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm font-medium hover:text-primary transition-colors">
                {format(weekStart, 'MMM d')} – {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDay}
                onSelect={handleDateSelect}
                weekStartsOn={1}
                defaultMonth={currentWeek}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onWeekChange(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day pills */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const isSelected = isSameDay(day, selectedDay)
            const isTodayDate = isToday(day)

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`py-1.5 rounded-md text-center transition-colors ${
                  isSelected
                    ? 'bg-foreground text-background'
                    : isTodayDate
                    ? 'bg-primary/10 text-primary hover:bg-primary/15'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="text-[10px] sm:text-xs font-medium leading-tight">
                  {format(day, 'EEE').slice(0, 3)}
                </div>
                <div className={`text-sm sm:text-base font-semibold leading-tight ${
                  isSelected ? '' : isTodayDate ? 'text-primary' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected day label */}
        <p className="text-xs text-muted-foreground text-center">
          {format(selectedDay, 'EEEE, MMMM d')}
          {dayShifts.length > 0 && (
            <span className="ml-1.5">
              &middot; {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden">
        {entries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No shifts scheduled</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map(([id, { entity, shifts: entityShifts }]) => {
              const isStore = viewMode === 'store'
              const name = isStore
                ? (entity as Store).name
                : (entity as Profile).full_name || (entity as Profile).email

              return (
                <div key={id}>
                  {/* Row header */}
                  <div className="px-4 py-2.5 bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {!isStore && (
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-semibold">
                            {getInitials((entity as Profile).full_name || null)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-sm font-medium truncate">{name}</span>
                    </div>
                    {entityShifts.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {entityShifts.length} shift{entityShifts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Shifts */}
                  <div className="px-4 py-2 space-y-1.5">
                    {entityShifts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No shifts</p>
                    ) : (
                      entityShifts.map(shift => {
                        const shiftStore = stores.find(s => s.id === shift.store_id)
                        const shiftUser = staff.find(s => s.id === shift.user_id)
                        const startTime = new Date(shift.start_time)
                        const endTime = new Date(shift.end_time)
                        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                        const color = getShiftColor(shift)

                        return (
                          <div key={shift.id} className={`rounded-md border ${color.border} px-3 py-2`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${color.bar}`} />
                                <span className="text-sm font-medium truncate">
                                  {isStore
                                    ? (shiftUser?.full_name || shiftUser?.email || 'Unassigned')
                                    : `${formatShiftTime(startTime)} – ${formatShiftTime(endTime)}`}
                                </span>
                                {!isStore && !isSameDay(startTime, endTime) && (
                                  <span className="text-[10px] text-violet-500 shrink-0">(+1d)</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                                {Math.round(duration)}h
                              </span>
                            </div>
                            {isStore && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="tabular-nums">
                                  {formatShiftTime(startTime)} – {formatShiftTime(endTime)}
                                  {!isSameDay(startTime, endTime) && (
                                    <span className="text-violet-500 ml-1">(+1d)</span>
                                  )}
                                </span>
                              </div>
                            )}
                            {(shift.clock_in_time || shift.clock_out_time) && (
                              <div className="flex gap-3 mt-1 text-xs">
                                {shift.clock_in_time && (
                                  <span className="text-emerald-600">
                                    In {format(new Date(shift.clock_in_time), 'h:mm a')}
                                  </span>
                                )}
                                {shift.clock_out_time && (
                                  <span className="text-muted-foreground">
                                    Out {format(new Date(shift.clock_out_time), 'h:mm a')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop timeline */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour header */}
          <div className="flex border-b bg-muted/30">
            <div className="flex-1 flex">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="flex-1 text-center text-[10px] text-muted-foreground/70 py-2 border-l first:border-l-0 tabular-nums"
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No shifts scheduled for this day</p>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map(([id, { entity, shifts: entityShifts }]) => {
                const isStore = viewMode === 'store'
                const name = isStore
                  ? (entity as Store).name
                  : (entity as Profile).full_name || (entity as Profile).email

                return (
                  <div key={id} className="group hover:bg-muted/20 transition-colors">
                    {/* Timeline area */}
                    <div className="relative py-2" style={{ minHeight: 44 }}>
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {hours.map(hour => (
                          <div key={hour} className="flex-1 border-l border-dashed border-border/40 first:border-l-0" />
                        ))}
                      </div>

                      {/* Shift bars */}
                      {entityShifts.map(shift => {
                        const style = getShiftStyle(shift)
                        if (!style) return null

                        const { left, width, isOvernight } = style
                        const color = getShiftColor(shift)
                        const shiftStore = stores.find(s => s.id === shift.store_id)
                        const shiftUser = staff.find(s => s.id === shift.user_id)
                        const startTime = new Date(shift.start_time)
                        const endTime = new Date(shift.end_time)
                        const scheduledMs = endTime.getTime() - startTime.getTime()
                        const status = getShiftStatus(shift)
                        const pattern = guessShiftPattern(startTime, shiftStore?.opening_time || '06:00')
                        const clockIn = shift.clock_in_time ? new Date(shift.clock_in_time) : null
                        const clockOut = shift.clock_out_time ? new Date(shift.clock_out_time) : null

                        return (
                          <Popover key={shift.id}>
                            <PopoverTrigger asChild>
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 h-7 ${color.bar} text-white text-xs flex items-center justify-center overflow-hidden rounded-md cursor-pointer transition-all hover:opacity-90 hover:h-8 hover:shadow-md`}
                                style={{ left, width }}
                              >
                                <span className="truncate font-medium text-[11px] px-2">
                                  {isStore
                                    ? (shiftUser?.full_name?.split(' ')[0] || 'Staff')
                                    : (shiftUser?.full_name || 'Member')}
                                </span>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="center" className="w-72 p-0">
                              {/* Header */}
                              <div className="px-4 pt-4 pb-3 border-b">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">
                                      {shiftUser?.full_name || shiftUser?.email || 'Unassigned'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{shiftStore?.name}</p>
                                  </div>
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                </div>
                              </div>

                              {/* Schedule */}
                              <div className="px-4 py-3 space-y-3">
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="tabular-nums">
                                    {formatShiftTime(startTime)} – {formatShiftTime(endTime)}
                                  </span>
                                  {isOvernight && <span className="text-[10px] text-violet-500">(+1d)</span>}
                                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                    {formatDuration(scheduledMs)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full shrink-0 ${color.bar}`} />
                                  <span className="text-xs text-muted-foreground capitalize">{pattern} shift</span>
                                </div>
                              </div>

                              {/* Attendance */}
                              {(clockIn || clockOut) && (
                                <div className="px-4 py-3 border-t space-y-2">
                                  {clockIn && (() => {
                                    const variance = formatVariance(clockIn, startTime, 'in')
                                    return (
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <LogIn className="h-3 w-3 shrink-0" />
                                          <span>Clocked in</span>
                                        </div>
                                        <div className="flex items-center gap-2 tabular-nums">
                                          <span className="font-medium">{format(clockIn, 'h:mm a')}</span>
                                          <span className={variance.className}>{variance.text}</span>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {clockOut && (() => {
                                    const variance = formatVariance(clockOut, endTime, 'out')
                                    return (
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                          <LogOut className="h-3 w-3 shrink-0" />
                                          <span>Clocked out</span>
                                        </div>
                                        <div className="flex items-center gap-2 tabular-nums">
                                          <span className="font-medium">{format(clockOut, 'h:mm a')}</span>
                                          <span className={variance.className}>{variance.text}</span>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {clockIn && clockOut && (
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed">
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Timer className="h-3 w-3 shrink-0" />
                                        <span>Worked</span>
                                      </div>
                                      <span className="font-medium tabular-nums">
                                        {formatDuration(clockOut.getTime() - clockIn.getTime())}
                                        <span className="text-muted-foreground font-normal ml-1">
                                          / {formatDuration(scheduledMs)}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* No attendance yet */}
                              {!clockIn && !clockOut && (
                                <div className="px-4 py-3 border-t">
                                  <p className="text-xs text-muted-foreground text-center">No clock data recorded</p>
                                </div>
                              )}

                              {/* Notes */}
                              {shift.notes && (
                                <div className="px-4 py-3 border-t">
                                  <div className="flex items-start gap-2">
                                    <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">{shift.notes}</p>
                                  </div>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Minimal legend */}
      <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-[10px] sm:text-xs text-muted-foreground">
        {Object.entries(SHIFT_COLORS).map(([label, { bar }]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${bar}`} />
            <span className="capitalize">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
