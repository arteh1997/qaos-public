'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseInsert, supabaseUpdate, supabaseDelete } from '@/lib/supabase/client'
import { StoreUser, StoreUserWithStore, Profile, AppRole } from '@/types'
import { sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export interface StoreUsersFilters {
  storeId: string
  search?: string
  role?: AppRole | 'all'
  page?: number
}

export interface StoreUserWithProfile extends StoreUser {
  user: Profile
}

export interface AddStoreUserData {
  store_id: string
  user_id: string
  role: AppRole
  is_billing_owner?: boolean
  invited_by?: string
}

export interface UpdateStoreUserData {
  role?: AppRole
  is_billing_owner?: boolean
}

/**
 * Hook for managing store memberships (store_users table)
 * Used for inviting users to stores and managing their roles
 */
export function useStoreUsers(filters: StoreUsersFilters) {
  const { storeId, search = '', role = 'all', page = 1 } = filters
  const [storeUsers, setStoreUsers] = useState<StoreUserWithProfile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStoreUsers = useCallback(async () => {
    if (!storeId) {
      setStoreUsers([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const filter: Record<string, string> = {
        store_id: `eq.${storeId}`,
      }

      if (role !== 'all') {
        filter['role'] = `eq.${role}`
      }

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error: fetchError, count } = await supabaseFetch<StoreUserWithProfile>(
        'store_users',
        {
          select: '*, user:profiles(*)',
          filter,
          range: { from, to },
          count: true,
        }
      )

      if (fetchError) throw fetchError

      // Filter by search if provided (search on user email/name)
      let filteredData = data || []
      if (search) {
        const searchLower = search.toLowerCase()
        filteredData = filteredData.filter(su =>
          su.user?.email?.toLowerCase().includes(searchLower) ||
          su.user?.full_name?.toLowerCase().includes(searchLower)
        )
      }

      setStoreUsers(filteredData)
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch store users'))
    } finally {
      setIsLoading(false)
    }
  }, [storeId, search, role, page])

  useEffect(() => {
    fetchStoreUsers()
  }, [fetchStoreUsers])

  /**
   * Add a user to a store with a specific role
   */
  const addUserToStore = useCallback(async (data: AddStoreUserData) => {
    const now = new Date().toISOString()

    try {
      const { error } = await supabaseInsert('store_users', {
        ...data,
        created_at: now,
        updated_at: now,
      })

      if (error) throw error
      toast.success('User added to store successfully')
      fetchStoreUsers()
    } catch (err) {
      toast.error('Failed to add user to store: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStoreUsers])

  /**
   * Update a user's role or billing status at a store
   */
  const updateStoreUser = useCallback(async (id: string, data: UpdateStoreUserData) => {
    // Optimistic update
    setStoreUsers(prev => prev.map(su =>
      su.id === id ? { ...su, ...data, updated_at: new Date().toISOString() } : su
    ))

    try {
      const { error } = await supabaseUpdate('store_users', id, {
        ...data,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      toast.success('User role updated successfully')
    } catch (err) {
      fetchStoreUsers()
      toast.error('Failed to update user role: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStoreUsers])

  /**
   * Remove a user from a store
   */
  const removeUserFromStore = useCallback(async (id: string) => {
    // Find the user to check billing status
    const storeUser = storeUsers.find(su => su.id === id)
    if (storeUser?.is_billing_owner) {
      toast.error('Cannot remove the billing owner. Transfer billing ownership first.')
      return
    }

    // Optimistic update
    setStoreUsers(prev => prev.filter(su => su.id !== id))
    setTotalCount(prev => prev - 1)

    try {
      const { error } = await supabaseDelete('store_users', id)

      if (error) throw error
      toast.success('User removed from store successfully')
    } catch (err) {
      fetchStoreUsers()
      toast.error('Failed to remove user from store: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStoreUsers, storeUsers])

  /**
   * Transfer billing ownership to another user at this store
   */
  const transferBillingOwnership = useCallback(async (newBillingOwnerId: string) => {
    const currentBillingOwner = storeUsers.find(su => su.is_billing_owner)
    const newBillingOwner = storeUsers.find(su => su.id === newBillingOwnerId)

    if (!newBillingOwner) {
      toast.error('New billing owner not found')
      return
    }

    if (newBillingOwner.role !== 'Owner') {
      toast.error('Billing owner must have Owner role')
      return
    }

    try {
      // Update both users
      if (currentBillingOwner) {
        await supabaseUpdate('store_users', currentBillingOwner.id, {
          is_billing_owner: false,
          updated_at: new Date().toISOString(),
        })
      }

      await supabaseUpdate('store_users', newBillingOwnerId, {
        is_billing_owner: true,
        updated_at: new Date().toISOString(),
      })

      toast.success('Billing ownership transferred successfully')
      fetchStoreUsers()
    } catch (err) {
      fetchStoreUsers()
      toast.error('Failed to transfer billing ownership: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchStoreUsers, storeUsers])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    storeUsers,
    totalCount,
    totalPages,
    currentPage: page,
    isLoading,
    error,
    addUserToStore,
    updateStoreUser,
    removeUserFromStore,
    transferBillingOwnership,
    refetch: fetchStoreUsers,
  }
}

/**
 * Hook to get all stores a user has access to
 */
export function useUserStores(userId: string | null) {
  const [stores, setStores] = useState<StoreUserWithStore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUserStores = useCallback(async () => {
    if (!userId) {
      setStores([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabaseFetch<StoreUserWithStore>(
        'store_users',
        {
          select: '*, store:stores(*)',
          filter: { user_id: `eq.${userId}` },
        }
      )

      if (fetchError) throw fetchError

      // Filter out any without valid store data
      const validStores = (data || []).filter(
        (s): s is StoreUserWithStore => s.store !== null && s.store !== undefined
      )

      setStores(validStores)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user stores'))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchUserStores()
  }, [fetchUserStores])

  return {
    stores,
    isLoading,
    error,
    refetch: fetchUserStores,
  }
}
