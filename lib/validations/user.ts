import { z } from 'zod'

export const inviteUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['Admin', 'Driver', 'Staff'], {
    message: 'Please select a role',
  }),
  storeId: z.string().optional(),
}).refine((data) => {
  // Staff must have a store assigned
  if (data.role === 'Staff' && !data.storeId) {
    return false
  }
  return true
}, {
  message: 'Staff members must be assigned to a store',
  path: ['storeId'],
})

export const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  role: z.enum(['Admin', 'Driver', 'Staff']).optional(),
  storeId: z.string().nullable().optional(),
  status: z.enum(['Invited', 'Active', 'Inactive']).optional(),
})

export type InviteUserFormData = z.infer<typeof inviteUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
