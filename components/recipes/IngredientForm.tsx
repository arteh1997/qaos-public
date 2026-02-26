'use client'

import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { RecipeIngredientFormData } from '@/lib/validations/recipes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const COMMON_UNITS = [
  'grams',
  'kg',
  'ml',
  'litres',
  'pieces',
  'slices',
  'cups',
  'tbsp',
  'tsp',
  'oz',
  'lb',
]

interface InventoryOption {
  id: string
  name: string
  unit_of_measure: string
}

interface IngredientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RecipeIngredientFormData) => Promise<void>
  isSubmitting: boolean
  inventoryItems: InventoryOption[]
}

// Local schema: quantity as string to avoid leading-zero problem
const ingredientFormSchema = z.object({
  inventory_item_id: z.string().min(1, 'Pick an ingredient'),
  quantity: z.string().min(1, 'Enter how much you use').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Must be a number greater than 0'
  ),
  unit_of_measure: z.string().min(1, 'Pick or type a unit'),
})

type FormValues = z.infer<typeof ingredientFormSchema>

export function IngredientForm({ open, onOpenChange, onSubmit, isSubmitting, inventoryItems }: IngredientFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      inventory_item_id: '',
      quantity: '',
      unit_of_measure: '',
    },
  })

  const prevUnitRef = useRef('')

  const handleSubmit = async (values: FormValues) => {
    const data: RecipeIngredientFormData = {
      inventory_item_id: values.inventory_item_id,
      quantity: parseFloat(values.quantity),
      unit_of_measure: values.unit_of_measure,
    }
    await onSubmit(data)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>
            Pick something from your inventory and say how much you use per serving.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inventory_item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredient *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose from your inventory" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 200"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_of_measure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. grams, pieces"
                        list="ingredient-units"
                        {...field}
                        onFocus={() => {
                          prevUnitRef.current = field.value
                          field.onChange('')
                        }}
                        onBlur={() => {
                          if (!field.value) {
                            field.onChange(prevUnitRef.current)
                          }
                        }}
                      />
                    </FormControl>
                    <datalist id="ingredient-units">
                      {COMMON_UNITS.map(unit => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Ingredient'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
