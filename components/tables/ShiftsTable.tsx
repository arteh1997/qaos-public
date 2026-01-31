'use client'

import { useState } from 'react'
import { Shift } from '@/types'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface ShiftsTableProps {
  shifts: Shift[]
  showUser?: boolean
  showStore?: boolean
  canManage?: boolean
  onEdit?: (shift: Shift) => void
  onDelete?: (shift: Shift) => void
}

export function ShiftsTable({
  shifts,
  showUser = true,
  showStore = true,
  canManage = false,
  onEdit,
  onDelete,
}: ShiftsTableProps) {
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null)

  const handleDelete = () => {
    if (deleteShift && onDelete) {
      onDelete(deleteShift)
      setDeleteShift(null)
    }
  }

  const getShiftStatus = (shift: Shift) => {
    const now = new Date()
    const start = new Date(shift.start_time)
    const end = new Date(shift.end_time)

    if (shift.clock_out_time) {
      return { label: 'Completed', variant: 'secondary' as const }
    }
    if (shift.clock_in_time) {
      return { label: 'In Progress', variant: 'default' as const }
    }
    if (now > end) {
      return { label: 'Missed', variant: 'destructive' as const }
    }
    if (now >= start && now <= end) {
      return { label: 'Active', variant: 'outline' as const }
    }
    return { label: 'Scheduled', variant: 'outline' as const }
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {shifts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-md">
            No shifts found
          </div>
        ) : (
          shifts.map((shift) => {
            const status = getShiftStatus(shift)
            return (
              <div key={shift.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(shift.start_time), 'EEE, MMM d')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(shift.start_time), 'h:mm a')} - {format(new Date(shift.end_time), 'h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit?.(shift)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteShift(shift)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {showUser && shift.user && (
                    <span>{shift.user.full_name || shift.user.email}</span>
                  )}
                  {showStore && shift.store && (
                    <span>{shift.store.name}</span>
                  )}
                </div>
                {shift.clock_in_time && (
                  <p className="text-xs text-muted-foreground">
                    In: {format(new Date(shift.clock_in_time), 'h:mm a')}
                    {shift.clock_out_time && (
                      <> • Out: {format(new Date(shift.clock_out_time), 'h:mm a')}</>
                    )}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              {showUser && <TableHead className="hidden md:table-cell">User</TableHead>}
              {showStore && <TableHead className="hidden lg:table-cell">Store</TableHead>}
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  No shifts found
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => {
                const status = getShiftStatus(shift)
                return (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {format(new Date(shift.start_time), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        <p>
                          {format(new Date(shift.start_time), 'h:mm a')} -{' '}
                          {format(new Date(shift.end_time), 'h:mm a')}
                        </p>
                        {shift.clock_in_time && (
                          <p className="text-xs text-muted-foreground">
                            In: {format(new Date(shift.clock_in_time), 'h:mm a')}
                            {shift.clock_out_time && (
                              <> • Out: {format(new Date(shift.clock_out_time), 'h:mm a')}</>
                            )}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    {showUser && (
                      <TableCell className="hidden md:table-cell">
                        {shift.user?.full_name || shift.user?.email || '-'}
                      </TableCell>
                    )}
                    {showStore && (
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {shift.store?.name || '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit?.(shift)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteShift(shift)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!deleteShift}
        onOpenChange={() => setDeleteShift(null)}
        title="Delete Shift"
        description={`Are you sure you want to delete the shift on ${deleteShift ? format(new Date(deleteShift.start_time), 'MMM d, yyyy') : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
