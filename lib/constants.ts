import { AppRole, LegacyAppRole } from '@/types'

// Role definitions - 3 roles: Owner, Manager, Staff
export const ROLES: AppRole[] = ['Owner', 'Manager', 'Staff']

// Roles available when inviting users (Owner shows as "Co-Owner" in UI)
// Note: "Owner" role is only automatically assigned when someone creates & pays for a store
// When inviting, "Owner" role means "Co-Owner" (has Owner privileges but not billing owner)
export const INVITE_ROLES: AppRole[] = ['Owner', 'Manager', 'Staff']

// Display labels for invite form (maps Owner -> Co-Owner for clarity)
export const INVITE_ROLE_LABELS: Record<AppRole, string> = {
  Owner: 'Co-Owner',
  Manager: 'Manager',
  Staff: 'Staff',
}

// Descriptions for invite form
export const INVITE_ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  Owner: 'Full access to the store as a co-owner. Cannot remove the billing owner.',
  Manager: 'Full operational access to their assigned store. Can manage inventory and shifts.',
  Staff: 'Can clock in/out, do stock counts, receive deliveries, and view reports.',
}

// Legacy roles for backward compatibility during migration
export const LEGACY_ROLES: LegacyAppRole[] = ['Admin', 'Driver', 'Staff']

// Roles that can manage store settings (create/update/delete)
export const STORE_MANAGEMENT_ROLES: AppRole[] = ['Owner', 'Manager']

// Roles that can manage users at a store
export const USER_MANAGEMENT_ROLES: AppRole[] = ['Owner']

// Roles that can have access to multiple stores
export const MULTI_STORE_ROLES: AppRole[] = ['Owner']

// Roles that are typically single-store focused
export const SINGLE_STORE_ROLES: AppRole[] = ['Manager', 'Staff']

// Permission definitions - now store-contextual
export const PERMISSIONS = {
  // Store management permissions
  CREATE_STORE: ['Owner'] as AppRole[], // Requires billing
  MANAGE_STORE_SETTINGS: ['Owner', 'Manager'] as AppRole[],
  DELETE_STORE: ['Owner'] as AppRole[], // Only billing owner

  // User management at store level
  INVITE_USERS: ['Owner'] as AppRole[],
  MANAGE_USERS: ['Owner', 'Manager'] as AppRole[],
  VIEW_STORE_USERS: ['Owner', 'Manager'] as AppRole[],

  // Inventory permissions
  MANAGE_INVENTORY_ITEMS: ['Owner', 'Manager'] as AppRole[],
  VIEW_INVENTORY_ITEMS: ['Owner', 'Manager', 'Staff'] as AppRole[],

  // Stock permissions
  DO_STOCK_COUNT: ['Owner', 'Manager', 'Staff'] as AppRole[],
  DO_STOCK_RECEPTION: ['Owner', 'Manager', 'Staff'] as AppRole[],
  DO_STOCK_ADJUSTMENT: ['Owner', 'Manager'] as AppRole[],
  VIEW_STOCK_HISTORY: ['Owner', 'Manager', 'Staff'] as AppRole[],

  // Shift permissions
  MANAGE_SHIFTS: ['Owner', 'Manager'] as AppRole[],
  VIEW_ALL_SHIFTS: ['Owner', 'Manager'] as AppRole[],
  VIEW_OWN_SHIFTS: ['Staff'] as AppRole[],

  // Report permissions
  VIEW_REPORTS: ['Owner', 'Manager', 'Staff'] as AppRole[],
  VIEW_DETAILED_REPORTS: ['Owner', 'Manager'] as AppRole[],

  // Billing permissions
  // NOTE: These role-based permissions are a fallback. Billing access should
  // ALWAYS check is_billing_owner === true on the store_users entry, not just role.
  // Only the billing owner (the person who pays) should access billing.
  // Co-Owners (role='Owner' but is_billing_owner=false) should NOT have billing access.
  MANAGE_BILLING: [] as AppRole[], // Must check is_billing_owner directly
  VIEW_BILLING: [] as AppRole[], // Must check is_billing_owner directly
} as const

// Route configurations
export const PUBLIC_ROUTES = [
  '/',              // Landing page (smart: shows dashboard if logged in)
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/onboard',
  '/onboarding',    // New user onboarding
  '/offline',
  '/terms',         // Terms of Service
  '/privacy',       // Privacy Policy
  '/cookies',       // Cookie Policy
  '/portal',        // Supplier portal (token-authenticated, no user session needed)
]

// Roles that each role can invite
// Owner/Co-Owner can invite: Co-Owner, Manager, Staff
// Manager can only invite: Staff
export const INVITABLE_ROLES_BY_ROLE: Record<AppRole, AppRole[]> = {
  Owner: ['Owner', 'Manager', 'Staff'], // Owner shown as Co-Owner in UI
  Manager: ['Staff'],
  Staff: [],
}

export const PROTECTED_ROUTES = [
  '/',
  '/inventory',
  '/users',
  '/reports',
  '/shifts',
  '/my-shifts',
  '/payroll',
  '/my-pay',
  '/billing',
  '/settings',
]

// Role-specific route access
export const ROLE_ROUTES: Record<AppRole, string[]> = {
  Owner: [
    '/',
    '/inventory',
    '/users',
    '/shifts',
    '/payroll',
    '/reports',
    '/reports/daily-summary',
    '/reports/low-stock',
    '/billing',
    '/settings',
  ],
  Manager: [
    '/',
    '/inventory',
    '/users',
    '/shifts',
    '/payroll',
    '/reports',
    '/reports/daily-summary',
    '/reports/low-stock',
    '/settings',
  ],
  Staff: [
    '/',
    '/my-shifts',
    '/my-pay',
    '/deliveries',
    '/reports',
    '/reports/daily-summary',
    '/reports/low-stock',
  ],
}

// Legacy route mapping for backward compatibility
export const LEGACY_ROLE_ROUTES: Record<LegacyAppRole, string[]> = {
  Admin: ROLE_ROUTES.Owner,
  Driver: ROLE_ROUTES.Staff,
  Staff: ROLE_ROUTES.Staff,
}

// Units of measure
export const UNITS_OF_MEASURE = [
  'each',
  'lb',
  'oz',
  'kg',
  'g',
  'gallon',
  'liter',
  'case',
  'box',
  'bag',
  'bottle',
  'can',
  'pack',
]

// Role display labels
export const ROLE_LABELS: Record<AppRole, string> = {
  Owner: 'Owner',
  Manager: 'Manager',
  Staff: 'Staff',
}

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  Owner: 'Full access to all stores they own. Can invite users and manage billing.',
  Manager: 'Full operational access to their assigned store. Can manage inventory and shifts.',
  Staff: 'Can clock in/out, do stock counts, receive deliveries, and view reports.',
}
