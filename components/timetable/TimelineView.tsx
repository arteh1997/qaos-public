'use client'

import { useMemo, useState } from 'react'
import { Shift, Store, Profile } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Building2, Users } from 'lucide-react'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
  addDays,
  subDays,
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

// Timeline display hours (6am to 6am next day = 24 hours)
const TIMELINE_START_HOUR = 6
const TIMELINE_END_HOUR = 30 // 6am next day (24 + 6)

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

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  // Generate hour columns for the selected day (every hour)
  const hours = useMemo(() => {
    return Array.from(
      { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
      (_, i) => TIMELINE_START_HOUR + i
    )
  }, [])

  // Filter shifts for selected day (only shifts that START on this day, since we show full 24hrs)
  const dayShifts = useMemo(() => {
    return shifts.filter(shift => {
      const shiftStart = new Date(shift.start_time)
      // Only include shifts that start on the selected day
      return isSameDay(shiftStart, selectedDay)
    })
  }, [shifts, selectedDay])

  // Group shifts by entity (store or staff member)
  const groupedShifts = useMemo(() => {
    const groups: Record<string, { entity: Store | Profile; shifts: Shift[] }> = {}

    if (viewMode === 'store') {
      const filteredStores = selectedStoreId
        ? stores.filter(s => s.id === selectedStoreId)
        : stores.filter(s => s.is_active)

      filteredStores.forEach(store => {
        groups[store.id] = {
          entity: store,
          shifts: dayShifts.filter(s => s.store_id === store.id),
        }
      })
    } else {
      const staffWithShifts = new Set(dayShifts.map(s => s.user_id))
      const relevantStaff = staff.filter(s =>
        s.role === 'Staff' && (staffWithShifts.has(s.id) || !selectedStoreId || s.store_id === selectedStoreId)
      )

      relevantStaff.forEach(person => {
        groups[person.id] = {
          entity: person,
          shifts: dayShifts.filter(s => s.user_id === person.id),
        }
      })
    }

    return groups
  }, [viewMode, dayShifts, stores, staff, selectedStoreId])

  // Calculate position and width for a shift bar
  const getShiftStyle = (shift: Shift) => {
    const start = new Date(shift.start_time)
    const end = new Date(shift.end_time)

    const startsOnSelectedDay = isSameDay(start, selectedDay)
    const endsOnSelectedDay = isSameDay(end, selectedDay)
    const isOvernightShift = !isSameDay(start, end)

    let startHour: number
    let endHour: number
    let isContinuation = false

    if (startsOnSelectedDay) {
      // Shift starts today
      startHour = start.getHours() + start.getMinutes() / 60

      if (isOvernightShift) {
        // Ends next day - add 24 to get the hour in our extended timeline
        endHour = 24 + end.getHours() + end.getMinutes() / 60
      } else {
        endHour = end.getHours() + end.getMinutes() / 60
      }
    } else if (endsOnSelectedDay) {
      // Shift started previous day - don't show on this day since we now show full 24hrs
      // The shift would have been shown on the previous day extending into "next day" area
      return null
    } else {
      return null
    }

    // Clamp to visible timeline
    startHour = Math.max(startHour, TIMELINE_START_HOUR)
    endHour = Math.min(endHour, TIMELINE_END_HOUR)

    // Calculate percentage positions
    const totalHours = TIMELINE_END_HOUR - TIMELINE_START_HOUR
    const left = ((startHour - TIMELINE_START_HOUR) / totalHours) * 100
    const width = ((endHour - startHour) / totalHours) * 100

    return {
      left: `${left}%`,
      width: `${Math.max(width, 2)}%`, // Minimum 2% width for visibility
      isOvernight: isOvernightShift,
      isContinuation,
    }
  }

  // Get color based on shift pattern
  const getShiftColor = (shift: Shift) => {
    const store = stores.find(s => s.id === shift.store_id)
    const pattern = guessShiftPattern(new Date(shift.start_time), store?.opening_time || '06:00')

    const colors: Record<string, string> = {
      opening: 'bg-emerald-500 hover:bg-emerald-600',
      mid: 'bg-blue-500 hover:bg-blue-600',
      closing: 'bg-purple-500 hover:bg-purple-600',
      custom: 'bg-gray-500 hover:bg-gray-600',
    }

    return colors[pattern] || colors.custom
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatHour = (hour: number) => {
    // Normalize hour to 0-23 range for display
    const displayHour = hour >= 24 ? hour - 24 : hour
    if (displayHour === 0) return '12am'
    if (displayHour === 12) return '12pm'
    if (displayHour > 12) return `${displayHour - 12}pm`
    return `${displayHour}am`
  }

  // Handle day navigation with arrows
  const goToPrevDay = () => {
    const prevDay = subDays(selectedDay, 1)
    setSelectedDay(prevDay)
    // Check if we need to change week
    const prevWeekStart = startOfWeek(prevDay, { weekStartsOn: 1 })
    if (prevWeekStart.getTime() !== weekStart.getTime()) {
      onWeekChange(prevDay)
    }
  }

  const goToNextDay = () => {
    const nextDay = addDays(selectedDay, 1)
    setSelectedDay(nextDay)
    // Check if we need to change week
    const nextWeekStart = startOfWeek(nextDay, { weekStartsOn: 1 })
    if (nextWeekStart.getTime() !== weekStart.getTime()) {
      onWeekChange(nextDay)
    }
  }

  // Get view-specific styling
  const viewStyles = viewMode === 'store'
    ? {
        headerBg: 'bg-blue-50 dark:bg-blue-950/30',
        headerBorder: 'border-blue-200 dark:border-blue-800',
        headerText: 'text-blue-700 dark:text-blue-300',
        rowAccent: 'border-l-4 border-l-blue-400',
        iconColor: 'text-blue-600',
        labelBg: 'bg-blue-50/50 dark:bg-blue-950/20',
      }
    : {
        headerBg: 'bg-teal-50 dark:bg-teal-950/30',
        headerBorder: 'border-teal-200 dark:border-teal-800',
        headerText: 'text-teal-700 dark:text-teal-300',
        rowAccent: 'border-l-4 border-l-teal-400',
        iconColor: 'text-teal-600',
        labelBg: 'bg-teal-50/50 dark:bg-teal-950/20',
      }

  // Handle day selection from the day buttons
  const handleDaySelect = (day: Date) => {
    setSelectedDay(day)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        {/* View Mode Indicator */}
        <div className={`-mx-6 -mt-6 mb-4 px-4 py-2 ${viewStyles.headerBg} border-b ${viewStyles.headerBorder}`}>
          <div className="flex items-center gap-2">
            {viewMode === 'store' ? (
              <>
                <Building2 className={`h-4 w-4 ${viewStyles.iconColor}`} />
                <span className={`text-sm font-medium ${viewStyles.headerText}`}>
                  Viewing by Store — Rows show stores, shifts show staff names
                </span>
              </>
            ) : (
              <>
                <Users className={`h-4 w-4 ${viewStyles.iconColor}`} />
                <span className={`text-sm font-medium ${viewStyles.headerText}`}>
                  Viewing by Staff — Rows show staff members, shifts show store names
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(weekStart, 'MMM d')} - {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d')}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 mt-3">
          {weekDays.map(day => {
            const isSelected = isSameDay(day, selectedDay)
            const isTodayDate = isToday(day)

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDaySelect(day)}
                className={`flex-1 py-2 px-1 rounded-lg text-center transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isTodayDate
                    ? 'bg-primary/10 hover:bg-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                <div className={`text-lg font-bold ${isSelected ? '' : isTodayDate ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day navigation arrows */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <Button variant="ghost" size="sm" onClick={goToPrevDay} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Prev Day
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {format(selectedDay, 'EEEE, MMMM d')}
          </span>
          <Button variant="ghost" size="sm" onClick={goToNextDay} className="gap-1">
            Next Day
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Timeline header with hours */}
        <div className={`flex border-b ${viewStyles.labelBg}`}>
          <div className={`w-36 flex-shrink-0 px-3 py-2 border-r text-xs font-medium ${viewStyles.headerText} flex items-center gap-1.5`}>
            {viewMode === 'store' ? (
              <>
                <Building2 className="h-3.5 w-3.5" />
                Store
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5" />
                Staff
              </>
            )}
          </div>
          <div className="flex-1 flex">
            {hours.map(hour => (
              <div
                key={hour}
                className="flex-1 text-center text-[10px] text-muted-foreground py-2 border-l first:border-l-0"
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline rows */}
        <div className="divide-y">
          {Object.entries(groupedShifts).length === 0 ? (
            <div className={`p-8 text-center ${viewStyles.labelBg} ${viewStyles.rowAccent}`}>
              <div className={`inline-flex items-center justify-center h-12 w-12 rounded-full mb-3 ${viewMode === 'store' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-teal-100 dark:bg-teal-900/50'}`}>
                {viewMode === 'store' ? (
                  <Building2 className={`h-6 w-6 ${viewStyles.iconColor}`} />
                ) : (
                  <Users className={`h-6 w-6 ${viewStyles.iconColor}`} />
                )}
              </div>
              <p className="text-muted-foreground">
                No {viewMode === 'store' ? 'stores' : 'staff members'} to display
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {viewMode === 'store'
                  ? 'Add stores in Settings to see them here'
                  : 'Add staff members to see them here'}
              </p>
            </div>
          ) : (
            Object.entries(groupedShifts).map(([id, { entity, shifts: entityShifts }]) => {
              const isStore = viewMode === 'store'
              const name = isStore ? (entity as Store).name : (entity as Profile).full_name || (entity as Profile).email
              const store = isStore ? (entity as Store) : null
              const person = !isStore ? (entity as Profile) : null

              return (
                <div key={id} className={`flex min-h-[60px] ${viewStyles.rowAccent}`}>
                  {/* Entity label */}
                  <div className={`w-36 flex-shrink-0 px-3 py-2 border-r flex items-center gap-2 ${viewStyles.labelBg}`}>
                    {isStore ? (
                      <>
                        <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium truncate">{name}</span>
                      </>
                    ) : (
                      <>
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarFallback className="text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                            {getInitials(person?.full_name || null)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{name}</span>
                      </>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div className="flex-1 relative py-2 min-h-[56px]">
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {hours.map(hour => (
                        <div
                          key={hour}
                          className="flex-1 border-l border-dashed border-muted first:border-l-0"
                        />
                      ))}
                    </div>

                    {/* Shift bars */}
                    <TooltipProvider>
                      {entityShifts.map(shift => {
                        const style = getShiftStyle(shift)
                        if (!style) return null

                        const { left, width, isOvernight, isContinuation } = style
                        const shiftStore = stores.find(s => s.id === shift.store_id)
                        const shiftUser = staff.find(s => s.id === shift.user_id)
                        const startTime = new Date(shift.start_time)
                        const endTime = new Date(shift.end_time)
                        const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

                        return (
                          <Tooltip key={shift.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 h-8 shadow-sm cursor-pointer transition-all ${getShiftColor(shift)} text-white text-xs flex items-center overflow-hidden rounded-md`}
                                style={{ left, width }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center">
                                  {isStore ? (
                                    <>
                                      <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center ml-1 flex-shrink-0">
                                        <User className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="truncate px-1.5 font-medium">
                                        {shiftUser?.full_name?.split(' ')[0] || 'Staff'}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-6 w-6 rounded-md bg-white/20 flex items-center justify-center ml-1 flex-shrink-0">
                                        <MapPin className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="truncate px-1.5 font-medium">
                                        {shiftStore?.name || 'Store'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-semibold">
                                  {shiftUser?.full_name || shiftUser?.email}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {shiftStore?.name}
                                </div>
                                <div className="text-xs">
                                  {formatShiftTime(startTime)} - {formatShiftTime(endTime)}
                                  {(isOvernight || isContinuation) && (
                                    <span className="text-indigo-300 ml-1">(+1 day)</span>
                                  )}
                                  <span className="text-muted-foreground ml-1">
                                    ({duration.toFixed(1)}h)
                                  </span>
                                </div>
                                {shift.clock_in_time && (
                                  <div className="text-xs text-green-600">
                                    Clocked in: {format(new Date(shift.clock_in_time), 'h:mm a')}
                                  </div>
                                )}
                                {shift.clock_out_time && (
                                  <div className="text-xs">
                                    Clocked out: {format(new Date(shift.clock_out_time), 'h:mm a')}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </TooltipProvider>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Legend */}
        <div className="p-3 border-t bg-muted/20 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-emerald-500" />
            <span>Opening</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-blue-500" />
            <span>Mid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-purple-500" />
            <span>Closing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-gray-500" />
            <span>Custom</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
