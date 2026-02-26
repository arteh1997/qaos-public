'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAccountingConnections,
  useAccountingAccounts,
  useAccountingConfig,
  useUpdateAccountingConfig,
  useDisconnectAccounting,
  useTriggerSync,
} from '@/hooks/useAccountingConnection'
import { PageHeader } from '@/components/ui/page-header'
import { AccountMappingForm } from '@/components/integrations/AccountMappingForm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Unplug,
  Loader2,
  Calculator,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const SYNC_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  idle: { label: 'Idle', className: 'bg-muted text-muted-foreground', icon: Clock },
  syncing: { label: 'Syncing', className: 'bg-blue-50 text-blue-700', icon: RefreshCw },
  error: { label: 'Error', className: 'bg-destructive/10 text-destructive', icon: AlertCircle },
}

export default function QuickBooksPage() {
  const { storeId } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

  const { connections, isLoading, refetch } = useAccountingConnections(storeId || undefined)
  const qbo = connections.find(c => c.provider === 'quickbooks' && c.is_active)

  const { expenseAccounts, isLoading: isLoadingAccounts } = useAccountingAccounts(
    qbo ? storeId || undefined : undefined
  )
  const { config, isLoading: isLoadingConfig } = useAccountingConfig(
    qbo ? storeId || undefined : undefined
  )
  const updateConfig = useUpdateAccountingConfig(storeId || undefined)
  const disconnect = useDisconnectAccounting()
  const triggerSync = useTriggerSync(storeId || undefined)

  // Show success toast on redirect from OAuth
  const success = searchParams.get('success')
  useEffect(() => {
    if (success === 'connected') {
      toast.success('QuickBooks connected successfully!')
    }
  }, [success])

  // Get categories from the store for mapping UI
  const [categories, setCategories] = useState<string[]>([])
  useEffect(() => {
    if (!storeId) return
    fetch(`/api/stores/${storeId}/categories`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.data) {
          setCategories(data.data.map((c: { name: string }) => c.name))
        }
      })
      .catch(() => {})
  }, [storeId])

  const handleDisconnect = () => {
    if (!storeId) return
    disconnect.mutate(
      { storeId, provider: 'quickbooks' },
      {
        onSuccess: () => {
          setShowDisconnectDialog(false)
          router.push('/integrations')
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    )
  }

  if (!qbo) {
    return (
      <div className="space-y-6">
        <PageHeader title="QuickBooks Integration" />
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="size-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Not Connected</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Connect your QuickBooks Online account to automatically sync invoices and bills.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" asChild>
                <Link href="/integrations">
                  <ArrowLeft className="size-4 mr-2" />
                  Back
                </Link>
              </Button>
              <Button
                onClick={() => {
                  if (storeId) window.location.href = `/api/integrations/quickbooks/auth?store_id=${storeId}`
                }}
              >
                Connect QuickBooks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusConfig = SYNC_STATUS_CONFIG[qbo.sync_status] || SYNC_STATUS_CONFIG.idle
  const StatusIcon = statusConfig.icon

  return (
    <div className="space-y-6">
      <PageHeader title="QuickBooks Integration">
        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerSync.mutate({})}
          disabled={triggerSync.isPending}
        >
          {triggerSync.isPending ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="size-4 mr-2" />
          )}
          Sync Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDisconnectDialog(true)}
          className="text-destructive hover:text-destructive"
        >
          <Unplug className="size-4 mr-2" />
          Disconnect
        </Button>
      </PageHeader>

      {/* Connection Status */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium">QuickBooks Connected</h3>
                <Badge variant="secondary" className={statusConfig.className}>
                  <StatusIcon className="size-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              {qbo.last_synced_at && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Last synced: {new Date(qbo.last_synced_at).toLocaleString()}
                </p>
              )}
              {qbo.sync_error && (
                <p className="text-sm text-destructive mt-1">{qbo.sync_error}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Mapping */}
      <AccountMappingForm
        categories={categories}
        accounts={expenseAccounts}
        config={config}
        isLoadingAccounts={isLoadingAccounts || isLoadingConfig}
        isSaving={updateConfig.isPending}
        onSave={(newConfig) => updateConfig.mutate(newConfig)}
      />

      {/* Disconnect Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect QuickBooks?</DialogTitle>
            <DialogDescription>
              This will revoke access and stop syncing data. Your existing sync history
              will be preserved. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="size-4 mr-2" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
