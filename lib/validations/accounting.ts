import { z } from 'zod'

// GL account mapping — maps expense categories to accounting GL codes
export const glMappingSchema = z.object({
  gl_mappings: z.record(z.string(), z.string()).optional(), // { "Produce": "5100", "Dairy": "5200" }
  auto_sync: z.boolean().optional(),
  sync_invoices: z.boolean().optional(),
  sync_purchase_orders: z.boolean().optional(),
})

// Trigger a manual sync
export const triggerSyncSchema = z.object({
  entity_type: z.enum(['invoice', 'bill', 'purchase_order']).optional(),
  entity_id: z.string().uuid().optional(),
})

// OAuth state validation
export const XERO_OAUTH_CONFIG = {
  authUrl: 'https://login.xero.com/identity/connect/authorize',
  tokenUrl: 'https://identity.xero.com/connect/token',
  connectionsUrl: 'https://api.xero.com/connections',
  apiBaseUrl: 'https://api.xero.com/api.xro/2.0',
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'accounting.transactions',
    'accounting.contacts',
    'accounting.settings.read',
  ],
  stateExpiryMinutes: 10,
} as const

export const QUICKBOOKS_OAUTH_CONFIG = {
  authUrl: 'https://appcenter.intuit.com/connect/oauth2',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  apiBaseUrl: 'https://quickbooks.api.intuit.com/v3',
  scopes: ['com.intuit.quickbooks.accounting'],
  stateExpiryMinutes: 10,
} as const
