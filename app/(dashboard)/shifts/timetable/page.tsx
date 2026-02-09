'use client'

import { useState, useCallback } from 'react'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'
import { Shift } from '@/types'
import { TimelineView } from '@/components/timetable/TimelineView'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { ShiftFormData } from '@/lib/validations/shift'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface QuickAddState {
  date: Date
  staffId?: string
  storeId?: string
}

export default function ShiftTimetablePage() {
  const { role, canManageCurrentStore, currentStore } = useAuth()
  const currentStoreId = currentStore?.store_id

  const { shifts, isLoading: shiftsLoading, createShift, updateShift } = useShifts(currentStoreId || null)
  const { stores, isLoading: storesLoading } = useStores()
  const { users, isLoading: usersLoading } = useUsers({ storeId: currentStoreId || 'all' })

  const [selectedStaffId, setSelectedStaffId] = useState<string>('all')
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddState, setQuickAddState] = useState<QuickAddState | null>(null)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)

  const isLoading = shiftsLoading || storesLoading || usersLoading
  const canManage = canManageCurrentStore || role === 'Owner' || role === 'Manager'

  // Handle quick add from timetable cell click
  const handleAddShift = useCallback((date: Date, storeId?: string, staffId?: string) => {
    setQuickAddState({ date, staffId, storeId })
    setQuickAddOpen(true)
  }, [])

  // Handle shift edit
  const _handleEditShift = useCallback((shift: Shift) => {
    setEditShift(shift)
    setEditFormOpen(true)
  }, [])

  // Handle quick add submit
  const handleQuickAddSubmit = async (data: ShiftFormData) => {
    await createShift({
      store_id: data.store_id,
      user_id: data.user_id,
      start_time: data.start_time,
      end_time: data.end_time,
      notes: data.notes,
    })
    setQuickAddOpen(false)
  }

  // Handle edit submit
  const handleEditSubmit = async (data: ShiftFormData) => {
    if (!editShift) return
    await updateShift({
      id: editShift.id,
      data,
    })
    setEditFormOpen(false)
    setEditShift(null)
  }

  // Get user's role at current store from store_users
  const getUserRoleAtStore = (user: any): string | null => {
    if (!currentStoreId || !user.store_users) return user.role

    const storeUserEntry = user.store_users.find((su: any) => su.store_id === currentStoreId)
    return storeUserEntry ? storeUserEntry.role : user.role
  }

  // Staff members (filter to current store using store_users role)
  const staffMembers = users.filter(u =>
    getUserRoleAtStore(u) === 'Staff' && u.status === 'Active'
  )

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  if (!currentStore) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shift Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please select a store from the sidebar to view its timetable.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/shifts">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <CalendarDays className="h-6 w-6" />
                Shift Calendar
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Weekly view for {currentStore.store?.name}
              </p>
            </div>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setQuickAddState({ date: new Date() })
              setQuickAddOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Shift
          </Button>
        )}
      </div>

      {/* Filter */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium whitespace-nowrap">Filter by staff:</span>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="All Staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffMembers.map(staff => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.full_name || staff.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <TimelineView
        shifts={shifts}
        stores={stores}
        staff={staffMembers}
        viewMode="staff"
        selectedStoreId={selectedStaffId === 'all' ? undefined : selectedStaffId}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        onAddShift={canManage ? handleAddShift : undefined}
      />

      {/* Add Shift Form */}
      <ShiftForm
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        stores={stores}
        users={staffMembers}
        onSubmit={handleQuickAddSubmit}
        initialStoreId={quickAddState?.storeId || currentStoreId}
        initialDate={quickAddState?.date}
        singleShiftMode={true}
      />

      {/* Edit Form */}
      <ShiftForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        shift={editShift}
        stores={stores}
        users={staffMembers}
        onSubmit={handleEditSubmit}
      />
    </div>
  )
}
