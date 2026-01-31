'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Store } from '@/types'
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
import { MoreHorizontal, Eye, Edit, Trash2, Package, Store as StoreIcon, Plus } from 'lucide-react'
import { StoresTableSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'

interface StoresTableProps {
  stores: Store[]
  canManage: boolean
  isLoading?: boolean
  onAdd?: () => void
  onEdit?: (store: Store) => void
  onDelete?: (store: Store) => void
}

export function StoresTable({ stores, canManage, isLoading, onAdd, onEdit, onDelete }: StoresTableProps) {
  const [deleteStore, setDeleteStore] = useState<Store | null>(null)

  const handleDelete = () => {
    if (deleteStore && onDelete) {
      onDelete(deleteStore)
      setDeleteStore(null)
    }
  }

  if (isLoading) {
    return <StoresTableSkeleton />
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-[300px]">
                  <EmptyState
                    icon={StoreIcon}
                    title="No stores found"
                    description={canManage
                      ? "Get started by adding your first store location."
                      : "No store locations have been added yet."
                    }
                    action={canManage && onAdd ? {
                      label: "Add Store",
                      onClick: onAdd,
                      icon: Plus,
                    } : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {store.address || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={store.is_active ? 'default' : 'secondary'}>
                      {store.is_active ? 'Active' : 'Inactive'}
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
                        <DropdownMenuItem asChild>
                          <Link href={`/stores/${store.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/stores/${store.id}/stock`}>
                            <Package className="mr-2 h-4 w-4" />
                            View Stock
                          </Link>
                        </DropdownMenuItem>
                        {canManage && (
                          <>
                            <DropdownMenuItem onClick={() => onEdit?.(store)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteStore(store)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
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

      <ConfirmDialog
        open={!!deleteStore}
        onOpenChange={() => setDeleteStore(null)}
        title="Delete Store"
        description={`Are you sure you want to delete "${deleteStore?.name}"? This action cannot be undone and will remove all associated inventory and stock history.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
