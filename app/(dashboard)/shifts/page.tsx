'use client'

import { Suspense, useState, useMemo } from 'react'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShiftsTableSkeleton, PageHeaderSkeleton } from '@/components/ui/skeletons'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Plus, MoreHorizontal, Pencil, Trash2, Clock, Calendar, ArrowUp, ArrowDown, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { format, isSameDay, parseISO } from 'date-fns'
import { Shift } from '@/types'
import { ShiftFormData } from '@/lib/validations/shift'

const FILTER_DEFAULTS = {
  store: '',
  date: '',
}

// Sort configuration
type SortKey = 'staff' | 'store' | 'date' | 'time' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
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

// Status priority for sorting (lower = shows first in ascending order)
const STATUS_PRIORITY: Record<string, number> = {
  'Upcoming': 1,
  'Active': 2,
  'In Progress': 3,
  'Completed': 4,
  'Missed': 5,
}

function getShiftStatus(shift: Shift) {
  const now = new Date()
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)

  if (shift.clock_out_time) {
    return { label: 'Completed', variant: 'secondary' as const }
  }
  if (shift.clock_in_time && !shift.clock_out_time) {
    return { label: 'In Progress', variant: 'default' as const }
  }
  if (now < start) {
    return { label: 'Upcoming', variant: 'outline' as const }
  }
  if (now >= start && now <= end) {
    return { label: 'Active', variant: 'default' as const }
  }
  return { label: 'Missed', variant: 'destructive' as const }
}

function ShiftsPageContent() {
  // URL-based filter state
  const { filters, setFilter } = useUrlFilters({ defaults: FILTER_DEFAULTS })

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  const { stores, isLoading: storesLoading } = useStores({ status: 'active' })
  const { users, isLoading: usersLoading } = useUsers({ status: 'Active' })

  // Convert empty string to null for the hook
  const selectedStoreId = filters.store || null
  const { shifts, isLoading: shiftsLoading, createShift, updateShift, deleteShift } = useShifts(selectedStoreId)

  const isLoading = storesLoading || usersLoading || shiftsLoading

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }

  // Filter shifts by date if selected
  const filteredShifts = useMemo(() => {
    if (!filters.date) return shifts
    const selectedDate = parseISO(filters.date)
    return shifts.filter(shift => isSameDay(new Date(shift.start_time), selectedDate))
  }, [shifts, filters.date])

  const sortedShifts = useMemo(() => {
    if (!sortConfig) return filteredShifts

    return [...filteredShifts].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number
      const multiplier = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'staff':
          aVal = (a.user?.full_name || a.user?.email || '').toLowerCase()
          bVal = (b.user?.full_name || b.user?.email || '').toLowerCase()
          break
        case 'store':
          aVal = (a.store?.name || '').toLowerCase()
          bVal = (b.store?.name || '').toLowerCase()
          break
        case 'date':
          aVal = new Date(a.start_time).getTime()
          bVal = new Date(b.start_time).getTime()
          break
        case 'time':
          // Sort by time of day (ignore date)
          const aDate = new Date(a.start_time)
          const bDate = new Date(b.start_time)
          aVal = aDate.getHours() * 60 + aDate.getMinutes()
          bVal = bDate.getHours() * 60 + bDate.getMinutes()
          break
        case 'status':
          const aStatus = getShiftStatus(a).label
          const bStatus = getShiftStatus(b).label
          aVal = STATUS_PRIORITY[aStatus] ?? 99
          bVal = STATUS_PRIORITY[bStatus] ?? 99
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
  }, [filteredShifts, sortConfig])

  const handleCreateShift = async (data: ShiftFormData) => {
    setIsCreating(true)
    try {
      await createShift(data)
      setIsFormOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateShift = async (data: ShiftFormData) => {
    if (!editingShift) return
    setIsUpdating(true)
    try {
      await updateShift({ id: editingShift.id, data })
      setEditingShift(null)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteShift = async () => {
    if (!deleteShiftId) return
    await deleteShift(deleteShiftId)
    setDeleteShiftId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shifts Management</h1>
          <p className="text-muted-foreground">
            Schedule and manage staff shifts across all stores
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/shifts/timetable">
            <Button variant="outline">
              <CalendarDays className="mr-2 h-4 w-4" />
              Timetable View
            </Button>
          </Link>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Shift
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <CardTitle className="text-base">Filters</CardTitle>
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Date:</span>
                <Input
                  type="date"
                  value={filters.date || ''}
                  onChange={(e) => setFilter('date', e.target.value)}
                  className="w-40"
                  aria-label="Filter by date"
                />
                {filters.date && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter('date', '')}
                    className="h-8 px-2 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Store:</span>
                <Select
                  value={filters.store || 'all'}
                  onValueChange={(value) => setFilter('store', value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {filters.date && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing shifts for {format(parseISO(filters.date), 'EEEE, MMMM d, yyyy')}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ShiftsTableSkeleton rows={5} />
          ) : filteredShifts.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={filters.date ? "No shifts for this date" : "No shifts scheduled"}
              description={filters.date
                ? `No shifts are scheduled for ${format(parseISO(filters.date), 'MMMM d, yyyy')}.`
                : "Create shifts to schedule your team members across stores."
              }
              action={filters.date ? undefined : {
                label: "Create Shift",
                onClick: () => setIsFormOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Staff Member"
                    sortKey="staff"
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Store"
                    sortKey="store"
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Date"
                    sortKey="date"
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Time"
                    sortKey="time"
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                  <TableHead>Clock In/Out</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedShifts.map((shift) => {
                  const status = getShiftStatus(shift)
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">
                        {shift.user?.full_name || shift.user?.email || 'Unknown'}
                      </TableCell>
                      <TableCell>{shift.store?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        {format(new Date(shift.start_time), 'EEE, MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(shift.start_time), 'h:mm a')} -{' '}
                          {format(new Date(shift.end_time), 'h:mm a')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {shift.clock_in_time && (
                          <div>In: {format(new Date(shift.clock_in_time), 'h:mm a')}</div>
                        )}
                        {shift.clock_out_time && (
                          <div>Out: {format(new Date(shift.clock_out_time), 'h:mm a')}</div>
                        )}
                        {!shift.clock_in_time && !shift.clock_out_time && '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                if (document.activeElement instanceof HTMLElement) {
                                  document.activeElement.blur()
                                }
                                setTimeout(() => setEditingShift(shift), 150)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                if (document.activeElement instanceof HTMLElement) {
                                  document.activeElement.blur()
                                }
                                setTimeout(() => setDeleteShiftId(shift.id), 150)
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ShiftForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        stores={stores}
        users={users}
        onSubmit={handleCreateShift}
        isLoading={isCreating}
      />

      <ShiftForm
        open={!!editingShift}
        onOpenChange={(open) => !open && setEditingShift(null)}
        shift={editingShift}
        stores={stores}
        users={users}
        onSubmit={handleUpdateShift}
        isLoading={isUpdating}
      />

      <AlertDialog open={!!deleteShiftId} onOpenChange={(open) => !open && setDeleteShiftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShift}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ShiftsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <Card>
          <CardHeader>
            <div className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <ShiftsTableSkeleton rows={5} />
          </CardContent>
        </Card>
      </div>
    }>
      <ShiftsPageContent />
    </Suspense>
  )
}
