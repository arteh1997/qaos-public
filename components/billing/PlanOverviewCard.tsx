'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Calendar, AlertTriangle, Check, Zap, X, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { getMonthlyPriceDisplay, BILLING_CONFIG } from '@/lib/stripe/billing-config'
import { Subscription } from '@/types/billing'

interface SubscriptionWithStore extends Subscription {
  store: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Check }> = {
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
    className: 'bg-destructive/5 text-destructive/70 border-red-200',
    icon: AlertTriangle,
  },
  canceled: {
    label: 'Canceled',
    className: 'bg-muted/50 text-muted-foreground border-muted',
    icon: X,
  },
  unpaid: {
    label: 'Payment Failed',
    className: 'bg-destructive/5 text-destructive/70 border-red-200',
    icon: AlertCircle,
  },
}

interface PlanOverviewCardProps {
  subscriptions: SubscriptionWithStore[]
  billingOwnerStoreIds?: Set<string>
}

export function PlanOverviewCard({ subscriptions, billingOwnerStoreIds }: PlanOverviewCardProps) {
  const monthlyPrice = getMonthlyPriceDisplay()

  const { billedCount, totalMonthly, primaryStatus, trialDaysRemaining, nextBillingDate, isCancelling, cancelDate, isPastDue } = useMemo(() => {
    const activeSubs = subscriptions.filter(s => ['active', 'trialing'].includes(s.status))
    // Only count stores you're the billing owner of in the price
    const billedSubs = billingOwnerStoreIds
      ? activeSubs.filter(s => billingOwnerStoreIds.has(s.store_id))
      : activeSubs
    const primary = subscriptions.find(s => ['active', 'trialing'].includes(s.status)) || subscriptions[0]

    let trialDays = 0
    let nextBilling: string | null = null
    let cancelling = false
    let cancelDt: string | null = null
    let pastDue = false

    if (primary) {
      if (primary.status === 'trialing' && primary.trial_end) {
        const end = new Date(primary.trial_end)
        trialDays = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      }
      if (primary.status === 'active' && primary.current_period_end) {
        nextBilling = primary.current_period_end
      }
      if (primary.cancel_at_period_end && primary.current_period_end) {
        cancelling = true
        cancelDt = primary.current_period_end
      }
      if (primary.status === 'past_due') {
        pastDue = true
      }
    }

    return {
      billedCount: billedSubs.length,
      totalMonthly: billedSubs.length * (BILLING_CONFIG.PRICE_AMOUNT_PENCE / 100),
      primaryStatus: primary?.status || null,
      trialDaysRemaining: trialDays,
      nextBillingDate: nextBilling,
      isCancelling: cancelling,
      cancelDate: cancelDt,
      isPastDue: pastDue,
    }
  }, [subscriptions, billingOwnerStoreIds])

  if (subscriptions.length === 0) return null

  const statusConfig = primaryStatus ? STATUS_CONFIG[primaryStatus] : null
  const StatusIcon = statusConfig?.icon || Check

  return (
    <Card>
      <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Plan info */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Professional Plan</h2>
              {statusConfig && (
                <Badge variant="outline" className={`${statusConfig.className} border text-[11px]`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {monthlyPrice}
              <span className="text-sm font-normal text-muted-foreground ml-1">/month per store</span>
            </p>
          </div>

          {/* Summary stat */}
          {billedCount > 0 && (
            <div className="text-right text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {billedCount} store{billedCount !== 1 ? 's' : ''} × {monthlyPrice}
              </p>
              <p>= £{totalMonthly.toFixed(0)}/month</p>
            </div>
          )}
        </div>

        {/* Context line */}
        <div className="mt-3 pt-3 border-t">
          {isPastDue && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">Payment failed — please update your card below</span>
            </div>
          )}
          {isCancelling && cancelDate && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Cancelling — access until {format(new Date(cancelDate), 'MMM d, yyyy')}</span>
            </div>
          )}
          {!isPastDue && !isCancelling && primaryStatus === 'trialing' && trialDaysRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in trial</span>
            </div>
          )}
          {!isPastDue && !isCancelling && primaryStatus === 'active' && nextBillingDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Next billing date: {format(new Date(nextBillingDate), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
