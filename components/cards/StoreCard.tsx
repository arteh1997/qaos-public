'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { Store } from '@/types'
import { MapPin, ChevronRight } from 'lucide-react'

interface StoreCardProps {
  store: Store
}

export function StoreCard({ store }: StoreCardProps) {
  const router = useRouter()
  const { setCurrentStore } = useAuth()

  const handleClick = () => {
    // Switch to this store and navigate to dashboard
    setCurrentStore(store.id)
    router.push('/')
  }

  return (
    <Card
      className="hover:border-primary/50 transition-colors cursor-pointer h-full"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{store.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={store.is_active ? 'default' : 'secondary'}>
              {store.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {store.address ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{store.address}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No address provided</p>
        )}
      </CardContent>
    </Card>
  )
}
