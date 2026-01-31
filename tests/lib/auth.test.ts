import { describe, it, expect } from 'vitest'
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
  getDefaultStoreId,
} from '@/lib/auth'
import { AppRole } from '@/types'

describe('Auth Helpers', () => {
  const roles: (AppRole | null | undefined)[] = ['Admin', 'Driver', 'Staff', null, undefined]

  describe('hasGlobalAccess', () => {
    it('should return true for Admin', () => {
      expect(hasGlobalAccess('Admin')).toBe(true)
    })

    it('should return true for Driver', () => {
      expect(hasGlobalAccess('Driver')).toBe(true)
    })

    it('should return false for Staff', () => {
      expect(hasGlobalAccess('Staff')).toBe(false)
    })

    it('should return false for null', () => {
      expect(hasGlobalAccess(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(hasGlobalAccess(undefined)).toBe(false)
    })
  })

  describe('isStoreScopedRole', () => {
    it('should return false for Admin', () => {
      expect(isStoreScopedRole('Admin')).toBe(false)
    })

    it('should return false for Driver', () => {
      expect(isStoreScopedRole('Driver')).toBe(false)
    })

    it('should return true for Staff', () => {
      expect(isStoreScopedRole('Staff')).toBe(true)
    })

    it('should return false for null', () => {
      expect(isStoreScopedRole(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isStoreScopedRole(undefined)).toBe(false)
    })
  })

  describe('canManageStores', () => {
    it('should return true only for Admin', () => {
      expect(canManageStores('Admin')).toBe(true)
      expect(canManageStores('Driver')).toBe(false)
      expect(canManageStores('Staff')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(canManageStores(null)).toBe(false)
      expect(canManageStores(undefined)).toBe(false)
    })
  })

  describe('canViewAllStores', () => {
    it('should return true for Admin and Driver', () => {
      expect(canViewAllStores('Admin')).toBe(true)
      expect(canViewAllStores('Driver')).toBe(true)
    })

    it('should return false for Staff', () => {
      expect(canViewAllStores('Staff')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(canViewAllStores(null)).toBe(false)
      expect(canViewAllStores(undefined)).toBe(false)
    })
  })

  describe('canManageUsers', () => {
    it('should return true only for Admin', () => {
      expect(canManageUsers('Admin')).toBe(true)
      expect(canManageUsers('Driver')).toBe(false)
      expect(canManageUsers('Staff')).toBe(false)
    })
  })

  describe('canManageInventoryItems', () => {
    it('should return true only for Admin', () => {
      expect(canManageInventoryItems('Admin')).toBe(true)
      expect(canManageInventoryItems('Driver')).toBe(false)
      expect(canManageInventoryItems('Staff')).toBe(false)
    })
  })

  describe('canDoStockCount', () => {
    it('should return true for Admin and Staff', () => {
      expect(canDoStockCount('Admin')).toBe(true)
      expect(canDoStockCount('Staff')).toBe(true)
    })

    it('should return false for Driver', () => {
      expect(canDoStockCount('Driver')).toBe(false)
    })
  })

  describe('canDoStockReception', () => {
    it('should return true for Admin and Driver', () => {
      expect(canDoStockReception('Admin')).toBe(true)
      expect(canDoStockReception('Driver')).toBe(true)
    })

    it('should return false for Staff', () => {
      expect(canDoStockReception('Staff')).toBe(false)
    })
  })

  describe('canManageShifts', () => {
    it('should return true only for Admin', () => {
      expect(canManageShifts('Admin')).toBe(true)
      expect(canManageShifts('Driver')).toBe(false)
      expect(canManageShifts('Staff')).toBe(false)
    })
  })

  describe('canViewReports', () => {
    it('should return true for Admin and Driver', () => {
      expect(canViewReports('Admin')).toBe(true)
      expect(canViewReports('Driver')).toBe(true)
    })

    it('should return false for Staff', () => {
      expect(canViewReports('Staff')).toBe(false)
    })
  })

  describe('canAccessStore', () => {
    const targetStoreId = 'store-123'
    const otherStoreId = 'store-456'

    describe('Global Access Roles (Admin, Driver)', () => {
      it('should allow Admin to access any store', () => {
        expect(canAccessStore('Admin', null, targetStoreId)).toBe(true)
        expect(canAccessStore('Admin', otherStoreId, targetStoreId)).toBe(true)
      })

      it('should allow Driver to access any store', () => {
        expect(canAccessStore('Driver', null, targetStoreId)).toBe(true)
        expect(canAccessStore('Driver', otherStoreId, targetStoreId)).toBe(true)
      })
    })

    describe('Store Scoped Roles (Staff)', () => {
      it('should allow Staff to access their assigned store', () => {
        expect(canAccessStore('Staff', targetStoreId, targetStoreId)).toBe(true)
      })

      it('should deny Staff access to other stores', () => {
        expect(canAccessStore('Staff', otherStoreId, targetStoreId)).toBe(false)
      })

      it('should deny Staff access when they have no store assigned', () => {
        expect(canAccessStore('Staff', null, targetStoreId)).toBe(false)
        expect(canAccessStore('Staff', undefined, targetStoreId)).toBe(false)
      })
    })

    describe('Edge Cases', () => {
      it('should deny access for null role', () => {
        expect(canAccessStore(null, targetStoreId, targetStoreId)).toBe(false)
      })

      it('should deny access for undefined role', () => {
        expect(canAccessStore(undefined, targetStoreId, targetStoreId)).toBe(false)
      })
    })
  })

  describe('getDefaultStoreId', () => {
    const storeId = 'store-123'

    describe('Store Scoped Roles', () => {
      it('should return assigned store for Staff', () => {
        expect(getDefaultStoreId('Staff', storeId)).toBe(storeId)
      })

      it('should return null for Staff with no assigned store', () => {
        expect(getDefaultStoreId('Staff', null)).toBe(null)
        expect(getDefaultStoreId('Staff', undefined)).toBe(null)
      })
    })

    describe('Global Access Roles', () => {
      it('should return null for Admin regardless of store assignment', () => {
        expect(getDefaultStoreId('Admin', storeId)).toBe(null)
        expect(getDefaultStoreId('Admin', null)).toBe(null)
      })

      it('should return null for Driver regardless of store assignment', () => {
        expect(getDefaultStoreId('Driver', storeId)).toBe(null)
        expect(getDefaultStoreId('Driver', null)).toBe(null)
      })
    })

    describe('Edge Cases', () => {
      it('should return null for null role', () => {
        expect(getDefaultStoreId(null, storeId)).toBe(null)
      })

      it('should return null for undefined role', () => {
        expect(getDefaultStoreId(undefined, storeId)).toBe(null)
      })
    })
  })

  describe('Role Consistency Tests', () => {
    it('should ensure global access and store scoped are mutually exclusive', () => {
      roles.forEach((role) => {
        if (role) {
          const hasGlobal = hasGlobalAccess(role)
          const isScoped = isStoreScopedRole(role)
          // A role cannot be both global and scoped
          expect(hasGlobal && isScoped).toBe(false)
        }
      })
    })

    it('should ensure stock count and reception have no overlap except Admin', () => {
      // Driver can do reception but not count
      expect(canDoStockReception('Driver')).toBe(true)
      expect(canDoStockCount('Driver')).toBe(false)

      // Staff can do count but not reception
      expect(canDoStockCount('Staff')).toBe(true)
      expect(canDoStockReception('Staff')).toBe(false)

      // Admin can do both
      expect(canDoStockReception('Admin')).toBe(true)
      expect(canDoStockCount('Admin')).toBe(true)
    })
  })
})
