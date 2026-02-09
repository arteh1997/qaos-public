'use client'

import { Suspense, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useUsers, UsersFilters } from '@/hooks/useUsers'
import { useStores } from '@/hooks/useStores'
import { useShifts } from '@/hooks/useShifts'
import { usePendingInvites } from '@/hooks/usePendingInvites'
import { InviteUserForm } from '@/components/forms/InviteUserForm'
import { UserForm } from '@/components/forms/UserForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeaderSkeleton, UsersTableSkeleton } from '@/components/ui/skeletons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Profile, AppRole, UserStatus } from '@/types'
import { InviteUserFormData, UpdateUserFormData } from '@/lib/validations/user'
import { Plus, Search, Mail, Users, Phone, Calendar, Edit, Clock, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Link from 'next/link'

// Store user entry with store name for display
type StoreUserWithStore = {
  store_id: string
  role: AppRole
  is_billing_owner: boolean
  store: { id: string; name: string } | null
}

type UserWithStore = Profile & {
  store?: { id: string; name: string } | null
  store_users?: StoreUserWithStore[]
}

function UsersPageContent() {
  const { currentStore, role: currentUserRole } = useAuth()
  const currentStoreId = currentStore?.store_id
  const { stores, isLoading: storesLoading } = useStores()
  const { shifts, isLoading: shiftsLoading } = useShifts(currentStoreId || null)
  const { invites: pendingInvites, cancelInvite, resendInvite, refetch: refetchInvites } = usePendingInvites()
  const [pendingInvitesOpen, setPendingInvitesOpen] = useState(true)

  // Simple local filters
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all')

  // Build filters for the hook - always filter by current store
  const usersFilters: UsersFilters = {
    search: searchInput,
    role: 'all',
    status: 'all',
    storeId: currentStoreId || 'all',
    page: 1,
  }

  const {
    users,
    isLoading,
    updateUser,
    deleteUser,
    refetch
  } = useUsers(usersFilters)

  // Form state
  const [inviteFormOpen, setInviteFormOpen] = useState(false)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Calculate who's on shift now
  const activeShifts = useMemo(() => {
    const now = new Date()
    return shifts.filter(shift => {
      const start = new Date(shift.start_time)
      const end = new Date(shift.end_time)
      return now >= start && now <= end
    })
  }, [shifts])

  // Users currently on shift
  const usersOnShift = useMemo(() => {
    const onShiftUserIds = new Set(activeShifts.map(s => s.user_id))
    return users.filter(u => onShiftUserIds.has(u.id))
  }, [users, activeShifts])

  // Get display role for a user at the current store
  const getDisplayRole = useCallback((user: UserWithStore): string => {
    if (!currentStoreId || !user.store_users) return user.role

    // Find the user's membership at the current store
    const storeUserEntry = user.store_users.find(su => su.store_id === currentStoreId)

    if (storeUserEntry) {
      if (storeUserEntry.role === 'Owner') {
        return storeUserEntry.is_billing_owner ? 'Owner' : 'Co-Owner'
      }
      return storeUserEntry.role
    }

    return user.role
  }, [currentStoreId])

  // Filter and group users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(u => u.status === 'Active')

    // Apply search
    if (searchInput) {
      const search = searchInput.toLowerCase()
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      )
    }

    // Apply role filter (using display role from store_users)
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => getDisplayRole(u as UserWithStore) === roleFilter)
    }

    return filtered
  }, [users, searchInput, roleFilter, getDisplayRole])

  // Group by role (using display role from store_users)
  const groupedByRole = useMemo(() => {
    const groups: Record<string, UserWithStore[]> = {
      Owner: [],
      'Co-Owner': [],
      Manager: [],
      Staff: [],
      Driver: [],
    }

    filteredUsers.forEach(user => {
      const displayRole = getDisplayRole(user)
      if (displayRole in groups) {
        groups[displayRole].push(user as UserWithStore)
      }
    })

    return groups
  }, [filteredUsers, currentStoreId])

  // Team stats
  const stats = useMemo(() => {
    const activeUsers = users.filter(u => u.status === 'Active')
    const scheduledToday = new Set(
      shifts
        .filter(s => {
          const start = new Date(s.start_time)
          const today = new Date()
          return start.toDateString() === today.toDateString()
        })
        .map(s => s.user_id)
    )

    return {
      total: activeUsers.length,
      active: activeUsers.length,
      onShiftNow: usersOnShift.length,
      scheduledToday: scheduledToday.size,
    }
  }, [users, shifts, usersOnShift])

  // Role counts for filter buttons (using display role from store_users)
  const roleCounts = useMemo(() => {
    const activeUsers = users.filter(u => u.status === 'Active')
    return {
      all: activeUsers.length,
      Owner: activeUsers.filter(u => getDisplayRole(u as UserWithStore) === 'Owner').length,
      Manager: activeUsers.filter(u => getDisplayRole(u as UserWithStore) === 'Manager').length,
      Staff: activeUsers.filter(u => getDisplayRole(u as UserWithStore) === 'Staff').length,
      Driver: activeUsers.filter(u => getDisplayRole(u as UserWithStore) === 'Driver').length,
    }
  }, [users, currentStoreId])

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

  const handleDelete = (user: Profile) => {
    if (currentStoreId) {
      deleteUser(user.id, currentStoreId)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      Owner: 'bg-amber-500 text-white',
      'Co-Owner': 'bg-amber-400 text-white',
      Manager: 'bg-blue-500 text-white',
      Staff: 'bg-green-500 text-white',
      Driver: 'bg-purple-500 text-white',
    }
    return colors[role] || 'bg-gray-500 text-white'
  }

  if (isLoading || storesLoading || shiftsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <PageHeaderSkeleton />
        <UsersTableSkeleton rows={8} />
      </div>
    )
  }

  // No store selected - prompt user to select one
  if (!currentStore) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please select a store from the sidebar to view your team.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team at {currentStore.store?.name}
          </p>
        </div>
        <Button onClick={() => setInviteFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Invite Team Member</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </div>

      {/* On Shift Now - Only show if someone is working */}
      {usersOnShift.length > 0 && (
        <Card className="border-blue-500 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-blue-900">
                On Shift Now ({usersOnShift.length} {usersOnShift.length === 1 ? 'person' : 'people'})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {usersOnShift.map(user => {
              const shift = activeShifts.find(s => s.user_id === user.id)
              if (!shift) return null

              return (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 border-2 border-blue-500">
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user.full_name || user.email}</p>
                        <Badge className={`text-xs ${getRoleBadgeColor(getDisplayRole(user))}`}>
                          {getDisplayRole(user)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Clocked in at {format(new Date(shift.start_time), 'h:mm a')} • Ends at {format(new Date(shift.end_time), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white"
                        onClick={() => window.open(`tel:${user.phone}`, '_self')}
                      >
                        <Phone className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Call</span>
                      </Button>
                    )}
                    <Link href={`/shifts?user=${user.id}`}>
                      <Button variant="outline" size="sm" className="bg-white">
                        <Calendar className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Schedule</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Team Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Active members</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Shift Now</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{stats.onShiftNow}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently working</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{stats.scheduledToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Shifts today</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{pendingInvites.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting acceptance</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <Collapsible open={pendingInvitesOpen} onOpenChange={setPendingInvitesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-muted/50 bg-white">
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
            <div className="space-y-2 border rounded-lg p-4 bg-white">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited as {invite.role} • {format(new Date(invite.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendInvite(invite.id)}
                      className="bg-white"
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvite(invite.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('all')}
            size="sm"
            className={roleFilter !== 'all' ? 'bg-white' : ''}
          >
            All ({roleCounts.all})
          </Button>
          <Button
            variant={roleFilter === 'Manager' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('Manager')}
            size="sm"
            className={roleFilter !== 'Manager' ? 'bg-white' : ''}
          >
            💼 Managers ({roleCounts.Manager})
          </Button>
          <Button
            variant={roleFilter === 'Staff' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('Staff')}
            size="sm"
            className={roleFilter !== 'Staff' ? 'bg-white' : ''}
          >
            👤 Staff ({roleCounts.Staff})
          </Button>
          <Button
            variant={roleFilter === 'Driver' ? 'default' : 'outline'}
            onClick={() => setRoleFilter('Driver')}
            size="sm"
            className={roleFilter !== 'Driver' ? 'bg-white' : ''}
          >
            🚗 Drivers ({roleCounts.Driver})
          </Button>
        </div>
      </div>

      {/* Team Members Grouped by Role */}
      <div className="space-y-6">
        {(['Owner', 'Co-Owner', 'Manager', 'Staff', 'Driver'] as string[]).map(role => {
          const roleUsers = groupedByRole[role]
          if (roleUsers.length === 0) return null

          const roleLabel = role === 'Owner' ? '👑 Owners' :
                           role === 'Co-Owner' ? '👑 Co-Owners' :
                           role === 'Manager' ? '💼 Managers' :
                           role === 'Staff' ? '👤 Staff' : '🚗 Drivers'

          return (
            <div key={role} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {roleLabel} ({roleUsers.length})
              </h2>
              <div className="grid gap-3">
                {roleUsers.map(user => {
                  const userShift = activeShifts.find(s => s.user_id === user.id)
                  const isOnShift = !!userShift

                  return (
                    <Card key={user.id} className={`bg-white ${isOnShift ? 'border-blue-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className={`${getRoleBadgeColor(getDisplayRole(user))} font-semibold`}>
                                {getInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{user.full_name || 'No name'}</h3>
                                <Badge className={`text-xs ${getRoleBadgeColor(getDisplayRole(user))}`}>
                                  {getDisplayRole(user)}
                                </Badge>
                                {isOnShift && (
                                  <Badge className="text-xs bg-blue-500 text-white">
                                    On Shift
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                {user.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    <span>{user.phone}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{user.email}</span>
                                </div>
                              </div>
                              {isOnShift && userShift && (
                                <p className="text-xs text-blue-600 font-medium mt-2">
                                  Shift ends at {format(new Date(userShift.end_time), 'h:mm a')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                            {user.phone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white w-full sm:w-auto"
                                onClick={() => window.open(`tel:${user.phone}`, '_self')}
                              >
                                <Phone className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Call</span>
                              </Button>
                            )}
                            <Link href={`/shifts?user=${user.id}`}>
                              <Button variant="outline" size="sm" className="bg-white w-full sm:w-auto">
                                <Calendar className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Schedule</span>
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="bg-white w-full sm:w-auto"
                            >
                              <Edit className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No team members found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchInput ? 'Try adjusting your search or filters.' : 'Get started by inviting your first team member.'}
            </p>
            {!searchInput && (
              <Button onClick={() => setInviteFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Invite Team Member
              </Button>
            )}
          </CardContent>
        </Card>
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
        onSubmit={handleUpdate}
        isLoading={isUpdating}
      />
    </div>
  )
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <PageHeaderSkeleton />
        <UsersTableSkeleton rows={8} />
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  )
}
