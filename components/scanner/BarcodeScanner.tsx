'use client'

import { useState, useEffect, useRef } from 'react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, X, RotateCcw, Loader2 } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose?: () => void
  className?: string
}

export function BarcodeScanner({ onScan, onClose, className = '' }: BarcodeScannerProps) {
  const { isScanning, lastScannedCode, error, startScanning, stopScanning, onScan: registerCallback } = useBarcodeScanner()
  const [isStarting, setIsStarting] = useState(false)
  const scannerElementId = 'barcode-scanner-viewport'
  const hasStartedRef = useRef(false)

  // Register the scan callback
  useEffect(() => {
    registerCallback((code: string) => {
      onScan(code)
    })
  }, [registerCallback, onScan])

  // Auto-start scanning on mount
  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const timer = setTimeout(async () => {
      setIsStarting(true)
      await startScanning(scannerElementId)
      setIsStarting(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [startScanning])

  const handleRetry = async () => {
    setIsStarting(true)
    stopScanning()
    // Small delay to let the camera release
    await new Promise(resolve => setTimeout(resolve, 300))
    await startScanning(scannerElementId)
    setIsStarting(false)
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-0">
        {/* Scanner header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {isScanning ? (
              <Camera className="h-4 w-4 text-green-600" />
            ) : (
              <CameraOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {isStarting ? 'Starting camera...' : isScanning ? 'Scanning...' : 'Camera off'}
            </span>
            {isScanning && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {error && (
              <Button variant="ghost" size="sm" onClick={handleRetry} className="h-8 w-8 p-0">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={() => { stopScanning(); onClose() }} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black aspect-square max-h-[300px]">
          <div id={scannerElementId} className="w-full h-full" />

          {/* Overlay when not scanning */}
          {!isScanning && !isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
              {error ? (
                <>
                  <CameraOff className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400 text-center px-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-white/60" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startScanning(scannerElementId)}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    Start Scanner
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
              <p className="text-sm text-white/70">Starting camera...</p>
            </div>
          )}
        </div>

        {/* Last scanned result */}
        {lastScannedCode && (
          <div className="px-4 py-3 border-t bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Last scanned</p>
                <p className="text-sm font-mono font-medium">{lastScannedCode}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Scanned</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
