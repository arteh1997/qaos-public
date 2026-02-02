'use client'

import { useState, useEffect } from 'react'
import { Shift } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Clock, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { EditClockTimesData } from '@/lib/validations/shift'

interface EditClockTimesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift | null
  onSuccess?: () => void
}

export function EditClockTimesDialog({
  open,
  onOpenChange,
  shift,
  onSuccess,
}: EditClockTimesDialogProps) {
  const [clockInDate, setClockInDate] = useState('')
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutDate, setClockOutDate] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Reset form when shift changes
  useEffect(() => {
    if (shift && open) {
      if (shift.clock_in_time) {
        const clockIn = parseISO(shift.clock_in_time)
        setClockInDate(format(clockIn, 'yyyy-MM-dd'))
        setClockInTime(format(clockIn, 'HH:mm'))
      } else {
        // Default to shift start time
        const start = parseISO(shift.start_time)
        setClockInDate(format(start, 'yyyy-MM-dd'))
        setClockInTime(format(start, 'HH:mm'))
      }

      if (shift.clock_out_time) {
        const clockOut = parseISO(shift.clock_out_time)
        setClockOutDate(format(clockOut, 'yyyy-MM-dd'))
        setClockOutTime(format(clockOut, 'HH:mm'))
      } else {
        // Default to shift end time
        const end = parseISO(shift.end_time)
        setClockOutDate(format(end, 'yyyy-MM-dd'))
        setClockOutTime(format(end, 'HH:mm'))
      }

      setNotes(shift.notes || '')
    }
  }, [shift, open])

  const handleSubmit = async () => {
    if (!shift) return

    setIsLoading(true)

    try {
      const updateData: EditClockTimesData = {}

      // Construct clock in time if both date and time are provided
      if (clockInDate && clockInTime) {
        updateData.clock_in_time = new Date(`${clockInDate}T${clockInTime}:00`).toISOString()
      }

      // Construct clock out time if both date and time are provided
      if (clockOutDate && clockOutTime) {
        updateData.clock_out_time = new Date(`${clockOutDate}T${clockOutTime}:00`).toISOString()
      }

      // Validate clock out is after clock in
      if (updateData.clock_in_time && updateData.clock_out_time) {
        if (new Date(updateData.clock_out_time) <= new Date(updateData.clock_in_time)) {
          toast.error('Clock-out time must be after clock-in time')
          setIsLoading(false)
          return
        }
      }

      // Include notes if changed
      if (notes !== shift.notes) {
        updateData.notes = notes
      }

      const response = await fetch(`/api/shifts/${shift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update clock times')
      }

      toast.success('Clock times updated successfully')
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update clock times')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearClockIn = () => {
    setClockInDate('')
    setClockInTime('')
  }

  const handleClearClockOut = () => {
    setClockOutDate('')
    setClockOutTime('')
  }

  if (!shift) return null

  const shiftStart = parseISO(shift.start_time)
  const shiftEnd = parseISO(shift.end_time)
  const employeeName = shift.user?.full_name || shift.user?.email || 'Unknown'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Clock Times
          </DialogTitle>
          <DialogDescription>
            Correct the clock in/out times for {employeeName}&apos;s shift
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shift info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium">{employeeName}</div>
            <div className="text-muted-foreground mt-1">
              Scheduled: {format(shiftStart, 'EEE, MMM d')} &bull;{' '}
              {format(shiftStart, 'h:mm a')} - {format(shiftEnd, 'h:mm a')}
            </div>
          </div>

          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
              Time corrections are logged for audit purposes
            </AlertDescription>
          </Alert>

          {/* Clock In */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Clock In</Label>
              {(clockInDate || clockInTime) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearClockIn}
                  className="h-6 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={clockInDate}
                onChange={(e) => setClockInDate(e.target.value)}
                aria-label="Clock in date"
              />
              <Input
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                aria-label="Clock in time"
              />
            </div>
          </div>

          {/* Clock Out */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Clock Out</Label>
              {(clockOutDate || clockOutTime) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearClockOut}
                  className="h-6 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={clockOutDate}
                onChange={(e) => setClockOutDate(e.target.value)}
                aria-label="Clock out date"
              />
              <Input
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                aria-label="Clock out time"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add a note about this correction (e.g., 'Employee forgot to clock out')"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
