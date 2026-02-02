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
import { BillingInfoCard } from '@/components/billing/BillingInfoCard'
import { PaymentForm } from '@/components/billing/PaymentForm'
import { ArrowLeft, ArrowRight, Loader2, Store, Check, AlertCircle, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

type Step = 'billing' | 'details'

export default function NewStorePage() {
  const router = useRouter()
  const { stores, refreshProfile, profile } = useAuth()
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
        const response = await fetch('/api/billing/setup-intent', {
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
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: storeName.trim(),
          address: storeAddress.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create store')
      }

      const storeData = await response.json()
      const storeId = storeData.data.id

      // Step 2: Create subscription if this is first store or we have new payment method
      if (paymentMethodId) {
        const subscriptionResponse = await fetch('/api/billing/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            payment_method_id: paymentMethodId,
          }),
        })

        if (!subscriptionResponse.ok) {
          console.error('Subscription creation failed')
          // Store was created, subscription failed - notify but continue
          toast.error('Store created but billing setup incomplete. Please contact support.')
        }
      }

      toast.success('Store created successfully!')

      // Refresh auth context to get the new store
      await refreshProfile()

      // Redirect to the new store
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isFirstStore ? 'Create Your First Store' : 'Add New Location'}
          </h1>
          <p className="text-muted-foreground">
            {isFirstStore
              ? 'Set up billing and create your store to get started'
              : 'Expand your business with another restaurant location'
            }
          </p>
        </div>
      </div>

      {/* Progress indicator for first store */}
      {isFirstStore && (
        <div className="flex items-center gap-4 max-w-4xl">
          <div className={`flex items-center gap-2 ${step === 'billing' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'billing' ? 'bg-primary text-primary-foreground' :
              paymentMethodId ? 'bg-green-600 text-white' : 'bg-muted'
            }`}>
              {paymentMethodId ? <Check className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </div>
            <span className="text-sm font-medium">Billing</span>
          </div>
          <div className="flex-1 h-px bg-border max-w-24" />
          <div className={`flex items-center gap-2 ${step === 'details' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'details' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Store className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Store Details</span>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="max-w-4xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Billing (for first store) */}
      {step === 'billing' && isFirstStore && (
        <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
          <BillingInfoCard showTrial={true} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
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
                  submitLabel="Continue to Store Details"
                />
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Store Details (or main view for existing users) */}
      {step === 'details' && (
        <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
          {/* Store Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Location Details
              </CardTitle>
              <CardDescription>
                Enter the details for your {isFirstStore ? '' : 'new '}restaurant location.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Restaurant Name *</Label>
                  <Input
                    id="storeName"
                    placeholder="e.g., Mario's Kitchen - Downtown"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    disabled={isLoading}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeAddress">Address (optional)</Label>
                  <Input
                    id="storeAddress"
                    placeholder="e.g., 456 Main Street, Manchester"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  {isFirstStore && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep('billing')}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        {isFirstStore ? 'Create Store' : 'Add Location'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Billing Summary */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle>Billing Summary</CardTitle>
              <CardDescription>
                {isFirstStore
                  ? 'Your 30-day free trial starts today.'
                  : 'Your subscription will be updated automatically.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isFirstStore && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current locations</span>
                    <span>{currentStoreCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New location</span>
                    <span>+1</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total locations</span>
                    <span>{newTotal}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-background p-4 border">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">
                    {isFirstStore ? 'After trial ends' : 'New monthly total'}
                  </span>
                  <div>
                    <span className="text-2xl font-bold">£{monthlyTotal}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  £299 × {newTotal} location{newTotal > 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                {isFirstStore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>30-day free trial included</span>
                  </div>
                )}
                {!isFirstStore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Prorated billing for this period</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Cancel any location anytime</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  <span>All features included</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
