'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/forms/LoginForm'
import { SignupForm } from '@/components/forms/SignupForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import Link from 'next/link'

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function AuthContent() {
  const searchParams = useSearchParams()
  const signupParam = searchParams.get('signup')
  const [activeTab, setActiveTab] = useState(signupParam === 'true' ? 'signup' : 'signin')

  // Update tab when URL parameter changes
  useEffect(() => {
    if (signupParam === 'true') {
      setActiveTab('signup')
    }
  }, [signupParam])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-xl font-bold text-primary-foreground">R</span>
          </div>
          <span className="text-2xl font-bold text-foreground">RestaurantOS</span>
        </Link>

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              {activeTab === 'signin' ? 'Welcome back' : 'Get started'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'signin'
                ? 'Sign in to manage your restaurant'
                : 'Create your account to start your free trial'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <Suspense fallback={<FormSkeleton />}>
                  <LoginForm />
                </Suspense>
              </TabsContent>

              <TabsContent value="signup">
                <Suspense fallback={<FormSkeleton />}>
                  <SignupForm onSuccess={() => setActiveTab('signin')} />
                </Suspense>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Skeleton className="h-8 w-32 mx-auto" />
            </CardHeader>
            <CardContent>
              <FormSkeleton />
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
