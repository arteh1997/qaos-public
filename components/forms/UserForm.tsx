'use client'

import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateUserSchema, UpdateUserFormData } from '@/lib/validations/user'
import { Profile, Store, StoreUser } from '@/types'
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
import { Loader2 } from 'lucide-react'
import { INVITE_ROLES, INVITE_ROLE_LABELS, INVITE_ROLE_DESCRIPTIONS, SINGLE_STORE_ROLES } from '@/lib/constants'
import { AppRole, LegacyAppRole } from '@/types'
import { normalizeRole } from '@/lib/auth'

// Extended profile type with store_users for getting current driver stores
type ProfileWithStoreUsers = Profile & {
  store_users?: Pick<StoreUser, 'store_id' | 'role'>[]
}

interface UserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ProfileWithStoreUsers | null
  stores: Store[]
  onSubmit: (data: UpdateUserFormData) => Promise<void>
  isLoading?: boolean
}

export function UserForm({
  open,
  onOpenChange,
  user,
  stores,
  onSubmit,
  isLoading,
}: UserFormProps) {
  const form = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: '',
      role: undefined,
      storeId: undefined,
      storeIds: [],
      status: undefined,
    },
  })

  // Reset form when user changes or dialog opens
  useEffect(() => {
    if (user && open) {
      // Normalize legacy roles (Admin -> Owner)
      const normalizedRole = normalizeRole(user.role as AppRole | LegacyAppRole) ?? undefined

      // Get current store IDs for drivers from store_users
      const currentStoreIds = user.store_users
        ?.filter(su => su.role === 'Driver')
        .map(su => su.store_id) ?? []

      form.reset({
        fullName: user.full_name ?? '',
        role: normalizedRole,
        storeId: user.store_id ?? undefined,
        storeIds: currentStoreIds,
        status: user.status,
      })
    }
  }, [user, open, form])

  const selectedRole = form.watch('role')

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  const handleSubmit = async (data: UpdateUserFormData) => {
    // Clear store_id for Driver role (they use storeIds instead)
    // Clear storeIds for non-Driver roles (they use storeId instead)
    if (data.role === 'Driver') {
      data.storeId = null
    } else {
      data.storeIds = undefined
    }
    await onSubmit(data)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details, role, and store assignment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              <p><strong>Email:</strong> {user.email}</p>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                      {INVITE_ROLES.map((role) => (
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
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
                      {selectedRole === 'Manager' && 'Managers are assigned to a specific store'}
                      {selectedRole === 'Staff' && 'Staff members must be assigned to a specific store'}
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
                    <FormLabel>Assigned Stores</FormLabel>
                    <FormDescription className="mb-2">
                      Select the stores this driver can access for deliveries and receptions.
                    </FormDescription>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {stores.filter(s => s.is_active).map((store) => {
                        const isChecked = field.value?.includes(store.id) ?? false
                        return (
                          <div key={store.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`store-${store.id}`}
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
                              htmlFor={`store-${store.id}`}
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

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Invited">Invited</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
