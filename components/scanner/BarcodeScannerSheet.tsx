'use client'

import { useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { BarcodeScanner } from './BarcodeScanner'
import { ScanBarcode } from 'lucide-react'

interface BarcodeScannerSheetProps {
  onScan: (code: string) => void
  children?: React.ReactNode
}

/**
 * A slide-up sheet containing the barcode scanner.
 * Use as a trigger button or wrap custom children.
 */
export function BarcodeScannerSheet({ onScan, children }: BarcodeScannerSheetProps) {
  const [open, setOpen] = useState(false)

  const handleScan = useCallback((code: string) => {
    onScan(code)
    // Auto-close after scan
    setOpen(false)
  }, [onScan])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <ScanBarcode className="h-4 w-4" />
            Scan Barcode
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] px-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle>Scan Barcode</SheetTitle>
        </SheetHeader>
        {open && (
          <BarcodeScanner
            onScan={handleScan}
            onClose={() => setOpen(false)}
            className="border-0 rounded-none shadow-none"
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
