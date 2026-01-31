'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStores, StoresFilters } from '@/hooks/useStores'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { StoresTable } from '@/components/tables/StoresTable'
import { StoreForm } from '@/components/forms/StoreForm'
import { StoreCard } from '@/components/cards/StoreCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeaderSkeleton, StoreCardsGridSkeleton, StoreCardSkeleton } from '@/components/ui/skeletons'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Store } from '@/types'
import { StoreFormData } from '@/lib/validations/store'
import { canManageStores } from '@/lib/auth'
import { Plus, Search, LayoutGrid, List, ChevronLeft, ChevronRight, Store as StoreIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useRouter } from 'next/navigation'

const FILTER_DEFAULTS = {
  search: '',
  view: 'grid' as 'grid' | 'list',
  page: 1,
}

function StoresPageContent() {
  const { role, storeId: userStoreId, isStoreScopedRole } = useAuth()
  const router = useRouter()

  // URL-based filter state
  const { filters, setFilter } = useUrlFilters({ defaults: FILTER_DEFAULTS })

  // Local search input for immediate feedback (synced with URL on change)
  const [searchInput, setSearchInput] = useState(filters.search)

  // Sync search input when URL changes (e.g., back/forward navigation)
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  // Debounce search updates to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilter('search', searchInput)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.search, setFilter])

  // Build filters for the hook
  const storesFilters: StoresFilters = {
    search: filters.search,
    status: 'all',
    page: filters.page,
  }

  const {
    stores,
    totalCount,
    totalPages,
    isLoading,
    createStore,
    updateStore,
    deleteStore
  } = useStores(storesFilters)

  const [formOpen, setFormOpen] = useState(false)
  const [editStore, setEditStore] = useState<Store | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canManage = canManageStores(role)

  // Filter stores for staff (they can only see their own store)
  const displayStores = isStoreScopedRole
    ? stores.filter(store => store.id === userStoreId)
    : stores

  // For Staff, redirect to their store directly
  useEffect(() => {
    if (isStoreScopedRole && userStoreId && displayStores.length === 1) {
      router.replace(`/stores/${userStoreId}`)
    }
  }, [isStoreScopedRole, userStoreId, displayStores.length, router])

  // Show loading while redirecting staff to their store
  if (isStoreScopedRole && userStoreId && displayStores.length === 1) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton showButton={false} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StoreCardSkeleton />
        </div>
      </div>
    )
  }

  const handleSubmit = async (data: StoreFormData) => {
    setIsSubmitting(true)
    try {
      if (editStore) {
        await updateStore({ id: editStore.id, data })
      } else {
        await createStore(data)
      }
      setFormOpen(false)
      setEditStore(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (store: Store) => {
    setEditStore(store)
    setFormOpen(true)
  }

  const handleDelete = (store: Store) => {
    deleteStore(store.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton showButton={canManage} />
        <StoreCardsGridSkeleton count={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stores</h1>
          <p className="text-muted-foreground">
            {canManage
              ? 'Manage your restaurant locations'
              : 'View restaurant locations'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Store
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs
          value={filters.view}
          onValueChange={(v) => setFilter('view', v as 'grid' | 'list')}
        >
          <TabsList>
            <TabsTrigger value="grid">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filters.view === 'grid' ? (
        displayStores.length === 0 ? (
          <EmptyState
            icon={StoreIcon}
            title="No stores found"
            description={canManage
              ? "Get started by adding your first store location."
              : "No store locations have been added yet."
            }
            action={canManage ? {
              label: "Add Store",
              onClick: () => setFormOpen(true),
              icon: Plus,
            } : undefined}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayStores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )
      ) : (
        <StoresTable
          stores={displayStores}
          canManage={canManage}
          onAdd={() => setFormOpen(true)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && !isStoreScopedRole && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {displayStores.length} of {totalCount} stores
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter('page', Math.max(1, filters.page - 1))}
              disabled={filters.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {filters.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter('page', Math.min(totalPages, filters.page + 1))}
              disabled={filters.page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <StoreForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditStore(null)
        }}
        store={editStore}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}

export default function StoresPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <StoreCardsGridSkeleton count={6} />
      </div>
    }>
      <StoresPageContent />
    </Suspense>
  )
}
