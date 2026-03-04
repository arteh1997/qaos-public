import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock offline dependencies
const mockIsOnline = vi.fn(() => true);
const mockOnConnectivityChange = vi.fn((_cb: (online: boolean) => void) =>
  vi.fn(),
); // returns cleanup
const mockSyncPendingOperations = vi.fn();
const mockGetPendingCount = vi.fn(() => Promise.resolve(0));
const mockQueueOperation = vi.fn(
  (_type: string, _storeId: string, _data: unknown) => Promise.resolve(1),
);

vi.mock("@/lib/offline/sync", () => ({
  isOnline: () => mockIsOnline(),
  onConnectivityChange: (cb: (online: boolean) => void) =>
    mockOnConnectivityChange(cb),
  syncPendingOperations: (csrfFetch: typeof fetch) =>
    mockSyncPendingOperations(csrfFetch),
}));

vi.mock("@/lib/offline/db", () => ({
  getPendingCount: () => mockGetPendingCount(),
  queueOperation: (type: string, storeId: string, data: unknown) =>
    mockQueueOperation(type, storeId, data),
}));

vi.mock("@/hooks/useCSRF", () => ({
  useCSRF: () => ({
    csrfFetch: vi.fn((url: string, opts: RequestInit) => fetch(url, opts)),
  }),
}));

import { useOfflineSync } from "@/hooks/useOfflineSync";

describe("useOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsOnline.mockReturnValue(true);
    mockGetPendingCount.mockResolvedValue(0);
    mockSyncPendingOperations.mockResolvedValue({
      synced: 0,
      failed: 0,
      errors: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with online status", () => {
    mockIsOnline.mockReturnValue(true);

    const { result } = renderHook(() => useOfflineSync());

    expect(result.current.online).toBe(true);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.lastSyncResult).toBeNull();
  });

  it("should detect offline status", () => {
    mockIsOnline.mockReturnValue(false);

    const { result } = renderHook(() => useOfflineSync());

    expect(result.current.online).toBe(false);
  });

  it("should register connectivity change listener", () => {
    renderHook(() => useOfflineSync());

    expect(mockOnConnectivityChange).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should queue an offline operation", async () => {
    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.queueOfflineOperation("stock_count", "store-123", {
        items: [{ inventory_item_id: "item-1", quantity: 10 }],
      });
    });

    expect(mockQueueOperation).toHaveBeenCalledWith(
      "stock_count",
      "store-123",
      {
        items: [{ inventory_item_id: "item-1", quantity: 10 }],
      },
    );
  });

  it("should return sync result from syncNow", async () => {
    mockSyncPendingOperations.mockResolvedValue({
      synced: 2,
      failed: 1,
      errors: ["stock_count: Server error"],
    });

    const { result } = renderHook(() => useOfflineSync());

    let syncResult:
      | { synced: number; failed: number; errors: string[] }
      | undefined;
    await act(async () => {
      syncResult = await result.current.syncNow();
    });

    expect(syncResult).toEqual({
      synced: 2,
      failed: 1,
      errors: ["stock_count: Server error"],
    });
    expect(result.current.lastSyncResult).toEqual({
      synced: 2,
      failed: 1,
      errors: ["stock_count: Server error"],
    });
  });

  it("should prevent concurrent syncs", async () => {
    let resolveSync: () => void;
    mockSyncPendingOperations.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = () => resolve({ synced: 1, failed: 0, errors: [] });
      }),
    );

    const { result } = renderHook(() => useOfflineSync());

    // Start first sync
    let firstSyncDone = false;
    act(() => {
      result.current.syncNow().then(() => {
        firstSyncDone = true;
      });
    });

    // Try second sync while first is in progress
    let secondResult:
      | { synced: number; failed: number; errors: string[] }
      | undefined;
    await act(async () => {
      secondResult = await result.current.syncNow();
    });

    // Second sync should return immediately with "already in progress"
    expect(secondResult?.errors).toContain("Sync already in progress");
    expect(secondResult?.synced).toBe(0);

    // Resolve the first sync
    await act(async () => {
      resolveSync!();
      await waitFor(() => expect(firstSyncDone).toBe(true));
    });
  });

  it("should refresh pending count after sync", async () => {
    mockGetPendingCount.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    mockSyncPendingOperations.mockResolvedValue({
      synced: 3,
      failed: 0,
      errors: [],
    });

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.syncNow();
    });

    // getPendingCount should have been called to refresh
    expect(mockGetPendingCount).toHaveBeenCalled();
  });

  it("should refresh pending count after queueing operation", async () => {
    mockGetPendingCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const { result } = renderHook(() => useOfflineSync());

    await act(async () => {
      await result.current.queueOfflineOperation("waste_report", "store-1", {
        items: [],
      });
    });

    expect(mockGetPendingCount).toHaveBeenCalled();
  });
});
