'use client'

import { CSVImport } from '@/components/inventory/CSVImport'
import { useAuth } from '@/components/providers/AuthProvider'

interface InventorySetupStepProps {
  onComplete: () => void
}

export function InventorySetupStep({ onComplete }: InventorySetupStepProps) {
  const { storeId } = useAuth()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Add all your inventory items at once using a spreadsheet. Download the template,
          fill in your items, and upload — you&apos;ll be tracking stock in minutes.
        </p>
        <p className="text-xs text-muted-foreground">
          You can always add individual items later from the Inventory page.
        </p>
      </div>

      {storeId && <CSVImport storeId={storeId} onSuccess={onComplete} showCard={false} />}
    </div>
  )
}
