import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiKeys } from "@/hooks/useApiKeys";

vi.mock("@/hooks/useCSRF", () => ({
  useCSRF: () => ({
    csrfFetch: vi.fn(async (url: string, options?: RequestInit) => {
      return csrfFetchMock(url, options);
    }),
  }),
}));

let csrfFetchMock: (url: string, options?: RequestInit) => Promise<Response>;

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const mockApiKeys = [
  {
    id: "key-1",
    name: "Test Key",
    key_prefix: "rk_live_abc",
    scopes: ["inventory:read"],
    is_active: true,
    last_used_at: null,
    expires_at: null,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("useApiKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    csrfFetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse({ success: true, data: [] }));
    global.fetch = vi
      .fn()
      .mockResolvedValue(makeResponse({ success: true, data: mockApiKeys }));
  });

  it("fetches API keys on mount", async () => {
    const { result } = renderHook(() => useApiKeys("store-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/stores/store-1/api-keys");
    expect(result.current.apiKeys).toHaveLength(1);
    expect(result.current.apiKeys[0].name).toBe("Test Key");
  });

  it("does not fetch when storeId is null", async () => {
    const { result } = renderHook(() => useApiKeys(null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.apiKeys).toHaveLength(0);
  });

  it("createApiKey calls POST and returns key", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(makeResponse({ success: true, data: mockApiKeys }));
    csrfFetchMock = vi.fn().mockResolvedValue(
      makeResponse(
        {
          success: true,
          data: { ...mockApiKeys[0], key: "rk_live_full_key" },
        },
        true,
        201,
      ),
    );

    const { result } = renderHook(() => useApiKeys("store-1"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let returned: { key: string } | undefined;
    await act(async () => {
      returned = await result.current.createApiKey({
        name: "Test Key",
        scopes: ["inventory:read"],
      });
    });

    expect(returned?.key).toBe("rk_live_full_key");
  });

  it("revokeApiKey removes key from list", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(makeResponse({ success: true, data: mockApiKeys }));
    csrfFetchMock = vi
      .fn()
      .mockResolvedValue(
        makeResponse({ success: true, data: { revoked: true } }),
      );

    const { result } = renderHook(() => useApiKeys("store-1"));

    await waitFor(() => {
      expect(result.current.apiKeys).toHaveLength(1);
    });

    await act(async () => {
      await result.current.revokeApiKey("key-1");
    });

    expect(result.current.apiKeys).toHaveLength(0);
  });
});
