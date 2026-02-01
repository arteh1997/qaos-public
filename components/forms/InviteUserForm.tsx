'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { inviteUserSchema, InviteUserFormData } from '@/lib/validations/user'
import { Store, AppRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Mail } from 'lucide-react'
import { INVITE_ROLE_LABELS, INVITE_ROLE_DESCRIPTIONS, SINGLE_STORE_ROLES, INVITABLE_ROLES_BY_ROLE } from '@/lib/constants'

interface InviteUserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stores: Store[]
  onSubmit: (data: InviteUserFormData) => Promise<void>
  isLoading?: boolean
  inviterRole?: AppRole // Role of the person doing the inviting
}

export function InviteUserForm({
  open,
  onOpenChange,
  stores,
  onSubmit,
  isLoading,
  inviterRole = 'Owner',
}: InviteUserFormProps) {
  const form = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      role: undefined,
      storeId: undefined,
      storeIds: [],
    },
  })

  const selectedRole = form.watch('role')

  // Get available roles based on inviter's role
  const availableRoles = INVITABLE_ROLES_BY_ROLE[inviterRole] || []

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (data: InviteUserFormData) => {
    // For Driver role, clear storeId and use storeIds
    if (data.role === 'Driver') {
      data.storeId = undefined
    } else {
      // For non-Driver roles, clear storeIds
      data.storeIds = undefined
    }
    await onSubmit(data)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new team member. They&apos;ll complete their account setup when they accept.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  <FormDescription>
                    We&apos;ll send them an invitation link that expires in 1 hour
                  </FormDescription>
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
                  <FormDescription>
                    {selectedRole && INVITE_ROLE_DESCRIPTIONS[selectedRole as AppRole]}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Store selection - required for Co-Owner/Manager/Staff */}
            {selectedRole && (SINGLE_STORE_ROLES.includes(selectedRole as AppRole) || selectedRole === 'Owner') && (
              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedRole === 'Owner' ? 'Store to Co-Own' : 'Assigned Store'}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stores
                          .filter(s => s.is_active)
                          .map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {selectedRole === 'Owner' && 'Co-owners have full access to the store but cannot remove the billing owner'}
                      {selectedRole === 'Manager' && 'Managers have full operational access to their assigned store'}
                      {selectedRole === 'Staff' && 'Staff members can clock in/out and perform stock counts'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Multi-store selection for Drivers */}
            {selectedRole === 'Driver' && (
              <FormField
                control={form.control}
                name="storeIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Stores (Optional)</FormLabel>
                    <FormDescription className="mb-2">
                      Select the stores this driver can access. Leave empty to assign stores later.
                    </FormDescription>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {stores.filter(s => s.is_active).map((store) => {
                        const isChecked = field.value?.includes(store.id) ?? false
                        return (
                          <div key={store.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`invite-store-${store.id}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const currentValues = field.value ?? []
                                if (checked) {
                                  field.onChange([...currentValues, store.id])
                                } else {
                                  field.onChange(currentValues.filter(id => id !== store.id))
                                }
                              }}
                            />
                            <label
                              htmlFor={`invite-store-${store.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {store.name}
                            </label>
                          </div>
                        )
                      })}
                      {stores.filter(s => s.is_active).length === 0 && (
                        <p className="text-sm text-muted-foreground">No active stores available</p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
