'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type FilterValue = string | number | boolean | null | undefined

interface UseUrlFiltersOptions<T extends Record<string, FilterValue>> {
  defaults: T
  /** Debounce delay in ms for search inputs (default: 0, no debounce) */
  debounceMs?: number
}

/**
 * Hook for managing filter state in URL search params
 * Provides persistence across refreshes and shareable URLs
 */
export function useUrlFilters<T extends Record<string, FilterValue>>(
  options: UseUrlFiltersOptions<T>
) {
  const { defaults } = options
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse current filters from URL
  const filters = useMemo(() => {
    const result = { ...defaults }

    for (const key of Object.keys(defaults)) {
      const urlValue = searchParams.get(key)
      if (urlValue !== null) {
        const defaultValue = defaults[key]

        // Type-aware parsing
        if (typeof defaultValue === 'number') {
          const parsed = parseInt(urlValue, 10)
          if (!isNaN(parsed)) {
            (result as Record<string, FilterValue>)[key] = parsed
          }
        } else if (typeof defaultValue === 'boolean') {
          (result as Record<string, FilterValue>)[key] = urlValue === 'true'
        } else {
          (result as Record<string, FilterValue>)[key] = urlValue
        }
      }
    }

    return result as T
  }, [searchParams, defaults])

  // Update a single filter
  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const params = new URLSearchParams(searchParams.toString())

      // Remove param if it's the default value or empty
      const defaultValue = defaults[key]
      if (
        value === defaultValue ||
        value === '' ||
        value === null ||
        value === undefined
      ) {
        params.delete(key as string)
      } else {
        params.set(key as string, String(value))
      }

      // Reset page to 1 when other filters change (except page itself)
      if (key !== 'page' && params.has('page')) {
        params.delete('page')
      }

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    },
    [searchParams, pathname, router, defaults]
  )

  // Update multiple filters at once
  const setFilters = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString())

      let pageReset = false

      for (const [key, value] of Object.entries(updates)) {
        const defaultValue = defaults[key as keyof T]
        if (
          value === defaultValue ||
          value === '' ||
          value === null ||
          value === undefined
        ) {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }

        if (key !== 'page') {
          pageReset = true
        }
      }

      // Reset page when other filters change
      if (pageReset && params.has('page') && !('page' in updates)) {
        params.delete('page')
      }

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    },
    [searchParams, pathname, router, defaults]
  )

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false })
  }, [pathname, router])

  // Check if any non-default filters are active
  const hasActiveFilters = useMemo(() => {
    for (const key of Object.keys(defaults)) {
      const currentValue = filters[key as keyof T]
      const defaultValue = defaults[key as keyof T]
      if (currentValue !== defaultValue) {
        return true
      }
    }
    return false
  }, [filters, defaults])

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    hasActiveFilters,
  }
}
