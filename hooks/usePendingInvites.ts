'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserInvite } from '@/types'
import { useCSRF } from './useCSRF'
import { toast } from 'sonner'

export interface PendingInvite extends Omit<UserInvite, 'store' | 'inviter'> {
  store?: { id: string; name: string } | null
  inviter?: { id: string; full_name: string | null; email: string } | null
}

export function usePendingInvites() {
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { csrfFetch } = useCSRF()

  const fetchInvites = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/users/invites')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch invitations')
      }

      setInvites(result.data || [])
    } catch (err) {
      console.error('[usePendingInvites] Error:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch invitations'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const cancelInvite = useCallback(async (inviteId: string) => {
    // Optimistic update
    setInvites(prev => prev.filter(invite => invite.id !== inviteId))

    try {
      const response = await csrfFetch(`/api/users/invites?id=${inviteId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to cancel invitation')
      }

      toast.success('Invitation cancelled')
    } catch (err) {
      // Rollback on error
      fetchInvites()
      toast.error(err instanceof Error ? err.message : 'Failed to cancel invitation')
      throw err
    }
  }, [fetchInvites])

  const resendInvite = useCallback(async (inviteId: string) => {
    try {
      const response = await csrfFetch('/api/users/invites/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to resend invitation')
      }

      toast.success('Invitation resent')
      // Refresh to get updated expiration time
      fetchInvites()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
      throw err
    }
  }, [fetchInvites])

  return {
    invites,
    isLoading,
    error,
    cancelInvite,
    resendInvite,
    refetch: fetchInvites,
  }
}
