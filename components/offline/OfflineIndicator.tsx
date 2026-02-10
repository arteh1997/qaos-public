'use client'

import { useOfflineSync } from '@/hooks/useOfflineSync'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Wifi, WifiOff, RefreshCw, Loader2, Cloud, CloudOff } from 'lucide-react'

export function OfflineIndicator() {
  const { online, pendingCount, isSyncing, syncNow, lastSyncResult } = useOfflineSync()

  // Don't show anything when online with no pending operations
  if (online && pendingCount === 0 && !lastSyncResult) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
          aria-label={online ? `Online, ${pendingCount} pending operations` : 'Offline'}
        >
          {online ? (
            <Cloud className="h-4 w-4 text-white/70" />
          ) : (
            <CloudOff className="h-4 w-4 text-red-400" />
          )}
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {online ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">Offline</span>
              </>
            )}
          </div>

          {/* Pending operations */}
          {pendingCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {pendingCount} pending {pendingCount === 1 ? 'operation' : 'operations'}
                </span>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  Queued
                </Badge>
              </div>

              {online && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          )}

          {/* Last sync result */}
          {lastSyncResult && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {lastSyncResult.synced > 0 && (
                <p className="text-green-600">{lastSyncResult.synced} synced successfully</p>
              )}
              {lastSyncResult.failed > 0 && (
                <p className="text-red-600">{lastSyncResult.failed} failed to sync</p>
              )}
              {lastSyncResult.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {lastSyncResult.errors.slice(0, 3).map((err, i) => (
                    <li key={i} className="text-red-500 truncate">{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Info when offline */}
          {!online && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              Your changes will be saved locally and synced when you&apos;re back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
