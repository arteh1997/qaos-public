'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAccountingConnections } from '@/hooks/useAccountingConnection'
import { PageHeader } from '@/components/ui/page-header'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileSpreadsheet,
  Calculator,
  Landmark,
  BarChart3,
  BookOpen,
  Library,
  Waves,
  ArrowLeft,
  Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AccountingProvider } from '@/types'
import type { LucideIcon } from 'lucide-react'

interface ProviderInfo {
  provider: AccountingProvider
  name: string
  description: string
  icon: LucideIcon
  region: string
}

const ACCOUNTING_PROVIDERS: ProviderInfo[] = [
  {
    provider: 'xero',
    name: 'Xero',
    description: 'Sync invoices and bills to your Xero account',
    icon: FileSpreadsheet,
    region: 'UK, AU, NZ, Global',
  },
  {
    provider: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync invoices and bills to QuickBooks Online',
    icon: Calculator,
    region: 'US, UK, Global',
  },
  {
    provider: 'sage',
    name: 'Sage',
    description: 'Sync with Sage Business Cloud Accounting',
    icon: Landmark,
    region: 'UK, EU, Africa',
  },
  {
    provider: 'myob',
    name: 'MYOB',
    description: 'Connect to MYOB AccountRight Live',
    icon: BarChart3,
    region: 'AU, NZ',
  },
  {
    provider: 'freshbooks',
    name: 'FreshBooks',
    description: 'Sync expenses and bills with FreshBooks',
    icon: BookOpen,
    region: 'North America',
  },
  {
    provider: 'zoho_books',
    name: 'Zoho Books',
    description: 'Connect to Zoho Books for bill sync',
    icon: Library,
    region: 'India, Middle East, Global',
  },
  {
    provider: 'wave',
    name: 'Wave',
    description: 'Sync bills with Wave Accounting',
    icon: Waves,
    region: 'North America',
  },
]

export default function AccountingIntegrationsPage() {
  const { storeId, role } = useAuth()
  const { connections, isLoading } = useAccountingConnections(storeId || undefined)
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filteredProviders = ACCOUNTING_PROVIDERS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.region.toLowerCase().includes(search.toLowerCase())
  )

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounting" description="Connect your accounting software" />
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is only available to Owners and Managers.
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleConnect = (provider: string) => {
    if (!storeId) return
    window.location.href = `/api/integrations/${provider}/auth?store_id=${storeId}`
  }

  const getConnection = (provider: AccountingProvider) =>
    connections.find(c => c.provider === provider && c.is_active)

  // Route slug uses hyphens, provider type uses underscores
  const getManageRoute = (provider: AccountingProvider) =>
    `/integrations/${provider.replace('_', '-')}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Connect your accounting software to sync invoices and bills"
      >
        <Button variant="outline" size="sm" onClick={() => router.push('/integrations')}>
          <ArrowLeft className="size-4 mr-1.5" />
          Back
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search accounting providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProviders.map(({ provider, name, description, icon, region }) => {
              const connection = getConnection(provider)
              return (
                <IntegrationCard
                  key={provider}
                  name={name}
                  description={connection ? description : `${description} — ${region}`}
                  icon={icon}
                  isConnected={!!connection}
                  lastSynced={connection?.last_synced_at}
                  syncError={connection?.sync_error}
                  onConnect={() => handleConnect(provider.replace('_', '-'))}
                  onManage={() => router.push(getManageRoute(provider))}
                />
              )
            })}
          </div>

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Accounting Integration Works</CardTitle>
              <CardDescription>Automatic invoice and bill sync</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Connect your accounting software using the buttons above</li>
                <li>Purchase orders are automatically synced as bills</li>
                <li>Supplier details are matched to contacts in your accounting system</li>
                <li>Payment status is tracked and updated in both systems</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
