'use client'

import { useState, useCallback } from 'react'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'
import { Shift } from '@/types'
import { TimelineView } from '@/components/timetable/TimelineView'
import { QuickShiftModal } from '@/components/timetable/QuickShiftModal'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarDays, Users, Store, Plus } from 'lucide-react'

interface QuickAddState {
  date: Date
  staffId?: string
  storeId?: string
}

export default function ShiftTimetablePage() {
  const { role, canManageCurrentStore } = useAuth()
  const { shifts, isLoading: shiftsLoading, createShift, updateShift, deleteShift } = useShifts()
  const { stores, isLoading: storesLoading } = useStores()
  const { users, isLoading: usersLoading } = useUsers()

  const [viewMode, setViewMode] = useState<'store' | 'staff'>('store')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all')
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddState, setQuickAddState] = useState<QuickAddState | null>(null)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)

  const isLoading = shiftsLoading || storesLoading || usersLoading
  // Owner and Manager can manage shifts
  const canManage = canManageCurrentStore || role === 'Owner' || role === 'Manager'

  // Handle quick add from timetable cell click
  const handleAddShift = useCallback((date: Date, storeId?: string, staffId?: string) => {
    setQuickAddState({ date, staffId, storeId })
    setQuickAddOpen(true)
  }, [])

  // Handle edit shift
  const handleEditShift = useCallback((shift: Shift) => {
    setEditShift(shift)
    setEditFormOpen(true)
  }, [])

  // Handle quick add submit
  const handleQuickAddSubmit = async (data: {
    store_id: string
    user_id: string
    start_time: string
    end_time: string
  }) => {
    await createShift({
      store_id: data.store_id,
      user_id: data.user_id,
      start_time: data.start_time,
      end_time: data.end_time,
    })
  }

  // Handle edit submit
  const handleEditSubmit = async (data: {
    store_id: string
    user_id: string
    start_time: string
    end_time: string
    notes?: string
  }) => {
    if (!editShift) return
    await updateShift({
      id: editShift.id,
      data,
    })
    setEditFormOpen(false)
    setEditShift(null)
  }

  // Filter stores for dropdown
  const activeStores = stores.filter(s => s.is_active)

  // Staff members
  const staffMembers = users.filter(u => u.role === 'Staff' && u.status === 'Active')

  if (isLoading) {
    return (
      <div className="space-y-6">
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8" />
            Shift Timetable
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly view of all scheduled shifts
          </p>
        </div>
        {canManage && (
          <Button
            className="w-full sm:w-auto"
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

      {/* Controls */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">View by:</span>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'store' | 'staff')} className="flex-1 sm:flex-initial">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="store" className="gap-1.5 flex-1 sm:flex-initial text-xs sm:text-sm">
                    <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Store
                  </TabsTrigger>
                  <TabsTrigger value="staff" className="gap-1.5 flex-1 sm:flex-initial text-xs sm:text-sm">
                    <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Staff
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Filter - changes based on view mode */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Filter:</span>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="flex-1 sm:w-48">
                  <SelectValue placeholder={viewMode === 'store' ? 'All Stores' : 'All Staff'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {viewMode === 'store' ? 'All Stores' : 'All Staff'}
                  </SelectItem>
                  {viewMode === 'store' ? (
                    activeStores.map(store => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))
                  ) : (
                    staffMembers.map(staff => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.full_name || staff.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <TimelineView
        shifts={shifts}
        stores={stores}
        staff={staffMembers}
        viewMode={viewMode}
        selectedStoreId={selectedStoreId === 'all' ? undefined : selectedStoreId}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        onAddShift={canManage ? handleAddShift : undefined}
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Shifts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-3 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold">{shifts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Staff
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-3 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold">
              {new Set(shifts.map(s => s.user_id)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
              Stores
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-3 sm:p-6">
            <div className="text-xl sm:text-2xl font-bold">
              {new Set(shifts.map(s => s.store_id)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Modal */}
      {quickAddState && (
        <QuickShiftModal
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          date={quickAddState.date}
          stores={stores}
          staff={staffMembers}
          preselectedStoreId={quickAddState.storeId}
          preselectedStaffId={quickAddState.staffId}
          onSubmit={handleQuickAddSubmit}
        />
      )}

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
