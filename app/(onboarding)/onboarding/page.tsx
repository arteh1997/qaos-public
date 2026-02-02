'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, ArrowRight, Loader2, Store, Package, Users, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

const features = [
  { icon: Package, text: 'Unlimited inventory items' },
  { icon: Users, text: 'Unlimited team members' },
  { icon: Store, text: 'Multi-location support' },
  { icon: BarChart3, text: 'Reports & analytics' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, stores, refreshProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')

  // Redirect if user already has stores
  if (stores && stores.length > 0) {
    router.push('/')
    return null
  }

  // Redirect if not logged in
  if (!user) {
    router.push('/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!storeName.trim()) {
      toast.error('Please enter a store name')
      return
    }

    setIsLoading(true)

    try {
      // For now, we'll create the store directly
      // TODO: Integrate Stripe checkout here
      // After Stripe payment succeeds, create the store via webhook or return URL

      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: storeName.trim(),
          address: storeAddress.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create store')
      }

      toast.success('Store created successfully!')

      // Refresh auth context to get the new store
      await refreshProfile()

      // Redirect to dashboard
      router.push('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Welcome to RestaurantOS
        </h1>
        <p className="text-muted-foreground">
          Let&apos;s set up your first restaurant location.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Store Setup Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Restaurant</CardTitle>
            <CardDescription>
              Enter your restaurant details to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Restaurant Name *</Label>
                <Input
                  id="storeName"
                  placeholder="e.g., Mario's Kitchen"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeAddress">Address (optional)</Label>
                <Input
                  id="storeAddress"
                  placeholder="e.g., 123 High Street, London"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* What You Get */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Professional Plan
              <span className="text-2xl font-bold">£299<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
            </CardTitle>
            <CardDescription>
              Everything you need to run your restaurant efficiently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
