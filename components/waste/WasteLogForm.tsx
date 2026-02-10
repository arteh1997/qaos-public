'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Plus, Trash2 } from 'lucide-react'
import type { WasteReason } from '@/types'

const WASTE_REASONS: { value: WasteReason; label: string }[] = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'expired', label: 'Expired' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'overproduction', label: 'Overproduction' },
  { value: 'other', label: 'Other' },
]

const wasteItemSchema = z.object({
  inventory_item_id: z.string().min(1, 'Select an item'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  reason: z.enum(['spoilage', 'damaged', 'expired', 'overproduction', 'other']),
})

const wasteFormSchema = z.object({
  items: z.array(wasteItemSchema).min(1, 'Add at least one item'),
  notes: z.string().optional(),
})

type WasteFormValues = z.infer<typeof wasteFormSchema>

interface InventoryOption {
  id: string
  name: string
  unit_of_measure: string
}

interface WasteLogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventoryItems: InventoryOption[]
  onSubmit: (data: { items: Array<{ inventory_item_id: string; quantity: number; reason?: WasteReason }>; notes?: string }) => Promise<void>
  isSubmitting: boolean
}

export function WasteLogForm({ open, onOpenChange, inventoryItems, onSubmit, isSubmitting }: WasteLogFormProps) {
  const form = useForm({
    resolver: zodResolver(wasteFormSchema),
    defaultValues: {
      items: [{ inventory_item_id: '', quantity: 0, reason: 'spoilage' as const }],
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const handleSubmit = async (values: Record<string, unknown>) => {
    const parsed = values as unknown as WasteFormValues
    await onSubmit({
      items: parsed.items.map(item => ({
        inventory_item_id: item.inventory_item_id,
        quantity: item.quantity,
        reason: item.reason,
      })),
      notes: parsed.notes || undefined,
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Waste</DialogTitle>
          <DialogDescription>
            Record wasted inventory items with quantities and reasons.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.inventory_item_id`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>Item</FormLabel>}
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inventoryItems.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>Quantity</FormLabel>}
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.reason`}
                      render={({ field }) => (
                        <FormItem>
                          {index === 0 && <FormLabel>Reason</FormLabel>}
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {WASTE_REASONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ inventory_item_id: '', quantity: 0, reason: 'spoilage' })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes about this waste..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Log Waste'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
