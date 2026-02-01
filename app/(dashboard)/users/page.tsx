'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useUsers, UsersFilters } from '@/hooks/useUsers'
import { useStores } from '@/hooks/useStores'
import { usePendingInvites } from '@/hooks/usePendingInvites'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { UsersTable } from '@/components/tables/UsersTable'
import { PendingInvitesTable } from '@/components/tables/PendingInvitesTable'
import { InviteUserForm } from '@/components/forms/InviteUserForm'
import { UserForm } from '@/components/forms/UserForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeaderSkeleton, UsersTableSkeleton } from '@/components/ui/skeletons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Profile, AppRole, UserStatus } from '@/types'
import { InviteUserFormData, UpdateUserFormData } from '@/lib/validations/user'
import { ROLES } from '@/lib/constants'
import { Plus, Search, ChevronLeft, ChevronRight, ChevronDown, Mail } from 'lucide-react'
import { toast } from 'sonner'

const FILTER_DEFAULTS = {
  search: '',
  role: 'all',
  status: 'all',
  storeId: 'all',
  page: 1,
}

function UsersPageContent() {
  const { currentStore, role: currentUserRole } = useAuth()
  const { stores, isLoading: storesLoading } = useStores()
  const { invites: pendingInvites, cancelInvite, resendInvite, refetch: refetchInvites } = usePendingInvites()
  const [pendingInvitesOpen, setPendingInvitesOpen] = useState(true)

  // URL-based filter state
  const { filters, setFilter } = useUrlFilters({ defaults: FILTER_DEFAULTS })

  // Local search input for immediate feedback
  const [searchInput, setSearchInput] = useState(filters.search)

  // Sync search input when URL changes
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
  const usersFilters: UsersFilters = {
    search: filters.search,
    role: filters.role as AppRole | 'all',
    status: filters.status as UserStatus | 'all',
    storeId: filters.storeId as string | 'all',
    page: filters.page,
  }

  const {
    users,
    totalCount,
    totalPages,
    isLoading,
    updateUser,
    deactivateUser,
    activateUser,
    refetch
  } = useUsers(usersFilters)

  // Form state
  const [inviteFormOpen, setInviteFormOpen] = useState(false)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleInvite = async (data: InviteUserFormData) => {
    setIsInviting(true)
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send invitation')
      }

      toast.success(`Invitation sent to ${data.email}`)
      setInviteFormOpen(false)
      refetch()
      refetchInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleEdit = (user: Profile) => {
    setEditUser(user)
    setEditFormOpen(true)
  }

  const handleUpdate = async (data: UpdateUserFormData) => {
    if (!editUser) return

    setIsUpdating(true)
    try {
      await updateUser({
        id: editUser.id,
        data: {
          full_name: data.fullName,
          role: data.role,
          store_id: data.storeId,
          store_ids: data.storeIds, // For Driver role - multiple stores
          status: data.status,
        },
      })

      setEditFormOpen(false)
      setEditUser(null)
    } catch {
      // Error handled by hook
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeactivate = (user: Profile) => {
    deactivateUser(user.id)
  }

  const handleActivate = (user: Profile) => {
    activateUser(user.id)
  }

  if (isLoading || storesLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <UsersTableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={() => setInviteFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.role}
          onValueChange={(value) => setFilter('role', value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) => setFilter('status', value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Invited">Invited</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.storeId}
          onValueChange={(value) => setFilter('storeId', value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.filter(s => s.is_active).map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <Collapsible open={pendingInvitesOpen} onOpenChange={setPendingInvitesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Pending Invitations</span>
                <Badge variant="secondary" className="ml-1">
                  {pendingInvites.length}
                </Badge>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${pendingInvitesOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <PendingInvitesTable
              invites={pendingInvites}
              onCancel={cancelInvite}
              onResend={async (invite) => { await resendInvite(invite.id) }}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      <UsersTable
        users={users}
        selectedStoreId={filters.storeId !== 'all' ? filters.storeId : undefined}
        onInvite={() => setInviteFormOpen(true)}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onActivate={handleActivate}
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {users.length} of {totalCount} users
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

      <InviteUserForm
        open={inviteFormOpen}
        onOpenChange={setInviteFormOpen}
        stores={stores}
        onSubmit={handleInvite}
        isLoading={isInviting}
        inviterRole={(currentStore?.role || currentUserRole || 'Owner') as AppRole}
      />

      <UserForm
        open={editFormOpen}
        onOpenChange={(open) => {
          setEditFormOpen(open)
          if (!open) setEditUser(null)
        }}
        user={editUser}
        stores={stores}
        onSubmit={handleUpdate}
        isLoading={isUpdating}
      />

    </div>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <UsersTableSkeleton rows={8} />
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  )
}
