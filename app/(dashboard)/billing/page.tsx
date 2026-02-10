'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CreditCard,
  Calendar,
  AlertCircle,
  Check,
  X,
  Loader2,
  Store,
  AlertTriangle,
  Download,
  Users,
  TrendingUp,
  PackageCheck,
  Clock,
  Receipt,
  ChevronRight,
  Plus,
  Settings,
  Crown,
  Zap,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { getMonthlyPriceDisplay, BILLING_CONFIG } from '@/lib/stripe/billing-config'
import { Subscription } from '@/types/billing'
import Link from 'next/link'

interface SubscriptionWithStore extends Subscription {
  store: { id: string; name: string } | null
}

const STATUS_CONFIG = {
  trialing: {
    label: 'Free Trial',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Zap,
  },
  active: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Check,
  },
  past_due: {
    label: 'Past Due',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertTriangle,
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
    icon: X,
  },
  unpaid: {
    label: 'Payment Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertCircle,
  },
}

const PLAN_FEATURES = [
  { icon: Users, label: 'Unlimited team members', included: true },
  { icon: Store, label: 'Multi-store management', included: true },
  { icon: PackageCheck, label: 'Real-time inventory tracking', included: true },
  { icon: TrendingUp, label: 'Stock count & reception', included: true },
  { icon: Clock, label: 'Shift management & scheduling', included: true },
  { icon: Receipt, label: 'Usage analytics & reports', included: true },
]

export default function BillingPage() {
  const { stores, isLoading: authLoading, currentStore, setCurrentStore } = useAuth()
  const currentStoreId = currentStore?.store_id
  const searchParams = useSearchParams()

  // Use existing hooks for real data
  const { users, isLoading: usersLoading } = useUsers({
    storeId: currentStoreId || 'all',
    status: 'all',
    role: 'all',
    page: 1,
  })

  const [subscriptions, setSubscriptions] = useState<SubscriptionWithStore[]>([])
  const [inventoryCount, setInventoryCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)

  const ownerStores = stores?.filter(s => s.role === 'Owner') || []
  const monthlyPrice = getMonthlyPriceDisplay()

  // Count active users
  const activeUsersCount = users.filter(u => u.status === 'Active').length

  // Handle returning from Stripe portal with store context
  useEffect(() => {
    const storeParam = searchParams.get('store')
    if (storeParam && stores && stores.length > 0) {
      // Check if user has access to this store
      const hasAccess = stores.some(s => s.store_id === storeParam)
      if (hasAccess && currentStoreId !== storeParam) {
        // Switch to the store they were viewing before going to Stripe
        setCurrentStore(storeParam)
      }
    }
  }, [searchParams, stores, currentStoreId, setCurrentStore])

  useEffect(() => {
    async function fetchBillingData() {
      if (authLoading) return

      setIsLoading(true)
      setError(null)

      try {
        // Fetch subscriptions and inventory count
        const [subsResponse, inventoryResponse] = await Promise.all([
          fetch('/api/billing/subscriptions'),
          currentStoreId ? fetch(`/api/stores/${currentStoreId}/inventory`) : Promise.resolve(null),
        ])

        if (!subsResponse.ok) {
          throw new Error('Failed to load subscriptions')
        }

        const subsData = await subsResponse.json()
        setSubscriptions(subsData.data || [])

        // Get inventory count
        if (inventoryResponse && inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json()
          setInventoryCount(Array.isArray(inventoryData.data) ? inventoryData.data.length : 0)
        } else {
          setInventoryCount(0)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing information')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBillingData()
  }, [authLoading, currentStoreId])

  const handleCancelSubscription = async (subscriptionId: string) => {
    setCancelingId(subscriptionId)

    try {
      const response = await fetch(`/api/billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to cancel subscription')
      }

      const data = await response.json()
      setSubscriptions(prev =>
        prev.map(s => s.id === subscriptionId ? { ...s, ...data.data } : s)
      )

      toast.success('Subscription will be canceled at the end of the billing period')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCancelingId(null)
      setConfirmCancelId(null)
    }
  }

  const handleReactivateSubscription = async (subscriptionId: string) => {
    setReactivatingId(subscriptionId)

    try {
      const response = await fetch(`/api/billing/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to reactivate subscription')
      }

      const data = await response.json()
      setSubscriptions(prev =>
        prev.map(s => s.id === subscriptionId ? { ...s, ...data.data } : s)
      )

      toast.success('Subscription reactivated successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    } finally {
      setReactivatingId(null)
    }
  }

  const getTrialDaysRemaining = (subscription: SubscriptionWithStore) => {
    if (subscription.status !== 'trialing' || !subscription.trial_end) return 0
    const trialEnd = new Date(subscription.trial_end)
    const now = new Date()
    return Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true)
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: currentStoreId, // Pass current store context
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to open billing portal')
      }

      const data = await response.json()

      // Redirect to Stripe Customer Portal
      window.location.href = data.data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal')
      setIsOpeningPortal(false)
    }
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeSubscriptions = subscriptions.filter(s => ['active', 'trialing'].includes(s.status))
    const totalMonthly = activeSubscriptions.length * (BILLING_CONFIG.PRICE_AMOUNT_PENCE / 100)

    return {
      activeStores: activeSubscriptions.length,
      totalStores: ownerStores.length,
      totalMonthly,
      teamMembers: activeUsersCount,
      inventoryItems: inventoryCount,
    }
  }, [subscriptions, ownerStores.length, activeUsersCount, inventoryCount])

  // Get primary subscription (for hero card)
  const primarySubscription = subscriptions.find(s => ['active', 'trialing'].includes(s.status)) || subscriptions[0]

  if (authLoading || isLoading || usersLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-48 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan, track usage, and view billing history
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Hero Card - Current Subscription */}
      {primarySubscription && (
        <Card className="border-2 bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Plan Info */}
              <div className="space-y-4 flex-1">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Crown className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold">Professional Plan</h2>
                      {(() => {
                        const config = STATUS_CONFIG[primarySubscription.status as keyof typeof STATUS_CONFIG]
                        const Icon = config?.icon || Check
                        return (
                          <Badge className={`${config?.className} border font-medium`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config?.label || primarySubscription.status}
                          </Badge>
                        )
                      })()}
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                      {monthlyPrice}
                      <span className="text-base font-normal text-muted-foreground ml-1">/month per store</span>
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {primarySubscription.status === 'trialing' && primarySubscription.trial_end && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="p-1.5 bg-blue-50 rounded">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-blue-900">
                          {getTrialDaysRemaining(primarySubscription)} days left in trial
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ends {format(new Date(primarySubscription.trial_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {primarySubscription.status === 'active' && primarySubscription.current_period_end && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="p-1.5 bg-emerald-50 rounded">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">Next billing date</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(primarySubscription.current_period_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}

                  {primarySubscription.cancel_at_period_end && primarySubscription.current_period_end && (
                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                      <div className="p-1.5 bg-amber-50 rounded">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-amber-900">Subscription ending</p>
                        <p className="text-xs text-muted-foreground">
                          Access until {format(new Date(primarySubscription.current_period_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={handleOpenPortal}
                    disabled={isOpeningPortal}
                  >
                    {isOpeningPortal ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Update Payment</span>
                    <span className="sm:hidden">Payment</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={handleOpenPortal}
                    disabled={isOpeningPortal}
                  >
                    {isOpeningPortal ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="mr-2 h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">View Invoices</span>
                    <span className="sm:hidden">Invoices</span>
                  </Button>
                </div>
                {primarySubscription.cancel_at_period_end ? (
                  <Button
                    onClick={() => handleReactivateSubscription(primarySubscription.id)}
                    disabled={reactivatingId === primarySubscription.id}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {reactivatingId === primarySubscription.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Reactivate Subscription
                  </Button>
                ) : primarySubscription.status !== 'canceled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmCancelId(primarySubscription.id)}
                    disabled={cancelingId === primarySubscription.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {cancelingId === primarySubscription.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="mr-2 h-4 w-4" />
                    )}
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Metrics - REAL DATA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Stores
            </CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{metrics.activeStores}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {metrics.totalStores} total
            </p>
            {metrics.totalStores > 0 && (
              <Progress
                value={(metrics.activeStores / metrics.totalStores) * 100}
                className="mt-3 h-2"
              />
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Cost
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              £{metrics.totalMonthly.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.activeStores} store{metrics.activeStores !== 1 ? 's' : ''} × {monthlyPrice}
            </p>
            <div className="mt-3 text-xs text-emerald-600 font-medium">
              ✓ Unlimited features
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{metrics.teamMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all stores
            </p>
            <div className="mt-3 text-xs text-blue-600 font-medium">
              Unlimited included
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inventory Items
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{metrics.inventoryItems}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Products being tracked
            </p>
            <div className="mt-3 text-xs text-emerald-600 font-medium">
              Unlimited included
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stores Without Subscriptions */}
      {(() => {
        const subscribedStoreIds = new Set(subscriptions.map(s => s.store_id))
        const unsubscribedStores = ownerStores.filter(s => !subscribedStoreIds.has(s.store_id))

        if (unsubscribedStores.length === 0) return null

        return (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Stores Need Subscription</CardTitle>
                  <CardDescription>
                    These stores require an active subscription to access features
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {unsubscribedStores.map(storeUser => (
                <div
                  key={storeUser.store_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Store className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{storeUser.store?.name || 'Unknown Store'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {BILLING_CONFIG.TRIAL_DAYS}-day free trial • No charge until trial ends
                      </p>
                    </div>
                  </div>
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <a href={`/billing/subscribe/${storeUser.store_id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Start Free Trial
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })()}

      {/* Store Subscriptions Grid */}
      {subscriptions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Store Subscriptions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscriptions.map(subscription => {
              const config = STATUS_CONFIG[subscription.status as keyof typeof STATUS_CONFIG]
              const Icon = config?.icon || Check
              const trialDaysRemaining = getTrialDaysRemaining(subscription)

              return (
                <Card key={subscription.id} className="bg-white hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Store className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold truncate">
                            {subscription.store?.name || 'Unknown Store'}
                          </h3>
                          <p className="text-sm text-muted-foreground">{monthlyPrice}/month</p>
                        </div>
                      </div>
                    </div>

                    <Badge className={`${config?.className} border font-medium mb-4`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config?.label || subscription.status}
                    </Badge>

                    <div className="space-y-2 text-sm">
                      {subscription.status === 'trialing' && trialDaysRemaining > 0 && (
                        <div className="flex items-center gap-2 text-blue-700">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">
                            {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
                          </span>
                        </div>
                      )}

                      {subscription.status === 'active' && subscription.current_period_end && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Renews {format(new Date(subscription.current_period_end), 'MMM d')}
                          </span>
                        </div>
                      )}

                      {subscription.cancel_at_period_end && subscription.current_period_end && (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">
                            Ends {format(new Date(subscription.current_period_end), 'MMM d')}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4 bg-white"
                      asChild
                    >
                      <Link href={`/billing/manage/${subscription.id}`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                        <ChevronRight className="ml-auto h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* What's Included Section */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg">What's Included in Your Plan</CardTitle>
          <CardDescription>
            Every subscription includes all features with no limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLAN_FEATURES.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="p-1.5 bg-emerald-100 rounded">
                    <Icon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.label}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">✓ Included</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Billing History</CardTitle>
              <CardDescription>View and download your invoices</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="bg-white">
              <Download className="mr-2 h-4 w-4" />
              Download All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No billing history yet</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Placeholder rows - in real implementation, fetch actual invoices */}
                  {subscriptions
                    .filter(s => s.status === 'active')
                    .slice(0, 5)
                    .map((sub, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {format(new Date(), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{sub.store?.name}</TableCell>
                        <TableCell>£{(BILLING_CONFIG.PRICE_AMOUNT_PENCE / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
                            <Check className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {subscriptions.filter(s => s.status === 'active').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No invoices yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State - No Subscriptions */}
      {subscriptions.length === 0 && ownerStores.length === 0 && (
        <Card className="bg-white">
          <CardContent className="py-12 text-center">
            <div className="p-4 bg-blue-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Store className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Get Started with Your First Store</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first store and start your {BILLING_CONFIG.TRIAL_DAYS}-day free trial.
              No credit card required.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/stores/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Store
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!confirmCancelId} onOpenChange={() => setConfirmCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period.
              After that, you&apos;ll lose access to this store&apos;s features including:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4 text-red-500" />
              <span>Inventory tracking and stock management</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4 text-red-500" />
              <span>Team member access and shift scheduling</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4 text-red-500" />
              <span>Usage reports and analytics</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmCancelId && handleCancelSubscription(confirmCancelId)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
