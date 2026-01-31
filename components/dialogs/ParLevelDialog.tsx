'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

interface ParLevelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  currentParLevel: number | null
  currentQuantity: number
  unitOfMeasure: string
  onSave: (parLevel: number) => void
  isLoading?: boolean
}

export function ParLevelDialog({
  open,
  onOpenChange,
  itemName,
  currentParLevel,
  currentQuantity,
  unitOfMeasure,
  onSave,
  isLoading,
}: ParLevelDialogProps) {
  const [parLevel, setParLevel] = useState<string>('')

  useEffect(() => {
    if (open) {
      setParLevel(currentParLevel?.toString() ?? '')
    }
  }, [open, currentParLevel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseInt(parLevel, 10)
    if (!isNaN(value) && value >= 0) {
      onSave(value)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set PAR Level</DialogTitle>
          <DialogDescription>
            Set the minimum stock level for <strong>{itemName}</strong>.
            You&apos;ll be alerted when stock falls below this level.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Current Stock:</span>
              <span className="font-medium">{currentQuantity} {unitOfMeasure}</span>
            </div>
            {currentParLevel !== null && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Current PAR Level:</span>
                <span className="font-medium">{currentParLevel} {unitOfMeasure}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="parLevel">New PAR Level ({unitOfMeasure})</Label>
            <Input
              id="parLevel"
              type="number"
              min="0"
              step="1"
              placeholder="Enter minimum quantity"
              value={parLevel}
              onChange={(e) => setParLevel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === '.') e.preventDefault()
              }}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Tip: Set this to cover your usage between deliveries plus a buffer.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !parLevel}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
