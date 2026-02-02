'use client'

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted">
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. Check your connection and try again.
          </p>
        </div>

        <Button onClick={handleRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try again
        </Button>

        <p className="text-sm text-muted-foreground">
          Some features may still be available from cached data.
        </p>
      </div>
    </div>
  )
}
