'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseUpdate, supabaseInsert, supabaseDelete } from '@/lib/supabase/client'
import { Profile, AppRole, UserStatus, StoreUser } from '@/types'
import { sanitizeSearchInput, sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export interface UsersFilters {
  search?: string
  role?: AppRole | 'all'
  status?: UserStatus | 'all'
  storeId?: string | 'all'
  page?: number
}

// Store user entry with store name for display
export type StoreUserWithStore = Pick<StoreUser, 'store_id' | 'role' | 'is_billing_owner'> & {
  store: { id: string; name: string } | null
}

// User with store and store_users data for determining billing owner status
export type UserWithStoreInfo = Profile & {
  store: { id: string; name: string } | null
  store_users: StoreUserWithStore[]
}

export interface PaginatedUsers {
  users: UserWithStoreInfo[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface UpdateUserData {
  full_name?: string
  role?: AppRole
  store_id?: string | null
  store_ids?: string[] // For Driver role - multiple stores
  status?: UserStatus
}

export function useUsers(filters: UsersFilters = {}) {
  const { search = '', role = 'all', status = 'all', storeId = 'all', page = 1 } = filters
  const [users, setUsers] = useState<PaginatedUsers['users']>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = {}

      if (search) {
        const sanitizedSearch = sanitizeSearchInput(search)
        if (sanitizedSearch) {
          filter['or'] = `(full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%)`
        }
      }

      if (role && role !== 'all') {
        filter['role'] = `eq.${role}`
      }

      if (status && status !== 'all') {
        filter['status'] = `eq.${status}`
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      // Build the store_users select for store-specific queries
      // Include store name for display purposes
      // Must specify the foreign key relationship explicitly since there are two FKs (user_id and invited_by)
      // Use !inner join to only return profiles that have a store_users entry for the selected store
      const storeUsersSelect = storeId && storeId !== 'all'
        ? 'store_users!store_users_user_id_fkey!inner(store_id,role,is_billing_owner,store:stores(id,name))'
        : 'store_users!store_users_user_id_fkey(store_id,role,is_billing_owner,store:stores(id,name))'

      // Add the store_id filter as a query parameter (not in select string)
      if (storeId && storeId !== 'all') {
        filter['store_users.store_id'] = `eq.${storeId}`
      }

      const { data, error: fetchError, count } = await supabaseFetch<UserWithStoreInfo>('profiles', {
        select: `*,store:stores!profiles_store_id_fkey(*),${storeUsersSelect}`,
        order: 'full_name',
        filter,
        range: { from, to },
        count: true,
      })

      console.log('[useUsers] Fetch result:', { data, error: fetchError, count, filter, storeId })

      if (fetchError) throw fetchError

      setUsers(data || [])
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error('[useUsers] Error:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch users'))
    } finally {
      setIsLoading(false)
    }
  }, [search, role, status, storeId, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const updateUser = useCallback(async ({ id, data }: { id: string; data: UpdateUserData }) => {
    // Check if user is a billing owner - they cannot have role/status changed
    const targetUser = users.find(u => u.id === id)
    const isBillingOwner = targetUser?.store_users?.some(su => su.is_billing_owner) ?? false

    if (isBillingOwner) {
      // Billing owners can only have their name changed
      if (data.role !== undefined || data.status !== undefined || data.store_id !== undefined) {
        toast.error('Cannot change role, status, or store of billing owner')
        return
      }
    }

    // Filter out undefined values for profile update
    const updateData: Record<string, unknown> = {}
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.role !== undefined && !isBillingOwner) updateData.role = data.role
    if (data.store_id !== undefined && !isBillingOwner) updateData.store_id = data.store_id
    if (data.status !== undefined && !isBillingOwner) updateData.status = data.status

    // Optimistic update
    setUsers(prev => prev.map(user =>
      user.id === id ? { ...user, ...updateData } as PaginatedUsers['users'][0] : user
    ))

    try {
      // Update profile
      const { error } = await supabaseUpdate('profiles', id, updateData)
      if (error) throw error

      // Update store_users role if role is being changed and we have a storeId filter
      if (data.role !== undefined && !isBillingOwner && storeId && storeId !== 'all') {
        // Find the store_users entry for this user at this store
        const { data: storeUsersData } = await supabaseFetch<{ id: string }>('store_users', {
          select: 'id',
          filter: {
            user_id: `eq.${id}`,
            store_id: `eq.${storeId}`,
          },
        })

        if (storeUsersData && storeUsersData.length > 0) {
          // Update the role in store_users
          const storeUserId = storeUsersData[0].id
          await supabaseUpdate('store_users', storeUserId, { role: data.role })
        }
      }

      // Handle store_users for Driver role
      if (data.role === 'Driver' && data.store_ids !== undefined) {
        // Get current store_users for this user with Driver role
        const { data: currentStoreUsers } = await supabaseFetch<{ id: string; store_id: string }>('store_users', {
          select: 'id,store_id',
          filter: {
            user_id: `eq.${id}`,
            role: 'eq.Driver',
          },
        })

        const currentStoreIds = currentStoreUsers?.map(su => su.store_id) ?? []
        const newStoreIds = data.store_ids

        // Find stores to add and remove
        const storesToAdd = newStoreIds.filter(storeId => !currentStoreIds.includes(storeId))
        const storesToRemove = currentStoreUsers?.filter(su => !newStoreIds.includes(su.store_id)) ?? []

        // Remove old store_users entries
        for (const storeUser of storesToRemove) {
          await supabaseDelete('store_users', storeUser.id)
        }

        // Add new store_users entries
        for (const storeId of storesToAdd) {
          await supabaseInsert('store_users', {
            user_id: id,
            store_id: storeId,
            role: 'Driver',
            is_billing_owner: false,
          })
        }
      }

      toast.success('User updated successfully')
      // Refetch to get updated store_users
      fetchUsers()
    } catch (err) {
      fetchUsers()
      toast.error('Failed to update user: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchUsers, users])

  const deleteUser = useCallback(async (id: string, storeId: string) => {
    // Check if user is a billing owner - they cannot be deleted
    const targetUser = users.find(u => u.id === id)
    const isBillingOwner = targetUser?.store_users?.some(su => su.is_billing_owner) ?? false

    if (isBillingOwner) {
      toast.error('Cannot delete billing owner')
      return
    }

    // Optimistic update - remove from list
    setUsers(prev => prev.filter(user => user.id !== id))

    try {
      // Use API endpoint to remove user - handles active shifts and audit logging
      const response = await fetch(`/api/stores/${storeId}/users/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to remove user')
      }

      // Show success message with shift info if applicable
      if (result.data?.activeShiftsEnded > 0) {
        toast.success(`User removed from store. ${result.data.activeShiftsEnded} active shift(s) were ended.`)
      } else {
        toast.success('User removed from store')
      }
    } catch (err) {
      fetchUsers()
      toast.error('Failed to remove user: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchUsers, users])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    users,
    totalCount,
    totalPages,
    currentPage: page,
    activeUsers: users.filter(u => u.status === 'Active'),
    isLoading,
    error,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  }
}
