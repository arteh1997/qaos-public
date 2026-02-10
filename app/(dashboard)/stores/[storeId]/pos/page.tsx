'use client'

import { useState, use } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePosConnections, usePosSaleEvents, type PosConnection, type PosSaleEvent } from '@/hooks/usePosConnections'
import { POS_PROVIDERS } from '@/lib/services/pos'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Monitor,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Plus,
} from 'lucide-react'
import Link from 'next/link'

const SYNC_STATUS_COLORS: Record<string, string> = {
  synced: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const EVENT_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  processed: CheckCircle2,
  failed: AlertCircle,
  pending: Clock,
  skipped: Clock,
}

function ConnectionCard({ connection }: { connection: PosConnection }) {
  const provider = POS_PROVIDERS[connection.provider as keyof typeof POS_PROVIDERS]

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
              <Monitor className="size-5" />
            </div>
            <div>
              <h3 className="font-medium">{connection.name}</h3>
              <p className="text-sm text-muted-foreground">
                {provider?.name ?? connection.provider}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connection.is_active ? (
              <Wifi className="size-4 text-green-500" />
            ) : (
              <WifiOff className="size-4 text-muted-foreground" />
            )}
            <Badge variant="secondary" className={SYNC_STATUS_COLORS[connection.sync_status] ?? ''}>
              {connection.sync_status}
            </Badge>
          </div>
        </div>

        {connection.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Last synced: {new Date(connection.last_synced_at).toLocaleString()}
          </p>
        )}

        {connection.sync_error && (
          <p className="text-xs text-destructive mt-1">{connection.sync_error}</p>
        )}
      </CardContent>
    </Card>
  )
}

function SaleEventRow({ event }: { event: PosSaleEvent }) {
  const StatusIcon = EVENT_STATUS_ICONS[event.status] ?? Clock

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon className={`size-4 ${
          event.status === 'processed' ? 'text-green-500' :
          event.status === 'failed' ? 'text-red-500' :
          'text-muted-foreground'
        }`} />
        <div>
          <p className="text-sm font-medium">{event.event_type} - {event.external_event_id.slice(0, 12)}...</p>
          <p className="text-xs text-muted-foreground">
            {new Date(event.occurred_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="text-right">
        {event.total_amount !== null && (
          <p className="text-sm font-medium">${event.total_amount.toFixed(2)}</p>
        )}
        <Badge variant="secondary" className="text-xs">
          {event.status}
        </Badge>
      </div>
    </div>
  )
}

export default function PosSettingsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = use(params)
  const { role } = useAuth()
  const { data: connections, isLoading: connectionsLoading } = usePosConnections(storeId)
  const { data: events, isLoading: eventsLoading } = usePosSaleEvents(storeId)

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">POS Integration</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is only available to Owners and Managers.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/stores/${storeId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Monitor className="size-6" />
              POS Integration
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect your Point-of-Sale system to automatically track sales
            </p>
          </div>
        </div>
      </div>

      {/* Connections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connected Systems</h2>
          <Button variant="outline" size="sm" disabled>
            <Plus className="size-4 mr-1" />
            Add Connection
          </Button>
        </div>

        {connectionsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {connections.map(conn => (
              <ConnectionCard key={conn.id} connection={conn} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Monitor className="size-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No POS systems connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your POS system to automatically deduct inventory when sales occur.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.entries(POS_PROVIDERS).map(([key, provider]) => (
                  <Badge key={key} variant="secondary">
                    {provider.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How POS Integration Works</CardTitle>
          <CardDescription>Automatic inventory deduction from sales</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Connect your POS system (Square, Toast, Clover, etc.)</li>
            <li>Map POS menu items to your inventory items</li>
            <li>When a sale occurs, the POS sends an event via webhook</li>
            <li>Inventory is automatically deducted based on your mappings</li>
            <li>Stock history records every POS-triggered change</li>
          </ol>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Webhook URL for your POS system:</p>
            <code className="text-xs text-muted-foreground break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.com'}/api/pos/webhook/{'<connection-id>'}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Sale Events</h2>

        {eventsLoading ? (
          <Card>
            <CardContent className="pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between py-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : events && events.length > 0 ? (
          <Card>
            <CardContent className="pt-4">
              {events.slice(0, 20).map(event => (
                <SaleEventRow key={event.id} event={event} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No sale events yet. Events will appear here once your POS system starts sending data.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
