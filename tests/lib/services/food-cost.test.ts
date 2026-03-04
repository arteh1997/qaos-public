import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { generateFoodCostReport } from "@/lib/services/food-cost";

// Create a mock Supabase client that returns data based on table/query
function createMockSupabase(data: Record<string, unknown[]>) {
  const createChain = (table: string) => {
    const filteredData = [...(data[table] || [])];

    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: filteredData, error: null }),
    };

    // Make it thenable for await
    Object.defineProperty(chain, "then", {
      value: (resolve: (v: unknown) => void) => {
        resolve({ data: filteredData, error: null });
        return Promise.resolve({ data: filteredData, error: null });
      },
    });

    return chain;
  };

  return {
    from: vi.fn((table: string) => createChain(table)),
  };
}

describe("generateFoodCostReport", () => {
  const storeId = "store-1";
  const startDate = "2026-02-01";
  const endDate = "2026-02-07";

  it("should return empty report when no menu items exist", async () => {
    const supabase = createMockSupabase({
      menu_items: [],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [],
      store_inventory: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    expect(report.summary.theoretical_cost).toBe(0);
    expect(report.summary.actual_cost).toBe(0);
    expect(report.summary.variance).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(report.categories).toHaveLength(0);
  });

  it("should calculate theoretical cost from recipe ingredients", async () => {
    const supabase = createMockSupabase({
      menu_items: [
        {
          id: "mi-1",
          name: "Chicken Burger",
          category: "Burgers",
          selling_price: 12.99,
          recipe_id: "r-1",
          recipe: {
            id: "r-1",
            name: "Chicken Burger Recipe",
            yield_quantity: 1,
          },
        },
      ],
      recipe_ingredients: [
        { inventory_item_id: "inv-1", quantity: 200, unit_of_measure: "g" },
        { inventory_item_id: "inv-2", quantity: 1, unit_of_measure: "each" },
      ],
      store_inventory: [
        { inventory_item_id: "inv-1", unit_cost: 0.008 }, // £0.008/g = £8/kg
        { inventory_item_id: "inv-2", unit_cost: 0.5 }, // £0.50/bun
      ],
      inventory_items: [
        { id: "inv-1", unit_of_measure: "g" },
        { id: "inv-2", unit_of_measure: "each" },
      ],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    // Theoretical cost per unit: 200g × £0.008 + 1 × £0.50 = £1.60 + £0.50 = £2.10
    const item = report.items[0];
    expect(item).toBeDefined();
    expect(item.name).toBe("Chicken Burger");
    expect(item.theoretical_cost_per_unit).toBe(2.1);
    expect(item.units_sold).toBe(0); // No POS data
    expect(item.theoretical_cost_total).toBe(0); // 0 sold × £2.10 = £0
  });

  it("should return correct summary structure", async () => {
    const supabase = createMockSupabase({
      menu_items: [],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    expect(report).toHaveProperty("summary");
    expect(report).toHaveProperty("items");
    expect(report).toHaveProperty("categories");
    expect(report).toHaveProperty("trends");

    expect(report.summary).toHaveProperty("theoretical_cost");
    expect(report.summary).toHaveProperty("actual_cost");
    expect(report.summary).toHaveProperty("variance");
    expect(report.summary).toHaveProperty("variance_percentage");
    expect(report.summary).toHaveProperty("total_revenue");
    expect(report.summary).toHaveProperty("waste_cost");
    expect(report.summary).toHaveProperty("unaccounted_variance");
    expect(report.summary.period_start).toBe(startDate);
    expect(report.summary.period_end).toBe(endDate);
  });

  it("should calculate waste cost from waste log", async () => {
    const supabase = createMockSupabase({
      menu_items: [],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [
        { inventory_item_id: "inv-1", estimated_cost: 15.5 },
        { inventory_item_id: "inv-2", estimated_cost: 8.25 },
      ],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    expect(report.summary.waste_cost).toBe(23.75);
  });

  it("should build category breakdown from menu items", async () => {
    const supabase = createMockSupabase({
      menu_items: [
        {
          id: "mi-1",
          name: "Chicken Burger",
          category: "Burgers",
          selling_price: 12.99,
          recipe_id: "r-1",
          recipe: { id: "r-1", name: "Recipe 1", yield_quantity: 1 },
        },
        {
          id: "mi-2",
          name: "Beef Burger",
          category: "Burgers",
          selling_price: 14.99,
          recipe_id: "r-2",
          recipe: { id: "r-2", name: "Recipe 2", yield_quantity: 1 },
        },
        {
          id: "mi-3",
          name: "Caesar Salad",
          category: "Salads",
          selling_price: 9.99,
          recipe_id: "r-3",
          recipe: { id: "r-3", name: "Recipe 3", yield_quantity: 1 },
        },
      ],
      recipe_ingredients: [],
      store_inventory: [],
      inventory_items: [],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    expect(report.categories).toHaveLength(2);
    const burgers = report.categories.find((c) => c.category === "Burgers");
    const salads = report.categories.find((c) => c.category === "Salads");
    expect(burgers?.item_count).toBe(2);
    expect(salads?.item_count).toBe(1);
  });

  it("should handle menu items without recipes", async () => {
    const supabase = createMockSupabase({
      menu_items: [
        {
          id: "mi-1",
          name: "Side Sauce",
          category: "Extras",
          selling_price: 0.99,
          recipe_id: null,
          recipe: null,
        },
      ],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [],
      waste_log: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    // Items without recipes should be excluded
    expect(report.items).toHaveLength(0);
  });

  it("should calculate actual COGS from stock history Sale events", async () => {
    const supabase = createMockSupabase({
      menu_items: [],
      pos_item_mappings: [],
      pos_sale_events: [],
      stock_history: [
        {
          action_type: "Sale",
          quantity_change: -10,
          inventory_item_id: "inv-1",
          created_at: "2026-02-03T12:00:00.000Z",
        },
        {
          action_type: "Reception",
          quantity_change: 50,
          inventory_item_id: "inv-1",
          created_at: "2026-02-02T08:00:00.000Z",
        },
        {
          action_type: "Waste",
          quantity_change: -2,
          inventory_item_id: "inv-1",
          created_at: "2026-02-04T15:00:00.000Z",
        },
      ],
      store_inventory: [{ inventory_item_id: "inv-1", unit_cost: 5.0 }],
      waste_log: [],
    });

    const report = await generateFoodCostReport(
      supabase as unknown as SupabaseClient,
      {
        storeId,
        startDate,
        endDate,
      },
    );

    // Sale: 10 × £5 = £50, Waste: 2 × £5 = £10 → Total COGS = £60
    expect(report.summary.actual_cost).toBe(60);
  });
});
