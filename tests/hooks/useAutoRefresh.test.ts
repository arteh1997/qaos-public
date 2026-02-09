/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({ onRefresh }))

      expect(result.current.isAutoRefreshEnabled).toBe(true)
      expect(result.current.isRefreshing).toBe(false)
      expect(result.current.lastRefreshed).toBeInstanceOf(Date)
    })

    it('should respect enabled option', () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({
        onRefresh,
        enabled: false,
      }))

      expect(result.current.isAutoRefreshEnabled).toBe(false)
    })
  })

  describe('interval refresh', () => {
    it('should call onRefresh at specified interval', async () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
      }))

      // Not called initially (except by effect)
      expect(onRefresh).not.toHaveBeenCalled()

      // Advance time to first interval
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Advance to second interval
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('should not refresh when disabled', async () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
        enabled: false,
      }))

      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should stop refreshing when toggled off', async () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
      }))

      // First interval
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Toggle off
      act(() => {
        result.current.toggleAutoRefresh()
      })

      // Advance more time
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      // Should still be 1 call
      expect(onRefresh).toHaveBeenCalledTimes(1)
      expect(result.current.isAutoRefreshEnabled).toBe(false)
    })

    it('should resume refreshing when toggled back on', async () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
        enabled: false,
      }))

      // Toggle on
      act(() => {
        result.current.toggleAutoRefresh()
      })

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalled()
    })
  })

  describe('manual refresh', () => {
    it('should allow manual refresh trigger', async () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({
        onRefresh,
        enabled: false,
      }))

      await act(async () => {
        await result.current.refresh()
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should update lastRefreshed on manual refresh', async () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({ onRefresh }))

      const initialTime = result.current.lastRefreshed

      await act(async () => {
        vi.advanceTimersByTime(1000)
        await result.current.refresh()
      })

      expect(result.current.lastRefreshed.getTime()).toBeGreaterThan(initialTime.getTime())
    })

    it('should set isRefreshing during refresh', async () => {
      let resolveRefresh: () => void
      const onRefresh = vi.fn(() => new Promise<void>(resolve => {
        resolveRefresh = resolve
      }))

      const { result } = renderHook(() => useAutoRefresh({ onRefresh }))

      expect(result.current.isRefreshing).toBe(false)

      let refreshPromise: Promise<void>
      act(() => {
        refreshPromise = result.current.refresh()
      })

      expect(result.current.isRefreshing).toBe(true)

      await act(async () => {
        resolveRefresh!()
        await refreshPromise!
      })

      expect(result.current.isRefreshing).toBe(false)
    })

    it('should prevent concurrent refreshes', async () => {
      let resolveRefresh: () => void
      const onRefresh = vi.fn(() => new Promise<void>(resolve => {
        resolveRefresh = resolve
      }))

      const { result } = renderHook(() => useAutoRefresh({ onRefresh }))

      // Start first refresh
      act(() => {
        result.current.refresh()
      })

      // Try to start second refresh while first is running
      act(() => {
        result.current.refresh()
      })

      // Only one call should have been made
      expect(onRefresh).toHaveBeenCalledTimes(1)

      // Complete the refresh
      await act(async () => {
        resolveRefresh!()
      })
    })
  })

  describe('visibility handling', () => {
    it('should not refresh when tab is hidden', async () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
      }))

      // Make tab hidden
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      // Should not have refreshed while hidden
      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('should refresh immediately when tab becomes visible', async () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 60000, // Long interval
      }))

      // Simulate visibility change event
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should not refresh on visibility change when disabled', async () => {
      const onRefresh = vi.fn()
      renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 60000,
        enabled: false,
      }))

      // Simulate visibility change event
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })
  })

  describe('setIsAutoRefreshEnabled', () => {
    it('should directly set auto-refresh state', () => {
      const onRefresh = vi.fn()
      const { result } = renderHook(() => useAutoRefresh({ onRefresh }))

      act(() => {
        result.current.setIsAutoRefreshEnabled(false)
      })

      expect(result.current.isAutoRefreshEnabled).toBe(false)

      act(() => {
        result.current.setIsAutoRefreshEnabled(true)
      })

      expect(result.current.isAutoRefreshEnabled).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should clear interval on unmount', async () => {
      const onRefresh = vi.fn()
      const { unmount } = renderHook(() => useAutoRefresh({
        onRefresh,
        interval: 5000,
      }))

      unmount()

      // Advance time past interval
      await act(async () => {
        vi.advanceTimersByTime(10000)
      })

      // Should not have been called after unmount
      expect(onRefresh).not.toHaveBeenCalled()
    })
  })
})
