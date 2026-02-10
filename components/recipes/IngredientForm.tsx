'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { recipeIngredientSchema, type RecipeIngredientFormData } from '@/lib/validations/recipes'
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

export function IngredientForm({ open, onOpenChange, onSubmit, isSubmitting, inventoryItems }: IngredientFormProps) {
  const form = useForm<RecipeIngredientFormData>({
    resolver: zodResolver(recipeIngredientSchema),
    defaultValues: {
      inventory_item_id: '',
      quantity: 0,
      unit_of_measure: '',
      notes: '',
    },
  })

  const selectedItemId = form.watch('inventory_item_id')
  const selectedItem = inventoryItems.find(i => i.id === selectedItemId)

  const handleSubmit = async (values: RecipeIngredientFormData) => {
    await onSubmit(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>
            Add an inventory item as an ingredient to this recipe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="inventory_item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Item *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      const item = inventoryItems.find(i => i.id === value)
                      if (item) form.setValue('unit_of_measure', item.unit_of_measure)
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.unit_of_measure})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
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
                      <Input placeholder={selectedItem?.unit_of_measure ?? 'kg, oz, each'} {...field} />
                    </FormControl>
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
