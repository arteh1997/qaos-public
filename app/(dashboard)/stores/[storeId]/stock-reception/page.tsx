'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/hooks/useStore'
import { useAuth } from '@/hooks/useAuth'
import { canDoStockReception } from '@/lib/auth'
import { StockReceptionForm } from '@/components/forms/StockReceptionForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

interface StockReceptionPageProps {
  params: Promise<{ storeId: string }>
}

export default function StockReceptionPage({ params }: StockReceptionPageProps) {
  const { storeId } = use(params)
  const { role } = useAuth()
  const router = useRouter()
  const { data: store, isLoading } = useStore(storeId)

  // Check permissions
  if (!canDoStockReception(role)) {
    router.push('/')
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  const handleSuccess = () => {
    router.push('/')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Stock Reception</h1>
          <p className="text-sm text-muted-foreground">{store.name}</p>
        </div>
      </div>

      <StockReceptionForm storeId={storeId} onSuccess={handleSuccess} />
    </div>
  )
}
