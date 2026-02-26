'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const addMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().max(50).optional(),
  selling_price: z.string().min(1, 'Price is required').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    'Price must be a valid number'
  ),
})

type FormValues = z.infer<typeof addMenuItemSchema>

export interface MenuItemSubmitData {
  name: string
  category?: string
  selling_price: number
}

interface MenuItemFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MenuItemSubmitData) => Promise<void>
  isSubmitting: boolean
  existingCategories?: string[]
  defaultCategory?: string
}

export function MenuItemForm({ open, onOpenChange, onSubmit, isSubmitting, existingCategories = [], defaultCategory }: MenuItemFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(addMenuItemSchema),
    defaultValues: {
      name: '',
      category: defaultCategory ?? '',
      selling_price: '',
    },
  })

  // Reset category when defaultCategory changes (e.g., clicking "+ Add" on a category)
  useEffect(() => {
    if (open) {
      form.reset({ name: '', category: defaultCategory ?? '', selling_price: '' })
    }
  }, [open, defaultCategory, form])

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      name: values.name,
      category: values.category,
      selling_price: parseFloat(values.selling_price),
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Menu Item</DialogTitle>
          <DialogDescription>
            What do you sell and for how much? You can add ingredients later to see your profit.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Chicken Burger, Large Chips" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Burgers, Meals"
                        list="menu-categories"
                        {...field}
                      />
                    </FormControl>
                    {existingCategories.length > 0 && (
                      <datalist id="menu-categories">
                        {existingCategories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="selling_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="5.99"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add to Menu'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
