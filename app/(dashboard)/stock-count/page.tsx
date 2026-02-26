'use client'

import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useDailyCounts } from '@/hooks/useReports'
import { StockCountForm } from '@/components/forms/StockCountForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { PageGuide } from '@/components/help/PageGuide'

export default function StockCountPage() {
  const { user, storeId, role } = useAuth()
  const { data: store, isLoading: storeLoading } = useStore(storeId)
  const { data: dailyCounts, isLoading: countsLoading } = useDailyCounts(storeId)

  const isLoading = storeLoading || countsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Please select a store from the top of the sidebar to start counting.</p>
        </CardContent>
      </Card>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const todayCountCompleted = dailyCounts?.some(c =>
    c.store_id === storeId && c.count_date === today
  ) ?? false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Stock Count
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record today&apos;s inventory counts</p>
          <p className="text-muted-foreground text-sm mt-1">
            {store?.name} &middot; {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <PageGuide pageKey="stock-count" />
      </div>

      {/* Status banner */}
      {todayCountCompleted ? (
        <Card className="border-green-500/50 bg-green-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-green-900">Today&apos;s Count Complete</p>
                <p className="text-sm text-emerald-700">
                  Great work! You can still update your count below if needed.
                </p>
              </div>
              <Badge variant="outline" className="ml-auto border-green-500 text-emerald-700">
                Done
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/40/50 bg-amber-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-amber-800">Count Not Submitted Yet</p>
                <p className="text-sm text-amber-700">
                  Please count all items below and submit when ready.
                </p>
              </div>
              <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-700">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Count Form */}
      <StockCountForm storeId={storeId} />
    </div>
  )
}
