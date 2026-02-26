'use client'

import * as React from 'react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last14days'
  | 'last30days'
  | 'last60days'
  | 'last90days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  className?: string
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  placeholder?: string
  presets?: DateRangePreset[]
  allowFutureDates?: boolean
}

const presetOptions: Record<DateRangePreset, { label: string; getRange: () => DateRange }> = {
  today: {
    label: 'Today',
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    },
  },
  yesterday: {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1)
      return { from: yesterday, to: yesterday }
    },
  },
  last7days: {
    label: 'Last 7 days',
    getRange: () => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  last14days: {
    label: 'Last 14 days',
    getRange: () => ({
      from: subDays(new Date(), 13),
      to: new Date(),
    }),
  },
  last30days: {
    label: 'Last 30 days',
    getRange: () => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  last60days: {
    label: 'Last 60 days',
    getRange: () => ({
      from: subDays(new Date(), 59),
      to: new Date(),
    }),
  },
  last90days: {
    label: 'Last 90 days',
    getRange: () => ({
      from: subDays(new Date(), 89),
      to: new Date(),
    }),
  },
  thisWeek: {
    label: 'This week',
    getRange: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: new Date(), // Up to today, not end of week
    }),
  },
  lastWeek: {
    label: 'Last week',
    getRange: () => {
      const lastWeekStart = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7)
      return {
        from: lastWeekStart,
        to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      }
    },
  },
  thisMonth: {
    label: 'This month',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: new Date(), // Up to today, not end of month
    }),
  },
  lastMonth: {
    label: 'Last month',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
}

const defaultPresets: DateRangePreset[] = [
  'today',
  'yesterday',
  'last7days',
  'last14days',
  'last30days',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
]

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    onChange(mql)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}

export function DateRangePicker({
  value,
  onChange,
  className,
  align = 'start',
  disabled = false,
  placeholder = 'Select date range',
  presets = defaultPresets,
  allowFutureDates = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  // Track internal selection state for custom range picking
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(undefined)
  // Ref to track whether next click is start or end (persists across renders)
  const isSelectingEnd = React.useRef(false)
  const isMobile = useIsMobile()

  const handlePresetChange = (preset: DateRangePreset) => {
    const range = presetOptions[preset].getRange()
    setInternalRange(range)
    isSelectingEnd.current = false
    onChange?.(range)
    setOpen(false)
  }

  const handleDayClick = (day: Date) => {
    if (!isSelectingEnd.current) {
      // First click — always sets new start date
      setInternalRange({ from: day })
      isSelectingEnd.current = true
    } else {
      // Second click — sets end date, auto-swap if needed
      const start = internalRange!.from!
      const [from, to] = start <= day ? [start, day] : [day, start]
      const completeRange = { from, to }
      setInternalRange(completeRange)
      isSelectingEnd.current = false
      onChange?.(completeRange)
      setOpen(false)
    }
  }

  // Handle popover open/close
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Show existing range highlighted; next click always picks a new start
      setInternalRange(value)
      isSelectingEnd.current = false
      setOpen(true)
    } else {
      // Don't allow closing if user is mid-selection (picked start, waiting for end)
      if (!isSelectingEnd.current) {
        setOpen(false)
      }
    }
  }

  // Check if current selection (or parent value if no selection) matches a preset
  const matchingPreset = React.useMemo(() => {
    // Use internal range if set, otherwise fall back to parent value
    const rangeToCheck = internalRange?.from ? internalRange : value
    if (!rangeToCheck?.from || !rangeToCheck?.to) return null

    for (const preset of presets) {
      const range = presetOptions[preset].getRange()
      if (
        range.from &&
        range.to &&
        format(range.from, 'yyyy-MM-dd') === format(rangeToCheck.from, 'yyyy-MM-dd') &&
        format(range.to, 'yyyy-MM-dd') === format(rangeToCheck.to, 'yyyy-MM-dd')
      ) {
        return preset
      }
    }
    return null
  }, [internalRange, value, presets])

  // Check if the committed value matches a preset (for button label)
  const valuePreset = React.useMemo(() => {
    if (!value?.from || !value?.to) return null
    for (const preset of presets) {
      const range = presetOptions[preset].getRange()
      if (
        range.from &&
        range.to &&
        format(range.from, 'yyyy-MM-dd') === format(value.from, 'yyyy-MM-dd') &&
        format(range.to, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')
      ) {
        return preset
      }
    }
    return null
  }, [value, presets])

  const formatDateRange = () => {
    if (!value?.from) return placeholder

    // Show preset label if the range matches one
    if (valuePreset) return presetOptions[valuePreset].label

    if (!value.to) {
      return format(value.from, 'MMM d, yyyy')
    }

    if (format(value.from, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')) {
      return format(value.from, 'MMM d, yyyy')
    }

    if (value.from.getFullYear() === value.to.getFullYear()) {
      if (value.from.getMonth() === value.to.getMonth()) {
        return `${format(value.from, 'MMM d')} - ${format(value.to, 'd, yyyy')}`
      }
      return `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d, yyyy')}`
    }

    return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        {/* Mobile: presets dropdown above calendar */}
        {isMobile && (
          <div className="border-b p-2">
            <Select
              value={matchingPreset ?? ''}
              onValueChange={(val) => handlePresetChange(val as DateRangePreset)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Quick select..." />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset} value={preset} className="text-xs">
                    {presetOptions[preset].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex w-fit">
          {/* Desktop: Presets sidebar */}
          {!isMobile && (
            <div className="flex flex-col border-r p-2 gap-1">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  variant={matchingPreset === preset ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-start text-left text-xs h-7 px-2"
                  onClick={() => handlePresetChange(preset)}
                >
                  {presetOptions[preset].label}
                </Button>
              ))}
            </div>
          )}

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={internalRange}
              onSelect={() => {}}
              onDayClick={handleDayClick}
              numberOfMonths={isMobile ? 1 : 2}
              disabled={allowFutureDates ? undefined : { after: new Date() }}
              defaultMonth={value?.from ?? new Date()}
              showOutsideDays={false}
              classNames={{
                // Make today less prominent - just underline instead of background
                today: 'underline underline-offset-4 decoration-primary',
                // Force row layout so months don't stack and stretch on small screens
                months: 'flex gap-4 flex-row relative',
              }}
            />
          </div>
        </div>

        {/* Footer with selected range or instruction - hidden on mobile */}
        {!isMobile && (
          <div className="border-t px-4 py-2 text-sm">
            {isSelectingEnd.current && internalRange?.from ? (
              <span className="text-primary font-medium">
                {format(internalRange.from, 'MMM d, yyyy')} &rarr; Select end date
              </span>
            ) : internalRange?.from && internalRange?.to ? (
              <span className="text-muted-foreground">
                {format(internalRange.from, 'MMM d, yyyy')} - {format(internalRange.to, 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Click to select start date
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Simple date range select with preset options only (no calendar)
 */
export function DateRangeSelect({
  value,
  onChange,
  className,
  disabled = false,
  presets = defaultPresets,
}: Omit<DateRangePickerProps, 'align' | 'placeholder'>) {
  const handleChange = (preset: string) => {
    const range = presetOptions[preset as DateRangePreset].getRange()
    onChange?.(range)
  }

  // Detect which preset matches the current value
  const currentPreset = React.useMemo(() => {
    if (!value?.from || !value?.to) return ''

    for (const preset of presets) {
      const range = presetOptions[preset].getRange()
      if (
        range.from &&
        range.to &&
        format(range.from, 'yyyy-MM-dd') === format(value.from, 'yyyy-MM-dd') &&
        format(range.to, 'yyyy-MM-dd') === format(value.to, 'yyyy-MM-dd')
      ) {
        return preset
      }
    }

    return ''
  }, [value, presets])

  return (
    <Select value={currentPreset} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn('w-[180px]', className)}>
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        {presets.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {presetOptions[preset].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
