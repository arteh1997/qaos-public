'use client'

import { useState, useCallback, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPurchaseOrderSchema, type CreatePurchaseOrderFormData } from '@/lib/validations/suppliers'
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
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { format, parseISO, startOfDay } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Supplier } from '@/types'

interface InventoryOption {
  id: string
  name: string
  unit_of_measure: string
  current_quantity?: number
}

interface PurchaseOrderFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreatePurchaseOrderFormData) => Promise<void>
  isSubmitting: boolean
  suppliers: Supplier[]
  inventoryItems: InventoryOption[]
  defaultSupplierId?: string
}

export function PurchaseOrderForm({ open, onOpenChange, onSubmit, isSubmitting, suppliers, inventoryItems, defaultSupplierId }: PurchaseOrderFormProps) {
  const form = useForm({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      supplier_id: defaultSupplierId ?? '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      notes: '',
      currency: 'GBP',
      items: [{ inventory_item_id: '', quantity_ordered: 0, unit_price: 0, notes: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // When dialog opens with a preselected supplier, sync the form value
  useEffect(() => {
    if (open && defaultSupplierId) {
      form.setValue('supplier_id', defaultSupplierId)
    }
  }, [open, defaultSupplierId, form])

  const lockedSupplier = defaultSupplierId
    ? suppliers.find(s => s.id === defaultSupplierId)
    : undefined

  // Track line totals separately — user types "line total", we derive unit_price
  const [lineTotals, setLineTotals] = useState<Record<number, number>>({})
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const today = startOfDay(new Date())

  const handleLineTotalChange = useCallback((index: number, lineTotal: number) => {
    setLineTotals(prev => ({ ...prev, [index]: lineTotal }))
    const qty = form.getValues(`items.${index}.quantity_ordered`)
    form.setValue(`items.${index}.unit_price`, qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : 0)
  }, [form])

  const handleQuantityChange = useCallback((index: number, qty: number) => {
    form.setValue(`items.${index}.quantity_ordered`, qty)
    const lt = lineTotals[index] ?? 0
    if (qty > 0 && lt > 0) {
      form.setValue(`items.${index}.unit_price`, Math.round((lt / qty) * 100) / 100)
    }
  }, [form, lineTotals])

  const handleSubmit = async (values: Record<string, unknown>) => {
    await onSubmit(values as unknown as CreatePurchaseOrderFormData)
    form.reset()
    setLineTotals({})
    onOpenChange(false)
  }

  const watchItems = form.watch('items')
  const total = Object.values(lineTotals).reduce((sum, lt) => sum + (lt || 0), 0)

  const getSelectedItem = (index: number) => {
    const itemId = watchItems[index]?.inventory_item_id
    return itemId ? inventoryItems.find(i => i.id === itemId) : undefined
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Add items and enter what you&apos;re paying for each line.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lockedSupplier ? (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50">
                    <span className="text-sm font-medium">{lockedSupplier.name}</span>
                  </div>
                </FormItem>
              ) : (
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery</FormLabel>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!field.value ? 'text-muted-foreground' : ''}`}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {field.value ? format(parseISO(field.value), 'EEE, d MMM yyyy') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? parseISO(field.value) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(format(date, 'yyyy-MM-dd'))
                              setDatePickerOpen(false)
                            }
                          }}
                          disabled={(date) => date < today}
                          weekStartsOn={1}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <FormLabel>Line Items *</FormLabel>
              {fields.map((field, index) => {
                const selectedItem = getSelectedItem(index)
                const qty = watchItems[index]?.quantity_ordered ?? 0
                const lt = lineTotals[index] ?? 0
                const unitPrice = qty > 0 && lt > 0 ? lt / qty : 0

                return (
                  <div key={field.id} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    {/* Row 1: Item selector + delete button */}
                    <div className="flex items-start gap-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.inventory_item_id`}
                        render={({ field }) => (
                          <FormItem className="flex-1 min-w-0">
                            {index === 0 && <FormLabel className="text-xs">Item</FormLabel>}
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="truncate">
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
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-1 shrink-0"
                          onClick={() => {
                            remove(index)
                            setLineTotals(prev => {
                              const next: Record<number, number> = {}
                              Object.entries(prev).forEach(([k, v]) => {
                                const ki = parseInt(k)
                                if (ki < index) next[ki] = v
                                else if (ki > index) next[ki - 1] = v
                              })
                              return next
                            })
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {/* Row 2: Qty + Line Total */}
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity_ordered`}
                        render={() => (
                          <FormItem>
                            {index === 0 && (
                              <FormLabel className="text-xs">
                                Qty{selectedItem ? ` (${selectedItem.unit_of_measure})` : ''}
                              </FormLabel>
                            )}
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                className="h-9"
                                value={qty || ''}
                                onChange={e => handleQuantityChange(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormItem>
                        {index === 0 && <FormLabel className="text-xs">Line Total (£)</FormLabel>}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-9 pl-7"
                            value={lt || ''}
                            onChange={e => handleLineTotalChange(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          />
                        </div>
                      </FormItem>
                    </div>

                    {/* Derived unit price hint */}
                    {unitPrice > 0 && selectedItem && (
                      <p className="text-xs text-muted-foreground pl-1">
                        = £{unitPrice.toFixed(2)} per {selectedItem.unit_of_measure}
                      </p>
                    )}
                  </div>
                )
              })}

              <div className="flex items-center justify-between pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ inventory_item_id: '', quantity_ordered: 0, unit_price: 0, notes: '' })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Order Total</p>
                  <p className="text-lg font-semibold tracking-tight">£{total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Delivery instructions, invoice reference..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
