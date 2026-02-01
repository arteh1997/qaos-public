'use client'

/**
 * AuthProvider - Global Authentication State Management
 *
 * This provider maintains auth state globally so it persists across
 * client-side navigations without re-fetching on every page change.
 *
 * Multi-tenant support: Users can belong to multiple stores with different roles.
 * The currentStore determines the active context for permissions and data access.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient, supabaseFetch, getUserFromCookies } from '@/lib/supabase/client'
import { Profile, AppRole, StoreUserWithStore } from '@/types'
import {
  hasGlobalAccess as checkGlobalAccess,
  isStoreScopedRole as checkStoreScopedRole,
  getDefaultStore,
  canManageStore,
  canManageUsersAtStore,
  isMultiStoreRole,
  normalizeRole,
} from '@/lib/auth'

/** Authentication state shape */
interface AuthState {
  user: User | null
  profile: Profile | null
  stores: StoreUserWithStore[]          // All stores user has access to
  currentStore: StoreUserWithStore | null  // Currently selected store context
  role: AppRole | null                  // Current role (at currentStore or legacy)
  storeId: string | null                // Current store ID (deprecated, use currentStore)
  isLoading: boolean
  hasGlobalAccess: boolean
  isStoreScopedRole: boolean
  isPlatformAdmin: boolean              // Super-admin access
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setCurrentStore: (storeId: string) => void
  // Permission helpers for current store context
  canManageCurrentStore: boolean
  canManageUsersAtCurrentStore: boolean
  isMultiStoreUser: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Local storage key for persisting current store selection
const CURRENT_STORE_KEY = 'restaurant-inventory-current-store'

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
      stores: [],
      currentStore: null,
      role: null,
      storeId: null,
      isLoading: true,
      hasGlobalAccess: false,
      isStoreScopedRole: false,
      isPlatformAdmin: false,
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
      console.log('[AuthProvider] Fetching profile and stores for user:', user.id, user.email)

      // Fetch profile and store memberships in parallel
      const [profileResult, storesResult] = await Promise.all([
        supabaseFetch<Profile>('profiles', {
          filter: { id: `eq.${user.id}` },
        }),
        // Fetch store_users with store data
        supabaseFetch<StoreUserWithStore>('store_users', {
          filter: { user_id: `eq.${user.id}` },
          select: '*, store:stores(*)',
        }),
      ])

      console.log('[AuthProvider] Profile result:', profileResult)
      console.log('[AuthProvider] Stores result:', storesResult)

      if (profileResult.error) {
        console.error('[AuthProvider] Profile error:', profileResult.error)
        const newState: AuthState = {
          user,
          profile: null,
          stores: [],
          currentStore: null,
          role: null,
          storeId: null,
          isLoading: false,
          hasGlobalAccess: false,
          isStoreScopedRole: false,
          isPlatformAdmin: false,
        }
        setAuthState(newState)
        return
      }

      const profile = profileResult.data && profileResult.data.length > 0 ? profileResult.data[0] : null
      const stores: StoreUserWithStore[] = (storesResult.data || []).filter(
        (s): s is StoreUserWithStore => s.store !== null && s.store !== undefined
      )

      console.log('[AuthProvider] Parsed profile:', profile)
      console.log('[AuthProvider] Parsed stores:', stores)
      console.log('[AuthProvider] Raw storesResult.data:', storesResult.data)

      if (profile) {
        // Determine current store:
        // 1. Check localStorage for previously selected store
        // 2. Use profile.default_store_id if set
        // 3. Fall back to getDefaultStore() logic
        let currentStore: StoreUserWithStore | null = null

        // Try to restore from localStorage
        const savedStoreId = typeof window !== 'undefined'
          ? localStorage.getItem(CURRENT_STORE_KEY)
          : null

        if (savedStoreId) {
          currentStore = stores.find(s => s.store_id === savedStoreId) || null
        }

        // Fall back to default_store_id
        if (!currentStore && profile.default_store_id) {
          currentStore = stores.find(s => s.store_id === profile.default_store_id) || null
        }

        // Fall back to getDefaultStore logic
        if (!currentStore) {
          currentStore = getDefaultStore(stores)
        }

        // Determine role - prefer current store role, fall back to legacy profile.role
        const currentRole = currentStore
          ? currentStore.role
          : normalizeRole(profile.role)

        const newState: AuthState = {
          user,
          profile,
          stores,
          currentStore,
          role: currentRole,
          storeId: currentStore?.store_id || profile.store_id,
          isLoading: false,
          hasGlobalAccess: checkGlobalAccess(currentRole),
          isStoreScopedRole: checkStoreScopedRole(currentRole),
          isPlatformAdmin: profile.is_platform_admin || false,
        }
        setAuthState(newState)
      } else {
        const newState: AuthState = {
          user,
          profile: null,
          stores: [],
          currentStore: null,
          role: null,
          storeId: null,
          isLoading: false,
          hasGlobalAccess: false,
          isStoreScopedRole: false,
          isPlatformAdmin: false,
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
            stores: [],
            currentStore: null,
            role: null,
            storeId: null,
            isLoading: false,
            hasGlobalAccess: false,
            isStoreScopedRole: false,
            isPlatformAdmin: false,
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
            stores: [],
            currentStore: null,
            role: null,
            storeId: null,
            isLoading: false,
            hasGlobalAccess: false,
            isStoreScopedRole: false,
            isPlatformAdmin: false,
          }
          setAuthState(newState)
          globalAuthState = null
          // Clear saved store selection
          if (typeof window !== 'undefined') {
            localStorage.removeItem(CURRENT_STORE_KEY)
          }
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

  // Switch current store context
  const setCurrentStore = useCallback((storeId: string) => {
    const newStore = authState.stores.find(s => s.store_id === storeId)
    if (!newStore) return

    // Persist selection to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(CURRENT_STORE_KEY, storeId)
    }

    // Update state with new store context
    setAuthState(prev => ({
      ...prev,
      currentStore: newStore,
      role: newStore.role,
      storeId: newStore.store_id,
      hasGlobalAccess: checkGlobalAccess(newStore.role),
      isStoreScopedRole: checkStoreScopedRole(newStore.role),
    }))
  }, [authState.stores])

  // Compute permission flags for current store context
  const canManageCurrentStore = authState.currentStore
    ? canManageStore(authState.stores, authState.currentStore.store_id)
    : false

  const canManageUsersAtCurrentStore = authState.currentStore
    ? canManageUsersAtStore(authState.stores, authState.currentStore.store_id)
    : false

  const isMultiStoreUser = authState.stores.length > 1 ||
    authState.stores.some(s => isMultiStoreRole(s.role))

  const value: AuthContextValue = {
    ...authState,
    signOut,
    refreshProfile,
    setCurrentStore,
    canManageCurrentStore,
    canManageUsersAtCurrentStore,
    isMultiStoreUser,
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
