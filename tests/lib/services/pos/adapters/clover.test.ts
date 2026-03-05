import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock fetch before importing the adapter
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { cloverAdapter } from "@/lib/services/pos/adapters/clover";

describe("cloverAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLOVER_API_URL;
  });

  describe("getAuthUrl", () => {
    it("uses production OAuth URL", () => {
      const url = cloverAdapter.getAuthUrl("store-1", "state-token");
      expect(url).toContain("https://www.clover.com/oauth/v2/authorize");
      expect(url).not.toContain("sandbox");
    });
  });

  describe("exchangeCode", () => {
    it("uses production OAuth URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "tok",
            merchant_id: "mid",
          }),
      });

      await cloverAdapter.exchangeCode("auth-code");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://www.clover.com/oauth/v2/token"),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.not.stringContaining("sandbox"),
      );
    });
  });

  describe("fetchMenuItems", () => {
    it("defaults to api.clover.com", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      });

      await cloverAdapter.fetchMenuItems({
        merchant_id: "m1",
        access_token: "tok",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.clover.com/v3/merchants/m1"),
        expect.any(Object),
      );
    });

    it("respects CLOVER_API_URL override", async () => {
      process.env.CLOVER_API_URL = "https://sandbox.dev.clover.com";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ elements: [] }),
      });

      await cloverAdapter.fetchMenuItems({
        merchant_id: "m1",
        access_token: "tok",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://sandbox.dev.clover.com/v3/merchants/m1",
        ),
        expect.any(Object),
      );
    });
  });
});
