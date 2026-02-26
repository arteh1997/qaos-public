'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { BillingInfoCard } from '@/components/billing/BillingInfoCard'
import { PaymentForm } from '@/components/billing/PaymentForm'
import {
  ArrowLeft, ArrowRight, Loader2, Check, AlertCircle,
  CreditCard, MapPin, Plus, Building2, Clock, Users, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCSRF } from '@/hooks/useCSRF'

type Step = 'billing' | 'details'

export default function NewStorePage() {
  const router = useRouter()
  const { stores, refreshProfile, profile } = useAuth()
  const { csrfFetch } = useCSRF()
  const [step, setStep] = useState<Step>('billing')
  const [isLoading, setIsLoading] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingSetup, setIsLoadingSetup] = useState(true)

  const currentStoreCount = stores?.length || 0
  const isFirstStore = currentStoreCount === 0
  const newTotal = currentStoreCount + 1
  const monthlyTotal = newTotal * 299

  // For existing users with payment method, skip to details
  // For new users or first store, show billing first
  useEffect(() => {
    async function initializeBilling() {
      setIsLoadingSetup(true)
      setError(null)

      try {
        // Check if user already has a payment method via Stripe customer
        if (profile?.stripe_customer_id && !isFirstStore) {
          // User has payment method, can skip to details
          setStep('details')
          setIsLoadingSetup(false)
          return
        }

        // Need to collect payment method - get setup intent
        const response = await csrfFetch('/api/billing/setup-intent', {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Failed to initialize payment form')
        }

        const data = await response.json()
        setClientSecret(data.data.clientSecret)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment form')
      } finally {
        setIsLoadingSetup(false)
      }
    }

    initializeBilling()
  }, [profile?.stripe_customer_id, isFirstStore])

  const handlePaymentSuccess = (pmId: string) => {
    setPaymentMethodId(pmId)
    setStep('details')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!storeName.trim()) {
      toast.error('Please enter a store name')
      return
    }

    // For first store without payment method, block
    if (isFirstStore && !paymentMethodId) {
      toast.error('Please add a payment method first')
      setStep('billing')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Step 1: Create the store
      const response = await csrfFetch('/api/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: storeName.trim(),
          address: storeAddress.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to create store')
      }

      const storeData = await response.json()
      const storeId = storeData.data.id

      // Step 2: Create subscription (uses new payment method or existing default)
      const subscriptionResponse = await csrfFetch('/api/billing/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          store_id: storeId,
          ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
        }),
      })

      if (!subscriptionResponse.ok) {
        console.error('Subscription creation failed')
        toast.error('Store created but billing setup incomplete. Please check billing settings.')
      }

      toast.success('Store created successfully!')

      // Refresh auth context to get the new store
      await refreshProfile()

      // Redirect to the new store's dashboard
      router.push(`/stores/${storeId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading state
  if (isLoadingSetup) {
    return (
      <div className="max-w-xl mx-auto space-y-8 py-4">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 py-4">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Settings
      </Link>

      {/* Title */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isFirstStore ? 'Create Your First Location' : 'Add a New Location'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isFirstStore
            ? 'Get started by setting up billing and creating your restaurant.'
            : `You currently manage ${currentStoreCount} location${currentStoreCount !== 1 ? 's' : ''}. Add another to keep growing.`
          }
        </p>
      </div>

      {/* Your locations — visual overview (existing users only) */}
      {!isFirstStore && stores && stores.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Locations
          </p>
          <div className="flex flex-wrap gap-2">
            {stores.map((s) => (
              <div
                key={s.store_id}
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate max-w-[180px]">{s.store?.name}</span>
              </div>
            ))}
            <div className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-3 py-2">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">New location</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress steps — first store only */}
      {isFirstStore && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => step !== 'billing' && setStep('billing')}
            className="flex items-center gap-2"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              paymentMethodId
                ? 'bg-emerald-600 text-white'
                : step === 'billing'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {paymentMethodId ? <Check className="h-4 w-4" /> : <span className="text-sm font-semibold">1</span>}
            </div>
            <span className={`text-sm font-medium ${step === 'billing' || paymentMethodId ? 'text-foreground' : 'text-muted-foreground'}`}>
              Billing
            </span>
          </button>
          <div className="flex-1 h-px bg-border max-w-16" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              step === 'details'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              <span className="text-sm font-semibold">2</span>
            </div>
            <span className={`text-sm font-medium ${step === 'details' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Location
            </span>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ─── BILLING STEP (first store only) ─── */}
      {step === 'billing' && isFirstStore && (
        <div className="space-y-6">
          <BillingInfoCard showTrial={true} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Add a card to start your 30-day free trial. You won&apos;t be charged until the trial ends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientSecret ? (
                <PaymentForm
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  submitLabel="Continue to Location Details"
                />
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── DETAILS STEP ─── */}
      {step === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location form */}
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="storeName" className="text-sm font-medium">
                  Restaurant Name
                </Label>
                <Input
                  id="storeName"
                  placeholder="e.g., Mario's Kitchen — Downtown"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress" className="text-sm font-medium">
                  Address
                  <span className="text-muted-foreground font-normal ml-1.5">(optional)</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="storeAddress"
                    placeholder="e.g., 456 Main Street, Manchester"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    disabled={isLoading}
                    className="h-11 pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What happens next */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              After you create this location
            </p>
            <div className="grid gap-2.5">
              {[
                { icon: Clock, text: 'Set up operating hours and shift patterns' },
                { icon: Package, text: 'Add inventory items or import from another location' },
                { icon: Users, text: 'Invite your team and assign roles' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-50 p-1.5 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <span className="text-sm text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing summary — woven into the flow */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Price section */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {isFirstStore ? 'After your free trial' : 'Updated plan'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFirstStore
                      ? '30-day free trial, then:'
                      : 'Prorated for this billing period'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-semibold tracking-tight">
                    £{monthlyTotal}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              </div>

              {!isFirstStore && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {currentStoreCount} current location{currentStoreCount !== 1 ? 's' : ''}
                    </span>
                    <span className="tabular-nums">£{currentStoreCount * 299}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New location</span>
                    <span className="tabular-nums text-primary font-medium">+ £299</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-medium">
                    <span>{newTotal} total locations</span>
                    <span className="tabular-nums">£{monthlyTotal}/mo</span>
                  </div>
                </div>
              )}
            </div>

            {/* Guarantees */}
            <div className="border-t bg-muted/30 px-5 py-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {(isFirstStore
                  ? ['30-day free trial', 'Cancel anytime', 'All features included']
                  : ['Prorated billing', 'Cancel anytime', 'All features included']
                ).map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isFirstStore && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('billing')}
                disabled={isLoading}
                className="h-11"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={isLoading || !storeName.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating location...
                </>
              ) : (
                <>
                  {isFirstStore ? 'Create Location' : 'Add Location'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
