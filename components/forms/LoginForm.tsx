'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

// Validate redirect URL to prevent open redirect attacks
function getSafeRedirect(redirect: string | null): string {
  if (!redirect) return '/'

  // Only allow relative paths starting with /
  // Reject absolute URLs, protocol-relative URLs, and paths with ..
  if (
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    redirect.includes('..') ||
    redirect.includes('://')
  ) {
    return '/'
  }

  return redirect
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = getSafeRedirect(searchParams.get('redirect'))

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setRetryAfter(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          setRetryAfter(result.retryAfter || 60)
          toast.error(result.message || 'Too many attempts. Please try again later.')
        } else {
          toast.error(result.message || 'Invalid email or password')
        }
        return
      }

      toast.success('Logged in successfully')
      router.push(redirect)
      router.refresh()
    } catch {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  // Prevent native form submission from exposing credentials in URL
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    form.handleSubmit(onSubmit)(e)
  }

  return (
    <Form {...form}>
      <form
        method="post"
        action="#"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...field}
                />
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
                <Input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || form.formState.isSubmitting || retryAfter !== null}>
          {(isLoading || form.formState.isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {retryAfter !== null ? `Try again in ${retryAfter}s` : 'Sign In'}
        </Button>

        {retryAfter !== null && (
          <p className="text-sm text-muted-foreground text-center">
            Too many login attempts. Please wait before trying again.
          </p>
        )}
      </form>
    </Form>
  )
}
