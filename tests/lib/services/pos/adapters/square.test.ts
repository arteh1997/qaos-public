import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock fetch before importing the adapter
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { squareAdapter } from "@/lib/services/pos/adapters/square";

describe("squareAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchMenuItems", () => {
    const credentials = { access_token: "test-token" };

    it("maps catalog items to PosMenuItem", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                id: "ITEM-1",
                item_data: {
                  name: "Espresso",
                  category: { name: "Drinks" },
                  variations: [
                    {
                      item_variation_data: {
                        price_money: { amount: 350, currency: "USD" },
                      },
                    },
                  ],
                },
              },
              {
                id: "ITEM-2",
                item_data: {
                  name: "Croissant",
                  category: { name: "Pastries" },
                  variations: [
                    {
                      item_variation_data: {
                        price_money: { amount: 500, currency: "GBP" },
                      },
                    },
                  ],
                },
              },
            ],
          }),
      });

      const items = await squareAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([
        {
          pos_item_id: "ITEM-1",
          pos_item_name: "Espresso",
          category: "Drinks",
          price: 3.5,
          currency: "USD",
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
        "https://connect.squareup.com/v2/catalog/list?types=ITEM",
        { headers: { Authorization: "Bearer test-token" } },
      );
    });

    it("returns empty array when catalog has no objects", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const items = await squareAdapter.fetchMenuItems!(credentials);

      expect(items).toEqual([]);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(squareAdapter.fetchMenuItems!(credentials)).rejects.toThrow(
        "Square catalog fetch failed: 401",
      );
    });

    it("handles items without price or category", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            objects: [
              {
                id: "ITEM-3",
                item_data: {
                  name: "Mystery Item",
                  variations: [],
                },
              },
              {
                id: "ITEM-4",
                item_data: {
                  name: "No Variations",
                },
              },
            ],
          }),
      });

      const items = await squareAdapter.fetchMenuItems!(credentials);

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
          pos_item_name: "No Variations",
          category: undefined,
          price: undefined,
          currency: "GBP",
        },
      ]);
    });
  });
});
