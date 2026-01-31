'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabaseFetch, supabaseUpdate } from '@/lib/supabase/client'
import { Profile, AppRole, UserStatus } from '@/types'
import { sanitizeSearchInput, sanitizeErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export interface UsersFilters {
  search?: string
  role?: AppRole | 'all'
  status?: UserStatus | 'all'
  page?: number
}

export interface PaginatedUsers {
  users: (Profile & { store: { id: string; name: string } | null })[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface UpdateUserData {
  full_name?: string
  role?: AppRole
  store_id?: string | null
  status?: UserStatus
}

export function useUsers(filters: UsersFilters = {}) {
  const { search = '', role = 'all', status = 'all', page = 1 } = filters
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

      const { data, error: fetchError, count } = await supabaseFetch<PaginatedUsers['users'][0]>('profiles', {
        select: '*,store:stores(*)',
        order: 'full_name',
        filter,
        range: { from, to },
        count: true,
      })

      if (fetchError) throw fetchError

      setUsers(data || [])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch users'))
    } finally {
      setIsLoading(false)
    }
  }, [search, role, status, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const updateUser = useCallback(async ({ id, data }: { id: string; data: UpdateUserData }) => {
    // Filter out undefined values
    const updateData: Record<string, unknown> = {}
    if (data.full_name !== undefined) updateData.full_name = data.full_name
    if (data.role !== undefined) updateData.role = data.role
    if (data.store_id !== undefined) updateData.store_id = data.store_id
    if (data.status !== undefined) updateData.status = data.status

    // Optimistic update
    setUsers(prev => prev.map(user =>
      user.id === id ? { ...user, ...updateData } as PaginatedUsers['users'][0] : user
    ))

    try {
      const { error } = await supabaseUpdate('profiles', id, updateData)

      if (error) throw error
      toast.success('User updated successfully')
    } catch (err) {
      fetchUsers()
      toast.error('Failed to update user: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchUsers])

  const deactivateUser = useCallback(async (id: string) => {
    // Optimistic update
    setUsers(prev => prev.map(user =>
      user.id === id ? { ...user, status: 'Inactive' as UserStatus } : user
    ))

    try {
      const { error } = await supabaseUpdate('profiles', id, { status: 'Inactive' })

      if (error) throw error
      toast.success('User deactivated')
    } catch (err) {
      fetchUsers()
      toast.error('Failed to deactivate user: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchUsers])

  const activateUser = useCallback(async (id: string) => {
    // Optimistic update
    setUsers(prev => prev.map(user =>
      user.id === id ? { ...user, status: 'Active' as UserStatus } : user
    ))

    try {
      const { error } = await supabaseUpdate('profiles', id, { status: 'Active' })

      if (error) throw error
      toast.success('User activated')
    } catch (err) {
      fetchUsers()
      toast.error('Failed to activate user: ' + sanitizeErrorMessage(err))
      throw err
    }
  }, [fetchUsers])

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
    deactivateUser,
    activateUser,
    refetch: fetchUsers,
  }
}
