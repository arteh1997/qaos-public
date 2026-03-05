/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

// Mock useAuth
const mockStores: unknown[] = [];
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    stores: mockStores,
    isLoading: false,
    role: "Owner",
  }),
}));

describe("useSubscriptionGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStores.length = 0;
  });

  it("should return isActive true for active subscription", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: "active",
      },
    });

    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.isActive).toBe(true);
    expect(result.current.status).toBe("active");
    expect(result.current.storeName).toBe("Test Store");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("should return isActive true for trialing subscription", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: "trialing",
      },
    });

    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.isActive).toBe(true);
    expect(result.current.status).toBe("trialing");
  });

  it("should return isActive true for past_due subscription (grace period)", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: "past_due",
      },
    });

    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.isActive).toBe(true);
    expect(result.current.status).toBe("past_due");
  });

  it("should return isActive false for canceled subscription", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: "canceled",
      },
    });

    vi.resetModules();
    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.isActive).toBe(false);
    expect(result.current.status).toBe("canceled");
  });

  it("should return isActive false for unpaid subscription", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: "unpaid",
      },
    });

    vi.resetModules();
    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.isActive).toBe(false);
    expect(result.current.status).toBe("unpaid");
  });

  it("should skip check when storeId is null", async () => {
    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard(null));

    expect(result.current.isActive).toBe(true); // Default to active when no storeId
    expect(result.current.status).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("should return null status when store not found", async () => {
    // Empty stores array
    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() =>
      useSubscriptionGuard("nonexistent-store"),
    );

    expect(result.current.status).toBeNull();
    expect(result.current.storeName).toBeNull();
  });

  it("should handle store with null subscription_status", async () => {
    mockStores.push({
      store_id: "store-1",
      role: "Owner",
      store: {
        id: "store-1",
        name: "Test Store",
        subscription_status: null,
      },
    });

    vi.resetModules();
    const { useSubscriptionGuard } =
      await import("@/hooks/useSubscriptionGuard");
    const { result } = renderHook(() => useSubscriptionGuard("store-1"));

    expect(result.current.status).toBeNull();
    expect(result.current.isActive).toBe(false);
  });
});
