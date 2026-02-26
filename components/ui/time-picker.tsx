'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TimePickerProps {
  value?: string | null
  onChange?: (value: string) => void
  /** Minutes between each quick-pick option. Default 30. */
  minuteStep?: 15 | 30 | 60
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Compact variant for shift times (smaller trigger) */
  size?: 'default' | 'sm'
}

function generateTimeSlots(step: number): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/** Validate and normalise a time string to HH:MM, or return null */
function parseTimeInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // HH:MM format
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`
  }
  return null
}

export function TimePicker({
  value,
  onChange,
  minuteStep = 30,
  placeholder = 'Select time',
  disabled = false,
  className,
  size = 'default',
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const timeSlots = React.useMemo(() => generateTimeSlots(minuteStep), [minuteStep])

  // Normalise value to HH:MM
  const normalised = React.useMemo(() => {
    if (!value) return null
    const parts = value.split(':')
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    }
    return null
  }, [value])

  // Local input state — synced from value when popover opens
  const [inputValue, setInputValue] = React.useState(normalised ?? '')

  React.useEffect(() => {
    if (open) {
      setInputValue(normalised ?? '')
      // Scroll selected into view
      requestAnimationFrame(() => {
        selectedRef.current?.scrollIntoView({ block: 'center' })
      })
    }
  }, [open, normalised])

  const handleSelect = (time: string) => {
    onChange?.(time)
    setOpen(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseTimeInput(inputValue)
      if (parsed) {
        onChange?.(parsed)
        setOpen(false)
      }
    }
  }

  const handleInputBlur = () => {
    const parsed = parseTimeInput(inputValue)
    if (parsed) {
      onChange?.(parsed)
    }
  }

  const isSmall = size === 'sm'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            isSmall ? 'h-8 px-2.5 text-sm' : 'h-9 px-3 text-sm',
            !normalised && 'text-muted-foreground',
            className
          )}
        >
          <Clock className={cn('shrink-0 text-muted-foreground', isSmall ? 'h-3 w-3 mr-1.5' : 'h-3.5 w-3.5 mr-2')} />
          {normalised ? formatTime12h(normalised) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Manual time input */}
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            type="time"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              const parsed = parseTimeInput(e.target.value)
              if (parsed) onChange?.(parsed)
            }}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            className="h-8 text-sm"
            placeholder="HH:MM"
          />
        </div>

        {/* Quick-pick list */}
        <ScrollArea className="h-48">
          <div className="p-1">
            {timeSlots.map((time) => {
              const isSelected = time === normalised
              return (
                <Button
                  key={time}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-between text-left h-7 px-2.5 font-normal text-xs',
                    !isSelected && 'text-foreground'
                  )}
                  onClick={() => handleSelect(time)}
                >
                  <span className="tabular-nums">{formatTime12h(time)}</span>
                  <span className={cn('tabular-nums', isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {time}
                  </span>
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
