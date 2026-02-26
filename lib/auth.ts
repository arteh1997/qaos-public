import { AppRole, StoreUserWithStore, LegacyAppRole } from '@/types'
import {
  STORE_MANAGEMENT_ROLES,
  USER_MANAGEMENT_ROLES,
  MULTI_STORE_ROLES,
  SINGLE_STORE_ROLES,
  PERMISSIONS,
} from './constants'

// ============================================================================
// Store-based permission functions (new multi-tenant system)
// ============================================================================

/**
 * Check if user has access to any store
 */
export function hasAnyStoreAccess(stores: StoreUserWithStore[]): boolean {
  return stores.length > 0
}

/**
 * Check if user can access a specific store
 */
export function canAccessStore(
  stores: StoreUserWithStore[],
  targetStoreId: string
): boolean {
  return stores.some(s => s.store_id === targetStoreId)
}

/**
 * Get user's role at a specific store
 */
export function getRoleAtStore(
  stores: StoreUserWithStore[],
  storeId: string
): AppRole | null {
  const membership = stores.find(s => s.store_id === storeId)
  return membership?.role ?? null
}

/**
 * Check if user can manage a store (Owner or Manager)
 */
export function canManageStore(
  stores: StoreUserWithStore[],
  storeId: string
): boolean {
  const role = getRoleAtStore(stores, storeId)
  return role ? STORE_MANAGEMENT_ROLES.includes(role) : false
}

/**
 * Check if user can manage users at a store (Owner only)
 */
export function canManageUsersAtStore(
  stores: StoreUserWithStore[],
  storeId: string
): boolean {
  const role = getRoleAtStore(stores, storeId)
  return role ? USER_MANAGEMENT_ROLES.includes(role) : false
}

/**
 * Check if user is billing owner of a store
 */
export function isBillingOwner(
  stores: StoreUserWithStore[],
  storeId: string
): boolean {
  const membership = stores.find(s => s.store_id === storeId)
  return membership?.is_billing_owner ?? false
}

/**
 * Check if user has a specific permission at a store
 */
export function hasPermissionAtStore(
  stores: StoreUserWithStore[],
  storeId: string,
  permission: keyof typeof PERMISSIONS
): boolean {
  const role = getRoleAtStore(stores, storeId)
  if (!role) return false
  return PERMISSIONS[permission].includes(role)
}

/**
 * Get stores where user has specific role(s)
 */
export function getStoresWithRoles(
  stores: StoreUserWithStore[],
  roles: AppRole[]
): StoreUserWithStore[] {
  return stores.filter(s => roles.includes(s.role))
}

/**
 * Check if user owns any store
 */
export function isAnyStoreOwner(stores: StoreUserWithStore[]): boolean {
  return stores.some(s => s.role === 'Owner')
}

/**
 * Check if user is a manager at any store
 */
export function isAnyStoreManager(stores: StoreUserWithStore[]): boolean {
  return stores.some(s => s.role === 'Manager')
}

/**
 * Get the user's default store (first owned store, or first store)
 */
export function getDefaultStore(
  stores: StoreUserWithStore[]
): StoreUserWithStore | null {
  if (stores.length === 0) return null

  // Prefer owned stores
  const ownedStore = stores.find(s => s.role === 'Owner')
  if (ownedStore) return ownedStore

  // Then managed stores
  const managedStore = stores.find(s => s.role === 'Manager')
  if (managedStore) return managedStore

  // Otherwise return first store
  return stores[0]
}

/**
 * Check if role can have access to multiple stores
 */
export function isMultiStoreRole(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return MULTI_STORE_ROLES.includes(role)
}

/**
 * Check if role is typically single-store focused
 */
export function isSingleStoreRole(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return SINGLE_STORE_ROLES.includes(role)
}

// ============================================================================
// Role-based permission helpers (for checking against a specific role)
// ============================================================================

export function canDoStockCount(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.DO_STOCK_COUNT.includes(role)
}

export function canDoStockReception(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.DO_STOCK_RECEPTION.includes(role)
}

export function canManageShifts(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_SHIFTS.includes(role)
}

export function canViewReports(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.VIEW_REPORTS.includes(role)
}

export function canManageInventoryItems(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_INVENTORY_ITEMS.includes(role)
}

export function canInviteUsers(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.INVITE_USERS.includes(role)
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_USERS.includes(role)
}

// ============================================================================
// Legacy compatibility functions (for transition period)
// These work with the old profiles.role and profiles.store_id system
// ============================================================================

/**
 * @deprecated Use store-based functions instead
 * Check if a legacy role has global access (Admin/Owner only)
 */
export function hasGlobalAccess(role: AppRole | LegacyAppRole | null | undefined): boolean {
  if (!role) return false
  if (role === 'Admin' || role === 'Owner') return true
  return false
}

/**
 * @deprecated Use store-based functions instead
 * Check if a legacy role is store-scoped (Staff only)
 */
export function isStoreScopedRole(role: AppRole | LegacyAppRole | null | undefined): boolean {
  if (!role) return false
  return role === 'Staff' || role === 'Manager'
}

/**
 * @deprecated Use canAccessStore with stores array instead
 * Legacy check if user can access a specific store
 */
export function canAccessStoreLegacy(
  role: AppRole | LegacyAppRole | null | undefined,
  userStoreId: string | null | undefined,
  targetStoreId: string
): boolean {
  if (!role) return false

  // Global access roles can access any store
  if (hasGlobalAccess(role)) return true

  // Store-scoped roles can only access their assigned store
  if (isStoreScopedRole(role)) {
    return userStoreId === targetStoreId
  }

  return false
}

/**
 * @deprecated Use getDefaultStore with stores array instead
 * Legacy get the default store for a user
 */
export function getDefaultStoreId(
  role: AppRole | LegacyAppRole | null | undefined,
  userStoreId: string | null | undefined
): string | null {
  if (!role) return null

  // Store-scoped roles default to their assigned store
  if (isStoreScopedRole(role) && userStoreId) {
    return userStoreId
  }

  // Global access roles don't have a default store
  return null
}

/**
 * @deprecated Use canManageUsersAtStore instead
 */
export function canManageStores(role: AppRole | LegacyAppRole | null | undefined): boolean {
  if (!role) return false
  return role === 'Admin' || role === 'Owner'
}

/**
 * @deprecated Use hasAnyStoreAccess and store filtering instead
 */
export function canViewAllStores(role: AppRole | LegacyAppRole | null | undefined): boolean {
  if (!role) return false
  return hasGlobalAccess(role)
}

// ============================================================================
// Role mapping utilities
// ============================================================================

/**
 * Map a legacy role to the new role system
 */
export function mapLegacyRole(legacyRole: LegacyAppRole): AppRole {
  switch (legacyRole) {
    case 'Admin':
      return 'Owner'
    case 'Driver':
      return 'Staff'
    case 'Staff':
      return 'Staff'
    default:
      return 'Staff'
  }
}

/**
 * Check if a role string is a legacy role
 */
export function isLegacyRole(role: string): role is LegacyAppRole {
  return role === 'Admin' || role === 'Driver'
}

/**
 * Normalize a role to the new system (converts Admin to Owner, Driver to Staff)
 */
export function normalizeRole(role: AppRole | LegacyAppRole | null | undefined): AppRole | null {
  if (!role) return null
  if (role === 'Admin') return 'Owner'
  if (role === 'Driver') return 'Staff'
  return role as AppRole
}
