import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "crypto";

// Must mock fetch before importing the adapter
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { lightspeedAdapter } from "@/lib/services/pos/adapters/lightspeed";

describe("lightspeedAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe("getAuthUrl", () => {
    it("returns a valid Lightspeed OAuth URL", () => {
      const raw = lightspeedAdapter.getAuthUrl!("store-1", "state-token-123");
      const url = new URL(raw);

      expect(url.origin + url.pathname).toBe(
        "https://cloud.lightspeedapp.com/oauth/authorize.php",
      );
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe(
        "employee:sales employee:inventory",
      );
      expect(url.searchParams.get("state")).toBe("state-token-123");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "ls-access-token",
            refresh_token: "ls-refresh-token",
            expires_in: 7200,
          }),
      });

      const tokens = await lightspeedAdapter.exchangeCode!("auth-code-123");

      expect(tokens.access_token).toBe("ls-access-token");
      expect(tokens.refresh_token).toBe("ls-refresh-token");
      expect(tokens.expires_at).toBeDefined();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.lightspeedapp.com/oauth/access_token.php",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"grant_type":"authorization_code"'),
        }),
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(lightspeedAdapter.exchangeCode!("bad-code")).rejects.toThrow(
        "Lightspeed token exchange failed: 401",
      );
    });
  });

  describe("refreshToken", () => {
    it("refreshes an access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 7200,
          }),
      });

      const tokens = await lightspeedAdapter.refreshToken!({
        refresh_token: "old-refresh-token",
      });

      expect(tokens.access_token).toBe("new-access-token");
      expect(tokens.refresh_token).toBe("new-refresh-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.lightspeedapp.com/oauth/access_token.php",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"grant_type":"refresh_token"'),
        }),
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(
        lightspeedAdapter.refreshToken!({ refresh_token: "expired" }),
      ).rejects.toThrow("Lightspeed token refresh failed: 401");
    });
  });

  describe("normalizeEvent", () => {
    it("normalizes a completed sale", () => {
      const event = lightspeedAdapter.normalizeEvent!({
        Sale: {
          saleID: "SALE-100",
          completed: "true",
          total: "25.50",
          timeStamp: "2025-01-15T10:30:00Z",
          SaleLines: [
            {
              itemID: "ITEM-1",
              Item: { description: "Espresso" },
              unitQuantity: "2",
              unitPrice: "3.50",
            },
            {
              itemID: "ITEM-2",
              Item: { description: "Croissant" },
              unitQuantity: "1",
              unitPrice: "4.00",
            },
          ],
        },
      });

      expect(event).toEqual({
        external_event_id: "SALE-100",
        event_type: "sale",
        items: [
          {
            pos_item_id: "ITEM-1",
            pos_item_name: "Espresso",
            quantity: 2,
            unit_price: 3.5,
          },
          {
            pos_item_id: "ITEM-2",
            pos_item_name: "Croissant",
            quantity: 1,
            unit_price: 4,
          },
        ],
        total_amount: 25.5,
        currency: "GBP",
        occurred_at: "2025-01-15T10:30:00Z",
      });
    });

    it("normalizes a voided sale", () => {
      const event = lightspeedAdapter.normalizeEvent!({
        Sale: {
          saleID: "SALE-101",
          completed: "false",
          total: "10.00",
          timeStamp: "2025-01-15T11:00:00Z",
          SaleLines: [],
        },
      });

      expect(event!.event_type).toBe("void");
    });

    it("returns null when Sale key is missing", () => {
      const event = lightspeedAdapter.normalizeEvent!({ Other: {} });

      expect(event).toBeNull();
    });

    it("returns event with empty items when SaleLines is missing", () => {
      const event = lightspeedAdapter.normalizeEvent!({
        Sale: {
          saleID: "SALE-102",
          completed: "true",
          total: "0",
          timeStamp: "2025-01-15T12:00:00Z",
        },
      });

      expect(event).not.toBeNull();
      expect(event!.items).toEqual([]);
    });
  });

  describe("fetchMenuItems", () => {
    const credentials = {
      access_token: "test-token",
      account_id: "12345",
    };

    it("maps Lightspeed items to PosMenuItem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Item: [
              {
                itemID: "ITEM-1",
                description: "Espresso",
                Category: { name: "Drinks" },
                Prices: {
                  ItemPrice: [{ amount: "3.50" }],
                },
              },
              {
                itemID: "ITEM-2",
                description: "Croissant",
                Category: { name: "Pastries" },
                Prices: {
                  ItemPrice: [{ amount: "5.00" }],
                },
              },
            ],
          }),
      });

      const items = await lightspeedAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "ITEM-1",
          pos_item_name: "Espresso",
          category: "Drinks",
          price: 3.5,
          currency: "GBP",
        },
        {
          pos_item_id: "ITEM-2",
          pos_item_name: "Croissant",
          category: "Pastries",
          price: 5,
          currency: "GBP",
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.lightspeedapp.com/API/V3/Account/12345/Item.json",
        { headers: { Authorization: "Bearer test-token" } },
      );
    });

    it("returns empty array when response has no items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const items = await lightspeedAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(
        lightspeedAdapter.fetchMenuItems!(credentials),
      ).rejects.toThrow("Lightspeed items fetch failed: 401");
    });

    it("handles items without price or category", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Item: [
              {
                itemID: "ITEM-3",
                description: "Mystery Item",
              },
              {
                itemID: "ITEM-4",
                description: "No Price",
                Category: { name: "Misc" },
                Prices: { ItemPrice: [] },
              },
            ],
          }),
      });

      const items = await lightspeedAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "ITEM-3",
          pos_item_name: "Mystery Item",
          category: undefined,
          price: undefined,
          currency: "GBP",
        },
        {
          pos_item_id: "ITEM-4",
          pos_item_name: "No Price",
          category: "Misc",
          price: undefined,
          currency: "GBP",
        },
      ]);
    });
  });

  describe("validateSignature", () => {
    const secret = "webhook-secret";
    const payload = '{"Sale":{"saleID":"100"}}';

    it("returns true for a valid HMAC-SHA256 hex signature", () => {
      const validSig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(
        lightspeedAdapter.validateSignature!(payload, validSig, secret),
      ).toBe(true);
    });

    it("returns false for an invalid signature", () => {
      const invalidSig = crypto
        .createHmac("sha256", "wrong-secret")
        .update(payload)
        .digest("hex");

      expect(
        lightspeedAdapter.validateSignature!(payload, invalidSig, secret),
      ).toBe(false);
    });
  });
});
