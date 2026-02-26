'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, X, Search, Link2, Unlink } from 'lucide-react'
import type { InvoiceLineItem } from '@/types'

interface InventoryOption {
  id: string
  name: string
  unit_of_measure: string
}

interface InvoiceLineItemTableProps {
  lineItems: InvoiceLineItem[]
  inventoryItems: InventoryOption[]
  editable?: boolean
  onUpdateLineItem?: (lineItemId: string, updates: Record<string, unknown>) => void
}

const MATCH_STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  auto_matched: { label: 'Auto', classes: 'bg-emerald-50 text-emerald-700' },
  manually_matched: { label: 'Manual', classes: 'bg-blue-50 text-blue-700' },
  unmatched: { label: 'Unmatched', classes: 'bg-amber-50 text-amber-700' },
  skipped: { label: 'Skipped', classes: 'bg-muted text-muted-foreground' },
}

export function InvoiceLineItemTable({
  lineItems,
  inventoryItems,
  editable = false,
  onUpdateLineItem,
}: InvoiceLineItemTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const sortedItems = [...lineItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const filteredInventory = searchQuery
    ? inventoryItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : inventoryItems

  const handleMatch = (lineItemId: string, inventoryItemId: string) => {
    onUpdateLineItem?.(lineItemId, {
      inventory_item_id: inventoryItemId,
      match_status: 'manually_matched',
    })
    setEditingId(null)
    setSearchQuery('')
  }

  const handleUnmatch = (lineItemId: string) => {
    onUpdateLineItem?.(lineItemId, {
      inventory_item_id: null,
      match_status: 'unmatched',
    })
  }

  const handleSkip = (lineItemId: string) => {
    onUpdateLineItem?.(lineItemId, {
      inventory_item_id: null,
      match_status: 'skipped',
    })
  }

  const matchedCount = lineItems.filter(l => l.inventory_item_id).length
  const total = lineItems.reduce((sum, l) => sum + (l.total_price ?? 0), 0)

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {matchedCount} of {lineItems.length} items matched
        </span>
        <span className="font-semibold">Total: £{total.toFixed(2)}</span>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedItems.map((item) => {
          const badge = MATCH_STATUS_BADGE[item.match_status] ?? MATCH_STATUS_BADGE.unmatched
          const matchedItem = item.inventory_item_id
            ? inventoryItems.find(i => i.id === item.inventory_item_id)
            : null
          const isEditing = editingId === item.id

          return (
            <div key={item.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description || 'Unnamed item'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {item.quantity != null && <span>{item.quantity} {item.unit_of_measure ?? ''}</span>}
                    {item.unit_price != null && <span>&middot; £{item.unit_price.toFixed(2)}/ea</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.total_price != null && (
                    <span className="text-sm font-semibold">£{item.total_price.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Match status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={badge.classes}>{badge.label}</Badge>
                  {matchedItem && (
                    <span className="text-xs text-muted-foreground truncate">
                      → {matchedItem.name}
                    </span>
                  )}
                </div>
                {editable && !isEditing && (
                  <div className="flex items-center gap-1">
                    {item.match_status !== 'skipped' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(item.id)}>
                        <Link2 className="h-3 w-3 mr-1" />
                        {matchedItem ? 'Change' : 'Match'}
                      </Button>
                    )}
                    {item.match_status !== 'skipped' ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleSkip(item.id)}>
                        Skip
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUnmatch(item.id)}>
                        Undo
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Inline matcher */}
              {isEditing && editable && (
                <div className="border-t pt-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search inventory items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {filteredInventory.slice(0, 10).map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => handleMatch(item.id, inv.id)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="truncate">{inv.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{inv.unit_of_measure}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => { setEditingId(null); setSearchQuery('') }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Description</TableHead>
              <TableHead className="text-right w-[10%]">Qty</TableHead>
              <TableHead className="text-right w-[12%]">Unit Price</TableHead>
              <TableHead className="text-right w-[12%]">Total</TableHead>
              <TableHead className="w-[24%]">Matched Item</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => {
              const badge = MATCH_STATUS_BADGE[item.match_status] ?? MATCH_STATUS_BADGE.unmatched
              const matchedItem = item.inventory_item_id
                ? inventoryItems.find(i => i.id === item.inventory_item_id)
                : null

              return (
                <TableRow key={item.id} className={item.match_status === 'skipped' ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <p className="truncate">{item.description || 'Unnamed item'}</p>
                    {item.unit_of_measure && (
                      <p className="text-xs text-muted-foreground">{item.unit_of_measure}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    {item.unit_price != null ? `£${item.unit_price.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.total_price != null ? `£${item.total_price.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <Select
                        value={item.inventory_item_id ?? 'unmatched'}
                        onValueChange={(val) => {
                          if (val === 'unmatched') {
                            handleUnmatch(item.id)
                          } else if (val === 'skip') {
                            handleSkip(item.id)
                          } else {
                            handleMatch(item.id, val)
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select item..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmatched">
                            <span className="text-muted-foreground">— Not matched —</span>
                          </SelectItem>
                          <SelectItem value="skip">
                            <span className="text-muted-foreground">Skip this item</span>
                          </SelectItem>
                          {inventoryItems.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.name} ({inv.unit_of_measure})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : matchedItem ? (
                      <span className="text-sm">{matchedItem.name}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={badge.classes}>{badge.label}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
