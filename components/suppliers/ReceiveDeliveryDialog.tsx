'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PurchaseOrder } from '@/types'

interface ReceiveDeliveryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PurchaseOrder
  onReceive: (data: { items: Array<{ purchase_order_item_id: string; quantity_received: number }>; notes?: string }) => Promise<void>
  isSubmitting: boolean
}

export function ReceiveDeliveryDialog({ open, onOpenChange, order, onReceive, isSubmitting }: ReceiveDeliveryDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    order.items?.forEach(item => {
      initial[item.id] = item.quantity_ordered - (item.quantity_received ?? 0)
    })
    return initial
  })
  const [notes, setNotes] = useState('')

  const handleReceive = async () => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ purchase_order_item_id: id, quantity_received: qty }))

    if (items.length === 0) return

    await onReceive({ items, notes: notes || undefined })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive Delivery</DialogTitle>
          <DialogDescription>
            Record received quantities for PO #{order.po_number}
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Already Received</TableHead>
              <TableHead className="text-right">Receiving Now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items?.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.inventory_item?.name ?? item.inventory_item_id}</TableCell>
                <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                <TableCell className="text-right">{item.quantity_received ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max={item.quantity_ordered - (item.quantity_received ?? 0)}
                    className="w-20 ml-auto"
                    value={quantities[item.id] ?? 0}
                    onChange={e => setQuantities(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Delivery notes, discrepancies..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReceive} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Confirm Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
