'use client'

/**
 * AuthProvider - Global Authentication State Management
 *
 * This provider maintains auth state globally so it persists across
 * client-side navigations without re-fetching on every page change.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient, supabaseFetch, getUserFromCookies } from '@/lib/supabase/client'
import { Profile, AppRole } from '@/types'
import { hasGlobalAccess as checkGlobalAccess, isStoreScopedRole as checkStoreScopedRole } from '@/lib/auth'

/** Authentication state shape */
interface AuthState {
  user: User | null
  profile: Profile | null
  role: AppRole | null
  storeId: string | null
  isLoading: boolean
  hasGlobalAccess: boolean
  isStoreScopedRole: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Global state to persist across navigations
let globalAuthState: AuthState | null = null

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Initialize from global state if available (persists across navigations)
    if (globalAuthState && !globalAuthState.isLoading) {
      return globalAuthState
    }
    return {
      user: null,
      profile: null,
      role: null,
      storeId: null,
      isLoading: true,
      hasGlobalAccess: false,
      isStoreScopedRole: false,
    }
  })

  const router = useRouter()
  // Create client without memoization to avoid stale connection issues
  const supabase = createClient()
  const lastRefreshRef = useRef<number>(0)

  // Update global state whenever local state changes
  useEffect(() => {
    globalAuthState = authState
  }, [authState])

  const fetchAndSetProfile = useCallback(async (user: User) => {
    try {
      const { data: profileData, error } = await supabaseFetch<Profile>('profiles', {
        filter: { id: `eq.${user.id}` },
      })

      if (error) {
        const newState: AuthState = {
          user,
          profile: null,
          role: null,
          storeId: null,
          isLoading: false,
          hasGlobalAccess: false,
          isStoreScopedRole: false,
        }
        setAuthState(newState)
        return
      }

      const profile = profileData && profileData.length > 0 ? profileData[0] : null

      if (profile) {
        const newState: AuthState = {
          user,
          profile,
          role: profile.role,
          storeId: profile.store_id,
          isLoading: false,
          hasGlobalAccess: checkGlobalAccess(profile.role),
          isStoreScopedRole: checkStoreScopedRole(profile.role),
        }
        setAuthState(newState)
      } else {
        const newState: AuthState = {
          user,
          profile: null,
          role: null,
          storeId: null,
          isLoading: false,
          hasGlobalAccess: false,
          isStoreScopedRole: false,
        }
        setAuthState(newState)
      }
    } catch {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // Validate and refresh session - used by visibility change
  const validateAndRefreshSession = useCallback(async (reason: string) => {
    if (!authState.user) return

    // Debounce: don't check more than once every 5 seconds
    const now = Date.now()
    if (now - lastRefreshRef.current < 5000) {
      return
    }
    lastRefreshRef.current = now

    try {
      // Get current session to check if token is still valid
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        globalAuthState = null
        window.location.href = '/login'
        return
      }

      // Check if token is expired or about to expire (within 60 seconds)
      const expiresAt = session.expires_at
      const nowSeconds = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt ? expiresAt - nowSeconds : 0

      if (timeUntilExpiry < 60) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError || !refreshData.session) {
          globalAuthState = null
          window.location.href = '/login'
          return
        }
      }
    } catch {
      // Session check failed silently
    }
  }, [supabase, authState.user])

  // Handle visibility change - refresh session when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateAndRefreshSession('Tab became visible')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [validateAndRefreshSession])

  useEffect(() => {
    // Skip initialization if we already have valid cached state
    if (globalAuthState && !globalAuthState.isLoading && globalAuthState.user) {
      return
    }

    const getSession = async () => {
      try {
        // Get user directly from JWT in cookies - bypasses Supabase client hanging issues
        const cookieUser = getUserFromCookies()

        if (!cookieUser) {
          const newState: AuthState = {
            user: null,
            profile: null,
            role: null,
            storeId: null,
            isLoading: false,
            hasGlobalAccess: false,
            isStoreScopedRole: false,
          }
          setAuthState(newState)
          return
        }

        // Create a minimal User object from the cookie data
        const user = {
          id: cookieUser.id,
          email: cookieUser.email,
          aud: 'authenticated',
          created_at: '',
          app_metadata: {},
          user_metadata: {},
        } as User

        await fetchAndSetProfile(user)
      } catch {
        setAuthState(prev => ({ ...prev, isLoading: false }))
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchAndSetProfile(session.user)
        } else if (event === 'SIGNED_OUT') {
          const newState: AuthState = {
            user: null,
            profile: null,
            role: null,
            storeId: null,
            isLoading: false,
            hasGlobalAccess: false,
            isStoreScopedRole: false,
          }
          setAuthState(newState)
          globalAuthState = null
          router.push('/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, fetchAndSetProfile])

  const signOut = useCallback(async () => {
    // Clear local state immediately
    globalAuthState = null

    // Manually clear all Supabase auth cookies
    const clearAuthCookies = () => {
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [name] = cookie.split('=')
        const trimmedName = name.trim()
        if (trimmedName.startsWith('sb-') || trimmedName.includes('auth')) {
          document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
        }
      }
    }

    clearAuthCookies()

    // Try to sign out from Supabase (don't wait for it)
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})

    // Hard redirect immediately after clearing cookies
    window.location.href = '/login'
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (authState.user) {
      await fetchAndSetProfile(authState.user)
    }
  }, [authState.user, fetchAndSetProfile])

  const value: AuthContextValue = {
    ...authState,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
