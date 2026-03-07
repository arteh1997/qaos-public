import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { revelAdapter } from "@/lib/services/pos/adapters/revel";

const credentials = {
  api_key: "test-key",
  api_secret: "test-secret",
  domain: "mystore.revelsystems.com",
};

describe("revelAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateConnection", () => {
    it("returns true when API responds ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await revelAdapter.validateConnection!(credentials);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mystore.revelsystems.com/resources/Establishment/?format=json&limit=1",
        {
          headers: {
            "API-AUTHENTICATION": "test-key:test-secret",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns false when API responds with error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await revelAdapter.validateConnection!(credentials);

      expect(result).toBe(false);
    });

    it("returns false when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await revelAdapter.validateConnection!(credentials);

      expect(result).toBe(false);
    });

    it("uses default domain when not provided", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await revelAdapter.validateConnection!({ api_key: "k", api_secret: "s" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.revelsystems.com/resources/Establishment/?format=json&limit=1",
        expect.objectContaining({}),
      );
    });
  });

  describe("syncSales", () => {
    it("fetches and maps orders to PosSaleEvent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                id: 1001,
                is_refund: false,
                final_total: 25.5,
                created_date: "2026-03-07T12:00:00Z",
                items: [
                  {
                    product_id: "P1",
                    product_name: "Burger",
                    quantity: 2,
                    price: 10.0,
                  },
                  {
                    id: "I2",
                    name: "Fries",
                    quantity: 1,
                    price: 5.5,
                  },
                ],
              },
            ],
          }),
      });

      const events = await revelAdapter.syncSales!(credentials);

      expect(events).toEqual([
        {
          external_event_id: "1001",
          event_type: "sale",
          total_amount: 25.5,
          currency: "USD",
          occurred_at: "2026-03-07T12:00:00Z",
          items: [
            {
              pos_item_id: "P1",
              pos_item_name: "Burger",
              quantity: 2,
              unit_price: 10.0,
            },
            {
              pos_item_id: "I2",
              pos_item_name: "Fries",
              quantity: 1,
              unit_price: 5.5,
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
            objects: [
              {
                id: 1002,
                is_refund: true,
                final_total: 15.0,
                created_date: "2026-03-07T13:00:00Z",
                items: [],
              },
            ],
          }),
      });

      const events = await revelAdapter.syncSales!(credentials);

      expect(events[0].event_type).toBe("refund");
    });

    it("passes since parameter as created_date__gte filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });

      await revelAdapter.syncSales!(credentials, "2026-03-01T00:00:00Z");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("created_date__gte=2026-03-01T00%3A00%3A00Z");
    });

    it("returns empty array when no orders", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });

      const events = await revelAdapter.syncSales!(credentials);

      expect(events).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(revelAdapter.syncSales!(credentials)).rejects.toThrow(
        "Revel orders fetch failed: 403",
      );
    });
  });

  describe("fetchMenuItems", () => {
    it("maps products to PosMenuItem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                id: 101,
                name: "Margherita Pizza",
                category_name: "Pizzas",
                price: 12.99,
              },
              {
                id: 102,
                name: "Caesar Salad",
                category_name: "Salads",
                price: 8.5,
              },
            ],
          }),
      });

      const items = await revelAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "101",
          pos_item_name: "Margherita Pizza",
          category: "Pizzas",
          price: 12.99,
          currency: "USD",
        },
        {
          pos_item_id: "102",
          pos_item_name: "Caesar Salad",
          category: "Salads",
          price: 8.5,
          currency: "USD",
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://mystore.revelsystems.com/resources/Product/?format=json&limit=500",
        {
          headers: {
            "API-AUTHENTICATION": "test-key:test-secret",
            Accept: "application/json",
          },
        },
      );
    });

    it("returns empty array when no products", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects: [] }),
      });

      const items = await revelAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(revelAdapter.fetchMenuItems!(credentials)).rejects.toThrow(
        "Revel products fetch failed: 500",
      );
    });

    it("handles products without category or price", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [{ id: 103, name: "Special Item" }],
          }),
      });

      const items = await revelAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "103",
          pos_item_name: "Special Item",
          category: undefined,
          price: undefined,
          currency: "USD",
        },
      ]);
    });
  });

  describe("normalizeEvent", () => {
    it("normalizes a sale event", () => {
      const event = revelAdapter.normalizeEvent({
        order_id: "ORD-1",
        is_refund: false,
        final_total: 30.0,
        created_date: "2026-03-07T10:00:00Z",
        items: [
          { product_id: "P1", product_name: "Latte", quantity: 2, price: 5.0 },
        ],
      });

      expect(event).toEqual({
        external_event_id: "ORD-1",
        event_type: "sale",
        total_amount: 30.0,
        currency: "USD",
        occurred_at: "2026-03-07T10:00:00Z",
        items: [
          {
            pos_item_id: "P1",
            pos_item_name: "Latte",
            quantity: 2,
            unit_price: 5.0,
          },
        ],
      });
    });

    it("normalizes a refund event", () => {
      const event = revelAdapter.normalizeEvent({
        id: "REF-1",
        is_refund: true,
        items: [],
      });

      expect(event?.event_type).toBe("refund");
      expect(event?.external_event_id).toBe("REF-1");
    });

    it("returns null when no order ID", () => {
      const event = revelAdapter.normalizeEvent({ items: [] });

      expect(event).toBeNull();
    });

    it("uses order_items as fallback for items", () => {
      const event = revelAdapter.normalizeEvent({
        order_id: "ORD-2",
        order_items: [{ id: "I1", name: "Soup", quantity: 1 }],
      });

      expect(event?.items).toHaveLength(1);
      expect(event?.items[0].pos_item_name).toBe("Soup");
    });
  });
});
