/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFormDraft, formatDraftTime } from '@/hooks/useFormDraft'

describe('useFormDraft', () => {
  const STORAGE_KEY = 'form-draft:test-form'

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  describe('initialization', () => {
    it('should initialize with default value when no draft exists', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      expect(result.current.value).toEqual({ name: 'default' })
      expect(result.current.hasDraft).toBe(false)
    })

    it('should detect existing draft on mount', () => {
      const draftData = {
        value: { name: 'drafted' },
        timestamp: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData))

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      expect(result.current.hasDraft).toBe(true)
      // Value is still default until restored
      expect(result.current.value).toEqual({ name: 'default' })
    })

    it('should ignore stale drafts', () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      const draftData = {
        value: { name: 'old draft' },
        timestamp: oldTimestamp,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData))

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }))

      expect(result.current.hasDraft).toBe(false)
      // Old draft should be removed
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('should handle invalid stored data', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json')

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      expect(result.current.hasDraft).toBe(false)
      expect(result.current.value).toEqual({ name: 'default' })
    })
  })

  describe('setValue', () => {
    it('should update value immediately', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      act(() => {
        result.current.setValue({ name: 'updated' })
      })

      expect(result.current.value).toEqual({ name: 'updated' })
    })

    it('should accept function updater', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { count: 0 },
      }))

      act(() => {
        result.current.setValue(prev => ({ count: prev.count + 1 }))
      })

      expect(result.current.value).toEqual({ count: 1 })
    })

    it('should save draft after debounce', async () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
        debounceMs: 500,
      }))

      act(() => {
        result.current.setValue({ name: 'saved' })
      })

      // Not saved yet
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Now it should be saved
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.value).toEqual({ name: 'saved' })
      expect(result.current.hasDraft).toBe(true)
    })

    it('should debounce multiple rapid updates', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
        debounceMs: 500,
      }))

      act(() => {
        result.current.setValue({ name: 'update1' })
      })

      act(() => {
        vi.advanceTimersByTime(200)
        result.current.setValue({ name: 'update2' })
      })

      act(() => {
        vi.advanceTimersByTime(200)
        result.current.setValue({ name: 'update3' })
      })

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Only the last value should be saved
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.value).toEqual({ name: 'update3' })
    })
  })

  describe('restoreDraft', () => {
    it('should restore draft value', () => {
      const draftData = {
        value: { name: 'drafted' },
        timestamp: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData))

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      let restored: unknown
      act(() => {
        restored = result.current.restoreDraft()
      })

      expect(restored).toEqual({ name: 'drafted' })
      expect(result.current.value).toEqual({ name: 'drafted' })
    })

    it('should return null when no draft exists', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      let restored: unknown
      act(() => {
        restored = result.current.restoreDraft()
      })

      expect(restored).toBeNull()
    })

    it('should handle invalid stored data during restore', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json')

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      let restored: unknown
      act(() => {
        restored = result.current.restoreDraft()
      })

      expect(restored).toBeNull()
    })
  })

  describe('clearDraft', () => {
    it('should remove draft from storage', () => {
      const draftData = {
        value: { name: 'drafted' },
        timestamp: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData))

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      act(() => {
        result.current.clearDraft()
      })

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(result.current.hasDraft).toBe(false)
    })

    it('should cancel pending save timeout', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
        debounceMs: 1000,
      }))

      // Trigger a save
      act(() => {
        result.current.setValue({ name: 'updated' })
      })

      // Clear before save completes
      act(() => {
        result.current.clearDraft()
        vi.advanceTimersByTime(1000)
      })

      // Should not have saved
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('draftTimestamp', () => {
    it('should track draft timestamp', () => {
      const timestamp = Date.now()
      const draftData = {
        value: { name: 'drafted' },
        timestamp,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData))

      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
      }))

      expect(result.current.draftTimestamp).toBe(timestamp)
    })

    it('should update timestamp when saving', () => {
      const { result } = renderHook(() => useFormDraft({
        key: 'test-form',
        defaultValue: { name: 'default' },
        debounceMs: 100,
      }))

      expect(result.current.draftTimestamp).toBeNull()

      act(() => {
        result.current.setValue({ name: 'updated' })
        vi.advanceTimersByTime(100)
      })

      expect(result.current.draftTimestamp).not.toBeNull()
    })
  })
})

describe('formatDraftTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "just now" for less than a minute ago', () => {
    const timestamp = Date.now() - 30000 // 30 seconds ago
    expect(formatDraftTime(timestamp)).toBe('just now')
  })

  it('should return minutes ago for 1-59 minutes', () => {
    expect(formatDraftTime(Date.now() - 60000)).toBe('1 minute ago')
    expect(formatDraftTime(Date.now() - 5 * 60000)).toBe('5 minutes ago')
    expect(formatDraftTime(Date.now() - 59 * 60000)).toBe('59 minutes ago')
  })

  it('should return hours ago for 1-23 hours', () => {
    expect(formatDraftTime(Date.now() - 3600000)).toBe('1 hour ago')
    expect(formatDraftTime(Date.now() - 5 * 3600000)).toBe('5 hours ago')
    expect(formatDraftTime(Date.now() - 23 * 3600000)).toBe('23 hours ago')
  })

  it('should return date for 24+ hours', () => {
    const timestamp = Date.now() - 25 * 3600000 // 25 hours ago
    const result = formatDraftTime(timestamp)
    // Should be a formatted date
    expect(result).not.toContain('hour')
    expect(result).not.toContain('minute')
  })
})
