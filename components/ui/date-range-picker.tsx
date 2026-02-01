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

export function DateRangePicker({
  value,
  onChange,
  className,
  align = 'start',
  disabled = false,
  placeholder = 'Select date range',
  presets = defaultPresets,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  // Track internal selection state for custom range picking
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(undefined)
  // Track the selection phase: 'idle' | 'selecting-start' | 'selecting-end'
  const [selectionPhase, setSelectionPhase] = React.useState<'idle' | 'selecting-start' | 'selecting-end'>('idle')

  // When popover opens, prepare for fresh selection
  React.useEffect(() => {
    if (open) {
      // Clear internal range and set to selecting-start phase
      // This means the next click will be treated as selecting a new start date
      setInternalRange(undefined)
      setSelectionPhase('selecting-start')
    } else {
      setSelectionPhase('idle')
    }
  }, [open])

  const handlePresetChange = (preset: DateRangePreset) => {
    const range = presetOptions[preset].getRange()
    setInternalRange(range)
    setSelectionPhase('idle')
    onChange?.(range)
    setOpen(false)
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (selectionPhase === 'selecting-start') {
      // First click - set as start date only (clear any auto-set end date)
      if (range?.from) {
        setInternalRange({ from: range.from, to: undefined })
        setSelectionPhase('selecting-end')
      }
    } else if (selectionPhase === 'selecting-end') {
      // Second click - complete the range
      if (range?.from && range?.to) {
        setInternalRange(range)
        setSelectionPhase('idle')
        onChange?.(range)
        setOpen(false)
      } else if (range?.from) {
        // User clicked the same date or calendar gave us just from
        // Treat it as both start and end
        const completeRange = { from: range.from, to: range.from }
        setInternalRange(completeRange)
        setSelectionPhase('idle')
        onChange?.(completeRange)
        setOpen(false)
      }
    }
  }

  // Handle popover open/close - only allow closing if we're not mid-selection
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setOpen(true)
    } else {
      // Don't allow closing if user is in the middle of selecting (has picked start, waiting for end)
      if (selectionPhase !== 'selecting-end') {
        setOpen(false)
      }
    }
  }

  const formatDateRange = () => {
    if (!value?.from) return placeholder

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
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-2 space-y-1 min-w-[140px]">
            {presets.map((preset) => (
              <Button
                key={preset}
                variant={matchingPreset === preset ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-left text-xs"
                onClick={() => handlePresetChange(preset)}
              >
                {presetOptions[preset].label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={internalRange ?? value}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              defaultMonth={value?.from ?? new Date()}
              showOutsideDays={false}
              classNames={{
                // Make today less prominent - just underline instead of background
                today: 'underline underline-offset-4 decoration-primary',
              }}
            />
          </div>
        </div>

        {/* Footer with selected range or instruction */}
        <div className="border-t px-4 py-2 text-sm">
          {internalRange?.from ? (
            internalRange.to ? (
              <span className="text-muted-foreground">
                {format(internalRange.from, 'MMM d, yyyy')} - {format(internalRange.to, 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="text-primary font-medium">
                {format(internalRange.from, 'MMM d, yyyy')} → Select end date
              </span>
            )
          ) : (
            <span className="text-muted-foreground">
              {value?.from && value?.to ? (
                <>Current: {format(value.from, 'MMM d')} - {format(value.to, 'MMM d, yyyy')} · Click to select new range</>
              ) : (
                'Select a start date'
              )}
            </span>
          )}
        </div>
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
