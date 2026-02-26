'use client'

import { useEffect, useState } from 'react'
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
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'

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
  onSubmit: (data: InventoryItemFormData, options?: { costPerUnit?: number }) => Promise<void>
  isLoading?: boolean
  existingCategories?: string[]
  currentCost?: number | null
}

export function InventoryItemForm({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading,
  existingCategories = [],
  currentCost,
}: InventoryItemFormProps) {
  const { storeId } = useAuth()

  const form = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      store_id: storeId ?? '',
      name: '',
      category: '',
      unit_of_measure: '',
      is_active: true,
    },
  })

  // Cost is stored on store_inventory, not inventory_items — managed separately
  const [costPerUnit, setCostPerUnit] = useState('')

  // Reset form when item changes (for edit mode) or when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        store_id: item?.store_id ?? storeId ?? '',
        name: item?.name ?? '',
        category: item?.category ?? '',
        unit_of_measure: item?.unit_of_measure ?? '',
        is_active: item?.is_active ?? true,
      })
      setCostPerUnit(currentCost && currentCost > 0 ? currentCost.toString() : '')
    }
  }, [open, item, form, currentCost, storeId])

  // Combine existing and suggested categories
  const categoryOptions = useMemo(() => {
    const combined = [...new Set([...existingCategories, ...SUGGESTED_CATEGORIES])]
    return combined.sort()
  }, [existingCategories])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = async (data: InventoryItemFormData) => {
    const parsedCost = parseFloat(costPerUnit)
    const options = !isNaN(parsedCost) && parsedCost >= 0 ? { costPerUnit: parsedCost } : undefined
    await onSubmit(data, options)
    form.reset()
    setCostPerUnit('')
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

            {/* Cost per unit — stored on store_inventory, not the Zod schema */}
            <div className="space-y-2">
              <label htmlFor="cost-per-unit" className="text-sm font-medium leading-none">
                Cost Per Unit (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                <Input
                  id="cost-per-unit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cost per single unit
              </p>
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
