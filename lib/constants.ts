import { AppRole } from '@/types'

// Role definitions - Only 3 roles (NO Manager)
export const ROLES: AppRole[] = ['Admin', 'Driver', 'Staff']

// Roles with global access (can see all stores)
export const GLOBAL_ACCESS_ROLES: AppRole[] = ['Admin', 'Driver']

// Roles that are store-scoped (can only see assigned store)
export const STORE_SCOPED_ROLES: AppRole[] = ['Staff']

// Permission definitions
export const PERMISSIONS = {
  // Store permissions
  MANAGE_STORES: ['Admin'] as AppRole[],
  VIEW_ALL_STORES: ['Admin', 'Driver'] as AppRole[],

  // User permissions
  MANAGE_USERS: ['Admin'] as AppRole[],
  VIEW_ALL_USERS: ['Admin'] as AppRole[],

  // Inventory permissions
  MANAGE_INVENTORY_ITEMS: ['Admin'] as AppRole[],
  VIEW_INVENTORY_ITEMS: ['Admin', 'Driver', 'Staff'] as AppRole[],

  // Stock permissions
  DO_STOCK_COUNT: ['Admin', 'Staff'] as AppRole[],
  DO_STOCK_RECEPTION: ['Admin', 'Driver'] as AppRole[],
  VIEW_ALL_STOCK: ['Admin', 'Driver'] as AppRole[],

  // Shift permissions
  MANAGE_SHIFTS: ['Admin'] as AppRole[],
  VIEW_OWN_SHIFTS: ['Staff'] as AppRole[],

  // Report permissions
  VIEW_REPORTS: ['Admin', 'Driver'] as AppRole[],
} as const

// Route configurations
export const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/offline',
]

export const PROTECTED_ROUTES = [
  '/',
  '/inventory',
  '/stores',
  '/users',
  '/reports',
  '/my-shifts',
]

// Role-specific route access
export const ROLE_ROUTES: Record<AppRole, string[]> = {
  Admin: [
    '/',
    '/inventory',
    '/stores',
    '/users',
    '/reports',
    '/reports/daily-summary',
    '/reports/low-stock',
  ],
  Driver: [
    '/',
    '/stores',
    '/reports',
    '/reports/daily-summary',
    '/reports/low-stock',
  ],
  Staff: [
    '/',
    '/stores',
    '/my-shifts',
  ],
}

// Categories for inventory items (matching Mr Fries inventory)
export const INVENTORY_CATEGORIES = [
  'Fries',
  'Proteins',
  'Dairy',
  'Sauces',
  'Italian',
  'Prepared',
  'Produce',
  'Supplies',
  'Packaging',
  'Drinks',
  'Frozen',
]

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
