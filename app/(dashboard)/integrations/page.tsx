'use client'

import { useAuth } from '@/hooks/useAuth'
import { useAccountingConnections } from '@/hooks/useAccountingConnection'
import { usePosConnections } from '@/hooks/usePosConnections'
import { PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/help/PageGuide'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { Skeleton } from '@/components/ui/skeleton'
import { FileSpreadsheet, Monitor } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

export default function IntegrationsPage() {
  const { storeId } = useAuth()
  const { connections, isLoading } = useAccountingConnections(storeId || undefined)
  const { data: posConnections } = usePosConnections(storeId)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle OAuth error redirects
  const error = searchParams.get('error')
  useEffect(() => {
    if (error) {
      const messages: Record<string, string> = {
        access_denied: 'You denied access to your accounting system.',
        invalid_state: 'OAuth state invalid. Please try again.',
        state_expired: 'OAuth session expired. Please try again.',
        missing_store: 'Missing store information. Please try again.',
        save_failed: 'Failed to save connection. Please try again.',
        exchange_failed: 'Failed to connect. Please try again.',
        missing_params: 'Missing OAuth parameters. Please try again.',
      }
      toast.error(messages[error] || `Connection failed: ${error}`)
    }
  }, [error])

  const activeAccountingCount = connections.filter(c => c.is_active).length
  const activePosCount = (posConnections || []).filter(c => c.is_active).length

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect your POS and accounting tools">
        <PageGuide pageKey="integrations" />
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Accounting */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Accounting</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <IntegrationCard
                name="Accounting"
                description={
                  activeAccountingCount > 0
                    ? `${activeAccountingCount} active connection${activeAccountingCount > 1 ? 's' : ''} — Xero, QuickBooks, Sage & more`
                    : 'Connect Xero, QuickBooks, Sage, FreshBooks, and more'
                }
                icon={FileSpreadsheet}
                isConnected={activeAccountingCount > 0}
                onConnect={() => router.push('/integrations/accounting')}
                onManage={() => router.push('/integrations/accounting')}
                connectLabel="Set Up"
              />
            </div>
          </div>

          {/* POS */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Point of Sale</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <IntegrationCard
                name="POS Systems"
                description={
                  activePosCount > 0
                    ? `${activePosCount} active connection${activePosCount > 1 ? 's' : ''} — Square, Zettle, SumUp & more`
                    : 'Connect Square, Zettle, SumUp, Lightspeed, and more'
                }
                icon={Monitor}
                isConnected={activePosCount > 0}
                onConnect={() => {
                  if (storeId) router.push(`/stores/${storeId}/pos`)
                }}
                onManage={() => {
                  if (storeId) router.push(`/stores/${storeId}/pos`)
                }}
                connectLabel="Set Up"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
