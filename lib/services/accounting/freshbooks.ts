/**
 * FreshBooks Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to FreshBooks as bills).
 *
 * Region: North America
 * Uses raw fetch against FreshBooks' REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  FRESHBOOKS_CLIENT_ID, FRESHBOOKS_CLIENT_SECRET, FRESHBOOKS_REDIRECT_URI
 */

import { getValidCredentials } from './token-manager'
import type {
  AccountingCredentials,
  AccountingProviderAdapter,
  AccountingAccount,
  AccountingBill,
  AccountingContact,
  TokenRefreshResult,
  SyncResult,
} from './types'

// ── Constants ──

const FRESHBOOKS_AUTH_URL = 'https://auth.freshbooks.com/oauth/authorize'
const FRESHBOOKS_TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token'
const FRESHBOOKS_API_BASE_URL = 'https://api.freshbooks.com'
const FRESHBOOKS_SCOPES = ['user:profile:read', 'user:bills:read', 'user:bills:write']

// ── Helpers ──

function getClientId(): string {
  return process.env.FRESHBOOKS_CLIENT_ID || ''
}

function getClientSecret(): string {
  return process.env.FRESHBOOKS_CLIENT_SECRET || ''
}

function getRedirectUri(): string {
  return process.env.FRESHBOOKS_REDIRECT_URI || ''
}

function getAccountApiBase(accountId: string): string {
  return `${FRESHBOOKS_API_BASE_URL}/accounting/account/${accountId}`
}

async function freshbooksFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const accountId = credentials.tenant_id
  if (!accountId) throw new Error('FreshBooks account_id (tenant_id) is required')

  const baseUrl = getAccountApiBase(accountId)
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token}`,
    Accept: 'application/json',
    'Api-Version': 'alpha',
    ...((options.headers as Record<string, string>) || {}),
  }

  return fetch(url, { ...options, headers })
}

// ── OAuth Flow ──

/**
 * Build the FreshBooks OAuth authorization URL.
 */
export function getFreshbooksAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: FRESHBOOKS_SCOPES.join(' '),
    state: stateToken,
  })
  return `${FRESHBOOKS_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<AccountingCredentials> {
  const response = await fetch(FRESHBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`FreshBooks token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  // Fetch the user's identity to get account_id
  let accountId: string | undefined
  const meRes = await fetch(`${FRESHBOOKS_API_BASE_URL}/auth/api/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      Accept: 'application/json',
    },
  })

  if (meRes.ok) {
    const meData = await meRes.json()
    const memberships = meData.response?.business_memberships || []
    if (memberships.length > 0) {
      accountId = String(memberships[0].business?.account_id || '')
    }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    tenant_id: accountId,
  }
}

// ── FreshBooks Provider Adapter ──

export const freshbooksAdapter: AccountingProviderAdapter = {
  provider: 'freshbooks',

  async refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult> {
    const response = await fetch(FRESHBOOKS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FreshBooks token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }
  },

  async getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]> {
    const res = await freshbooksFetch(credentials, '/expenses/expense_categories')
    if (!res.ok) {
      throw new Error(`Failed to fetch FreshBooks accounts: ${res.status}`)
    }

    const data = await res.json()
    const categories = data.response?.result?.expense_categories || []

    return categories.map((acc: Record<string, unknown>) => ({
      account_id: String(acc.id),
      code: String(acc.category_id || acc.id || ''),
      name: String(acc.category_name || acc.name || ''),
      type: 'EXPENSE',
      class: 'EXPENSE',
      status: acc.is_active !== false ? 'ACTIVE' : 'ARCHIVED',
    }))
  },

  async findOrCreateContact(
    credentials: AccountingCredentials,
    contact: AccountingContact
  ): Promise<string> {
    // Return existing external ID if available
    if (contact.external_id) {
      return contact.external_id
    }

    // Search for existing vendor by name
    const searchRes = await freshbooksFetch(
      credentials,
      `/bills/bill_vendors?search[vendor_name]=${encodeURIComponent(contact.name)}`
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      const vendors = data.response?.result?.bill_vendors || []
      if (vendors.length > 0) {
        return String(vendors[0].vendorid)
      }
    }

    // Create new vendor
    const createRes = await freshbooksFetch(credentials, '/bills/bill_vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_vendor: {
          vendor_name: contact.name,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          is_active: true,
        },
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Failed to create FreshBooks vendor: ${createRes.status}`)
    }

    const created = await createRes.json()
    return String(created.response?.result?.bill_vendor?.vendorid || '')
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const fbBill = mapBillToFreshbooksBill(bill)

    const res = await freshbooksFetch(credentials, '/bills/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill: fbBill }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `FreshBooks API error: ${res.status} ${errorText}` }
    }

    const data = await res.json()
    const created = data.response?.result?.bill
    return { success: true, external_id: String(created?.id || '') }
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const fbBill = mapBillToFreshbooksBill(bill)

    const res = await freshbooksFetch(credentials, `/bills/bills/${externalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill: fbBill }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `FreshBooks API error: ${res.status} ${errorText}` }
    }

    return { success: true, external_id: externalId }
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string
  ): Promise<string> {
    const res = await freshbooksFetch(credentials, `/bills/bills/${externalId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch FreshBooks bill: ${res.status}`)
    }

    const data = await res.json()
    const bill = data.response?.result?.bill
    const status = bill?.status
    if (status === 'paid') return 'PAID'
    if (status === 'partial') return 'PARTIALLY_PAID'
    if (status === 'overdue') return 'OVERDUE'
    if (status === 'draft') return 'DRAFT'
    return status?.toUpperCase() || 'UNKNOWN'
  },
}

// ── Mapping Helpers ──

function mapBillToFreshbooksBill(bill: AccountingBill) {
  return {
    vendorid: bill.contact_external_id ? Number(bill.contact_external_id) : undefined,
    vendor_name: bill.contact_name,
    bill_number: bill.reference,
    issued_on: bill.date,
    due_date: bill.due_date || bill.date,
    currency_code: bill.currency?.toUpperCase() || 'USD',
    status: mapStatusToFreshbooks(bill.status),
    amount: {
      amount: String(bill.total),
      code: bill.currency?.toUpperCase() || 'USD',
    },
    lines: bill.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_cost: {
        amount: String(item.unit_amount),
        code: bill.currency?.toUpperCase() || 'USD',
      },
      amount: {
        amount: String(item.line_amount ?? item.quantity * item.unit_amount),
        code: bill.currency?.toUpperCase() || 'USD',
      },
      category_id: item.account_code || undefined,
      tax_name: item.tax_type || undefined,
    })),
  }
}

function mapStatusToFreshbooks(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'draft',
    AUTHORISED: 'unpaid',
    PAID: 'paid',
  }
  return map[status] || 'draft'
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getFreshbooksCredentials(
  connectionId: string,
  credentials: AccountingCredentials
): Promise<AccountingCredentials> {
  return getValidCredentials(connectionId, credentials, freshbooksAdapter.refreshToken)
}

/**
 * Disconnect from FreshBooks — revoke the token.
 */
export async function revokeFreshbooksToken(credentials: AccountingCredentials): Promise<void> {
  try {
    await fetch(`${FRESHBOOKS_API_BASE_URL}/auth/oauth/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: credentials.refresh_token,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    })
  } catch {
    // Best effort — token may already be expired
  }
}
