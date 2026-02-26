'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePortalAuth } from '@/hooks/useSupplierPortal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Truck } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Supplier Portal Login Page
 *
 * Suppliers enter their portal token (received via email) to access the portal.
 * No user account required — token-based authentication.
 */
export default function PortalLoginPage() {
  const router = useRouter()
  const { setToken, isAuthenticated } = usePortalAuth()
  const [tokenInput, setTokenInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // If already authenticated, redirect to orders
  if (isAuthenticated) {
    router.replace('/portal/orders')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = tokenInput.trim()
    if (!trimmed) return

    setIsLoading(true)
    try {
      // Validate token by making a test API call
      const res = await fetch('/api/supplier-portal/orders?page=1', {
        headers: { Authorization: `Bearer ${trimmed}` },
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Invalid token')
        return
      }

      setToken(trimmed)
      toast.success('Welcome to the Supplier Portal')
      router.push('/portal/orders')
    } catch {
      toast.error('Failed to verify token. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Supplier Portal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your portal access token to manage orders, invoices, and your product catalog.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="token" className="text-sm font-medium">
                Access Token
              </label>
              <Input
                id="token"
                type="password"
                placeholder="sp_live_..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You should have received this token via email from your customer.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !tokenInput.trim()}>
              {isLoading ? 'Verifying...' : 'Access Portal'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
