'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, OnboardingFormData } from '@/lib/validations/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

type InviteStatus = 'loading' | 'valid' | 'expired' | 'invalid' | 'used'

interface InviteDetails {
  email: string
  role: string
  storeName?: string
  expiresAt?: string
}

// Returns minutes until expiry, or null if no expiry set
function getMinutesUntilExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60)))
}

function OnboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading')
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      token: token || '',
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInviteStatus('invalid')
        return
      }

      try {
        const response = await fetch(`/api/users/onboard/validate?token=${token}`)
        const result = await response.json()

        if (!response.ok) {
          if (response.status === 410) {
            setInviteStatus('expired')
          } else if (response.status === 409) {
            setInviteStatus('used')
          } else {
            setInviteStatus('invalid')
          }
          return
        }

        setInviteDetails(result.data)
        setInviteStatus('valid')
        form.setValue('token', token)

        // Calculate initial time remaining
        const mins = getMinutesUntilExpiry(result.data.expiresAt)
        setMinutesRemaining(mins)
      } catch {
        setInviteStatus('invalid')
      }
    }

    validateToken()
  }, [token, form])

  // Update countdown timer every minute
  useEffect(() => {
    if (!inviteDetails?.expiresAt || inviteStatus !== 'valid') return

    const interval = setInterval(() => {
      const mins = getMinutesUntilExpiry(inviteDetails.expiresAt)
      setMinutesRemaining(mins)

      // If expired, update status
      if (mins !== null && mins <= 0) {
        setInviteStatus('expired')
      }
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [inviteDetails?.expiresAt, inviteStatus])

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/users/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to complete registration')
      }

      toast.success('Account created successfully! Redirecting to login...')

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login?onboarded=true')
      }, 2000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete registration')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (inviteStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verifying your invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invalid or missing token
  if (inviteStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
              <p className="text-muted-foreground mb-6">
                This invitation link is invalid or has been corrupted. Please contact your administrator
                for a new invitation.
              </p>
              <Button onClick={() => router.push('/login')}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired token
  if (inviteStatus === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
              <p className="text-muted-foreground mb-6">
                This invitation has expired. Invitations are valid for 1 hour. Please contact
                your administrator to resend the invitation.
              </p>
              <Button onClick={() => router.push('/login')}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already used token
  if (inviteStatus === 'used') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Already Registered</h2>
              <p className="text-muted-foreground mb-6">
                This invitation has already been used. If you&apos;ve completed your registration,
                you can log in with your credentials.
              </p>
              <Button onClick={() => router.push('/login')}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Valid invitation - show registration form
  const roleDisplay = inviteDetails?.role === 'Owner' ? 'Co-Owner' : inviteDetails?.role

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 text-4xl">
            Welcome
          </div>
          <CardTitle className="text-2xl">Complete Your Account</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a <strong>{roleDisplay}</strong>
            {inviteDetails?.storeName && <> at <strong>{inviteDetails.storeName}</strong></>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Expiry warning - show when less than 15 minutes remaining */}
          {minutesRemaining !== null && minutesRemaining <= 15 && minutesRemaining > 0 && (
            <Alert className="mb-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                This invitation expires in {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''}. Please complete your registration soon.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email display */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{inviteDetails?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a secure password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      At least 8 characters with uppercase, lowercase, and number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting || form.formState.isSubmitting}>
                {(isSubmitting || form.formState.isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <OnboardContent />
    </Suspense>
  )
}
