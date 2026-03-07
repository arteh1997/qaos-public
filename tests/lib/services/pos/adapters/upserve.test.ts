import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { upserveAdapter } from "@/lib/services/pos/adapters/upserve";

const credentials = { access_token: "test-token" };

describe("upserveAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("validateConnection", () => {
    it("returns true when API responds ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await upserveAdapter.validateConnection!(credentials);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.upserve.com/v1/restaurant",
        {
          headers: {
            Authorization: "Bearer test-token",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns false when API responds with error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await upserveAdapter.validateConnection!(credentials);

      expect(result).toBe(false);
    });

    it("returns false when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await upserveAdapter.validateConnection!(credentials);

      expect(result).toBe(false);
    });
  });

  describe("syncSales", () => {
    it("fetches and maps orders to PosSaleEvent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: [
              {
                id: "ORD-100",
                isRefund: false,
                total: 4250,
                createdAt: "2026-03-07T14:00:00Z",
                items: [
                  {
                    itemId: "ITEM-1",
                    name: "Steak",
                    quantity: 1,
                    price: 2500,
                  },
                  {
                    id: "ITEM-2",
                    itemName: "Salad",
                    quantity: 2,
                    price: 875,
                  },
                ],
              },
            ],
          }),
      });

      const events = await upserveAdapter.syncSales!(credentials);

      expect(events).toEqual([
        {
          external_event_id: "ORD-100",
          event_type: "sale",
          total_amount: 42.5,
          currency: "USD",
          occurred_at: "2026-03-07T14:00:00Z",
          items: [
            {
              pos_item_id: "ITEM-1",
              pos_item_name: "Steak",
              quantity: 1,
              unit_price: 25.0,
            },
            {
              pos_item_id: "ITEM-2",
              pos_item_name: "Salad",
              quantity: 2,
              unit_price: 8.75,
            },
          ],
        },
      ]);
    });

    it("maps refund orders correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            orders: [
              {
                id: "ORD-101",
                type: "refund",
                total: 1500,
                createdAt: "2026-03-07T15:00:00Z",
                items: [],
              },
            ],
          }),
      });

      const events = await upserveAdapter.syncSales!(credentials);

      expect(events[0].event_type).toBe("refund");
    });

    it("passes since parameter as created_after filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ orders: [] }),
      });

      await upserveAdapter.syncSales!(credentials, "2026-03-01T00:00:00Z");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("created_after=2026-03-01T00%3A00%3A00Z");
    });

    it("returns empty array when no orders", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ orders: [] }),
      });

      const events = await upserveAdapter.syncSales!(credentials);

      expect(events).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(upserveAdapter.syncSales!(credentials)).rejects.toThrow(
        "Upserve orders fetch failed: 403",
      );
    });
  });

  describe("fetchMenuItems", () => {
    it("maps menu items to PosMenuItem with prices in dollars", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 301,
                name: "Ribeye Steak",
                category: "Entrees",
                price: 3499,
              },
              {
                id: 302,
                name: "Caesar Salad",
                category: "Starters",
                price: 1250,
              },
            ],
          }),
      });

      const items = await upserveAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "301",
          pos_item_name: "Ribeye Steak",
          category: "Entrees",
          price: 34.99,
          currency: "USD",
        },
        {
          pos_item_id: "302",
          pos_item_name: "Caesar Salad",
          category: "Starters",
          price: 12.5,
          currency: "USD",
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.upserve.com/v1/menu/items",
        {
          headers: {
            Authorization: "Bearer test-token",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns empty array when no items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const items = await upserveAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(upserveAdapter.fetchMenuItems!(credentials)).rejects.toThrow(
        "Upserve menu fetch failed: 500",
      );
    });

    it("handles items without category or price", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 303, name: "Daily Special" }],
          }),
      });

      const items = await upserveAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "303",
          pos_item_name: "Daily Special",
          category: undefined,
          price: undefined,
          currency: "USD",
        },
      ]);
    });
  });

  describe("normalizeEvent", () => {
    it("normalizes a sale event", () => {
      const event = upserveAdapter.normalizeEvent({
        orderId: "ORD-50",
        isRefund: false,
        total: 3000,
        createdAt: "2026-03-07T10:00:00Z",
        items: [{ itemId: "I1", name: "Burger", quantity: 2, price: 1500 }],
      });

      expect(event).toEqual({
        external_event_id: "ORD-50",
        event_type: "sale",
        total_amount: 30.0,
        currency: "USD",
        occurred_at: "2026-03-07T10:00:00Z",
        items: [
          {
            pos_item_id: "I1",
            pos_item_name: "Burger",
            quantity: 2,
            unit_price: 15.0,
          },
        ],
      });
    });

    it("normalizes a refund event via type field", () => {
      const event = upserveAdapter.normalizeEvent({
        order_id: "ORD-51",
        type: "refund",
        items: [],
      });

      expect(event?.event_type).toBe("refund");
    });

    it("normalizes a refund event via isRefund flag", () => {
      const event = upserveAdapter.normalizeEvent({
        id: "ORD-52",
        isRefund: true,
        items: [],
      });

      expect(event?.event_type).toBe("refund");
    });

    it("returns null when no order ID", () => {
      const event = upserveAdapter.normalizeEvent({ items: [] });

      expect(event).toBeNull();
    });

    it("uses lineItems as fallback for items", () => {
      const event = upserveAdapter.normalizeEvent({
        orderId: "ORD-53",
        lineItems: [{ id: "LI1", name: "Soup", quantity: 1 }],
      });

      expect(event?.items).toHaveLength(1);
      expect(event?.items[0].pos_item_name).toBe("Soup");
    });

    it("preserves zero quantity for comped items", () => {
      const event = upserveAdapter.normalizeEvent({
        orderId: "ORD-54",
        items: [{ id: "I1", name: "Comped Wine", quantity: 0, price: 0 }],
      });

      expect(event?.items[0].quantity).toBe(0);
    });
  });
});
