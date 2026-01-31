'use client'

/**
 * useAuth Hook - Central Authentication State Management
 *
 * This hook now uses the AuthProvider context to get auth state.
 * The state is managed globally in the AuthProvider, which persists
 * across client-side navigations without re-fetching.
 *
 * Usage:
 *   const { user, role, isLoading, signOut } = useAuth()
 */

// Re-export useAuth from the AuthProvider
export { useAuth } from '@/components/providers/AuthProvider'
