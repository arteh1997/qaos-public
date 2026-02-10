'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { inventoryItemSchema, InventoryItemFormData } from '@/lib/validations/inventory'
import { useInventory } from '@/hooks/useInventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UNITS_OF_MEASURE } from '@/lib/constants'
import { Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CSVImport } from '@/components/inventory/CSVImport'
import { useAuth } from '@/components/providers/AuthProvider'

interface InventorySetupStepProps {
  onComplete: () => void
}

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

export function InventorySetupStep({ onComplete }: InventorySetupStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('csv')
  const { createItem, items } = useInventory()
  const { storeId } = useAuth()

  const form = useForm<InventoryItemFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: '',
      category: '',
      unit_of_measure: '',
      is_active: true,
    },
  })

  // Get existing categories from current items
  const existingCategories = useMemo(() => {
    const categories = items.map(item => item.category).filter((c): c is string => c !== null && c !== undefined)
    return [...new Set(categories)]
  }, [items])

  // Combine suggested and existing categories
  const categoryOptions = useMemo(() => {
    const combined = [...new Set([...existingCategories, ...SUGGESTED_CATEGORIES])]
    return combined.sort()
  }, [existingCategories])

  const handleSubmit = async (data: InventoryItemFormData) => {
    setIsSubmitting(true)
    try {
      await createItem(data)
      form.reset()
      toast.success('Inventory item added! You can add more or continue setup.')
      onComplete()
    } catch (error) {
      // Error is already handled by useInventory
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCSVSuccess = () => {
    onComplete()
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'csv')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="csv">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Plus className="mr-2 h-4 w-4" />
            Add Manually
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quickly add multiple inventory items by uploading a CSV file.
          </p>
          {storeId && <CSVImport storeId={storeId} onSuccess={handleCSVSuccess} showCard={false} />}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Add your first inventory item to start tracking stock levels. You can add more items later.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Tomatoes" {...field} />
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
                          list="category-suggestions"
                          {...field}
                        />
                      </FormControl>
                      <datalist id="category-suggestions">
                        {categoryOptions.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                      <FormDescription className="text-xs">
                        Type or select from suggestions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="unit_of_measure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., kg, liters, pcs"
                        list="unit-suggestions"
                        {...field}
                      />
                    </FormControl>
                    <datalist id="unit-suggestions">
                      {UNITS_OF_MEASURE.map((unit) => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                    <FormDescription className="text-xs">
                      Type or select from suggestions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </>
                )}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
