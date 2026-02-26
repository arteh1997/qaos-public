'use client'

import { useState, useEffect } from 'react'
import { useCSRF } from '@/hooks/useCSRF'
import { Shift } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TimePicker } from '@/components/ui/time-picker'
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
import { format, parseISO, isSameDay } from 'date-fns'
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
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { csrfFetch } = useCSRF()

  // Reset form when shift changes
  useEffect(() => {
    if (shift && open) {
      // Only populate if the employee actually clocked in/out — otherwise leave blank
      if (shift.clock_in_time) {
        setClockInTime(format(parseISO(shift.clock_in_time), 'HH:mm'))
      } else {
        setClockInTime('')
      }

      if (shift.clock_out_time) {
        setClockOutTime(format(parseISO(shift.clock_out_time), 'HH:mm'))
      } else {
        setClockOutTime('')
      }

      setNotes(shift.notes || '')
    }
  }, [shift, open])

  const handleSubmit = async () => {
    if (!shift) return

    setIsLoading(true)

    try {
      const updateData: EditClockTimesData = {}
      const shiftStart = parseISO(shift.start_time)
      const shiftEnd = parseISO(shift.end_time)

      // Build clock-in datetime using the shift's start date + entered time
      if (clockInTime) {
        const clockInDate = format(shiftStart, 'yyyy-MM-dd')
        updateData.clock_in_time = new Date(`${clockInDate}T${clockInTime}:00`).toISOString()
      } else if (shift.clock_in_time) {
        // User cleared a previously-set clock-in time — send null to remove it
        updateData.clock_in_time = null
      }

      // Build clock-out datetime using the shift's end date + entered time
      if (clockOutTime) {
        const clockOutDate = format(shiftEnd, 'yyyy-MM-dd')
        updateData.clock_out_time = new Date(`${clockOutDate}T${clockOutTime}:00`).toISOString()
      } else if (shift.clock_out_time) {
        // User cleared a previously-set clock-out time — send null to remove it
        updateData.clock_out_time = null
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

      const response = await csrfFetch(`/api/shifts/${shift.id}`, {
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

  if (!shift) return null

  const shiftStart = parseISO(shift.start_time)
  const shiftEnd = parseISO(shift.end_time)
  const isOvernight = !isSameDay(shiftStart, shiftEnd)
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
              {isOvernight && (
                <span className="text-violet-500 ml-1">(+1d)</span>
              )}
            </div>
          </div>

          <Alert className="bg-muted border-border">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-muted-foreground text-sm">
              Time corrections are logged for audit purposes
            </AlertDescription>
          </Alert>

          {/* Clock In */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Clock In</Label>
              {clockInTime && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClockInTime('')}
                  className="h-6 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <TimePicker
              value={clockInTime || null}
              onChange={(v) => setClockInTime(v)}
              minuteStep={15}
              placeholder="Select time"
            />
            {clockInTime && (
              <p className="text-xs text-muted-foreground">
                on {format(shiftStart, 'EEE, MMM d')}
              </p>
            )}
          </div>

          {/* Clock Out */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Clock Out</Label>
              {clockOutTime && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClockOutTime('')}
                  className="h-6 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <TimePicker
              value={clockOutTime || null}
              onChange={(v) => setClockOutTime(v)}
              minuteStep={15}
              placeholder="Select time"
            />
            {clockOutTime && (
              <p className="text-xs text-muted-foreground">
                on {format(shiftEnd, 'EEE, MMM d')}
                {isOvernight && ' (next day)'}
              </p>
            )}
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
