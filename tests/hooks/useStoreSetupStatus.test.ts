/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock supabaseFetch and supabaseUpdate
const mockSupabaseFetch = vi.fn()
const mockSupabaseUpdate = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase/client', () => ({
  supabaseFetch: (...args: any[]) => mockSupabaseFetch(...args),
  supabaseUpdate: (...args: any[]) => mockSupabaseUpdate(...args),
}))

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    refreshProfile: vi.fn(),
  }),
}))

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/stores/store-1',
  useSearchParams: () => new URLSearchParams(),
}))

/**
 * Helper: mock all supabaseFetch calls in order:
 * 1. Store data (sequential first call)
 * 2-5. Promise.all: [inventory, team, supplier, menu] counts
 */
function mockAllFetches(opts: {
  store?: Record<string, unknown>
  inventoryCount?: number
  teamCount?: number
  supplierCount?: number
  menuItemCount?: number
  storeError?: unknown
}) {
  const storeData = opts.store ?? { id: 'store-1', opening_time: null, closing_time: null, setup_completed_at: null }
  mockSupabaseFetch
    // 1. Store fetch
    .mockResolvedValueOnce({ data: opts.storeError ? null : [storeData], error: opts.storeError ?? null })
    // 2-5. Promise.all order: inventory, team, supplier, menu
    .mockResolvedValueOnce({ count: opts.inventoryCount ?? 0, error: null })
    .mockResolvedValueOnce({ count: opts.teamCount ?? 0, error: null })
    .mockResolvedValueOnce({ count: opts.supplierCount ?? 0, error: null })
    .mockResolvedValueOnce({ count: opts.menuItemCount ?? 0, error: null })
}

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

  it('should short-circuit when setup_completed_at is set', async () => {
    mockSupabaseFetch.mockResolvedValueOnce({
      data: [{ id: 'store-1', setup_completed_at: '2026-01-01T00:00:00Z' }],
      error: null,
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.isSetupComplete).toBe(true)
    expect(result.current.status.completedCount).toBe(5)
    // Should NOT have made any count queries (only the store fetch)
    expect(mockSupabaseFetch).toHaveBeenCalledTimes(1)
  })

  it('should mark inventory step as complete when count > 0', async () => {
    mockAllFetches({ inventoryCount: 5 })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const inventoryStep = result.current.status.steps.find(s => s.id === 'inventory')
    expect(inventoryStep?.isComplete).toBe(true)
    // Setup is NOT complete — all 5 steps are required now
    expect(result.current.status.isSetupComplete).toBe(false)
  })

  it('should mark setup as incomplete when no inventory', async () => {
    mockAllFetches({ inventoryCount: 0 })

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
    mockAllFetches({
      store: { id: 'store-1', opening_time: '09:00', closing_time: '22:00', setup_completed_at: null },
      inventoryCount: 1,
    })

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
    mockAllFetches({
      store: { id: 'store-1', opening_time: '09:00', closing_time: null, setup_completed_at: null },
      inventoryCount: 1,
    })

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
    mockAllFetches({ inventoryCount: 1, teamCount: 3 })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const teamStep = result.current.status.steps.find(s => s.id === 'team')
    expect(teamStep?.isComplete).toBe(true)
  })

  it('should mark suppliers step as complete when has suppliers', async () => {
    mockAllFetches({ inventoryCount: 1, supplierCount: 2 })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const suppliersStep = result.current.status.steps.find(s => s.id === 'suppliers')
    expect(suppliersStep?.isComplete).toBe(true)
  })

  it('should mark menu step as complete when has menu items', async () => {
    mockAllFetches({ inventoryCount: 1, menuItemCount: 3 })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const menuStep = result.current.status.steps.find(s => s.id === 'menu')
    expect(menuStep?.isComplete).toBe(true)
  })

  it('should return store data', async () => {
    mockAllFetches({
      store: { id: 'store-1', name: 'Test Store', opening_time: '09:00', closing_time: '22:00', setup_completed_at: null },
      inventoryCount: 1,
    })

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

  it('should calculate correct step counts when all complete', async () => {
    mockAllFetches({
      store: { id: 'store-1', opening_time: '09:00', closing_time: '22:00', setup_completed_at: null },
      inventoryCount: 5,
      teamCount: 2,
      supplierCount: 1,
      menuItemCount: 3,
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.totalCount).toBe(5)
    expect(result.current.status.requiredCount).toBe(5)
    expect(result.current.status.completedCount).toBe(5)
    expect(result.current.status.isSetupComplete).toBe(true)
  })

  it('should auto-stamp setup_completed_at when all steps complete', async () => {
    mockAllFetches({
      store: { id: 'store-1', opening_time: '09:00', closing_time: '22:00', setup_completed_at: null },
      inventoryCount: 5,
      teamCount: 2,
      supplierCount: 1,
      menuItemCount: 3,
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.isSetupComplete).toBe(true)
    // Should have called supabaseUpdate to stamp setup_completed_at
    expect(mockSupabaseUpdate).toHaveBeenCalledWith('stores', 'store-1', expect.objectContaining({
      setup_completed_at: expect.any(String),
    }))
  })

  it('should mark setup incomplete when any required step is missing', async () => {
    mockAllFetches({
      store: { id: 'store-1', opening_time: '09:00', closing_time: '22:00', setup_completed_at: null },
      inventoryCount: 5,
      teamCount: 2,
      supplierCount: 0, // No suppliers
      menuItemCount: 3,
    })

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.status.completedCount).toBe(4) // 4 of 5
    expect(result.current.status.isSetupComplete).toBe(false) // Missing suppliers
    // Should NOT have called supabaseUpdate
    expect(mockSupabaseUpdate).not.toHaveBeenCalled()
  })

  it('should have correct step order: inventory, hours, suppliers, menu, team', async () => {
    mockAllFetches({})

    vi.resetModules()
    const { useStoreSetupStatus } = await import('@/hooks/useStoreSetupStatus')
    const { result } = renderHook(() => useStoreSetupStatus('store-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const stepIds = result.current.status.steps.map(s => s.id)
    expect(stepIds).toEqual(['inventory', 'hours', 'suppliers', 'menu', 'team'])
  })

  it('should provide refetch function', async () => {
    let fetchCount = 0
    mockSupabaseFetch.mockImplementation(() => {
      fetchCount++
      return Promise.resolve({
        data: [{ id: 'store-1', opening_time: null, closing_time: null, setup_completed_at: null }],
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
