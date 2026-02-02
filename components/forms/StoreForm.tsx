'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { storeSchema, StoreFormData, DAYS_OF_WEEK, DAY_LABELS, getDefaultWeeklyHours, calculateDefaultShiftPatterns } from '@/lib/validations/store'
import { Store, DayOfWeek, WeeklyHours, DayHours } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, Clock, ChevronDown } from 'lucide-react'

interface StoreFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  store?: Store | null
  onSubmit: (data: StoreFormData) => Promise<void>
  isLoading?: boolean
}

export function StoreForm({
  open,
  onOpenChange,
  store,
  onSubmit,
  isLoading,
}: StoreFormProps) {
  const [showWeeklyHours, setShowWeeklyHours] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours | null>(null)
  const [expandedDays, setExpandedDays] = useState<Record<DayOfWeek, boolean>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  })

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      address: '',
      is_active: true,
      opening_time: '09:00', // Default to 9am with :00 minutes for easier adjustment
      closing_time: '22:00', // Default to 10pm with :00 minutes for easier adjustment
      weekly_hours: null,
    },
  })

  // Reset form when store prop changes or dialog opens
  useEffect(() => {
    if (open) {
      const hasWeeklyHours = !!store?.weekly_hours
      setShowWeeklyHours(hasWeeklyHours)
      setWeeklyHours(store?.weekly_hours ?? null)

      form.reset({
        name: store?.name ?? '',
        address: store?.address ?? '',
        is_active: store?.is_active ?? true,
        opening_time: store?.opening_time ?? '09:00', // Default with :00 minutes
        closing_time: store?.closing_time ?? '22:00', // Default with :00 minutes
        weekly_hours: store?.weekly_hours ?? null,
      })
    }
  }, [open, store, form])

  const handleDefaultTimesChange = () => {
    const openingTime = form.getValues('opening_time')
    const closingTime = form.getValues('closing_time')

    // If weekly hours are shown and both default times are set, update all days
    if (showWeeklyHours && openingTime && closingTime && weeklyHours) {
      const updated = { ...weeklyHours }
      DAYS_OF_WEEK.forEach(day => {
        if (updated[day].is_open) {
          updated[day] = {
            ...updated[day],
            opening_time: openingTime,
            closing_time: closingTime,
          }
        }
      })
      setWeeklyHours(updated)
    }
  }

  const handleToggleWeeklyHours = (enabled: boolean) => {
    setShowWeeklyHours(enabled)

    if (enabled) {
      const openingTime = form.getValues('opening_time') || '09:00'
      const closingTime = form.getValues('closing_time') || '22:00'
      const defaultHours = getDefaultWeeklyHours(openingTime, closingTime)
      setWeeklyHours(defaultHours)
    } else {
      setWeeklyHours(null)
    }
  }

  const handleDayChange = (day: DayOfWeek, field: keyof DayHours, value: boolean | string | null) => {
    if (!weeklyHours) return

    const updated = {
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        [field]: value,
      },
    }

    // When opening/closing times change, recalculate shift patterns for that day
    if ((field === 'opening_time' || field === 'closing_time') && updated[day].is_open) {
      const openTime = field === 'opening_time' ? value as string : updated[day].opening_time
      const closeTime = field === 'closing_time' ? value as string : updated[day].closing_time
      if (openTime && closeTime) {
        updated[day].shifts = calculateDefaultShiftPatterns(openTime, closeTime)
      }
    }

    setWeeklyHours(updated)
  }

  const handleShiftChange = (
    day: DayOfWeek,
    shiftType: 'opening' | 'mid' | 'closing',
    timeField: 'start_time' | 'end_time',
    value: string
  ) => {
    if (!weeklyHours) return

    const currentShifts = weeklyHours[day].shifts || {}
    const currentShift = currentShifts[shiftType] || { start_time: '', end_time: '' }

    const updated = {
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        shifts: {
          ...currentShifts,
          [shiftType]: {
            ...currentShift,
            [timeField]: value,
          },
        },
      },
    }
    setWeeklyHours(updated)
  }

  const toggleDayExpanded = (day: DayOfWeek) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day],
    }))
  }

  const handleSubmit = async (data: StoreFormData) => {
    try {
      await onSubmit({
        ...data,
        weekly_hours: showWeeklyHours ? weeklyHours : null,
      })
      form.reset()
      setShowWeeklyHours(false)
      setWeeklyHours(null)
    } catch {
      // Error handled by parent component
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? 'Edit Store' : 'Add Store'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter store name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter store address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Operating Hours */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Operating Hours</Label>
              </div>

              {/* Default Hours - only show when NOT using per-day hours */}
              {!showWeeklyHours && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="opening_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Default Opening</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            step="3600"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              field.onChange(e.target.value || null)
                              handleDefaultTimesChange()
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="closing_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Default Closing</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            step="3600"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              field.onChange(e.target.value || null)
                              handleDefaultTimesChange()
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Toggle for per-day hours */}
              <div className="flex items-center justify-between py-2">
                <Label className="text-xs text-muted-foreground">
                  Different hours for each day?
                </Label>
                <Switch
                  checked={showWeeklyHours}
                  onCheckedChange={handleToggleWeeklyHours}
                />
              </div>

              {/* Per-day hours */}
              {showWeeklyHours && weeklyHours && (
                <div className="space-y-1 border rounded-lg p-3 bg-muted/30">
                  {DAYS_OF_WEEK.map((day) => (
                    <Collapsible
                      key={day}
                      open={expandedDays[day]}
                      onOpenChange={() => toggleDayExpanded(day)}
                    >
                      <div
                        className={`flex flex-wrap items-center gap-2 py-2 ${
                          !weeklyHours[day].is_open ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Checkbox
                            checked={weeklyHours[day].is_open}
                            onCheckedChange={(checked) =>
                              handleDayChange(day, 'is_open', checked as boolean)
                            }
                          />
                          <span className="text-xs font-medium w-10">{DAY_LABELS[day].slice(0, 3)}</span>
                        </div>
                        {weeklyHours[day].is_open ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].opening_time ?? ''}
                                onChange={(e) =>
                                  handleDayChange(day, 'opening_time', e.target.value || null)
                                }
                              />
                              <span className="text-xs text-muted-foreground px-1">-</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].closing_time ?? ''}
                                onChange={(e) =>
                                  handleDayChange(day, 'closing_time', e.target.value || null)
                                }
                              />
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 ml-auto"
                              >
                                <ChevronDown className={`h-3 w-3 transition-transform ${expandedDays[day] ? 'rotate-180' : ''}`} />
                                <span className="text-xs ml-1">Shifts</span>
                              </Button>
                            </CollapsibleTrigger>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Closed</span>
                        )}
                      </div>

                      {/* Shift patterns for this day */}
                      <CollapsibleContent>
                        {weeklyHours[day].is_open && (
                          <div className="mt-2 mb-3 space-y-3 pl-4 border-l-2 border-muted ml-4 sm:ml-12">
                            {/* Opening Shift */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium w-14 text-green-600">Opening</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.opening?.start_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'opening', 'start_time', e.target.value)
                                }
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.opening?.end_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'opening', 'end_time', e.target.value)
                                }
                              />
                            </div>

                            {/* Mid Shift */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium w-14 text-blue-600">Mid</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.mid?.start_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'mid', 'start_time', e.target.value)
                                }
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.mid?.end_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'mid', 'end_time', e.target.value)
                                }
                              />
                            </div>

                            {/* Closing Shift */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium w-14 text-purple-600">Closing</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.closing?.start_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'closing', 'start_time', e.target.value)
                                }
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="time"
                                step="3600"
                                className="h-8 w-[6.5rem] text-sm"
                                value={weeklyHours[day].shifts?.closing?.end_time ?? ''}
                                onChange={(e) =>
                                  handleShiftChange(day, 'closing', 'end_time', e.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}

              <FormDescription className="text-xs">
                Set store hours to enable shift pattern presets
              </FormDescription>
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {store ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
