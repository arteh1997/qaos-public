'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSupplierSchema, type CreateSupplierFormData } from '@/lib/validations/suppliers'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HelpCircle } from 'lucide-react'
import type { Supplier } from '@/types'

interface SupplierFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateSupplierFormData) => Promise<void>
  isSubmitting: boolean
  supplier?: Supplier | null
}

export function SupplierForm({ open, onOpenChange, onSubmit, isSubmitting, supplier }: SupplierFormProps) {
  const form = useForm<CreateSupplierFormData>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      contact_person: supplier?.contact_person ?? '',
      payment_terms: supplier?.payment_terms ?? '',
      notes: supplier?.notes ?? '',
    },
  })

  const handleSubmit = async (values: CreateSupplierFormData) => {
    await onSubmit(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          <DialogDescription>
            {supplier ? 'Update supplier details.' : 'Add a new supplier to your store.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Brakes Foodservice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., James Wilson" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., orders@supplier.co.uk" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 020 7946 0958" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="inline-flex items-center gap-1">
                      Payment Terms
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex" aria-label="What are payment terms?">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-64 text-xs leading-relaxed p-3">
                          <p className="font-medium mb-1">When you pay this supplier:</p>
                          <p><strong>COD</strong> — Cash on delivery</p>
                          <p><strong>Net 7/14/30</strong> — Pay within 7, 14, or 30 days</p>
                          <p><strong>EOM</strong> — Pay by end of month</p>
                          <p className="mt-1 text-muted-foreground">Helps you plan cash flow and compare supplier deals.</p>
                        </PopoverContent>
                      </Popover>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Net 30, COD, EOM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Unit 4, Covent Garden Market, London SW8 5EL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Delivery schedule, special instructions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : supplier ? 'Update Supplier' : 'Add Supplier'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
