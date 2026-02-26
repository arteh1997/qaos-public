'use client'

import { useState, useCallback, useMemo } from 'react'
import { useShifts } from '@/hooks/useShifts'
import { useStores } from '@/hooks/useStores'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'
import { Shift } from '@/types'
import { TimelineView } from '@/components/timetable/TimelineView'
import { ShiftForm } from '@/components/forms/ShiftForm'
import { ShiftFormData } from '@/lib/validations/shift'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PageGuide } from '@/components/help/PageGuide'

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

  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddState, setQuickAddState] = useState<QuickAddState | null>(null)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)

  const isLoading = shiftsLoading || storesLoading || usersLoading
  const canManage = canManageCurrentStore || role === 'Owner' || role === 'Manager'

  const handleAddShift = useCallback((date: Date, storeId?: string, staffId?: string) => {
    setQuickAddState({ date, staffId, storeId })
    setQuickAddOpen(true)
  }, [])

  const _handleEditShift = useCallback((shift: Shift) => {
    setEditShift(shift)
    setEditFormOpen(true)
  }, [])

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

  const handleEditSubmit = async (data: ShiftFormData) => {
    if (!editShift) return
    await updateShift({ id: editShift.id, data })
    setEditFormOpen(false)
    setEditShift(null)
  }

  // All active team members — anyone can have a shift
  const teamMembers = useMemo(() =>
    users.filter(u => u.status === 'Active'),
  [users])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    )
  }

  if (!currentStore) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Shift Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a store to view the timetable</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/shifts">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Shift Calendar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Weekly schedule for {currentStore.store?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-11 sm:ml-0">
          <PageGuide pageKey="shift-timetable" />
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setQuickAddState({ date: new Date() })
                setQuickAddOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Shift
            </Button>
          )}
        </div>
      </div>

      {/* Timeline View */}
      <TimelineView
        shifts={shifts}
        stores={stores}
        staff={teamMembers}
        viewMode="staff"
        selectedStoreId={undefined}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        onAddShift={canManage ? handleAddShift : undefined}
      />

      {/* Add Shift Form */}
      <ShiftForm
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        stores={stores}
        users={teamMembers}
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
        users={teamMembers}
        onSubmit={handleEditSubmit}
      />
    </div>
  )
}
