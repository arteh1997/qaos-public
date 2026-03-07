import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { touchBistroAdapter } from "@/lib/services/pos/adapters/touchbistro";

const credentials = { api_key: "test-api-key" };

describe("touchBistroAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateConnection", () => {
    it("returns true when API responds ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await touchBistroAdapter.validateConnection!(credentials);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.touchbistro.com/api/v1/restaurant",
        {
          headers: {
            Authorization: "Bearer test-api-key",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns false when API responds with error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await touchBistroAdapter.validateConnection!(credentials);

      expect(result).toBe(false);
    });

    it("returns false when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await touchBistroAdapter.validateConnection!(credentials);

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
                id: 5001,
                is_refund: false,
                total: 42.5,
                currency: "CAD",
                closed_at: "2026-03-07T14:00:00Z",
                order_items: [
                  {
                    menu_item_id: "MI-1",
                    menu_item_name: "Poutine",
                    quantity: 1,
                    price: 15.0,
                  },
                  {
                    id: "I-2",
                    name: "Caesar",
                    quantity: 2,
                    price: 13.75,
                  },
                ],
              },
            ],
          }),
      });

      const events = await touchBistroAdapter.syncSales!(credentials);

      expect(events).toEqual([
        {
          external_event_id: "5001",
          event_type: "sale",
          total_amount: 42.5,
          currency: "CAD",
          occurred_at: "2026-03-07T14:00:00Z",
          items: [
            {
              pos_item_id: "MI-1",
              pos_item_name: "Poutine",
              quantity: 1,
              unit_price: 15.0,
            },
            {
              pos_item_id: "I-2",
              pos_item_name: "Caesar",
              quantity: 2,
              unit_price: 13.75,
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
                id: 5002,
                is_refund: true,
                total: 20.0,
                closed_at: "2026-03-07T15:00:00Z",
                order_items: [],
              },
            ],
          }),
      });

      const events = await touchBistroAdapter.syncSales!(credentials);

      expect(events[0].event_type).toBe("refund");
    });

    it("passes since parameter as closed_after filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ orders: [] }),
      });

      await touchBistroAdapter.syncSales!(credentials, "2026-03-01T00:00:00Z");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("closed_after=2026-03-01T00%3A00%3A00Z");
    });

    it("returns empty array when no orders", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ orders: [] }),
      });

      const events = await touchBistroAdapter.syncSales!(credentials);

      expect(events).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(touchBistroAdapter.syncSales!(credentials)).rejects.toThrow(
        "TouchBistro orders fetch failed: 403",
      );
    });
  });

  describe("fetchMenuItems", () => {
    it("maps menu items to PosMenuItem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            menu_items: [
              {
                id: 201,
                name: "Maple Salmon",
                category_name: "Mains",
                price: 24.99,
              },
              {
                id: 202,
                name: "Poutine",
                category_name: "Sides",
                price: 12.5,
              },
            ],
          }),
      });

      const items = await touchBistroAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "201",
          pos_item_name: "Maple Salmon",
          category: "Mains",
          price: 24.99,
          currency: "CAD",
        },
        {
          pos_item_id: "202",
          pos_item_name: "Poutine",
          category: "Sides",
          price: 12.5,
          currency: "CAD",
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.touchbistro.com/api/v1/menu-items",
        {
          headers: {
            Authorization: "Bearer test-api-key",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns empty array when no menu items", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ menu_items: [] }),
      });

      const items = await touchBistroAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(
        touchBistroAdapter.fetchMenuItems!(credentials),
      ).rejects.toThrow("TouchBistro menu fetch failed: 500");
    });

    it("handles items without category or price", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            menu_items: [{ id: 203, name: "Special" }],
          }),
      });

      const items = await touchBistroAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "203",
          pos_item_name: "Special",
          category: undefined,
          price: undefined,
          currency: "CAD",
        },
      ]);
    });
  });

  describe("normalizeEvent", () => {
    it("normalizes a sale event", () => {
      const event = touchBistroAdapter.normalizeEvent({
        order_id: "ORD-10",
        is_refund: false,
        total: 35.0,
        currency: "CAD",
        closed_at: "2026-03-07T10:00:00Z",
        order_items: [
          {
            menu_item_id: "M1",
            menu_item_name: "Burger",
            quantity: 2,
            price: 17.5,
          },
        ],
      });

      expect(event).toEqual({
        external_event_id: "ORD-10",
        event_type: "sale",
        total_amount: 35.0,
        currency: "CAD",
        occurred_at: "2026-03-07T10:00:00Z",
        items: [
          {
            pos_item_id: "M1",
            pos_item_name: "Burger",
            quantity: 2,
            unit_price: 17.5,
          },
        ],
      });
    });

    it("normalizes a refund event", () => {
      const event = touchBistroAdapter.normalizeEvent({
        bill_id: "BILL-1",
        is_refund: true,
        items: [],
      });

      expect(event?.event_type).toBe("refund");
      expect(event?.external_event_id).toBe("BILL-1");
    });

    it("returns null when no order ID", () => {
      const event = touchBistroAdapter.normalizeEvent({ items: [] });

      expect(event).toBeNull();
    });

    it("uses items as fallback for order_items", () => {
      const event = touchBistroAdapter.normalizeEvent({
        order_id: "ORD-11",
        items: [{ id: "I1", name: "Soup", quantity: 1 }],
      });

      expect(event?.items).toHaveLength(1);
      expect(event?.items[0].pos_item_name).toBe("Soup");
    });
  });
});
