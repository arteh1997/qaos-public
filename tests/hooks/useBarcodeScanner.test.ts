import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock Html5Qrcode
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockClear = vi.fn()

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    clear: mockClear,
  })),
}))

import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStart.mockResolvedValue(undefined)
    mockStop.mockResolvedValue(undefined)
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBarcodeScanner())

    expect(result.current.isScanning).toBe(false)
    expect(result.current.lastScannedCode).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should start scanning', async () => {
    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    expect(result.current.isScanning).toBe(true)
    expect(mockStart).toHaveBeenCalledWith(
      { facingMode: 'environment' },
      expect.objectContaining({
        fps: 10,
        qrbox: { width: 250, height: 250 },
      }),
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('should stop scanning', async () => {
    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    act(() => {
      result.current.stopScanning()
    })

    expect(result.current.isScanning).toBe(false)
  })

  it('should handle scan callback', async () => {
    const { result } = renderHook(() => useBarcodeScanner())

    const callback = vi.fn()

    act(() => {
      result.current.onScan(callback)
    })

    // Simulate a scan by calling the success callback
    let scanCallback: ((text: string) => void) | undefined
    mockStart.mockImplementation(
      (_config: unknown, _prefs: unknown, onSuccess: (text: string) => void) => {
        scanCallback = onSuccess
        return Promise.resolve()
      }
    )

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    // Trigger a scan
    if (scanCallback) {
      act(() => {
        scanCallback!('BARCODE-12345')
      })
    }

    expect(result.current.lastScannedCode).toBe('BARCODE-12345')
    expect(callback).toHaveBeenCalledWith('BARCODE-12345')
  })

  it('should handle camera errors', async () => {
    mockStart.mockRejectedValue(new Error('Camera permission denied'))

    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBe('Camera permission denied')
  })

  it('should handle non-Error camera failures', async () => {
    mockStart.mockRejectedValue('Unknown camera error')

    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBe('Failed to start camera')
  })

  it('should stop existing scanner before starting new one', async () => {
    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('element-1')
    })

    await act(async () => {
      await result.current.startScanning('element-2')
    })

    // stop should have been called for the first scanner
    expect(mockStop).toHaveBeenCalled()
  })

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    unmount()

    expect(mockStop).toHaveBeenCalled()
  })

  it('should register callback via onScan', () => {
    const { result } = renderHook(() => useBarcodeScanner())

    const callback = vi.fn()
    act(() => {
      result.current.onScan(callback)
    })

    // Callback is stored but not immediately called
    expect(callback).not.toHaveBeenCalled()
  })

  it('should clear error when starting new scan', async () => {
    mockStart.mockRejectedValueOnce(new Error('First error'))

    const { result } = renderHook(() => useBarcodeScanner())

    await act(async () => {
      await result.current.startScanning('test-element')
    })
    expect(result.current.error).toBe('First error')

    mockStart.mockResolvedValueOnce(undefined)

    await act(async () => {
      await result.current.startScanning('test-element')
    })

    expect(result.current.error).toBeNull()
  })
})
