/**
 * Sage Business Cloud Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to Sage as purchase invoices).
 *
 * Region: UK/EU/Africa
 * Uses raw fetch against Sage's REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  SAGE_CLIENT_ID, SAGE_CLIENT_SECRET, SAGE_REDIRECT_URI
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

const SAGE_API_BASE_URL = 'https://api.accounting.sage.com/v3.1'
const SAGE_AUTH_URL = 'https://www.sageone.com/oauth2/auth/central'
const SAGE_TOKEN_URL = 'https://oauth.accounting.sage.com/token'
const SAGE_REVOCATION_URL = 'https://oauth.accounting.sage.com/revoke'
const SAGE_SCOPES = ['full_access']

// ── Helpers ──

function getClientId(): string {
  return process.env.SAGE_CLIENT_ID || ''
}

function getClientSecret(): string {
  return process.env.SAGE_CLIENT_SECRET || ''
}

function getRedirectUri(): string {
  return process.env.SAGE_REDIRECT_URI || ''
}

function getBasicAuthHeader(): string {
  return Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64')
}

async function sageFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${SAGE_API_BASE_URL}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token}`,
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  return fetch(url, { ...options, headers })
}

// ── OAuth Flow ──

/**
 * Build the Sage OAuth authorization URL.
 */
export function getSageAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: SAGE_SCOPES.join(' '),
    state: stateToken,
  })
  return `${SAGE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<AccountingCredentials> {
  const response = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sage token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
  }
}

// ── Sage Provider Adapter ──

export const sageAdapter: AccountingProviderAdapter = {
  provider: 'sage',

  async refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult> {
    const response = await fetch(SAGE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${getBasicAuthHeader()}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Sage token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }
  },

  async getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]> {
    const res = await sageFetch(credentials, '/ledger_accounts?items_per_page=200')
    if (!res.ok) {
      throw new Error(`Failed to fetch Sage accounts: ${res.status}`)
    }

    const data = await res.json()
    return (data.$items || []).map((acc: Record<string, unknown>) => ({
      account_id: String(acc.id),
      code: String((acc as Record<string, unknown>).nominal_code || ''),
      name: String(acc.displayed_as),
      type: String((acc.ledger_account_type as Record<string, unknown>)?.id || ''),
      class: mapSageAccountClass(
        String((acc.ledger_account_classification as Record<string, unknown>)?.id || '')
      ),
      status: acc.visible_in_chart_of_accounts ? 'ACTIVE' : 'ARCHIVED',
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

    // Search for existing contact by name
    const searchRes = await sageFetch(
      credentials,
      `/contacts?search=${encodeURIComponent(contact.name)}&contact_type_id=VENDOR`
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      const items = data.$items || []
      if (items.length > 0) {
        return String(items[0].id)
      }
    }

    // Create new contact
    const createRes = await sageFetch(credentials, '/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact: {
          name: contact.name,
          contact_type_ids: ['VENDOR'],
          email: contact.email || undefined,
          telephone: contact.phone || undefined,
        },
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Failed to create Sage contact: ${createRes.status}`)
    }

    const created = await createRes.json()
    return String(created.id)
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const sageBill = mapBillToSagePurchaseInvoice(bill)

    const res = await sageFetch(credentials, '/purchase_invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_invoice: sageBill }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Sage API error: ${res.status} ${errorText}` }
    }

    const data = await res.json()
    return { success: true, external_id: String(data.id || '') }
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const sageBill = mapBillToSagePurchaseInvoice(bill)

    const res = await sageFetch(credentials, `/purchase_invoices/${externalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_invoice: sageBill }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Sage API error: ${res.status} ${errorText}` }
    }

    return { success: true, external_id: externalId }
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string
  ): Promise<string> {
    const res = await sageFetch(credentials, `/purchase_invoices/${externalId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch Sage purchase invoice: ${res.status}`)
    }

    const data = await res.json()
    const status = data.status?.id
    if (status === 'PAID') return 'PAID'
    if (status === 'PART_PAID') return 'PARTIALLY_PAID'
    if (status === 'VOID') return 'VOIDED'
    return status || 'UNKNOWN'
  },
}

// ── Mapping Helpers ──

function mapBillToSagePurchaseInvoice(bill: AccountingBill) {
  return {
    contact_id: bill.contact_external_id || undefined,
    contact_name: bill.contact_name,
    reference: bill.reference,
    date: bill.date,
    due_date: bill.due_date || bill.date,
    currency_id: bill.currency?.toUpperCase() || 'GBP',
    status_id: mapStatusToSage(bill.status),
    invoice_lines: bill.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_amount,
      ledger_account_id: item.account_code,
      tax_rate_id: item.tax_type || 'GB_STANDARD',
      total_amount: item.line_amount ?? item.quantity * item.unit_amount,
    })),
  }
}

function mapStatusToSage(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'DRAFT',
    AUTHORISED: 'OUTSTANDING',
    PAID: 'PAID',
  }
  return map[status] || 'DRAFT'
}

function mapSageAccountClass(classification: string): string {
  const map: Record<string, string> = {
    EXPENSE: 'EXPENSE',
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    INCOME: 'REVENUE',
  }
  return map[classification] || classification.toUpperCase()
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getSageCredentials(
  connectionId: string,
  credentials: AccountingCredentials
): Promise<AccountingCredentials> {
  return getValidCredentials(connectionId, credentials, sageAdapter.refreshToken)
}

/**
 * Disconnect from Sage — revoke the token.
 */
export async function revokeSageToken(credentials: AccountingCredentials): Promise<void> {
  try {
    await fetch(SAGE_REVOCATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${getBasicAuthHeader()}`,
      },
      body: new URLSearchParams({
        token: credentials.refresh_token,
      }),
    })
  } catch {
    // Best effort — token may already be expired
  }
}
