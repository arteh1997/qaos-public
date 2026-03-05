'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Store, Check, Zap, X, AlertTriangle, AlertCircle,
  Clock, Calendar, Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { BILLING_CONFIG, getMonthlyPriceDisplay } from '@/lib/stripe/billing-config'
import { Subscription } from '@/types/billing'
import { StoreUser } from '@/types'
import { UseMutationResult } from '@tanstack/react-query'
import { getCSRFHeaders } from '@/hooks/useCSRF'

interface SubscriptionWithStore extends Subscription {
  store: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Check }> = {
  trialing: { label: 'Trial', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Zap },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Check },
  past_due: { label: 'Past Due', className: 'bg-destructive/5 text-destructive/70 border-red-200', icon: AlertTriangle },
  canceled: { label: 'Canceled', className: 'bg-muted/50 text-muted-foreground border-muted', icon: X },
  unpaid: { label: 'Failed', className: 'bg-destructive/5 text-destructive/70 border-red-200', icon: AlertCircle },
}

interface StoreSubscriptionListProps {
  subscriptions: SubscriptionWithStore[]
  ownerStores: StoreUser[]
  cancelSubscription: UseMutationResult<unknown, Error, string, unknown>
  reactivateSubscription: UseMutationResult<unknown, Error, string, unknown>
  hasPaymentMethod?: boolean
  onSubscriptionsChanged?: () => void
}

export function StoreSubscriptionList({
  subscriptions,
  ownerStores,
  cancelSubscription,
  reactivateSubscription,
  hasPaymentMethod = false,
  onSubscriptionsChanged,
}: StoreSubscriptionListProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [activatingStores, setActivatingStores] = useState<Set<string>>(new Set())
  // Tracks stores we've already attempted (never cleared — prevents retries)
  const attemptedRef = useRef<Set<string>>(new Set())

  // Track which stores the user is billing owner of
  const billingOwnerStoreIds = new Set(
    ownerStores.filter(s => s.is_billing_owner).map(s => s.store_id)
  )

  const subscribedStoreIds = new Set(subscriptions.map(s => s.store_id))

  // Only billing-owner stores can be auto-activated — co-owner stores are managed by the other owner
  const unsubscribedStores = ownerStores.filter(
    s => s.is_billing_owner && !subscribedStoreIds.has(s.store_id)
  )

  // Stable list of store IDs that need activation (only changes when actual IDs change)
  const unsubscribedIds = unsubscribedStores.map(s => s.store_id).sort().join(',')

  // Auto-start trials for unsubscribed stores when user has a payment method
  // Runs once per set of unsubscribed store IDs — never retries failed attempts
  useEffect(() => {
    if (!hasPaymentMethod || !unsubscribedIds) return

    const storeIds = unsubscribedIds.split(',')
    const toActivate = storeIds.filter(id => !attemptedRef.current.has(id))
    if (toActivate.length === 0) return

    // Mark all as attempted immediately to prevent re-runs
    toActivate.forEach(id => attemptedRef.current.add(id))

    let cancelled = false

    async function autoActivateTrials() {
      for (const storeId of toActivate) {
        if (cancelled) break

        setActivatingStores(prev => new Set(prev).add(storeId))

        try {
          await fetch('/api/billing/subscriptions', {
            method: 'POST',
            headers: getCSRFHeaders(),
            body: JSON.stringify({ store_id: storeId }),
          })
        } catch {
          // Don't retry — user can refresh page if needed
        } finally {
          setActivatingStores(prev => {
            const next = new Set(prev)
            next.delete(storeId)
            return next
          })
        }
      }

      if (!cancelled) {
        // Refresh subscriptions once after all activations complete
        onSubscriptionsChanged?.()
      }
    }

    autoActivateTrials()

    return () => { cancelled = true }
   
  }, [hasPaymentMethod, unsubscribedIds])

  const getTrialDaysRemaining = (sub: SubscriptionWithStore) => {
    if (sub.status !== 'trialing' || !sub.trial_end) return 0
    const end = new Date(sub.trial_end)
    return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  }

  if (subscriptions.length === 0 && unsubscribedStores.length === 0) return null

  return (
    <>
      <Card>
        <CardContent className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5 sm:pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Store Subscriptions
          </h3>

          <div className="divide-y">
            {/* Subscribed stores */}
            {subscriptions.map(sub => {
              const config = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active
              const StatusIcon = config.icon
              const trialDays = getTrialDaysRemaining(sub)
              const isBillingOwner = billingOwnerStoreIds.has(sub.store_id)

              return (
                <div key={sub.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-muted rounded-md shrink-0">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{sub.store?.name || 'Unknown Store'}</p>
                          {!isBillingOwner && (
                            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted text-[10px] px-1.5 py-0 shrink-0">
                              Co-Owner
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`${config.className} border text-[10px] px-1.5 py-0`}>
                            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                            {config.label}
                          </Badge>
                          {sub.status === 'trialing' && trialDays > 0 && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {trialDays}d left
                            </span>
                          )}
                          {sub.status === 'active' && sub.current_period_end && !sub.cancel_at_period_end && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Renews {format(new Date(sub.current_period_end), 'MMM d')}
                            </span>
                          )}
                          {sub.cancel_at_period_end && sub.current_period_end && (
                            <span className="text-[11px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Ends {format(new Date(sub.current_period_end), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions — only for billing owner */}
                    {isBillingOwner && (
                      <div className="flex items-center gap-1.5 sm:shrink-0 ml-auto sm:ml-0">
                        {sub.cancel_at_period_end ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                            onClick={() => reactivateSubscription.mutate(sub.id)}
                            disabled={reactivateSubscription.isPending}
                          >
                            {reactivateSubscription.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            Reactivate
                          </Button>
                        ) : sub.status !== 'canceled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmCancelId(sub.id)}
                            disabled={cancelSubscription.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Unsubscribed stores — auto-activating */}
            {unsubscribedStores.map(storeUser => {
              const isActivating = activatingStores.has(storeUser.store_id)

              return (
                <div key={storeUser.store_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-amber-50 rounded-md shrink-0">
                        <Store className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{storeUser.store?.name || 'Unknown Store'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {isActivating
                            ? 'Starting trial...'
                            : hasPaymentMethod
                              ? 'Activating trial...'
                              : `${BILLING_CONFIG.TRIAL_DAYS}-day free trial — add a payment method to activate`
                          }
                        </p>
                      </div>
                    </div>
                    {isActivating && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Billing summary — only count stores you're billed for */}
          {(() => {
            const billedSubs = subscriptions.filter(
              s => ['active', 'trialing'].includes(s.status) && billingOwnerStoreIds.has(s.store_id)
            )
            if (billedSubs.length === 0) return null
            const monthlyPrice = getMonthlyPriceDisplay()
            const total = billedSubs.length * (BILLING_CONFIG.PRICE_AMOUNT_PENCE / 100)
            return (
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {billedSubs.length} store{billedSubs.length !== 1 ? 's' : ''} × {monthlyPrice}
                </span>
                <span className="font-semibold">
                  £{total.toFixed(0)}/month
                </span>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!confirmCancelId} onOpenChange={() => setConfirmCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period.
              After that, you&apos;ll lose access to this store&apos;s features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-3">
            {['Inventory tracking and stock management', 'Team member access and shift scheduling', 'Usage reports and analytics'].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmCancelId) {
                  cancelSubscription.mutate(confirmCancelId)
                  setConfirmCancelId(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
