import { describe, it, expect } from 'vitest'
import {
  ROLES,
  INVITE_ROLES,
  INVITE_ROLE_LABELS,
  INVITE_ROLE_DESCRIPTIONS,
  LEGACY_ROLES,
  STORE_MANAGEMENT_ROLES,
  USER_MANAGEMENT_ROLES,
  MULTI_STORE_ROLES,
  SINGLE_STORE_ROLES,
  PERMISSIONS,
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
  ROLE_ROUTES,
  LEGACY_ROLE_ROUTES,
  UNITS_OF_MEASURE,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  INVITABLE_ROLES_BY_ROLE,
} from '@/lib/constants'
import { AppRole } from '@/types'

describe('Constants', () => {
  describe('ROLES', () => {
    it('should have exactly 4 roles', () => {
      expect(ROLES).toHaveLength(4)
    })

    it('should contain all expected roles', () => {
      expect(ROLES).toContain('Owner')
      expect(ROLES).toContain('Manager')
      expect(ROLES).toContain('Staff')
      expect(ROLES).toContain('Driver')
    })

    it('should have roles in specific order', () => {
      expect(ROLES).toEqual(['Owner', 'Manager', 'Staff', 'Driver'])
    })
  })

  describe('INVITE_ROLES', () => {
    it('should have same roles as ROLES', () => {
      expect(INVITE_ROLES).toEqual(ROLES)
    })
  })

  describe('INVITE_ROLE_LABELS', () => {
    it('should have labels for all roles', () => {
      ROLES.forEach(role => {
        expect(INVITE_ROLE_LABELS[role]).toBeDefined()
      })
    })

    it('should map Owner to Co-Owner', () => {
      expect(INVITE_ROLE_LABELS['Owner']).toBe('Co-Owner')
    })

    it('should keep other role names as-is', () => {
      expect(INVITE_ROLE_LABELS['Manager']).toBe('Manager')
      expect(INVITE_ROLE_LABELS['Staff']).toBe('Staff')
      expect(INVITE_ROLE_LABELS['Driver']).toBe('Driver')
    })
  })

  describe('INVITE_ROLE_DESCRIPTIONS', () => {
    it('should have descriptions for all roles', () => {
      ROLES.forEach(role => {
        expect(INVITE_ROLE_DESCRIPTIONS[role]).toBeDefined()
        expect(typeof INVITE_ROLE_DESCRIPTIONS[role]).toBe('string')
        expect(INVITE_ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(0)
      })
    })
  })

  describe('LEGACY_ROLES', () => {
    it('should contain legacy role names', () => {
      expect(LEGACY_ROLES).toContain('Admin')
      expect(LEGACY_ROLES).toContain('Driver')
      expect(LEGACY_ROLES).toContain('Staff')
    })

    it('should not contain new roles', () => {
      expect(LEGACY_ROLES).not.toContain('Owner')
      expect(LEGACY_ROLES).not.toContain('Manager')
    })
  })

  describe('Role Categories', () => {
    describe('STORE_MANAGEMENT_ROLES', () => {
      it('should include Owner and Manager', () => {
        expect(STORE_MANAGEMENT_ROLES).toContain('Owner')
        expect(STORE_MANAGEMENT_ROLES).toContain('Manager')
      })

      it('should not include Staff or Driver', () => {
        expect(STORE_MANAGEMENT_ROLES).not.toContain('Staff')
        expect(STORE_MANAGEMENT_ROLES).not.toContain('Driver')
      })
    })

    describe('USER_MANAGEMENT_ROLES', () => {
      it('should only include Owner', () => {
        expect(USER_MANAGEMENT_ROLES).toEqual(['Owner'])
      })
    })

    describe('MULTI_STORE_ROLES', () => {
      it('should include Owner and Driver', () => {
        expect(MULTI_STORE_ROLES).toContain('Owner')
        expect(MULTI_STORE_ROLES).toContain('Driver')
      })

      it('should not include Manager or Staff', () => {
        expect(MULTI_STORE_ROLES).not.toContain('Manager')
        expect(MULTI_STORE_ROLES).not.toContain('Staff')
      })
    })

    describe('SINGLE_STORE_ROLES', () => {
      it('should include Manager and Staff', () => {
        expect(SINGLE_STORE_ROLES).toContain('Manager')
        expect(SINGLE_STORE_ROLES).toContain('Staff')
      })

      it('should not include Owner or Driver', () => {
        expect(SINGLE_STORE_ROLES).not.toContain('Owner')
        expect(SINGLE_STORE_ROLES).not.toContain('Driver')
      })
    })
  })

  describe('PERMISSIONS', () => {
    describe('Store Management', () => {
      it('CREATE_STORE should be Owner only', () => {
        expect(PERMISSIONS.CREATE_STORE).toEqual(['Owner'])
      })

      it('MANAGE_STORE_SETTINGS should be Owner and Manager', () => {
        expect(PERMISSIONS.MANAGE_STORE_SETTINGS).toContain('Owner')
        expect(PERMISSIONS.MANAGE_STORE_SETTINGS).toContain('Manager')
      })

      it('DELETE_STORE should be Owner only', () => {
        expect(PERMISSIONS.DELETE_STORE).toEqual(['Owner'])
      })
    })

    describe('User Management', () => {
      it('INVITE_USERS should be Owner only', () => {
        expect(PERMISSIONS.INVITE_USERS).toEqual(['Owner'])
      })

      it('MANAGE_USERS should be Owner and Manager', () => {
        expect(PERMISSIONS.MANAGE_USERS).toContain('Owner')
        expect(PERMISSIONS.MANAGE_USERS).toContain('Manager')
      })
    })

    describe('Inventory', () => {
      it('MANAGE_INVENTORY_ITEMS should be Owner and Manager', () => {
        expect(PERMISSIONS.MANAGE_INVENTORY_ITEMS).toContain('Owner')
        expect(PERMISSIONS.MANAGE_INVENTORY_ITEMS).toContain('Manager')
      })

      it('VIEW_INVENTORY_ITEMS should include all roles', () => {
        ROLES.forEach(role => {
          expect(PERMISSIONS.VIEW_INVENTORY_ITEMS).toContain(role)
        })
      })
    })

    describe('Stock Operations', () => {
      it('DO_STOCK_COUNT should include Owner, Manager, Staff', () => {
        expect(PERMISSIONS.DO_STOCK_COUNT).toContain('Owner')
        expect(PERMISSIONS.DO_STOCK_COUNT).toContain('Manager')
        expect(PERMISSIONS.DO_STOCK_COUNT).toContain('Staff')
        expect(PERMISSIONS.DO_STOCK_COUNT).not.toContain('Driver')
      })

      it('DO_STOCK_RECEPTION should include Owner, Manager, Driver', () => {
        expect(PERMISSIONS.DO_STOCK_RECEPTION).toContain('Owner')
        expect(PERMISSIONS.DO_STOCK_RECEPTION).toContain('Manager')
        expect(PERMISSIONS.DO_STOCK_RECEPTION).toContain('Driver')
        expect(PERMISSIONS.DO_STOCK_RECEPTION).not.toContain('Staff')
      })
    })

    describe('Reports', () => {
      it('VIEW_REPORTS should include Owner, Manager, Driver', () => {
        expect(PERMISSIONS.VIEW_REPORTS).toContain('Owner')
        expect(PERMISSIONS.VIEW_REPORTS).toContain('Manager')
        expect(PERMISSIONS.VIEW_REPORTS).toContain('Driver')
        expect(PERMISSIONS.VIEW_REPORTS).not.toContain('Staff')
      })
    })

    describe('Billing', () => {
      it('MANAGE_BILLING should be empty (must check is_billing_owner)', () => {
        expect(PERMISSIONS.MANAGE_BILLING).toEqual([])
      })

      it('VIEW_BILLING should be empty (must check is_billing_owner)', () => {
        expect(PERMISSIONS.VIEW_BILLING).toEqual([])
      })
    })
  })

  describe('INVITABLE_ROLES_BY_ROLE', () => {
    it('Owner can invite all roles', () => {
      expect(INVITABLE_ROLES_BY_ROLE['Owner']).toContain('Owner')
      expect(INVITABLE_ROLES_BY_ROLE['Owner']).toContain('Manager')
      expect(INVITABLE_ROLES_BY_ROLE['Owner']).toContain('Staff')
      expect(INVITABLE_ROLES_BY_ROLE['Owner']).toContain('Driver')
    })

    it('Manager can only invite Staff and Driver', () => {
      expect(INVITABLE_ROLES_BY_ROLE['Manager']).toContain('Staff')
      expect(INVITABLE_ROLES_BY_ROLE['Manager']).toContain('Driver')
      expect(INVITABLE_ROLES_BY_ROLE['Manager']).not.toContain('Owner')
      expect(INVITABLE_ROLES_BY_ROLE['Manager']).not.toContain('Manager')
    })

    it('Staff cannot invite anyone', () => {
      expect(INVITABLE_ROLES_BY_ROLE['Staff']).toHaveLength(0)
    })

    it('Driver cannot invite anyone', () => {
      expect(INVITABLE_ROLES_BY_ROLE['Driver']).toHaveLength(0)
    })
  })

  describe('Routes', () => {
    describe('PUBLIC_ROUTES', () => {
      it('should include login route', () => {
        expect(PUBLIC_ROUTES).toContain('/login')
      })

      it('should include landing page', () => {
        expect(PUBLIC_ROUTES).toContain('/')
      })

      it('should include legal pages', () => {
        expect(PUBLIC_ROUTES).toContain('/terms')
        expect(PUBLIC_ROUTES).toContain('/privacy')
        expect(PUBLIC_ROUTES).toContain('/cookies')
      })

      it('should include onboarding routes', () => {
        expect(PUBLIC_ROUTES).toContain('/onboard')
        expect(PUBLIC_ROUTES).toContain('/onboarding')
      })
    })

    describe('PROTECTED_ROUTES', () => {
      it('should include main dashboard routes', () => {
        expect(PROTECTED_ROUTES).toContain('/inventory')
        expect(PROTECTED_ROUTES).toContain('/users')
        expect(PROTECTED_ROUTES).toContain('/reports')
        expect(PROTECTED_ROUTES).toContain('/shifts')
      })
    })

    describe('ROLE_ROUTES', () => {
      it('Owner should have access to all protected routes', () => {
        expect(ROLE_ROUTES['Owner']).toContain('/')
        expect(ROLE_ROUTES['Owner']).toContain('/inventory')
        expect(ROLE_ROUTES['Owner']).toContain('/users')
        expect(ROLE_ROUTES['Owner']).toContain('/billing')
      })

      it('Manager should have access to operational routes but not billing', () => {
        expect(ROLE_ROUTES['Manager']).toContain('/inventory')
        expect(ROLE_ROUTES['Manager']).toContain('/users')
        expect(ROLE_ROUTES['Manager']).not.toContain('/billing')
      })

      it('Staff should have minimal access', () => {
        expect(ROLE_ROUTES['Staff']).toContain('/')
        expect(ROLE_ROUTES['Staff']).toContain('/my-shifts')
        expect(ROLE_ROUTES['Staff']).not.toContain('/inventory')
        expect(ROLE_ROUTES['Staff']).not.toContain('/users')
      })

      it('Driver should have access to reports and shifts', () => {
        expect(ROLE_ROUTES['Driver']).toContain('/reports')
        expect(ROLE_ROUTES['Driver']).toContain('/my-shifts')
        expect(ROLE_ROUTES['Driver']).not.toContain('/inventory')
      })
    })

    describe('LEGACY_ROLE_ROUTES', () => {
      it('Admin should map to Owner routes', () => {
        expect(LEGACY_ROLE_ROUTES['Admin']).toEqual(ROLE_ROUTES['Owner'])
      })

      it('Legacy Driver should map to Driver routes', () => {
        expect(LEGACY_ROLE_ROUTES['Driver']).toEqual(ROLE_ROUTES['Driver'])
      })

      it('Legacy Staff should map to Staff routes', () => {
        expect(LEGACY_ROLE_ROUTES['Staff']).toEqual(ROLE_ROUTES['Staff'])
      })
    })
  })

  describe('UNITS_OF_MEASURE', () => {
    it('should have multiple units', () => {
      expect(UNITS_OF_MEASURE.length).toBeGreaterThan(5)
    })

    it('should include common units', () => {
      expect(UNITS_OF_MEASURE).toContain('each')
      expect(UNITS_OF_MEASURE).toContain('lb')
      expect(UNITS_OF_MEASURE).toContain('kg')
      expect(UNITS_OF_MEASURE).toContain('box')
    })
  })

  describe('ROLE_LABELS', () => {
    it('should have labels for all roles', () => {
      ROLES.forEach(role => {
        expect(ROLE_LABELS[role]).toBeDefined()
      })
    })
  })

  describe('ROLE_DESCRIPTIONS', () => {
    it('should have descriptions for all roles', () => {
      ROLES.forEach(role => {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined()
        expect(typeof ROLE_DESCRIPTIONS[role]).toBe('string')
      })
    })
  })
})
