'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ExternalLink, type LucideIcon } from 'lucide-react'

interface IntegrationCardProps {
  name: string
  description: string
  icon: LucideIcon
  isConnected: boolean
  lastSynced?: string | null
  syncError?: string | null
  onConnect: () => void
  onManage: () => void
  connectLabel?: string
}

export function IntegrationCard({
  name,
  description,
  icon: Icon,
  isConnected,
  lastSynced,
  syncError,
  onConnect,
  onManage,
  connectLabel = 'Connect',
}: IntegrationCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{name}</h3>
              {isConnected && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 shrink-0">
                  <CheckCircle2 className="size-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>

            {isConnected && lastSynced && (
              <p className="text-xs text-muted-foreground mt-2">
                Last synced: {new Date(lastSynced).toLocaleString()}
              </p>
            )}

            {syncError && (
              <p className="text-xs text-destructive mt-1">{syncError}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {isConnected ? (
            <Button variant="outline" size="sm" onClick={onManage}>
              Manage
              <ExternalLink className="size-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect}>
              {connectLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
