'use client'

/**
 * AuthProvider - Global Authentication State Management
 *
 * Simplified version that relies on Supabase's onAuthStateChange
 * and getSession() for reliable auth state management.
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient, supabaseFetch } from '@/lib/supabase/client'
import { Profile, AppRole, StoreUserWithStore } from '@/types'
import { debugLog } from '@/lib/debug'
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/utils/storage'
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
  const [authState, setAuthState] = useState<AuthState>({
    ...emptyState,
    isLoading: true,
  })

  const supabase = useMemo(() => createClient(), [])

  // Race condition prevention: Track latest request ID
  const latestRequestIdRef = useRef(0)

  // Prevent concurrent refreshProfile calls
  const refreshInProgressRef = useRef(false)

  // Track intentional sign-out to prevent flash of content
  const isSigningOutRef = useRef(false)

  // Fetch profile and stores for a user
  // Accepts partial user (just id) for cookie-based auth, or full User from Supabase
  // Returns null if request was cancelled (not latest)
  const fetchUserData = useCallback(async (
    user: User | { id: string; email?: string },
    requestId: number
  ): Promise<{ data: AuthState; requestId: number } | null> => {
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

      // Check if this request is still the latest
      if (requestId !== latestRequestIdRef.current) {
        debugLog("AuthProvider", `[AuthProvider] Request ${requestId} cancelled (latest: ${latestRequestIdRef.current})`)
        return null
      }

      if (profileResult.error) {
        console.error('[AuthProvider] Profile fetch error:', profileResult.error)
        return { data: emptyState, requestId }
      }

      const profile = profileResult.data?.[0] || null
      const stores: StoreUserWithStore[] = (storesResult.data || []).filter(
        (s): s is StoreUserWithStore => s.store !== null && s.store !== undefined
      )

      if (!profile) {
        return { data: emptyState, requestId }
      }

      // Determine current store
      let currentStore: StoreUserWithStore | null = null
      const savedStoreId = typeof window !== 'undefined'
        ? safeGetItem(CURRENT_STORE_KEY)
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
        data: {
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
        },
        requestId,
      }
    } catch (error) {
      console.error('[AuthProvider] Error fetching user data:', error)
      return { data: emptyState, requestId }
    }
  }, [])

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      // Get a new request ID for this initialization
      const requestId = ++latestRequestIdRef.current
      debugLog('AuthProvider', `initAuth (request ${requestId})`)

      try {
        const { getUserFromCookies } = await import('@/lib/supabase/client')
        const cookieUser = getUserFromCookies()

        if (cookieUser) {
          debugLog('AuthProvider', `Cookie user found: ${cookieUser.id}`)
          const result = await fetchUserData({ id: cookieUser.id, email: cookieUser.email }, requestId)

          // Check if this request is still valid
          if (result && mounted && result.requestId === latestRequestIdRef.current) {
            setAuthState(result.data)
          }

          // Background getSession to sync Supabase client and update with full User object
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted && session?.user && requestId === latestRequestIdRef.current) {
              // Update with the full User object from Supabase
              setAuthState(prev => ({ ...prev, user: session.user }))
            }
          })
          return
        }

        // No cookie user — fall back to getSession (e.g. OAuth callback)
        debugLog('AuthProvider', 'No cookie user, calling getSession')
        const { data: { session }, error } = await supabase.auth.getSession()

        if (requestId !== latestRequestIdRef.current) return

        if (error) {
          console.error('[AuthProvider] getSession error:', error)
          if (mounted) setAuthState(emptyState)
          return
        }

        if (session?.user) {
          const result = await fetchUserData(session.user, requestId)

          // Check if this request is still valid
          if (result && mounted && result.requestId === latestRequestIdRef.current) {
            setAuthState(result.data)
          }
        } else {
          if (mounted && requestId === latestRequestIdRef.current) {
            setAuthState(emptyState)
          }
        }
      } catch (error) {
        console.error('[AuthProvider] Init error:', error)
        if (mounted && requestId === latestRequestIdRef.current) {
          setAuthState(emptyState)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    // IMPORTANT: Only increment latestRequestIdRef for events we actually handle.
    // Unhandled events (like INITIAL_SESSION) must NOT invalidate in-flight initAuth() requests.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog('AuthProvider', `Auth event: ${event}`)

        if (event === 'SIGNED_IN' && session?.user) {
          const requestId = ++latestRequestIdRef.current
          const result = await fetchUserData(session.user, requestId)
          if (result && mounted && result.requestId === latestRequestIdRef.current) {
            setAuthState(result.data)
          }
        } else if (event === 'SIGNED_OUT') {
          const requestId = ++latestRequestIdRef.current
          if (typeof window !== 'undefined') {
            safeRemoveItem(CURRENT_STORE_KEY)
          }
          if (mounted && requestId === latestRequestIdRef.current) {
            // If we're deliberately signing out, keep isLoading true
            // to prevent flash of unauthenticated content before redirect
            if (isSigningOutRef.current) {
              setAuthState({ ...emptyState, isLoading: true })
            } else {
              setAuthState(emptyState)
            }
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Just update the user object, don't re-fetch everything
          if (mounted) {
            setAuthState(prev => ({ ...prev, user: session.user }))
          }
        }
        // INITIAL_SESSION and other events are intentionally ignored here -
        // initAuth() already handles the initial session load.
      }
    )

    // Handle visibility change - re-check auth when tab becomes visible
    // This works around browser throttling of background events
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initAuth()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cross-tab sync: when another tab changes the current store, update this tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CURRENT_STORE_KEY && e.newValue) {
        setAuthState(prev => {
          const newStore = prev.stores.find(s => s.store_id === e.newValue)
          if (!newStore) return prev
          return {
            ...prev,
            currentStore: newStore,
            role: newStore.role,
            storeId: newStore.store_id,
            hasGlobalAccess: checkGlobalAccess(newStore.role),
            isStoreScopedRole: checkStoreScopedRole(newStore.role),
          }
        })
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [supabase, fetchUserData])

  const signOut = useCallback(async () => {
    // Mark as intentional sign-out to prevent flash of content
    isSigningOutRef.current = true

    ++latestRequestIdRef.current

    // Set loading to prevent flash of content
    setAuthState(prev => ({ ...prev, isLoading: true }))

    // Clear stored selection
    if (typeof window !== 'undefined') {
      safeRemoveItem(CURRENT_STORE_KEY)
    }

    // Sign out and redirect
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (refreshInProgressRef.current) return

    if (!authState.user) {
      return
    }

    try {
      refreshInProgressRef.current = true
      const requestId = ++latestRequestIdRef.current
      const result = await fetchUserData(authState.user, requestId)

      if (result && result.requestId === latestRequestIdRef.current) {
        setAuthState(result.data)
      }
    } finally {
      refreshInProgressRef.current = false
    }
  }, [authState.user, fetchUserData])

  const setCurrentStore = useCallback((storeId: string) => {
    const newStore = authState.stores.find(s => s.store_id === storeId)
    if (!newStore) return

    if (typeof window !== 'undefined') {
      safeSetItem(CURRENT_STORE_KEY, storeId)
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

  const canManageCurrentStore = useMemo(
    () => authState.currentStore
      ? canManageStore(authState.stores, authState.currentStore.store_id)
      : false,
    [authState.currentStore, authState.stores]
  )

  const canManageUsersAtCurrentStore = useMemo(
    () => authState.currentStore
      ? canManageUsersAtStore(authState.stores, authState.currentStore.store_id)
      : false,
    [authState.currentStore, authState.stores]
  )

  const isMultiStoreUser = useMemo(
    () => authState.stores.length > 1 ||
      authState.stores.some(s => isMultiStoreRole(s.role)),
    [authState.stores]
  )

  const value = useMemo<AuthContextValue>(() => ({
    ...authState,
    signOut,
    refreshProfile,
    setCurrentStore,
    canManageCurrentStore,
    canManageUsersAtCurrentStore,
    isMultiStoreUser,
  }), [
    authState, signOut, refreshProfile, setCurrentStore,
    canManageCurrentStore, canManageUsersAtCurrentStore, isMultiStoreUser,
  ])

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
