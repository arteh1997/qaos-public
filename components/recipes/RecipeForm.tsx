'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRecipeSchema, type CreateRecipeFormData } from '@/lib/validations/recipes'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { Recipe } from '@/types'

interface RecipeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateRecipeFormData) => Promise<void>
  isSubmitting: boolean
  recipe?: Recipe | null
}

export function RecipeForm({ open, onOpenChange, onSubmit, isSubmitting, recipe }: RecipeFormProps) {
  const form = useForm<CreateRecipeFormData>({
    resolver: zodResolver(createRecipeSchema),
    defaultValues: {
      name: recipe?.name ?? '',
      description: recipe?.description ?? '',
      category: recipe?.category ?? '',
      yield_quantity: recipe?.yield_quantity ?? 1,
      yield_unit: recipe?.yield_unit ?? 'serving',
      prep_time_minutes: recipe?.prep_time_minutes ?? undefined,
      is_active: recipe?.is_active ?? true,
    },
  })

  const handleSubmit = async (values: CreateRecipeFormData) => {
    await onSubmit(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
          <DialogDescription>
            {recipe ? 'Update recipe details.' : 'Create a new recipe to track food costs.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Caesar Salad" {...field} />
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
                    <Input placeholder="e.g., Appetizers, Mains, Desserts" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="yield_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yield *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yield_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yield Unit *</FormLabel>
                    <FormControl>
                      <Input placeholder="serving" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prep_time_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prep Time (min)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="30" {...field} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Recipe description or instructions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : recipe ? 'Update Recipe' : 'Add Recipe'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
