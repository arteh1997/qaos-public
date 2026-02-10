'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseBarcodeResult {
  isScanning: boolean
  lastScannedCode: string | null
  error: string | null
  startScanning: (elementId: string) => Promise<void>
  stopScanning: () => void
  onScan: (callback: (code: string) => void) => void
}

export function useBarcodeScanner(): UseBarcodeResult {
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<unknown>(null)
  const callbackRef = useRef<((code: string) => void) | null>(null)

  const stopScanning = useCallback(() => {
    const scanner = scannerRef.current as { stop?: () => Promise<void>; clear?: () => void } | null
    if (scanner) {
      try {
        scanner.stop?.()
        scanner.clear?.()
      } catch {
        // Scanner already stopped
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }, [])

  const startScanning = useCallback(async (elementId: string) => {
    setError(null)

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode')

      // Stop any existing scanner
      stopScanning()

      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText: string) => {
          setLastScannedCode(decodedText)
          callbackRef.current?.(decodedText)
        },
        () => {
          // QR code not found in frame - this is normal, ignore
        }
      )

      setIsScanning(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start camera'
      setError(message)
      setIsScanning(false)
    }
  }, [stopScanning])

  const onScan = useCallback((callback: (code: string) => void) => {
    callbackRef.current = callback
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  return {
    isScanning,
    lastScannedCode,
    error,
    startScanning,
    stopScanning,
    onScan,
  }
}
