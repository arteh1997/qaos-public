'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
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
import {
  CreditCard,
  Calendar,
  AlertCircle,
  Check,
  X,
  Loader2,
  Store,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { getMonthlyPriceDisplay, BILLING_CONFIG } from '@/lib/stripe/billing-config'
import { Subscription } from '@/types/billing'

interface SubscriptionWithStore extends Subscription {
  store: { id: string; name: string } | null
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trialing: { label: 'Trial', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  past_due: { label: 'Past Due', variant: 'destructive' },
  canceled: { label: 'Canceled', variant: 'outline' },
  unpaid: { label: 'Unpaid', variant: 'destructive' },
}

export default function BillingPage() {
  const { stores, isLoading: authLoading } = useAuth()
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithStore[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const ownerStores = stores?.filter(s => s.role === 'Owner') || []
  const monthlyPrice = getMonthlyPriceDisplay()

  useEffect(() => {
    async function fetchSubscriptions() {
      if (authLoading) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/billing/subscriptions')
        if (!response.ok) {
          throw new Error('Failed to load subscriptions')
        }

        const data = await response.json()
        setSubscriptions(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing information')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscriptions()
  }, [authLoading])

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

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage your subscriptions and payment methods</p>
        </div>
        <div className="grid gap-4">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const totalMonthlyAmount = subscriptions
    .filter(s => ['active', 'trialing'].includes(s.status))
    .length * (BILLING_CONFIG.PRICE_AMOUNT_PENCE / 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscriptions and payment methods</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Active Stores</p>
              <p className="text-2xl font-bold">
                {subscriptions.filter(s => ['active', 'trialing'].includes(s.status)).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Total</p>
              <p className="text-2xl font-bold">
                £{totalMonthlyAmount.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price per Store</p>
              <p className="text-2xl font-bold">{monthlyPrice}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Store Subscriptions</h2>

        {subscriptions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subscriptions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a store to start your subscription
              </p>
            </CardContent>
          </Card>
        ) : (
          subscriptions.map(subscription => {
            const statusBadge = STATUS_BADGES[subscription.status] || STATUS_BADGES.active
            const trialDaysRemaining = getTrialDaysRemaining(subscription)
            const isCanceling = cancelingId === subscription.id
            const isReactivating = reactivatingId === subscription.id

            return (
              <Card key={subscription.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Store className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">
                          {subscription.store?.name || 'Unknown Store'}
                        </h3>
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        {subscription.status === 'trialing' && trialDaysRemaining > 0 && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}
                              {subscription.trial_end && (
                                <span className="text-xs ml-1">
                                  ({format(new Date(subscription.trial_end), 'MMM d, yyyy')})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {subscription.status === 'active' && subscription.current_period_end && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>
                              Next billing: {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}

                        {subscription.cancel_at_period_end && subscription.current_period_end && (
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span>
                              Cancels on {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{monthlyPrice}</span>
                      <span className="text-sm text-muted-foreground">/month</span>

                      {subscription.cancel_at_period_end ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivateSubscription(subscription.id)}
                          disabled={isReactivating}
                        >
                          {isReactivating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      ) : subscription.status !== 'canceled' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmCancelId(subscription.id)}
                          disabled={isCanceling}
                        >
                          {isCanceling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!confirmCancelId} onOpenChange={() => setConfirmCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period.
              After that, you&apos;ll lose access to this store&apos;s features.
              You can reactivate anytime before the period ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmCancelId && handleCancelSubscription(confirmCancelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
