/**
 * RLS Integration Tests: inventory_items
 *
 * Tests Row Level Security policies for multi-tenant isolation of inventory items.
 * Uses REAL database queries with authenticated clients.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  createTestStore,
  createTestInventoryItem,
  createAuthenticatedClient,
  deleteTestUser,
  deleteTestStore,
  hasRlsCredentials,
  type TestUserCredentials,
  type TestStore,
} from "../../utils/rls-test-helpers";

describe.skipIf(!hasRlsCredentials)("RLS: inventory_items", () => {
  let storeA: TestStore;
  let storeB: TestStore;
  let ownerA: TestUserCredentials;
  let ownerB: TestUserCredentials;
  let staffA: TestUserCredentials;
  let platformAdmin: TestUserCredentials;
  let itemA1: { id: string; name: string };
  let itemA2: { id: string; name: string };
  let itemB1: { id: string; name: string };

  beforeAll(async () => {
    // Create two separate stores
    storeA = await createTestStore({ name: "Test Store A - RLS" });
    storeB = await createTestStore({ name: "Test Store B - RLS" });

    // Create users with different roles at different stores
    ownerA = await createTestUser({
      email: "owner-a-rls@test.com",
      password: "TestPass123!",
      role: "Owner",
      storeId: storeA.id,
    });

    ownerB = await createTestUser({
      email: "owner-b-rls@test.com",
      password: "TestPass123!",
      role: "Owner",
      storeId: storeB.id,
    });

    staffA = await createTestUser({
      email: "staff-a-rls@test.com",
      password: "TestPass123!",
      role: "Staff",
      storeId: storeA.id,
    });

    platformAdmin = await createTestUser({
      email: "admin-rls@test.com",
      password: "TestPass123!",
      role: "Owner",
      isPlatformAdmin: true,
    });

    // Create inventory items for each store
    itemA1 = await createTestInventoryItem({
      storeId: storeA.id,
      name: "Store A Item 1",
      category: "Vegetables",
    });

    itemA2 = await createTestInventoryItem({
      storeId: storeA.id,
      name: "Store A Item 2",
      category: "Meat",
    });

    itemB1 = await createTestInventoryItem({
      storeId: storeB.id,
      name: "Store B Item 1",
      category: "Vegetables",
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await deleteTestUser(ownerA.id);
    await deleteTestUser(ownerB.id);
    await deleteTestUser(staffA.id);
    await deleteTestUser(platformAdmin.id);
    await deleteTestStore(storeA.id);
    await deleteTestStore(storeB.id);
  }, 30000);

  describe("Store Isolation", () => {
    it("should allow Owner A to see only Store A items", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .select("id, name, store_id")
        .eq("is_active", true);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(2);

      // Should only see Store A items
      const itemIds = data.map((item: { id: string }) => item.id).sort();
      expect(itemIds).toEqual([itemA1.id, itemA2.id].sort());

      // All items should belong to Store A
      data.forEach((item: { store_id: string }) => {
        expect(item.store_id).toBe(storeA.id);
      });
    });

    it("should allow Owner B to see only Store B items", async () => {
      const client = await createAuthenticatedClient(ownerB);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .select("id, name, store_id")
        .eq("is_active", true);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(1);

      // Should only see Store B item
      expect(data[0].id).toBe(itemB1.id);
      expect(data[0].store_id).toBe(storeB.id);
    });

    it("should prevent Owner A from querying Store B items directly", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data } = await clientAny
        .from("inventory_items")
        .select("id, name")
        .eq("id", itemB1.id)
        .single();

      // RLS should prevent this - either error or no data
      expect(data).toBeNull();
    });

    it("should prevent Owner A from accessing Store B via store_id filter", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .select("id, name, store_id")
        .eq("store_id", storeB.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(0); // Should return empty array, not Store B's data
    });
  });

  describe("Role-Based Access", () => {
    it("should allow Staff to view items from their store", async () => {
      const client = await createAuthenticatedClient(staffA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .select("id, name, store_id")
        .eq("is_active", true);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(2);

      // Staff should see same items as Owner A (both at Store A)
      const itemIds = data.map((item: { id: string }) => item.id).sort();
      expect(itemIds).toEqual([itemA1.id, itemA2.id].sort());
    });

    it("should prevent Staff from inserting items (Owner/Manager only)", async () => {
      const client = await createAuthenticatedClient(staffA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .insert({
          store_id: storeA.id,
          name: "Unauthorized Item",
          category: "Test",
          unit_of_measure: "kg",
        })
        .select();

      // Should fail - Staff cannot insert
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("should prevent Staff from updating items", async () => {
      const client = await createAuthenticatedClient(staffA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data } = await clientAny
        .from("inventory_items")
        .update({ name: "Hacked Name" })
        .eq("id", itemA1.id)
        .select();

      // RLS blocks by returning no rows (not an error)
      expect(data).toBeDefined();
      expect(data.length).toBe(0);
    });

    it("should prevent Staff from deleting items", async () => {
      const client = await createAuthenticatedClient(staffA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data } = await clientAny
        .from("inventory_items")
        .delete()
        .eq("id", itemA1.id)
        .select();

      // RLS blocks by returning no rows (not an error)
      expect(data).toBeDefined();
      expect(data.length).toBe(0);
    });

    it("should allow Owner to insert items into their store", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .insert({
          store_id: storeA.id,
          name: "Owner Inserted Item",
          category: "Test",
          unit_of_measure: "kg",
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.store_id).toBe(storeA.id);

      // Clean up
      await clientAny.from("inventory_items").delete().eq("id", data.id);
    });

    it("should allow Owner to update items in their store", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .update({ category: "Updated Category" })
        .eq("id", itemA1.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.category).toBe("Updated Category");

      // Restore original value
      await clientAny
        .from("inventory_items")
        .update({ category: "Vegetables" })
        .eq("id", itemA1.id);
    });
  });

  describe("Platform Admin Access", () => {
    it("should allow platform admin to see ALL items across stores", async () => {
      const client = await createAuthenticatedClient(platformAdmin);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      const { data, error } = await clientAny
        .from("inventory_items")
        .select("id, name, store_id")
        .eq("is_active", true)
        .in("id", [itemA1.id, itemA2.id, itemB1.id]);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(3);

      // Should see items from both stores
      const storeIds = [
        ...new Set(data.map((item: { store_id: string }) => item.store_id)),
      ];
      expect(storeIds).toContain(storeA.id);
      expect(storeIds).toContain(storeB.id);
    });

    it("should allow platform admin to modify items in any store", async () => {
      const client = await createAuthenticatedClient(platformAdmin);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      // Update item in Store B (which platform admin is not a member of)
      const { data, error } = await clientAny
        .from("inventory_items")
        .update({ category: "Admin Updated" })
        .eq("id", itemB1.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.category).toBe("Admin Updated");

      // Restore
      await clientAny
        .from("inventory_items")
        .update({ category: "Vegetables" })
        .eq("id", itemB1.id);
    });
  });

  describe("Data Integrity", () => {
    it("should enforce unique constraint on (store_id, name) within same store", async () => {
      const client = await createAuthenticatedClient(ownerA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      // Try to create duplicate item name in Store A
      const { error } = await clientAny.from("inventory_items").insert({
        store_id: storeA.id,
        name: "Store A Item 1", // Duplicate name
        category: "Test",
        unit_of_measure: "kg",
      });

      // Should fail due to unique constraint
      expect(error).not.toBeNull();
      expect(error.code).toBe("23505"); // Unique violation
    });

    it("should allow same item name in different stores", async () => {
      const client = await createAuthenticatedClient(ownerB);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = client as any;

      // Create item with same name as Store A's item, but in Store B
      const { data, error } = await clientAny
        .from("inventory_items")
        .insert({
          store_id: storeB.id,
          name: "Store A Item 1", // Same name as itemA1, but different store
          category: "Test",
          unit_of_measure: "kg",
        })
        .select()
        .single();

      // Should succeed - different stores can have same item names
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.name).toBe("Store A Item 1");
      expect(data.store_id).toBe(storeB.id);

      // Clean up
      await clientAny.from("inventory_items").delete().eq("id", data.id);
    });
  });
});
