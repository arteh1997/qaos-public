'use client'

import { useMemo, useState } from 'react'
import { Shift, Store, Profile } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { format } from 'date-fns'
import {
  getWeekDates,
  formatWeekDay,
  isToday,
  formatShiftTime,
  calculateHours,
  guessShiftPattern,
} from '@/lib/shift-patterns'

interface WeeklyTimetableProps {
  shifts: Shift[]
  stores: Store[]
  staff: Profile[]
  isLoading?: boolean
  viewMode: 'store' | 'staff'
  selectedStoreId?: string
  onAddShift?: (date: Date, staffId?: string, storeId?: string) => void
  onEditShift?: (shift: Shift) => void
  onDeleteShift?: (shift: Shift) => void
}

// Shift colors based on pattern
const SHIFT_COLORS: Record<string, string> = {
  Opening: 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400',
  Mid: 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-400',
  Closing: 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-400',
  Custom: 'bg-gray-500/20 border-gray-500/50 text-gray-700 dark:text-gray-400',
}

export function WeeklyTimetable({
  shifts,
  stores,
  staff,
  isLoading,
  viewMode,
  selectedStoreId,
  onAddShift,
  onEditShift,
}: WeeklyTimetableProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  // Calculate current week dates
  const weekDates = useMemo(() => {
    const today = new Date()
    today.setDate(today.getDate() + weekOffset * 7)
    return getWeekDates(today)
  }, [weekOffset])

  // Get store for looking up opening hours
  const getStore = (storeId: string) => stores.find(s => s.id === storeId)

  // Filter shifts for the current week
  const weekShifts = useMemo(() => {
    const weekStart = weekDates[0]
    const weekEnd = new Date(weekDates[6])
    weekEnd.setHours(23, 59, 59, 999)

    return shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time)
      return shiftDate >= weekStart && shiftDate <= weekEnd
    })
  }, [shifts, weekDates])

  // Group shifts by day and row (staff or store)
  const groupedShifts = useMemo(() => {
    const grouped: Record<string, Record<number, Shift[]>> = {}

    // Initialize structure for each row
    const rows = viewMode === 'staff'
      ? staff.filter(s => !selectedStoreId || s.store_id === selectedStoreId)
      : stores.filter(s => !selectedStoreId || s.id === selectedStoreId)

    rows.forEach(row => {
      grouped[row.id] = {}
      weekDates.forEach((_, dayIndex) => {
        grouped[row.id][dayIndex] = []
      })
    })

    // Populate shifts
    weekShifts.forEach(shift => {
      const rowId = viewMode === 'staff' ? shift.user_id : shift.store_id
      const shiftDate = new Date(shift.start_time)
      const dayIndex = weekDates.findIndex(d =>
        d.getDate() === shiftDate.getDate() &&
        d.getMonth() === shiftDate.getMonth()
      )

      if (dayIndex !== -1 && grouped[rowId]) {
        grouped[rowId][dayIndex].push(shift)
      }
    })

    return grouped
  }, [weekShifts, weekDates, viewMode, staff, stores, selectedStoreId])

  // Get rows to display
  const rows = viewMode === 'staff'
    ? staff.filter(s => s.role === 'Staff' && (!selectedStoreId || s.store_id === selectedStoreId))
    : stores.filter(s => s.is_active && (!selectedStoreId || s.id === selectedStoreId))

  const weekLabel = useMemo(() => {
    const start = weekDates[0]
    const end = weekDates[6]
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`
    }
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
  }, [weekDates])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(w => w - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h3 className="font-semibold">{weekLabel}</h3>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-primary hover:underline"
              >
                Go to current week
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(w => w + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Timetable Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="w-32 p-2 text-left text-sm font-medium text-muted-foreground border-b">
                  {viewMode === 'staff' ? 'Staff' : 'Store'}
                </th>
                {weekDates.map((date, i) => {
                  const { day, date: dateStr } = formatWeekDay(date)
                  const today = isToday(date)
                  return (
                    <th
                      key={i}
                      className={`p-2 text-center text-sm border-b ${
                        today ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className={`font-medium ${today ? 'text-primary' : ''}`}>
                        {day}
                      </div>
                      <div className={`text-xs ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                        {dateStr}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No {viewMode === 'staff' ? 'staff members' : 'stores'} to display
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const rowName = viewMode === 'staff'
                    ? (row as Profile).full_name || (row as Profile).email
                    : (row as Store).name

                  return (
                    <tr key={row.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium text-sm">
                        {rowName}
                      </td>
                      {weekDates.map((date, dayIndex) => {
                        const cellShifts = groupedShifts[row.id]?.[dayIndex] || []
                        const today = isToday(date)

                        return (
                          <td
                            key={dayIndex}
                            className={`p-1 align-top min-h-[60px] relative group ${
                              today ? 'bg-primary/5' : ''
                            }`}
                          >
                            <div className="min-h-[50px] space-y-1">
                              {cellShifts.map(shift => {
                                const store = getStore(shift.store_id)
                                const pattern = guessShiftPattern(
                                  new Date(shift.start_time),
                                  store?.opening_time ?? null
                                )
                                const colorClass = SHIFT_COLORS[pattern] || SHIFT_COLORS.Custom
                                const startTime = new Date(shift.start_time)
                                const endTime = new Date(shift.end_time)
                                const hours = calculateHours(startTime, endTime)

                                return (
                                  <TooltipProvider key={shift.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => onEditShift?.(shift)}
                                          className={`w-full text-left p-1.5 rounded border text-xs cursor-pointer transition-all hover:scale-[1.02] ${colorClass}`}
                                        >
                                          <div className="font-medium truncate">
                                            {formatShiftTime(startTime)} - {formatShiftTime(endTime)}
                                          </div>
                                          {viewMode === 'store' && shift.user && (
                                            <div className="truncate text-[10px] opacity-80">
                                              {shift.user.full_name || shift.user.email}
                                            </div>
                                          )}
                                          {viewMode === 'staff' && shift.store && (
                                            <div className="truncate text-[10px] opacity-80">
                                              {shift.store.name}
                                            </div>
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1">
                                          <div className="font-medium">{pattern} Shift</div>
                                          <div className="text-xs">
                                            {formatShiftTime(startTime)} - {formatShiftTime(endTime)} ({hours}h)
                                          </div>
                                          {viewMode === 'store' && shift.user && (
                                            <div className="text-xs">{shift.user.full_name}</div>
                                          )}
                                          {viewMode === 'staff' && shift.store && (
                                            <div className="text-xs">{shift.store.name}</div>
                                          )}
                                          {shift.clock_in_time && (
                                            <Badge variant="outline" className="text-[10px]">
                                              Clocked In
                                            </Badge>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              })}

                              {/* Add shift button - shows on hover */}
                              {onAddShift && (
                                <button
                                  onClick={() => onAddShift(
                                    date,
                                    viewMode === 'staff' ? row.id : undefined,
                                    viewMode === 'store' ? row.id : undefined
                                  )}
                                  className="w-full h-8 border border-dashed border-muted-foreground/30 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-primary hover:bg-primary/5"
                                >
                                  <Plus className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
          <span className="text-xs text-muted-foreground">Shift types:</span>
          {Object.entries(SHIFT_COLORS).map(([name, colorClass]) => (
            <div key={name} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded border ${colorClass}`} />
              <span className="text-xs">{name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
