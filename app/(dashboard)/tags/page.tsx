'use client'

import { useAuth } from '@/hooks/useAuth'
import { TagList } from '@/components/tags/TagList'
import { Loader2, Store } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function TagsPage() {
  const { currentStore, isLoading, role } = useAuth()
  const currentStoreId = currentStore?.store_id

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!currentStore || !currentStoreId) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No store selected</h3>
            <p className="text-muted-foreground text-center">
              Select a store from the sidebar to manage tags.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Staff and Drivers shouldn't reach here (sidebar filters), but guard anyway
  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground text-center">
              Only Owners and Managers can manage tags.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <TagList storeId={currentStoreId} />
    </div>
  )
}
