'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useCSRF } from '@/hooks/useCSRF'
import { Loader2, Plus, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'

interface MenuSetupStepProps {
  storeId: string
  onComplete: () => void
}

interface AddedMenuItem {
  id: string
  name: string
  selling_price: number
}

export function MenuSetupStep({ storeId, onComplete }: MenuSetupStepProps) {
  const { csrfFetch } = useCSRF()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addedItems, setAddedItems] = useState<AddedMenuItem[]>([])

  // Form fields
  const [name, setName] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [category, setCategory] = useState('')

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Menu item name is required')
      return
    }

    const price = parseFloat(sellingPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await csrfFetch(`/api/stores/${storeId}/menu-items`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          selling_price: price,
          category: category.trim() || undefined,
          currency: 'GBP',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add menu item')
      }

      setAddedItems(prev => [...prev, {
        id: result.data.id,
        name: result.data.name,
        selling_price: result.data.selling_price,
      }])
      toast.success(`${name.trim()} added`)

      // Clear form for next item
      setName('')
      setSellingPrice('')
      // Keep category — likely adding items in the same category

      // Notify parent that step is complete (at least 1 menu item added)
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add menu item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Add your menu items with their selling prices. This lets you track food costs and profit margins. You can link recipes later.
        </p>
      </div>

      {/* Added items list */}
      {addedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {addedItems.map((item) => (
            <Badge key={item.id} variant="secondary" className="gap-1.5 py-1">
              <UtensilsCrossed className="h-3 w-3" />
              {item.name}
              <span className="text-muted-foreground">
                £{Number(item.selling_price).toFixed(2)}
              </span>
            </Badge>
          ))}
        </div>
      )}

      {/* Add menu item form */}
      <form onSubmit={handleAddMenuItem} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="menu-item-name" className="text-sm">Item Name *</Label>
            <Input
              id="menu-item-name"
              placeholder="e.g., Classic Burger"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-white text-black"
            />
          </div>
          <div>
            <Label htmlFor="menu-item-price" className="text-sm">Selling Price (£) *</Label>
            <Input
              id="menu-item-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="8.99"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="mt-1 bg-white text-black"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="menu-item-category" className="text-sm">Category</Label>
          <Input
            id="menu-item-category"
            placeholder="e.g., Mains, Sides, Drinks"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 bg-white text-black"
          />
        </div>

        <Button type="submit" disabled={isSubmitting || !name.trim() || !sellingPrice} size="sm">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Menu Item
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
