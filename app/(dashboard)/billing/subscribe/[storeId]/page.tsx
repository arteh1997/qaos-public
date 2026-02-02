'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, CreditCard, Shield, Check, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { BILLING_CONFIG, getMonthlyPriceDisplay } from '@/lib/stripe/billing-config'
import Link from 'next/link'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PageProps {
  params: Promise<{ storeId: string }>
}

function PaymentForm({
  storeId,
  onSuccess
}: {
  storeId: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Confirm the setup intent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        throw new Error(confirmError.message || 'Failed to confirm payment method')
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('No payment method returned')
      }

      // Create the subscription
      const subscriptionResponse = await fetch('/api/billing/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          payment_method_id: setupIntent.payment_method,
        }),
      })

      if (!subscriptionResponse.ok) {
        const data = await subscriptionResponse.json()
        throw new Error(data.message || 'Failed to create subscription')
      }

      toast.success('Subscription created! Your 30-day trial has started.')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PaymentElement />

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!stripe || !elements || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Start Free Trial
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You won&apos;t be charged until your {BILLING_CONFIG.TRIAL_DAYS}-day trial ends.
        Cancel anytime.
      </p>
    </form>
  )
}

export default function SubscribePage({ params }: PageProps) {
  const { storeId } = use(params)
  const router = useRouter()
  const { stores, isLoading: authLoading } = useAuth()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const store = stores?.find(s => s.store_id === storeId)
  const isOwner = store?.role === 'Owner'
  const monthlyPrice = getMonthlyPriceDisplay()

  useEffect(() => {
    async function createSetupIntent() {
      if (authLoading) return

      if (!isOwner) {
        setError('Only store owners can manage subscriptions')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/billing/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!response.ok) {
          throw new Error('Failed to initialize payment')
        }

        const data = await response.json()
        setClientSecret(data.data.clientSecret)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment form')
      } finally {
        setIsLoading(false)
      }
    }

    createSetupIntent()
  }, [authLoading, isOwner])

  const handleSuccess = () => {
    router.push('/billing')
  }

  if (authLoading || isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/billing">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/billing">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Subscribe: {store?.store?.name}
        </h1>
        <p className="text-muted-foreground">
          Start your {BILLING_CONFIG.TRIAL_DAYS}-day free trial
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>
              Enter your card to start your free trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#0f172a',
                    },
                  },
                }}
              >
                <PaymentForm storeId={storeId} onSuccess={handleSuccess} />
              </Elements>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Store Subscription</span>
                <span className="font-semibold">{monthlyPrice}/month</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Free Trial</span>
                <span>{BILLING_CONFIG.TRIAL_DAYS} days</span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Due Today</span>
                <span className="text-green-600">£0.00</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your card will be charged {monthlyPrice} on{' '}
                {new Date(Date.now() + BILLING_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Full Access</p>
                  <p className="text-sm text-muted-foreground">
                    All features included during trial
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Cancel Anytime</p>
                  <p className="text-sm text-muted-foreground">
                    No commitment, cancel before trial ends
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Secure Payment</p>
                  <p className="text-sm text-muted-foreground">
                    Powered by Stripe
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
