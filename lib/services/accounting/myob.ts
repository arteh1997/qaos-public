/**
 * MYOB AccountRight Live Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to MYOB as purchase bills).
 *
 * Region: Australia/NZ
 * Uses raw fetch against MYOB's REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  MYOB_CLIENT_ID, MYOB_CLIENT_SECRET, MYOB_REDIRECT_URI
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

const MYOB_API_BASE_URL = 'https://api.myob.com/accountright'
const MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/v1/authorize'
const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/account/authorize'
const MYOB_SCOPES = ['CompanyFile']

// ── Helpers ──

function getClientId(): string {
  return process.env.MYOB_CLIENT_ID || ''
}

function getClientSecret(): string {
  return process.env.MYOB_CLIENT_SECRET || ''
}

function getRedirectUri(): string {
  return process.env.MYOB_REDIRECT_URI || ''
}

async function myobFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${MYOB_API_BASE_URL}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token}`,
    Accept: 'application/json',
    'x-myobapi-key': getClientId(),
    'x-myobapi-version': 'v2',
    ...((options.headers as Record<string, string>) || {}),
  }

  // MYOB requires a company file URI for most API calls
  if (credentials.tenant_id) {
    headers['x-myobapi-cftoken'] = credentials.tenant_id
  }

  return fetch(url, { ...options, headers })
}

// ── OAuth Flow ──

/**
 * Build the MYOB OAuth authorization URL.
 */
export function getMyobAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: MYOB_SCOPES.join(' '),
    state: stateToken,
  })
  return `${MYOB_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<AccountingCredentials> {
  const response = await fetch(MYOB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MYOB token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  // Fetch available company files to get the first one as the tenant
  let tenantId: string | undefined
  const cfRes = await fetch(MYOB_API_BASE_URL, {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      'x-myobapi-key': getClientId(),
      'x-myobapi-version': 'v2',
      Accept: 'application/json',
    },
  })

  if (cfRes.ok) {
    const companyFiles = await cfRes.json()
    if (Array.isArray(companyFiles) && companyFiles.length > 0) {
      tenantId = companyFiles[0].Uri
    }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    tenant_id: tenantId,
  }
}

// ── MYOB Provider Adapter ──

export const myobAdapter: AccountingProviderAdapter = {
  provider: 'myob',

  async refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult> {
    const response = await fetch(MYOB_TOKEN_URL, {
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
      throw new Error(`MYOB token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }
  },

  async getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]> {
    const companyFileUri = credentials.tenant_id || MYOB_API_BASE_URL
    const res = await myobFetch(credentials, `${companyFileUri}/GeneralLedger/Account`)

    if (!res.ok) {
      throw new Error(`Failed to fetch MYOB accounts: ${res.status}`)
    }

    const data = await res.json()
    return (data.Items || []).map((acc: Record<string, unknown>) => ({
      account_id: String(acc.UID),
      code: String(acc.Number || ''),
      name: String(acc.Name),
      type: String(acc.Type || ''),
      class: mapMyobAccountClass(String(acc.Classification || '')),
      status: acc.IsActive ? 'ACTIVE' : 'ARCHIVED',
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

    // Search for existing supplier by name
    const companyFileUri = credentials.tenant_id || MYOB_API_BASE_URL
    const filter = encodeURIComponent(`Name eq '${contact.name.replace(/'/g, "''")}'`)
    const searchRes = await myobFetch(
      credentials,
      `${companyFileUri}/Contact/Supplier?$filter=${filter}`
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      const items = data.Items || []
      if (items.length > 0) {
        return String(items[0].UID)
      }
    }

    // Create new supplier contact
    const createRes = await myobFetch(credentials, `${companyFileUri}/Contact/Supplier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyName: contact.name,
        FirstName: contact.name,
        IsIndividual: false,
        Addresses: contact.email || contact.phone ? [{
          Email: contact.email || undefined,
          Phone1: contact.phone || undefined,
          Street: '',
          City: '',
          State: '',
          PostCode: '',
          Country: '',
          Location: 1,
        }] : undefined,
      }),
    })

    if (!createRes.ok) {
      throw new Error(`Failed to create MYOB supplier: ${createRes.status}`)
    }

    // MYOB returns the UID in the Location header
    const location = createRes.headers.get('Location') || ''
    const uid = location.split('/').pop() || ''
    if (!uid) {
      const created = await createRes.json().catch(() => null)
      return String(created?.UID || '')
    }
    return uid
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const myobBill = mapBillToMyobPurchaseBill(bill)
    const companyFileUri = credentials.tenant_id || MYOB_API_BASE_URL

    const res = await myobFetch(credentials, `${companyFileUri}/Purchase/Bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(myobBill),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `MYOB API error: ${res.status} ${errorText}` }
    }

    // MYOB returns the UID in the Location header
    const location = res.headers.get('Location') || ''
    const uid = location.split('/').pop() || ''

    return { success: true, external_id: uid }
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const companyFileUri = credentials.tenant_id || MYOB_API_BASE_URL

    // MYOB requires RowVersion for optimistic concurrency — fetch current bill
    const getRes = await myobFetch(credentials, `${companyFileUri}/Purchase/Bill/${externalId}`)
    if (!getRes.ok) {
      return { success: false, error: `Failed to fetch MYOB bill for update: ${getRes.status}` }
    }
    const existing = await getRes.json()
    const rowVersion = existing.RowVersion || ''

    const myobBill = {
      ...mapBillToMyobPurchaseBill(bill),
      UID: externalId,
      RowVersion: rowVersion,
    }

    const res = await myobFetch(credentials, `${companyFileUri}/Purchase/Bill/${externalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(myobBill),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `MYOB API error: ${res.status} ${errorText}` }
    }

    return { success: true, external_id: externalId }
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string
  ): Promise<string> {
    const companyFileUri = credentials.tenant_id || MYOB_API_BASE_URL
    const res = await myobFetch(credentials, `${companyFileUri}/Purchase/Bill/${externalId}`)
    if (!res.ok) {
      throw new Error(`Failed to fetch MYOB bill: ${res.status}`)
    }

    const data = await res.json()
    const status = data.Status
    if (status === 'Closed') return 'PAID'
    if (status === 'Open' && data.BalanceDueAmount < data.TotalAmount) return 'PARTIALLY_PAID'
    return status === 'Open' ? 'UNPAID' : (status || 'UNKNOWN')
  },
}

// ── Mapping Helpers ──

function mapBillToMyobPurchaseBill(bill: AccountingBill) {
  return {
    Supplier: {
      UID: bill.contact_external_id || undefined,
      Name: bill.contact_name,
    },
    Number: bill.reference,
    Date: bill.date,
    PromisedDate: bill.due_date || bill.date,
    Status: mapStatusToMyob(bill.status),
    IsTaxInclusive: false,
    Lines: bill.line_items.map(item => ({
      Description: item.description,
      ShipQuantity: item.quantity,
      UnitPrice: item.unit_amount,
      Total: item.line_amount ?? item.quantity * item.unit_amount,
      Account: {
        UID: item.account_code,
      },
      TaxCode: {
        UID: item.tax_type || 'GST', // Australian GST default
      },
    })),
  }
}

function mapStatusToMyob(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Open',
    AUTHORISED: 'Open',
    PAID: 'Closed',
  }
  return map[status] || 'Open'
}

function mapMyobAccountClass(classification: string): string {
  const map: Record<string, string> = {
    Expense: 'EXPENSE',
    Asset: 'ASSET',
    Liability: 'LIABILITY',
    Equity: 'EQUITY',
    Income: 'REVENUE',
    OtherExpense: 'EXPENSE',
    OtherIncome: 'REVENUE',
    CostOfSales: 'EXPENSE',
  }
  return map[classification] || classification.toUpperCase()
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getMyobCredentials(
  connectionId: string,
  credentials: AccountingCredentials
): Promise<AccountingCredentials> {
  return getValidCredentials(connectionId, credentials, myobAdapter.refreshToken)
}

/**
 * Disconnect from MYOB — revoke the token.
 */
export async function revokeMyobToken(credentials: AccountingCredentials): Promise<void> {
  try {
    await fetch('https://secure.myob.com/oauth2/account/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        token: credentials.refresh_token,
      }),
    })
  } catch {
    // Best effort — token may already be expired
  }
}
