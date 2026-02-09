'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Store, AppRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INVITE_ROLE_LABELS, INVITE_ROLE_DESCRIPTIONS, INVITABLE_ROLES_BY_ROLE } from '@/lib/constants'
import { Loader2, Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const teamInviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Owner', 'Manager', 'Staff', 'Driver'], {
    message: 'Please select a role',
  }),
})

type TeamInviteFormData = z.infer<typeof teamInviteSchema>

interface TeamSetupStepProps {
  store: Store
  onComplete: () => void
}

export function TeamSetupStep({ store, onComplete }: TeamSetupStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Owner inviting to their store - they can invite all roles including co-owners
  const availableRoles = INVITABLE_ROLES_BY_ROLE['Owner']

  const form = useForm<TeamInviteFormData>({
    resolver: zodResolver(teamInviteSchema),
    defaultValues: {
      email: '',
      role: undefined,
    },
  })

  const selectedRole = form.watch('role')

  const handleSubmit = async (data: TeamInviteFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          storeId: data.role !== 'Driver' ? store.id : undefined,
          storeIds: data.role === 'Driver' ? [store.id] : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send invitation')
      }

      form.reset()
      // Show different message if user was added directly vs invited
      if (result.addedToExisting) {
        toast.success(result.message || `${data.email} has been added to the store!`)
      } else {
        toast.success(`Invitation sent to ${data.email}!`)
      }
      onComplete()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Invite team members to help manage your store. They&apos;ll receive an email to complete their account setup.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="teammate@example.com"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {INVITE_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {selectedRole && (
            <FormDescription>
              {INVITE_ROLE_DESCRIPTIONS[selectedRole as AppRole]}
            </FormDescription>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
