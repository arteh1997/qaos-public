'use client'

import { useState, useEffect } from 'react'
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Lock } from 'lucide-react'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
)

interface PaymentFormProps {
  onSuccess: (paymentMethodId: string) => void
  onError?: (error: string) => void
  submitLabel?: string
  isSubmitting?: boolean
}

function PaymentFormContent({
  onSuccess,
  onError,
  submitLabel = 'Add Payment Method',
  isSubmitting: externalSubmitting = false,
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Confirm the SetupIntent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Failed to confirm payment method')
        onError?.(confirmError.message || 'Failed to confirm payment method')
      } else if (setupIntent && setupIntent.status === 'succeeded') {
        // Extract payment method ID
        const paymentMethodId = setupIntent.payment_method as string
        onSuccess(paymentMethodId)
      } else {
        setError('Unexpected error. Please try again.')
        onError?.('Unexpected error. Please try again.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      onError?.(message)
    } finally {
      setIsLoading(false)
    }
  }

  const isSubmittingAny = isLoading || externalSubmitting

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Your payment info is securely processed by Stripe</span>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || !elements || isSubmittingAny}
      >
        {isSubmittingAny && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}

interface PaymentFormWrapperProps extends PaymentFormProps {
  clientSecret: string
}

export function PaymentForm({ clientSecret, ...props }: PaymentFormWrapperProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0f172a',
            colorBackground: '#ffffff',
            colorText: '#1e293b',
            colorDanger: '#dc2626',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
          rules: {
            '.Input': {
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid #0f172a',
              boxShadow: '0 0 0 1px #0f172a',
            },
            '.Label': {
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '6px',
            },
          },
        },
      }}
    >
      <PaymentFormContent {...props} />
    </Elements>
  )
}
