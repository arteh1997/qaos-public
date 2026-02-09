/**
 * Central hooks exports
 *
 * This file exports the NEW TanStack Query versions of hooks
 * with backward-compatible names for seamless migration.
 */

// Re-export TanStack Query hooks with original names
export {
  useStores,
  useStoresQuery,
  useCreateStore,
  useUpdateStore,
  useDeleteStore,
  type StoresFilters,
  type PaginatedStores,
} from './useStores.query'

export {
  useStoreInventory,
  useStoreInventoryQuery,
  useUpdateInventoryQuantity,
  useSetParLevel,
} from './useStoreInventory.query'

export {
  useStoreUsers,
  useStoreUsersQuery,
  useAddUserToStore,
  useRemoveUserFromStore,
  useUpdateUserRole,
  type StoreUserWithProfile,
} from './useStoreUsers.query'

// Keep other hooks as-is (will migrate gradually)
export { useAuth } from './useAuth'
export { useUsers } from './useUsers'
export { useShifts } from './useShifts'
export { useInventory } from './useInventory'
export { useSubscriptionGuard } from './useSubscriptionGuard'
export { useAutoRefresh } from './useAutoRefresh'
export { useStoreSetupStatus } from './useStoreSetupStatus'
