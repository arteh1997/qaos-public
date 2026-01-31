import { AppRole } from '@/types'
import { GLOBAL_ACCESS_ROLES, STORE_SCOPED_ROLES, PERMISSIONS } from './constants'

// Check if a role has global access (Admin or Driver)
export function hasGlobalAccess(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return GLOBAL_ACCESS_ROLES.includes(role)
}

// Check if a role is store-scoped (Staff only)
export function isStoreScopedRole(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return STORE_SCOPED_ROLES.includes(role)
}

// Check if a role can perform a specific action
export function canManageStores(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_STORES.includes(role)
}

export function canViewAllStores(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.VIEW_ALL_STORES.includes(role)
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_USERS.includes(role)
}

export function canManageInventoryItems(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return PERMISSIONS.MANAGE_INVENTORY_ITEMS.includes(role)
}

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

// Check if user can access a specific store
export function canAccessStore(
  role: AppRole | null | undefined,
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

// Get the default store for a user (for store-scoped roles)
export function getDefaultStoreId(
  role: AppRole | null | undefined,
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
