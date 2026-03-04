import { describe, it, expect } from "vitest";
import {
  hasGlobalAccess,
  isStoreScopedRole,
  canManageStores,
  canViewAllStores,
  canManageUsers,
  canManageInventoryItems,
  canDoStockCount,
  canDoStockReception,
  canManageShifts,
  canViewReports,
  canAccessStore,
  canAccessStoreLegacy,
  getDefaultStoreId,
  normalizeRole,
  isMultiStoreRole,
  isSingleStoreRole,
} from "@/lib/auth";
import { AppRole, StoreUserWithStore } from "@/types";

// Helper to create a mock StoreUserWithStore
function createStoreMembership(
  storeId: string,
  role: AppRole,
  isBillingOwner = false,
): StoreUserWithStore {
  return {
    id: `membership-${storeId}`,
    store_id: storeId,
    user_id: "user-123",
    role,
    is_billing_owner: isBillingOwner,
    hourly_rate: null,
    invited_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    store: {
      id: storeId,
      name: `Store ${storeId}`,
      address: "123 Test St",
      country: "GB",
      currency: "GBP",
      is_active: true,
      opening_time: null,
      closing_time: null,
      weekly_hours: null,
      billing_user_id: null,
      subscription_status: "active",
      setup_completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

describe("Auth Helpers", () => {
  // New role system: Owner, Manager, Staff
  const roles: (AppRole | null | undefined)[] = [
    "Owner",
    "Manager",
    "Staff",
    null,
    undefined,
  ];

  describe("normalizeRole", () => {
    it("should map Admin to Owner", () => {
      expect(normalizeRole("Admin")).toBe("Owner");
    });

    it("should pass through new roles unchanged", () => {
      expect(normalizeRole("Owner")).toBe("Owner");
      expect(normalizeRole("Manager")).toBe("Manager");
      expect(normalizeRole("Staff")).toBe("Staff");
    });

    it("should map Driver to Staff (legacy)", () => {
      expect(normalizeRole("Driver")).toBe("Staff");
    });

    it("should return null for null/undefined", () => {
      expect(normalizeRole(null)).toBe(null);
      expect(normalizeRole(undefined)).toBe(null);
    });
  });

  describe("hasGlobalAccess (legacy)", () => {
    it("should return true for Owner", () => {
      expect(hasGlobalAccess("Owner")).toBe(true);
    });

    it("should return true for Admin (legacy)", () => {
      expect(hasGlobalAccess("Admin")).toBe(true);
    });

    it("should return false for Driver", () => {
      expect(hasGlobalAccess("Driver")).toBe(false);
    });

    it("should return false for Staff", () => {
      expect(hasGlobalAccess("Staff")).toBe(false);
    });

    it("should return false for Manager", () => {
      expect(hasGlobalAccess("Manager")).toBe(false);
    });

    it("should return false for null", () => {
      expect(hasGlobalAccess(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(hasGlobalAccess(undefined)).toBe(false);
    });
  });

  describe("isStoreScopedRole (legacy)", () => {
    it("should return false for Owner", () => {
      expect(isStoreScopedRole("Owner")).toBe(false);
    });

    it("should return false for Driver (legacy, not a current role)", () => {
      expect(isStoreScopedRole("Driver")).toBe(false);
    });

    it("should return true for Staff", () => {
      expect(isStoreScopedRole("Staff")).toBe(true);
    });

    it("should return true for Manager", () => {
      expect(isStoreScopedRole("Manager")).toBe(true);
    });

    it("should return false for null", () => {
      expect(isStoreScopedRole(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isStoreScopedRole(undefined)).toBe(false);
    });
  });

  describe("isMultiStoreRole", () => {
    it("should return true for Owner", () => {
      expect(isMultiStoreRole("Owner")).toBe(true);
    });

    it("should return false for Driver (no longer a multi-store role)", () => {
      expect(isMultiStoreRole("Driver" as AppRole)).toBe(false);
    });

    it("should return false for Manager", () => {
      expect(isMultiStoreRole("Manager")).toBe(false);
    });

    it("should return false for Staff", () => {
      expect(isMultiStoreRole("Staff")).toBe(false);
    });
  });

  describe("isSingleStoreRole", () => {
    it("should return true for Manager", () => {
      expect(isSingleStoreRole("Manager")).toBe(true);
    });

    it("should return true for Staff", () => {
      expect(isSingleStoreRole("Staff")).toBe(true);
    });

    it("should return false for Owner", () => {
      expect(isSingleStoreRole("Owner")).toBe(false);
    });

    it("should return false for Driver", () => {
      expect(isSingleStoreRole("Driver" as AppRole)).toBe(false);
    });
  });

  describe("canManageStores (legacy)", () => {
    it("should return true only for Owner and Admin", () => {
      expect(canManageStores("Owner")).toBe(true);
      expect(canManageStores("Admin")).toBe(true);
      expect(canManageStores("Manager")).toBe(false);
      expect(canManageStores("Driver")).toBe(false);
      expect(canManageStores("Staff")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(canManageStores(null)).toBe(false);
      expect(canManageStores(undefined)).toBe(false);
    });
  });

  describe("canViewAllStores (legacy)", () => {
    it("should return true for Owner", () => {
      expect(canViewAllStores("Owner")).toBe(true);
    });

    it("should return false for Manager, Staff, and Driver", () => {
      expect(canViewAllStores("Manager")).toBe(false);
      expect(canViewAllStores("Staff")).toBe(false);
      expect(canViewAllStores("Driver")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(canViewAllStores(null)).toBe(false);
      expect(canViewAllStores(undefined)).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("should return true for Owner and Manager", () => {
      expect(canManageUsers("Owner")).toBe(true);
      expect(canManageUsers("Manager")).toBe(true);
    });

    it("should return false for Staff", () => {
      expect(canManageUsers("Staff")).toBe(false);
    });
  });

  describe("canManageInventoryItems", () => {
    it("should return true for Owner and Manager", () => {
      expect(canManageInventoryItems("Owner")).toBe(true);
      expect(canManageInventoryItems("Manager")).toBe(true);
    });

    it("should return false for Staff", () => {
      expect(canManageInventoryItems("Staff")).toBe(false);
    });
  });

  describe("canDoStockCount", () => {
    it("should return true for Owner, Manager, and Staff", () => {
      expect(canDoStockCount("Owner")).toBe(true);
      expect(canDoStockCount("Manager")).toBe(true);
      expect(canDoStockCount("Staff")).toBe(true);
    });
  });

  describe("canDoStockReception", () => {
    it("should return true for Owner, Manager, and Staff", () => {
      expect(canDoStockReception("Owner")).toBe(true);
      expect(canDoStockReception("Manager")).toBe(true);
      expect(canDoStockReception("Staff")).toBe(true);
    });
  });

  describe("canManageShifts", () => {
    it("should return true for Owner and Manager", () => {
      expect(canManageShifts("Owner")).toBe(true);
      expect(canManageShifts("Manager")).toBe(true);
    });

    it("should return false for Staff", () => {
      expect(canManageShifts("Staff")).toBe(false);
    });
  });

  describe("canViewReports", () => {
    it("should return true for Owner, Manager, and Staff", () => {
      expect(canViewReports("Owner")).toBe(true);
      expect(canViewReports("Manager")).toBe(true);
      expect(canViewReports("Staff")).toBe(true);
    });
  });

  describe("canAccessStore (new multi-tenant)", () => {
    const targetStoreId = "store-123";
    const otherStoreId = "store-456";

    it("should allow access when user has membership at target store", () => {
      const stores = [createStoreMembership(targetStoreId, "Staff")];
      expect(canAccessStore(stores, targetStoreId)).toBe(true);
    });

    it("should allow access for any role with membership", () => {
      const roles: AppRole[] = ["Owner", "Manager", "Staff"];
      roles.forEach((role) => {
        const stores = [createStoreMembership(targetStoreId, role)];
        expect(canAccessStore(stores, targetStoreId)).toBe(true);
      });
    });

    it("should deny access when user has no membership at target store", () => {
      const stores = [createStoreMembership(otherStoreId, "Owner")];
      expect(canAccessStore(stores, targetStoreId)).toBe(false);
    });

    it("should deny access when user has no store memberships", () => {
      const stores: StoreUserWithStore[] = [];
      expect(canAccessStore(stores, targetStoreId)).toBe(false);
    });

    it("should allow access to multiple stores with multiple memberships", () => {
      const stores = [
        createStoreMembership(targetStoreId, "Manager"),
        createStoreMembership(otherStoreId, "Owner"),
      ];
      expect(canAccessStore(stores, targetStoreId)).toBe(true);
      expect(canAccessStore(stores, otherStoreId)).toBe(true);
    });
  });

  describe("canAccessStoreLegacy", () => {
    const targetStoreId = "store-123";
    const otherStoreId = "store-456";

    describe("Global Access Roles (Owner)", () => {
      it("should allow Owner to access any store", () => {
        expect(canAccessStoreLegacy("Owner", null, targetStoreId)).toBe(true);
        expect(canAccessStoreLegacy("Owner", otherStoreId, targetStoreId)).toBe(
          true,
        );
      });

      it("should deny Driver access (no longer global after merge)", () => {
        expect(canAccessStoreLegacy("Driver", null, targetStoreId)).toBe(false);
        expect(
          canAccessStoreLegacy("Driver", otherStoreId, targetStoreId),
        ).toBe(false);
      });
    });

    describe("Store Scoped Roles (Staff, Manager)", () => {
      it("should allow Staff to access their assigned store", () => {
        expect(
          canAccessStoreLegacy("Staff", targetStoreId, targetStoreId),
        ).toBe(true);
      });

      it("should deny Staff access to other stores", () => {
        expect(canAccessStoreLegacy("Staff", otherStoreId, targetStoreId)).toBe(
          false,
        );
      });

      it("should deny Staff access when they have no store assigned", () => {
        expect(canAccessStoreLegacy("Staff", null, targetStoreId)).toBe(false);
        expect(canAccessStoreLegacy("Staff", undefined, targetStoreId)).toBe(
          false,
        );
      });

      it("should allow Manager to access their assigned store", () => {
        expect(
          canAccessStoreLegacy("Manager", targetStoreId, targetStoreId),
        ).toBe(true);
      });

      it("should deny Manager access to other stores", () => {
        expect(
          canAccessStoreLegacy("Manager", otherStoreId, targetStoreId),
        ).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should deny access for null role", () => {
        expect(canAccessStoreLegacy(null, targetStoreId, targetStoreId)).toBe(
          false,
        );
      });

      it("should deny access for undefined role", () => {
        expect(
          canAccessStoreLegacy(undefined, targetStoreId, targetStoreId),
        ).toBe(false);
      });
    });
  });

  describe("getDefaultStoreId (legacy)", () => {
    const storeId = "store-123";

    describe("Store Scoped Roles", () => {
      it("should return assigned store for Staff", () => {
        expect(getDefaultStoreId("Staff", storeId)).toBe(storeId);
      });

      it("should return assigned store for Manager", () => {
        expect(getDefaultStoreId("Manager", storeId)).toBe(storeId);
      });

      it("should return null for Staff with no assigned store", () => {
        expect(getDefaultStoreId("Staff", null)).toBe(null);
        expect(getDefaultStoreId("Staff", undefined)).toBe(null);
      });
    });

    describe("Global Access Roles", () => {
      it("should return null for Owner regardless of store assignment", () => {
        expect(getDefaultStoreId("Owner", storeId)).toBe(null);
        expect(getDefaultStoreId("Owner", null)).toBe(null);
      });

      it("should return null for Driver (legacy role)", () => {
        expect(getDefaultStoreId("Driver", storeId)).toBe(null);
        expect(getDefaultStoreId("Driver", null)).toBe(null);
      });
    });

    describe("Edge Cases", () => {
      it("should return null for null role", () => {
        expect(getDefaultStoreId(null, storeId)).toBe(null);
      });

      it("should return null for undefined role", () => {
        expect(getDefaultStoreId(undefined, storeId)).toBe(null);
      });
    });
  });

  describe("Role Consistency Tests", () => {
    it("should ensure global access and store scoped are mutually exclusive", () => {
      roles.forEach((role) => {
        if (role) {
          const hasGlobal = hasGlobalAccess(role);
          const isScoped = isStoreScopedRole(role);
          // A role cannot be both global and scoped
          expect(hasGlobal && isScoped).toBe(false);
        }
      });
    });

    it("should ensure stock count and reception have appropriate role overlap", () => {
      // Staff can do both count and reception
      expect(canDoStockCount("Staff")).toBe(true);
      expect(canDoStockReception("Staff")).toBe(true);

      // Owner can do both
      expect(canDoStockReception("Owner")).toBe(true);
      expect(canDoStockCount("Owner")).toBe(true);

      // Manager can do both
      expect(canDoStockReception("Manager")).toBe(true);
      expect(canDoStockCount("Manager")).toBe(true);
    });
  });
});
