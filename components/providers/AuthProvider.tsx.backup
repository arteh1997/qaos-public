'use client'

/**
 * AuthProvider - Global Authentication State Management
 *
 * Simplified version that relies on Supabase's onAuthStateChange
 * and getSession() for reliable auth state management.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient, supabaseFetch } from '@/lib/supabase/client'
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
  stores: StoreUserWithStore[]
  currentStore: StoreUserWithStore | null
  role: AppRole | null
  storeId: string | null
  isLoading: boolean
  hasGlobalAccess: boolean
  isStoreScopedRole: boolean
  isPlatformAdmin: boolean
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setCurrentStore: (storeId: string) => void
  canManageCurrentStore: boolean
  canManageUsersAtCurrentStore: boolean
  isMultiStoreUser: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const CURRENT_STORE_KEY = 'restaurant-inventory-current-store'

const emptyState: AuthState = {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  console.log('[AuthProvider] RENDER - component is rendering')

  const [authState, setAuthState] = useState<AuthState>({
    ...emptyState,
    isLoading: true,
  })

  const supabase = createClient()

  // Fetch profile and stores for a user
  // Accepts partial user (just id) for cookie-based auth, or full User from Supabase
  const fetchUserData = useCallback(async (user: User | { id: string; email?: string }): Promise<AuthState> => {
    try {
      const [profileResult, storesResult] = await Promise.all([
        supabaseFetch<Profile>('profiles', {
          filter: { id: `eq.${user.id}` },
        }),
        supabaseFetch<StoreUserWithStore>('store_users', {
          filter: { user_id: `eq.${user.id}` },
          select: '*, store:stores(*)',
        }),
      ])

      if (profileResult.error) {
        console.error('[AuthProvider] Profile fetch error:', profileResult.error)
        return { ...emptyState, user: user as User }
      }

      const profile = profileResult.data?.[0] || null
      const stores: StoreUserWithStore[] = (storesResult.data || []).filter(
        (s): s is StoreUserWithStore => s.store !== null && s.store !== undefined
      )

      if (!profile) {
        return { ...emptyState, user: user as User }
      }

      // Determine current store
      let currentStore: StoreUserWithStore | null = null
      const savedStoreId = typeof window !== 'undefined'
        ? localStorage.getItem(CURRENT_STORE_KEY)
        : null

      if (savedStoreId) {
        currentStore = stores.find(s => s.store_id === savedStoreId) || null
      }
      if (!currentStore && profile.default_store_id) {
        currentStore = stores.find(s => s.store_id === profile.default_store_id) || null
      }
      if (!currentStore) {
        currentStore = getDefaultStore(stores)
      }

      const currentRole = currentStore ? currentStore.role : normalizeRole(profile.role)

      return {
        user: user as User,
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
    } catch (error) {
      console.error('[AuthProvider] Error fetching user data:', error)
      return { ...emptyState, user: user as User }
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      console.log('[AuthProvider] 1. initAuth started')
      console.log('[AuthProvider] 2. document.visibilityState:', document.visibilityState)

      try {
        // First, try to get user from cookies (instant, no network)
        // This bypasses the potentially hanging getSession() call
        const { getUserFromCookies } = await import('@/lib/supabase/client')
        const cookieUser = getUserFromCookies()
        console.log('[AuthProvider] 3. Cookie user:', cookieUser ? cookieUser.id : 'null')

        if (cookieUser) {
          // We have a valid JWT in cookies - fetch user data directly
          console.log('[AuthProvider] 4. Fetching user data from cookie user...')
          const userData = await fetchUserData({ id: cookieUser.id, email: cookieUser.email })
          console.log('[AuthProvider] 5. User data fetched')
          if (mounted) setAuthState(userData)

          // Also call getSession in background to ensure Supabase client is synced
          // and update with full User object when it completes
          supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[AuthProvider] 6. Background getSession completed, session:', session ? 'exists' : 'null')
            if (mounted && session?.user) {
              // Update with the full User object from Supabase
              setAuthState(prev => ({ ...prev, user: session.user }))
            }
          })
          return
        }

        // No cookie user - try getSession (for cases like OAuth callback)
        console.log('[AuthProvider] 4. No cookie user, calling getSession...')
        const startTime = Date.now()
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('[AuthProvider] 5. getSession returned after', Date.now() - startTime, 'ms')
        console.log('[AuthProvider] 6. session:', session ? 'exists' : 'null', 'error:', error)

        if (error) {
          console.error('[AuthProvider] getSession error:', error)
          if (mounted) setAuthState(emptyState)
          return
        }

        if (session?.user) {
          console.log('[AuthProvider] 7. User found, fetching user data...')
          const userData = await fetchUserData(session.user)
          console.log('[AuthProvider] 8. User data fetched')
          if (mounted) setAuthState(userData)
        } else {
          console.log('[AuthProvider] 7. No session, setting empty state')
          if (mounted) setAuthState(emptyState)
        }
      } catch (error) {
        console.error('[AuthProvider] Init error:', error)
        if (mounted) setAuthState(emptyState)
      }
    }

    console.log('[AuthProvider] 0. useEffect running, calling initAuth')
    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event)

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await fetchUserData(session.user)
          if (mounted) setAuthState(userData)
        } else if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(CURRENT_STORE_KEY)
          }
          if (mounted) setAuthState(emptyState)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Just update the user object, don't re-fetch everything
          if (mounted) {
            setAuthState(prev => ({ ...prev, user: session.user }))
          }
        }
      }
    )

    // Handle visibility change - re-check auth when tab becomes visible
    // This works around browser throttling of background events
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AuthProvider] Tab became visible, re-checking auth...')
        initAuth()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supabase, fetchUserData])

  const signOut = useCallback(async () => {
    // Set loading to prevent flash of content
    setAuthState(prev => ({ ...prev, isLoading: true }))

    // Clear stored selection
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CURRENT_STORE_KEY)
    }

    // Sign out and redirect
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (authState.user) {
      const userData = await fetchUserData(authState.user)
      setAuthState(userData)
    }
  }, [authState.user, fetchUserData])

  const setCurrentStore = useCallback((storeId: string) => {
    const newStore = authState.stores.find(s => s.store_id === storeId)
    if (!newStore) return

    if (typeof window !== 'undefined') {
      localStorage.setItem(CURRENT_STORE_KEY, storeId)
    }

    setAuthState(prev => ({
      ...prev,
      currentStore: newStore,
      role: newStore.role,
      storeId: newStore.store_id,
      hasGlobalAccess: checkGlobalAccess(newStore.role),
      isStoreScopedRole: checkStoreScopedRole(newStore.role),
    }))
  }, [authState.stores])

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
