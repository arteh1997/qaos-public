'use client'

import { use, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useDailyCounts } from '@/hooks/useReports'
import { canDoStockCount } from '@/lib/auth'
import { StockCountForm } from '@/components/forms/StockCountForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CheckCircle } from 'lucide-react'

interface StockCountPageProps {
  params: Promise<{ storeId: string }>
}

export default function StockCountPage({ params }: StockCountPageProps) {
  const { storeId } = use(params)
  const { role, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { data: dailyCounts, isLoading: countsLoading } = useDailyCounts()

  const isLoading = authLoading || storeLoading || countsLoading
  const hasPermission = canDoStockCount(role)

  // Redirect if user doesn't have permission (only after auth has loaded)
  useEffect(() => {
    if (!authLoading && !hasPermission) {
      router.push(`/stores/${storeId}`)
    }
  }, [authLoading, hasPermission, router, storeId])

  // Show loading while auth is loading or while checking permissions
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  // Only redirect check after loading is complete
  if (!hasPermission) {
    return null
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

  // Check if count already completed today
  const today = new Date().toISOString().split('T')[0]
  const todayCountCompleted = dailyCounts?.some(
    c => c.store_id === storeId && c.count_date === today
  )

  const handleSuccess = () => {
    router.push(`/stores/${storeId}`)
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
          <h1 className="text-3xl font-bold tracking-tight">Stock Count</h1>
          <p className="text-muted-foreground">{store.name}</p>
        </div>
      </div>

      {todayCountCompleted ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Count Completed</h2>
            <p className="text-muted-foreground mb-4">
              Today&apos;s stock count has already been submitted for this store.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              You can submit another count to update the inventory levels.
            </p>
            <StockCountForm storeId={storeId} onSuccess={handleSuccess} />
          </CardContent>
        </Card>
      ) : (
        <StockCountForm storeId={storeId} onSuccess={handleSuccess} />
      )}
    </div>
  )
}
