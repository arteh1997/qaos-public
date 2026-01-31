'use client'

import { use } from 'react'
import Link from 'next/link'
import { useStore } from '@/hooks/useStore'
import { useUsers } from '@/hooks/useUsers'
import { UsersTable } from '@/components/tables/UsersTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

interface StoreUsersPageProps {
  params: Promise<{ storeId: string }>
}

export default function StoreUsersPage({ params }: StoreUsersPageProps) {
  const { storeId } = use(params)
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { users, isLoading: usersLoading } = useUsers()

  const isLoading = storeLoading || usersLoading

  // Filter users assigned to this store
  const storeUsers = users.filter(u => u.store_id === storeId)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Link href="/stores">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Stores
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href={`/stores/${storeId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Users</h1>
          <p className="text-muted-foreground">{store.name}</p>
        </div>
      </div>

      {storeUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No users assigned to this store
          </p>
          <Link href="/users">
            <Button>Manage Users</Button>
          </Link>
        </div>
      ) : (
        <UsersTable users={storeUsers} />
      )}
    </div>
  )
}
