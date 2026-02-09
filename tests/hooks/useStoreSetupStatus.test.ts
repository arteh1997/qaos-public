/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock supabaseFetch
const mockSupabaseFetch = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  supabaseFetch: (...args: any[]) => mockSupabaseFetch(...args),
}))

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}))

describe('useStoreSetupStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return loading state initially', async () => {
    mockSupabaseFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    expect(result.current.isLoading).toBe(true)
  })

  it('should return not loading when storeId is null', async () => {
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus(null))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should mark inventory step as complete when count > 0', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({ data: [{ id: 'store-1', opening_time: null, closing_time: null }], error: null }) // Store
      .mockResolvedValueOnce({ count: 5, error: null }) // Inventory count
      .mockResolvedValueOnce({ count: 0, error: null }) // Team count

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const inventoryStep = result.current.status.steps.find(s => s.id === 'inventory')
    expect(inventoryStep?.isComplete).toBe(true)
    expect(result.current.status.isSetupComplete).toBe(true) // Only inventory is required
  })

  it('should mark setup as incomplete when no inventory', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({ data: [{ id: 'store-1', opening_time: null, closing_time: null }], error: null })
      .mockResolvedValueOnce({ count: 0, error: null }) // No inventory
      .mockResolvedValueOnce({ count: 0, error: null }) // No team

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.isSetupComplete).toBe(false)
    const inventoryStep = result.current.status.steps.find(s => s.id === 'inventory')
    expect(inventoryStep?.isComplete).toBe(false)
  })

  it('should mark hours step as complete when both times set', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({
        data: [{ id: 'store-1', opening_time: '09:00', closing_time: '22:00' }],
        error: null,
      })
      .mockResolvedValueOnce({ count: 1, error: null }) // Has inventory
      .mockResolvedValueOnce({ count: 0, error: null })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const hoursStep = result.current.status.steps.find(s => s.id === 'hours')
    expect(hoursStep?.isComplete).toBe(true)
  })

  it('should mark hours step as incomplete when only opening time set', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({
        data: [{ id: 'store-1', opening_time: '09:00', closing_time: null }],
        error: null,
      })
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({ count: 0, error: null })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const hoursStep = result.current.status.steps.find(s => s.id === 'hours')
    expect(hoursStep?.isComplete).toBe(false)
  })

  it('should mark team step as complete when has team members', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({ data: [{ id: 'store-1', opening_time: null, closing_time: null }], error: null })
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({ count: 3, error: null }) // Has team members

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const teamStep = result.current.status.steps.find(s => s.id === 'team')
    expect(teamStep?.isComplete).toBe(true)
  })

  it('should return store data', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({
        data: [{ id: 'store-1', name: 'Test Store', opening_time: '09:00', closing_time: '22:00' }],
        error: null,
      })
      .mockResolvedValueOnce({ count: 1, error: null })
      .mockResolvedValueOnce({ count: 0, error: null })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.store?.name).toBe('Test Store')
  })

  it('should handle fetch error gracefully', async () => {
    mockSupabaseFetch.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' },
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
  })

  it('should calculate correct step counts', async () => {
    mockSupabaseFetch
      .mockResolvedValueOnce({
        data: [{ id: 'store-1', opening_time: '09:00', closing_time: '22:00' }],
        error: null,
      })
      .mockResolvedValueOnce({ count: 5, error: null }) // Has inventory (required complete)
      .mockResolvedValueOnce({ count: 2, error: null }) // Has team (optional complete)

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.totalCount).toBe(3) // 3 steps total
    expect(result.current.status.requiredCount).toBe(1) // Only inventory is required
    expect(result.current.status.completedCount).toBe(3) // All 3 complete
  })

  it('should provide refetch function', async () => {
    let fetchCount = 0
    mockSupabaseFetch.mockImplementation(() => {
      fetchCount++
      return Promise.resolve({
        data: [{ id: 'store-1', opening_time: null, closing_time: null }],
        count: fetchCount,
        error: null,
      })
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(typeof result.current.refetch).toBe('function')
  })
})
