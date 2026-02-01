'use client'

import React, { useState, useMemo, useCallback, memo } from 'react'
import { Profile, StoreUser } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { MoreHorizontal, Edit, UserX, UserCheck, Users, UserPlus, ArrowUp, ArrowDown } from 'lucide-react'
import { UsersTableSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'

// Store user entry with store name for display
type StoreUserWithStore = Pick<StoreUser, 'store_id' | 'role' | 'is_billing_owner'> & {
  store: { id: string; name: string } | null
}

type UserWithStore = Profile & {
  store?: { id: string; name: string } | null
  store_users?: StoreUserWithStore[]
}

/**
 * Get the display role for a user relative to a specific store (if selected)
 * - If selectedStoreId is provided, find the user's role at THAT store
 *   - If role is Owner and is_billing_owner -> "Owner"
 *   - If role is Owner and NOT is_billing_owner -> "Co-Owner"
 *   - Otherwise -> their role at that store
 * - If no selectedStoreId, fall back to profile role with billing owner check
 */
function getDisplayRole(user: UserWithStore, selectedStoreId?: string): string {
  if (selectedStoreId && user.store_users) {
    // Find the user's membership at the selected store
    const storeUserEntry = user.store_users.find(su => su.store_id === selectedStoreId)

    if (storeUserEntry) {
      if (storeUserEntry.role === 'Owner') {
        return storeUserEntry.is_billing_owner ? 'Owner' : 'Co-Owner'
      }
      return storeUserEntry.role
    }

    // User is not a member of the selected store - show their profile role
    return user.role
  }

  // No store selected - fall back to checking if billing owner of any store
  const isBillingOwner = user.store_users?.some(su => su.is_billing_owner) ?? false

  if (user.role === 'Owner') {
    return isBillingOwner ? 'Owner' : 'Co-Owner'
  }

  return user.role
}

/**
 * Get formatted role string for a store user entry
 */
function getStoreRoleDisplay(su: StoreUserWithStore): string {
  if (su.role === 'Owner') {
    return su.is_billing_owner ? 'Owner' : 'Co-Owner'
  }
  return su.role
}

/**
 * Get the stores display for a user
 * - If selectedStoreId is provided, show that store name
 * - If no selectedStoreId, show all store names
 */
function getStoresDisplay(user: UserWithStore, selectedStoreId?: string): React.ReactNode {
  if (selectedStoreId) {
    // When filtered by store, show that store name
    const storeEntry = user.store_users?.find(su => su.store_id === selectedStoreId)
    return storeEntry?.store?.name || user.store?.name || '-'
  }

  // No filter - show all store names
  if (!user.store_users || user.store_users.length === 0) {
    return user.store?.name || '-'
  }

  // Single store - just show the name
  if (user.store_users.length === 1) {
    return user.store_users[0].store?.name || 'Unknown'
  }

  // Multiple stores - show as comma-separated list
  return user.store_users.map(su => su.store?.name || 'Unknown').join(', ')
}

// Sort configuration
type SortKey = 'name' | 'email' | 'role' | 'store' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

// Priority for role sorting (lower = shows first in ascending order)
const ROLE_PRIORITY: Record<string, number> = {
  'Owner': 1,
  'Manager': 2,
  'Driver': 3,
  'Staff': 4,
}

// Priority for status sorting (lower = shows first in ascending order)
const STATUS_PRIORITY: Record<string, number> = {
  'Active': 1,
  'Invited': 2,
  'Inactive': 3,
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  currentSort: SortConfig | null
  onSort: (key: SortKey) => void
  className?: string
}

function SortableHeader({ label, sortKey, currentSort, onSort, className = '' }: SortableHeaderProps) {
  const isActive = currentSort?.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}>
          {direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </TableHead>
  )
}

interface UsersTableProps {
  users: UserWithStore[]
  selectedStoreId?: string  // When set, show role relative to this store
  isLoading?: boolean
  onInvite?: () => void
  onEdit?: (user: Profile) => void
  onDeactivate?: (user: Profile) => void
  onActivate?: (user: Profile) => void
  onBulkDeactivate?: (users: Profile[]) => void
  onBulkActivate?: (users: Profile[]) => void
}

export const UsersTable = memo(function UsersTable({
  users,
  selectedStoreId,
  isLoading,
  onInvite,
  onEdit,
  onDeactivate,
  onActivate,
  onBulkDeactivate,
  onBulkActivate,
}: UsersTableProps) {
  const [actionUser, setActionUser] = useState<Profile | null>(null)
  const [actionType, setActionType] = useState<'deactivate' | 'activate' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'deactivate' | 'activate' | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const sortedUsers = useMemo(() => {
    if (!sortConfig) return users

    return [...users].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'name':
          aVal = (a.full_name || '').toLowerCase()
          bVal = (b.full_name || '').toLowerCase()
          break
        case 'email':
          aVal = a.email.toLowerCase()
          bVal = b.email.toLowerCase()
          break
        case 'role':
          aVal = ROLE_PRIORITY[a.role] ?? 99
          bVal = ROLE_PRIORITY[b.role] ?? 99
          break
        case 'store':
          // Put unassigned ("-") at the end
          aVal = a.store?.name?.toLowerCase() || 'zzz'
          bVal = b.store?.name?.toLowerCase() || 'zzz'
          break
        case 'status':
          aVal = STATUS_PRIORITY[a.status] ?? 99
          bVal = STATUS_PRIORITY[b.status] ?? 99
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier
      }

      if (aVal < bVal) return -1 * multiplier
      if (aVal > bVal) return 1 * multiplier
      return 0
    })
  }, [users, sortConfig])

  const selectedUsers = useMemo(
    () => users.filter(user => selectedIds.has(user.id)),
    [users, selectedIds]
  )

  const allSelected = users.length > 0 && selectedIds.size === users.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < users.length

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map(user => user.id)))
    }
  }, [allSelected, users])

  const handleSelectUser = useCallback((userId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(userId)
      } else {
        next.delete(userId)
      }
      return next
    })
  }, [])

  const handleAction = () => {
    if (!actionUser || !actionType) return

    if (actionType === 'deactivate') {
      onDeactivate?.(actionUser)
    } else {
      onActivate?.(actionUser)
    }

    setActionUser(null)
    setActionType(null)
  }

  const handleBulkAction = () => {
    if (bulkAction === 'deactivate' && onBulkDeactivate) {
      onBulkDeactivate(selectedUsers)
    } else if (bulkAction === 'activate' && onBulkActivate) {
      onBulkActivate(selectedUsers)
    }
    setSelectedIds(new Set())
    setBulkAction(null)
  }

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Count active/inactive in selection
  const activeInSelection = selectedUsers.filter(u => u.status === 'Active').length
  const inactiveInSelection = selectedUsers.filter(u => u.status === 'Inactive').length

  const roleColors: Record<string, string> = {
    Owner: 'bg-amber-500',
    'Co-Owner': 'bg-amber-400', // Slightly lighter to distinguish from billing owner
    Manager: 'bg-purple-500',
    Admin: 'bg-amber-500', // Legacy: maps to Owner
    Driver: 'bg-blue-500',
    Staff: 'bg-green-500',
  }

  const statusColors = {
    Active: 'default' as const,
    Invited: 'outline' as const,
    Inactive: 'secondary' as const,
  }

  if (isLoading) {
    return <UsersTableSkeleton />
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-3 mb-4 bg-muted/50 rounded-lg border animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedIds.size} user{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {activeInSelection > 0 && onBulkDeactivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('deactivate')}
                className="h-8"
              >
                <UserX className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Deactivate ({activeInSelection})
              </Button>
            )}
            {inactiveInSelection > 0 && onBulkActivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkAction('activate')}
                className="h-8"
              >
                <UserCheck className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Activate ({inactiveInSelection})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedUsers.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <EmptyState
              icon={Users}
              title="No users found"
              description="Invite team members to help manage your restaurant inventory."
              action={onInvite ? {
                label: "Invite User",
                onClick: onInvite,
                icon: UserPlus,
              } : undefined}
            />
          </div>
        ) : (
          sortedUsers.map((user) => (
            <div
              key={user.id}
              className={`border rounded-lg p-3 ${selectedIds.has(user.id) ? 'bg-muted/50 border-primary/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(user.id)}
                  onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                  aria-label={`Select ${user.full_name || user.email}`}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name || 'No name'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(user)}>
                          <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        {user.status === 'Active' ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setActionUser(user)
                              setActionType('deactivate')
                            }}
                            className="text-red-600"
                          >
                            <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : user.status === 'Inactive' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setActionUser(user)
                              setActionType('activate')
                            }}
                          >
                            <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge className={`text-white text-xs ${roleColors[getDisplayRole(user, selectedStoreId)]}`}>
                      {getDisplayRole(user, selectedStoreId)}
                    </Badge>
                    <Badge variant={statusColors[user.status]} className="text-xs">
                      {user.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getStoresDisplay(user, selectedStoreId)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allSelected}
                  data-indeterminate={someSelected ? true : undefined}
                  onCheckedChange={handleSelectAll}
                  aria-label={allSelected ? 'Deselect all users' : 'Select all users'}
                />
              </TableHead>
              <SortableHeader
                label="Name"
                sortKey="name"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Email"
                sortKey="email"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden md:table-cell"
              />
              <SortableHeader
                label="Role"
                sortKey="role"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Store"
                sortKey="store"
                currentSort={sortConfig}
                onSort={handleSort}
                className="hidden lg:table-cell"
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-[300px]">
                  <EmptyState
                    icon={Users}
                    title="No users found"
                    description="Invite team members to help manage your restaurant inventory."
                    action={onInvite ? {
                      label: "Invite User",
                      onClick: onInvite,
                      icon: UserPlus,
                    } : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={selectedIds.has(user.id) ? 'bg-muted/50' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                      aria-label={`Select ${user.full_name || user.email}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.full_name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground md:hidden">
                        {user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-white ${roleColors[getDisplayRole(user, selectedStoreId)]}`}>
                      {getDisplayRole(user, selectedStoreId)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {getStoresDisplay(user, selectedStoreId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[user.status]}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(user)}>
                          <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        {user.status === 'Active' ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setActionUser(user)
                              setActionType('deactivate')
                            }}
                            className="text-red-600"
                          >
                            <UserX className="mr-2 h-4 w-4" aria-hidden="true" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : user.status === 'Inactive' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setActionUser(user)
                              setActionType('activate')
                            }}
                          >
                            <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                            Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Single user action dialog */}
      <ConfirmDialog
        open={!!actionUser && !!actionType}
        onOpenChange={() => {
          setActionUser(null)
          setActionType(null)
        }}
        title={actionType === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        description={actionType === 'deactivate'
          ? `Are you sure you want to deactivate ${actionUser?.full_name || actionUser?.email}? They will no longer be able to access the system.`
          : `Are you sure you want to activate ${actionUser?.full_name || actionUser?.email}? They will be able to access the system again.`}
        confirmLabel={actionType === 'deactivate' ? 'Deactivate' : 'Activate'}
        variant={actionType === 'deactivate' ? 'destructive' : 'default'}
        onConfirm={handleAction}
      />

      {/* Bulk action dialog */}
      <ConfirmDialog
        open={!!bulkAction}
        onOpenChange={() => setBulkAction(null)}
        title={bulkAction === 'deactivate' ? 'Deactivate Users' : 'Activate Users'}
        description={
          bulkAction === 'deactivate'
            ? `Are you sure you want to deactivate ${activeInSelection} user${activeInSelection !== 1 ? 's' : ''}? They will no longer be able to access the system.`
            : `Are you sure you want to activate ${inactiveInSelection} user${inactiveInSelection !== 1 ? 's' : ''}? They will be able to access the system again.`
        }
        confirmLabel={bulkAction === 'deactivate' ? 'Deactivate All' : 'Activate All'}
        variant={bulkAction === 'deactivate' ? 'destructive' : 'default'}
        onConfirm={handleBulkAction}
      />
    </>
  )
})
