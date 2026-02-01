'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabaseUpdate } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import {
  Shield,
  Truck,
  UserCircle,
  Mail,
  Calendar,
  Store,
  Loader2,
  CheckCircle,
  Crown,
  Briefcase,
} from 'lucide-react'
import { AppRole, LegacyAppRole } from '@/types'
import { normalizeRole } from '@/lib/auth'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const { user, profile, role, storeId, isLoading, refreshProfile } = useAuth()
  const { data: assignedStore } = useStore(storeId)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
    },
    values: {
      full_name: profile?.full_name || '',
    },
  })

  const roleConfig: Record<AppRole, {
    icon: typeof Shield
    color: string
    bg: string
    borderColor: string
    label: string
    description: string
  }> = {
    Owner: {
      icon: Crown,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      label: 'Owner',
      description: 'Full access to owned stores, billing, and user management',
    },
    Manager: {
      icon: Briefcase,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      label: 'Manager',
      description: 'Full operational access to assigned store',
    },
    Driver: {
      icon: Truck,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      label: 'Driver',
      description: 'Can manage deliveries and stock reception across stores',
    },
    Staff: {
      icon: UserCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      label: 'Staff Member',
      description: 'Can clock in/out and perform stock counts',
    },
  }

  // Normalize role (handles legacy Admin -> Owner mapping)
  const normalizedRole = normalizeRole(role as AppRole | LegacyAppRole | null)
  const currentRole = normalizedRole ? roleConfig[normalizedRole] : null
  const RoleIcon = currentRole?.icon

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || profile?.email?.[0]?.toUpperCase() || '?'

  async function onSubmit(data: ProfileFormData) {
    if (!user) return

    setIsSaving(true)
    try {
      const { error } = await supabaseUpdate('profiles', user.id, {
        full_name: data.full_name,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error

      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error('Failed to update profile: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">{profile?.full_name || 'User'}</CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" />
                {profile?.email}
              </CardDescription>
              {currentRole && RoleIcon && (
                <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-sm font-medium ${currentRole.bg} ${currentRole.color}`}>
                  <RoleIcon className="h-4 w-4" />
                  {currentRole.label}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Information</CardTitle>
          <CardDescription>
            Details about your account and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Email Address</p>
              <p className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {profile?.email}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Account Status</p>
              <p className="text-sm flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${profile?.status === 'Active' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                {profile?.status || 'Unknown'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Member Since</p>
              <p className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Unknown'}
              </p>
            </div>
            {storeId && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Assigned Store</p>
                <p className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  {assignedStore?.name || 'Loading...'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role & Permissions */}
      {currentRole && RoleIcon && (
        <Card className={`border-2 ${currentRole.borderColor}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RoleIcon className={`h-5 w-5 ${currentRole.color}`} />
              Role & Permissions
            </CardTitle>
            <CardDescription>
              Your current role and what you can do
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg ${currentRole.bg}`}>
              <p className={`font-semibold ${currentRole.color}`}>{currentRole.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentRole.description}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Contact an administrator if you need different permissions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
