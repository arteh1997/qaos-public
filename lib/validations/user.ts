import { z } from 'zod'

// Role system: Owner, Manager, Staff
// Owner: Full access to owned stores, billing, invite users
// Manager: Full operational access to assigned store
// Staff: Clock in/out, stock counts, deliveries, reports at assigned store

// New invite schema - email-based invitation flow
// User only enters email and role, plus assigned store
// The invitee completes their profile during onboarding
export const inviteUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Owner', 'Manager', 'Staff'], {
    message: 'Please select a role',
  }),
  storeId: z.string().optional(),
  storeIds: z.array(z.string()).optional(), // Legacy field
}).refine((data) => {
  // All roles must have a store assigned
  if (!data.storeId) {
    return false
  }
  return true
}, {
  message: 'Please select a store',
  path: ['storeId'],
})

// Legacy invite schema with fullName (kept for backward compatibility)
export const legacyInviteUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['Owner', 'Manager', 'Staff'], {
    message: 'Please select a role',
  }),
  storeId: z.string().optional(),
}).refine((data) => {
  if (!data.storeId) {
    return false
  }
  return true
}, {
  message: 'Please select a store',
  path: ['storeId'],
})

// Onboarding schema - for when invitee completes registration
export const onboardingSchema = z.object({
  token: z.string().min(1, 'Invalid invitation token'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  role: z.enum(['Owner', 'Manager', 'Staff']).optional(),
  storeId: z.string().nullable().optional(),
  status: z.enum(['Invited', 'Active', 'Inactive']).optional(),
})

// Schema for adding a user to a store (store_users)
export const addUserToStoreSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  storeId: z.string().uuid('Invalid store ID'),
  role: z.enum(['Owner', 'Manager', 'Staff'], {
    message: 'Please select a role',
  }),
  isBillingOwner: z.boolean().default(false),
})

export type InviteUserFormData = z.infer<typeof inviteUserSchema>
export type LegacyInviteUserFormData = z.infer<typeof legacyInviteUserSchema>
export type OnboardingFormData = z.infer<typeof onboardingSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
export type AddUserToStoreFormData = z.infer<typeof addUserToStoreSchema>
