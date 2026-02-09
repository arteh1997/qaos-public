'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { inventoryItemSchema, InventoryItemFormData } from '@/lib/validations/inventory'
import { InventoryItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
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
import { Loader2 } from 'lucide-react'
import { UNITS_OF_MEASURE } from '@/lib/constants'
import { useMemo } from 'react'

// Common category suggestions
const SUGGESTED_CATEGORIES = [
  'Proteins',
  'Produce',
  'Dairy',
  'Beverages',
  'Dry Goods',
  'Frozen',
  'Sauces & Condiments',
  'Supplies',
  'Packaging',
]

interface InventoryItemFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem | null
  onSubmit: (data: InventoryItemFormData) => Promise<void>
  isLoading?: boolean
  existingCategories?: string[]
}

export function InventoryItemForm({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
  existingCategories = [],
}: InventoryItemFormProps) {
  const form = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: '',
      category: '',
      unit_of_measure: '',
      is_active: true,
    },
  })

  // Reset form when item changes (for edit mode) or when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: item?.name ?? '',
        category: item?.category ?? '',
        unit_of_measure: item?.unit_of_measure ?? '',
        is_active: item?.is_active ?? true,
      })
    }
  }, [open, item, form])

  // Combine existing and suggested categories
  const categoryOptions = useMemo(() => {
    const combined = [...new Set([...existingCategories, ...SUGGESTED_CATEGORIES])]
    return combined.sort()
  }, [existingCategories])

  // Get existing units from items (if we want to add that later)
  const unitOptions = UNITS_OF_MEASURE

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = async (data: InventoryItemFormData) => {
    await onSubmit(data)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter item name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Produce"
                      list="category-options"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="category-options">
                    {categoryOptions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_of_measure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., kg, liters, pcs"
                      list="unit-options"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="unit-options">
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {item ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
