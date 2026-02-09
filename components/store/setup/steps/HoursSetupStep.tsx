'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabaseUpdate } from '@/lib/supabase/client'
import { Store } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Loader2, Clock, Check } from 'lucide-react'
import { toast } from 'sonner'

// Time format validation - matches store validation (HH:MM or H:MM)
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

const hoursSchema = z.object({
  opening_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  closing_time: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
})

type HoursFormData = z.infer<typeof hoursSchema>

interface HoursSetupStepProps {
  store: Store
  isComplete: boolean
  onComplete: () => void
}

// Helper to normalize time format (strip seconds if present)
function normalizeTime(time: string | null | undefined, defaultValue: string): string {
  if (!time) return defaultValue
  // Handle "HH:MM:SS" format by taking only "HH:MM"
  const parts = time.split(':')
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1]}`
  }
  return defaultValue
}

export function HoursSetupStep({ store, isComplete, onComplete }: HoursSetupStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<HoursFormData>({
    resolver: zodResolver(hoursSchema),
    defaultValues: {
      opening_time: normalizeTime(store.opening_time, '09:00'),
      closing_time: normalizeTime(store.closing_time, '22:00'),
    },
  })

  const handleSubmit = async (data: HoursFormData) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabaseUpdate('stores', store.id, {
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error

      toast.success('Operating hours saved!')
      onComplete()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save hours')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your store&apos;s regular operating hours. You can configure per-day hours later in store settings.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="opening_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Time</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        step="3600"
                        className="pl-10"
                        disabled={isComplete}
                        {...field}
                      />
                    </div>
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
                  <FormLabel>Closing Time</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        step="3600"
                        className="pl-10"
                        disabled={isComplete}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormDescription>
            These are your default daily hours. You can customize hours for each day of the week in store settings.
          </FormDescription>

          {!isComplete && (
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Hours
                </>
              )}
            </Button>
          )}
        </form>
      </Form>
    </div>
  )
}
