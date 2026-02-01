'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Loader2, Store, Check } from 'lucide-react'
import { toast } from 'sonner'

export default function NewStorePage() {
  const router = useRouter()
  const { stores, refreshProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')

  const currentStoreCount = stores?.length || 0
  const newTotal = currentStoreCount + 1
  const monthlyTotal = newTotal * 299

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!storeName.trim()) {
      toast.error('Please enter a store name')
      return
    }

    setIsLoading(true)

    try {
      // TODO: For paid stores, integrate Stripe checkout here
      // After payment succeeds, create the store

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

      // Redirect to stores list or dashboard
      router.push('/stores')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/stores">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Location</h1>
          <p className="text-muted-foreground">
            Expand your business with another restaurant location
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        {/* Store Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Location Details
            </CardTitle>
            <CardDescription>
              Enter the details for your new restaurant location.
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Add Location
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle>Billing Summary</CardTitle>
            <CardDescription>
              Your subscription will be updated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="rounded-lg bg-background p-4 border">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">New monthly total</span>
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
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>Prorated billing for this period</span>
              </div>
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
    </div>
  )
}
