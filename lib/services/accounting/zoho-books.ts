/**
 * Zoho Books Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to Zoho Books as bills).
 *
 * Region: India/Middle East/Global
 * Uses raw fetch against Zoho Books' REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REDIRECT_URI
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

const ZOHO_API_BASE_URL = 'https://www.zohoapis.com/books/v3'
const ZOHO_AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth'
const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_REVOCATION_URL = 'https://accounts.zoho.com/oauth/v2/token/revoke'
const ZOHO_SCOPES = [
  'ZohoBooks.fullaccess.all',
]

// ── Helpers ──

function getClientId(): string {
  return process.env.ZOHO_CLIENT_ID || ''
}

function getClientSecret(): string {
  return process.env.ZOHO_CLIENT_SECRET || ''
}

function getRedirectUri(): string {
  return process.env.ZOHO_REDIRECT_URI || ''
}

async function zohoFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const organizationId = credentials.tenant_id
  const url = path.startsWith('http') ? path : `${ZOHO_API_BASE_URL}${path}`

  // Zoho requires organization_id as a query parameter
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = organizationId ? `${url}${separator}organization_id=${organizationId}` : url

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${credentials.access_token}`,
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  return fetch(fullUrl, { ...options, headers })
}

// ── OAuth Flow ──

/**
 * Build the Zoho Books OAuth authorization URL.
 */
export function getZohoBooksAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: ZOHO_SCOPES.join(','),
    state: stateToken,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${ZOHO_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<AccountingCredentials> {
  const response = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Zoho Books token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`Zoho Books token exchange error: ${data.error}`)
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

  // Fetch organizations to get the first organization_id
  let organizationId: string | undefined
  const orgRes = await fetch(`${ZOHO_API_BASE_URL}/organizations`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${data.access_token}`,
      Accept: 'application/json',
    },
  })

  if (orgRes.ok) {
    const orgData = await orgRes.json()
    const organizations = orgData.organizations || []
    if (organizations.length > 0) {
      organizationId = String(organizations[0].organization_id)
    }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || 'Zoho-oauthtoken',
    scope: data.scope,
    tenant_id: organizationId,
  }
}

// ── Zoho Books Provider Adapter ──

export const zohoBooksAdapter: AccountingProviderAdapter = {
  provider: 'zoho_books',

  async refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult> {
    const response = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Zoho Books token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    if (data.error) {
      throw new Error(`Zoho Books token refresh error: ${data.error}`)
    }

    return {
      access_token: data.access_token,
      // Zoho does not return a new refresh_token on refresh — reuse the existing one
      refresh_token: credentials.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]> {
    const res = await zohoFetch(credentials, '/chartofaccounts?sort_column=account_name')
    if (!res.ok) {
      throw new Error(`Failed to fetch Zoho Books accounts: ${res.status}`)
    }

    const data = await res.json()
    return (data.chartofaccounts || []).map((acc: Record<string, unknown>) => ({
      account_id: String(acc.account_id),
      code: String(acc.account_code || ''),
      name: String(acc.account_name),
      type: String(acc.account_type || ''),
      class: mapZohoAccountClass(String(acc.account_type || '')),
      status: acc.is_active ? 'ACTIVE' : 'ARCHIVED',
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
    const searchRes = await zohoFetch(
      credentials,
      `/contacts?contact_type=vendor&search_text=${encodeURIComponent(contact.name)}`
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      const contacts = data.contacts || []
      if (contacts.length > 0) {
        return String(contacts[0].contact_id)
      }
    }

    // Create new vendor contact
    const createRes = await zohoFetch(credentials, '/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: contact.name,
        contact_type: 'vendor',
        email: contact.email || undefined,
        phone: contact.phone || undefined,
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Failed to create Zoho Books contact: ${createRes.status}`)
    }

    const created = await createRes.json()
    return String(created.contact?.contact_id || '')
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const zohoBill = mapBillToZohoBill(bill)

    const res = await zohoFetch(credentials, '/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zohoBill),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Zoho Books API error: ${res.status} ${errorText}` }
    }

    const data = await res.json()
    if (data.code !== 0) {
      return { success: false, error: data.message || 'Zoho Books API error' }
    }

    return { success: true, external_id: String(data.bill?.bill_id || '') }
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const zohoBill = mapBillToZohoBill(bill)

    const res = await zohoFetch(credentials, `/bills/${externalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zohoBill),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Zoho Books API error: ${res.status} ${errorText}` }
    }

    const data = await res.json()
    if (data.code !== 0) {
      return { success: false, error: data.message || 'Zoho Books API error' }
    }

    return { success: true, external_id: externalId }
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string
  ): Promise<string> {
    const res = await zohoFetch(credentials, `/bills/${externalId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch Zoho Books bill: ${res.status}`)
    }

    const data = await res.json()
    const status = data.bill?.status
    if (status === 'paid') return 'PAID'
    if (status === 'partially_paid') return 'PARTIALLY_PAID'
    if (status === 'overdue') return 'OVERDUE'
    if (status === 'open') return 'UNPAID'
    if (status === 'void') return 'VOIDED'
    return status?.toUpperCase() || 'UNKNOWN'
  },
}

// ── Mapping Helpers ──

function mapBillToZohoBill(bill: AccountingBill) {
  return {
    vendor_id: bill.contact_external_id || undefined,
    vendor_name: bill.contact_name,
    bill_number: bill.reference,
    date: bill.date,
    due_date: bill.due_date || bill.date,
    currency_code: bill.currency?.toUpperCase() || 'INR',
    status: mapStatusToZoho(bill.status),
    line_items: bill.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.unit_amount,
      account_id: item.account_code,
      tax_id: item.tax_type || undefined,
      item_total: item.line_amount ?? item.quantity * item.unit_amount,
    })),
  }
}

function mapStatusToZoho(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'draft',
    AUTHORISED: 'open',
    PAID: 'paid',
  }
  return map[status] || 'draft'
}

function mapZohoAccountClass(accountType: string): string {
  const type = accountType.toLowerCase()
  if (type.includes('expense') || type.includes('cost_of_goods')) return 'EXPENSE'
  if (type.includes('asset') || type.includes('bank') || type.includes('cash')) return 'ASSET'
  if (type.includes('liability') || type.includes('credit_card')) return 'LIABILITY'
  if (type.includes('equity')) return 'EQUITY'
  if (type.includes('income') || type.includes('revenue')) return 'REVENUE'
  return accountType.toUpperCase()
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getZohoBooksCredentials(
  connectionId: string,
  credentials: AccountingCredentials
): Promise<AccountingCredentials> {
  return getValidCredentials(connectionId, credentials, zohoBooksAdapter.refreshToken)
}

/**
 * Disconnect from Zoho Books — revoke the token.
 */
export async function revokeZohoBooksToken(credentials: AccountingCredentials): Promise<void> {
  try {
    await fetch(`${ZOHO_REVOCATION_URL}?token=${credentials.refresh_token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  } catch {
    // Best effort — token may already be expired
  }
}
