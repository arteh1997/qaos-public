/**
 * Wave Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to Wave as bills via GraphQL).
 *
 * Region: North America
 * Wave uses a GraphQL API — all data operations go through a single endpoint.
 * Uses raw fetch — no SDK dependency needed.
 *
 * Env vars required:
 *  WAVE_CLIENT_ID, WAVE_CLIENT_SECRET, WAVE_REDIRECT_URI
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

const WAVE_GRAPHQL_URL = 'https://gql.waveapps.com/graphql/public'
const WAVE_AUTH_URL = 'https://api.waveapps.com/oauth2/authorize/'
const WAVE_TOKEN_URL = 'https://api.waveapps.com/oauth2/token/'
const WAVE_SCOPES = ['account:*', 'bill:*', 'vendor:*']

// ── Helpers ──

function getClientId(): string {
  return process.env.WAVE_CLIENT_ID || ''
}

function getClientSecret(): string {
  return process.env.WAVE_CLIENT_SECRET || ''
}

function getRedirectUri(): string {
  return process.env.WAVE_REDIRECT_URI || ''
}

interface GraphQLResponse {
  data?: Record<string, unknown>
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>
}

async function waveGraphQL(
  credentials: AccountingCredentials,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<GraphQLResponse> {
  const response = await fetch(WAVE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Wave API error: ${response.status} ${errorText}`)
  }

  return response.json()
}

function getBusinessId(credentials: AccountingCredentials): string {
  const businessId = credentials.tenant_id
  if (!businessId) throw new Error('Wave business_id (tenant_id) is required')
  return businessId
}

// ── OAuth Flow ──

/**
 * Build the Wave OAuth authorization URL.
 */
export function getWaveAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: WAVE_SCOPES.join(' '),
    state: stateToken,
  })
  return `${WAVE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<AccountingCredentials> {
  const response = await fetch(WAVE_TOKEN_URL, {
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
    throw new Error(`Wave token exchange failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

  // Fetch the user's businesses to get the primary business ID
  let businessId: string | undefined
  const businessQuery = `
    query {
      businesses(page: 1, pageSize: 1) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `

  try {
    const bizRes = await fetch(WAVE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query: businessQuery }),
    })

    if (bizRes.ok) {
      const bizData = await bizRes.json()
      const edges = bizData.data?.businesses?.edges || []
      if (edges.length > 0) {
        businessId = edges[0].node.id
      }
    }
  } catch {
    // Non-fatal — businessId can be set later
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    tenant_id: businessId,
  }
}

// ── Wave Provider Adapter ──

export const waveAdapter: AccountingProviderAdapter = {
  provider: 'wave',

  async refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult> {
    const response = await fetch(WAVE_TOKEN_URL, {
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
      throw new Error(`Wave token refresh failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || credentials.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }
  },

  async getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]> {
    const businessId = getBusinessId(credentials)

    const query = `
      query GetAccounts($businessId: ID!) {
        business(id: $businessId) {
          accounts(page: 1, pageSize: 200) {
            edges {
              node {
                id
                name
                type {
                  name
                  value
                }
                subtype {
                  name
                  value
                }
                normalBalanceType
                isArchived
              }
            }
          }
        }
      }
    `

    const result = await waveGraphQL(credentials, query, { businessId })

    if (result.errors?.length) {
      throw new Error(`Failed to fetch Wave accounts: ${result.errors[0].message}`)
    }

    const edges = (result.data?.business as Record<string, unknown>)
    const accounts = (edges as Record<string, unknown>)?.accounts as Record<string, unknown>
    const accountEdges = (accounts?.edges || []) as Array<{ node: Record<string, unknown> }>

    return accountEdges.map(({ node }) => ({
      account_id: String(node.id),
      code: '', // Wave does not use account codes
      name: String(node.name),
      type: String((node.type as Record<string, unknown>)?.value || ''),
      class: mapWaveAccountClass(
        String((node.type as Record<string, unknown>)?.value || '')
      ),
      status: node.isArchived ? 'ARCHIVED' : 'ACTIVE',
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

    const businessId = getBusinessId(credentials)

    // Search for existing vendor by name
    const searchQuery = `
      query SearchVendors($businessId: ID!, $page: Int!) {
        business(id: $businessId) {
          vendors(page: $page, pageSize: 50) {
            edges {
              node {
                id
                name
                email
              }
            }
          }
        }
      }
    `

    const searchResult = await waveGraphQL(credentials, searchQuery, {
      businessId,
      page: 1,
    })

    if (!searchResult.errors?.length) {
      const business = searchResult.data?.business as Record<string, unknown>
      const vendors = business?.vendors as Record<string, unknown>
      const edges = (vendors?.edges || []) as Array<{ node: Record<string, unknown> }>

      const match = edges.find(
        ({ node }) => String(node.name).toLowerCase() === contact.name.toLowerCase()
      )

      if (match) {
        return String(match.node.id)
      }
    }

    // Create new vendor
    const createMutation = `
      mutation CreateVendor($input: VendorCreateInput!) {
        vendorCreate(input: $input) {
          didSucceed
          inputErrors {
            path
            message
            code
          }
          vendor {
            id
            name
          }
        }
      }
    `

    const createResult = await waveGraphQL(credentials, createMutation, {
      input: {
        businessId,
        name: contact.name,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
      },
    })

    if (createResult.errors?.length) {
      throw new Error(`Failed to create Wave vendor: ${createResult.errors[0].message}`)
    }

    const vendorCreate = createResult.data?.vendorCreate as Record<string, unknown>
    if (!vendorCreate?.didSucceed) {
      const inputErrors = (vendorCreate?.inputErrors || []) as Array<{ message: string }>
      throw new Error(
        `Failed to create Wave vendor: ${inputErrors.map(e => e.message).join('; ')}`
      )
    }

    const vendor = vendorCreate.vendor as Record<string, unknown>
    return String(vendor?.id || '')
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const businessId = getBusinessId(credentials)
    const waveBill = mapBillToWaveBillInput(bill, businessId)

    const mutation = `
      mutation CreateBill($input: BillCreateInput!) {
        billCreate(input: $input) {
          didSucceed
          inputErrors {
            path
            message
            code
          }
          bill {
            id
            status
          }
        }
      }
    `

    const result = await waveGraphQL(credentials, mutation, { input: waveBill })

    if (result.errors?.length) {
      return { success: false, error: `Wave API error: ${result.errors[0].message}` }
    }

    const billCreate = result.data?.billCreate as Record<string, unknown>
    if (!billCreate?.didSucceed) {
      const inputErrors = (billCreate?.inputErrors || []) as Array<{ message: string }>
      return {
        success: false,
        error: inputErrors.map(e => e.message).join('; ') || 'Wave validation failed',
      }
    }

    const created = billCreate.bill as Record<string, unknown>
    return { success: true, external_id: String(created?.id || '') }
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill
  ): Promise<SyncResult> {
    const businessId = getBusinessId(credentials)
    const waveBill = mapBillToWaveBillInput(bill, businessId)

    const mutation = `
      mutation UpdateBill($input: BillPatchInput!) {
        billPatch(input: $input) {
          didSucceed
          inputErrors {
            path
            message
            code
          }
          bill {
            id
            status
          }
        }
      }
    `

    const result = await waveGraphQL(credentials, mutation, {
      input: {
        id: externalId,
        ...waveBill,
      },
    })

    if (result.errors?.length) {
      return { success: false, error: `Wave API error: ${result.errors[0].message}` }
    }

    const billPatch = result.data?.billPatch as Record<string, unknown>
    if (!billPatch?.didSucceed) {
      const inputErrors = (billPatch?.inputErrors || []) as Array<{ message: string }>
      return {
        success: false,
        error: inputErrors.map(e => e.message).join('; ') || 'Wave validation failed',
      }
    }

    return { success: true, external_id: externalId }
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string
  ): Promise<string> {
    const query = `
      query GetBill($id: ID!) {
        node(id: $id) {
          ... on Bill {
            id
            status
            amountDue {
              value
            }
            amountPaid {
              value
            }
            total {
              value
            }
          }
        }
      }
    `

    const result = await waveGraphQL(credentials, query, { id: externalId })

    if (result.errors?.length) {
      throw new Error(`Failed to fetch Wave bill: ${result.errors[0].message}`)
    }

    const node = result.data?.node as Record<string, unknown>
    const status = String(node?.status || '')

    if (status === 'PAID') return 'PAID'
    if (status === 'PARTIAL') return 'PARTIALLY_PAID'
    if (status === 'OVERDUE') return 'OVERDUE'
    if (status === 'UNPAID') return 'UNPAID'
    if (status === 'DRAFT') return 'DRAFT'
    return status || 'UNKNOWN'
  },
}

// ── Mapping Helpers ──

function mapBillToWaveBillInput(bill: AccountingBill, businessId: string) {
  return {
    businessId,
    vendorId: bill.contact_external_id || undefined,
    billNumber: bill.reference,
    billDate: bill.date,
    dueDate: bill.due_date || bill.date,
    currency: bill.currency?.toUpperCase() || 'USD',
    status: mapStatusToWave(bill.status),
    items: bill.line_items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: String(item.unit_amount),
      accountId: item.account_code,
      taxes: item.tax_type ? [{ salesTaxId: item.tax_type }] : [],
      totalAmount: String(item.line_amount ?? item.quantity * item.unit_amount),
    })),
  }
}

function mapStatusToWave(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'DRAFT',
    AUTHORISED: 'UNPAID',
    PAID: 'PAID',
  }
  return map[status] || 'DRAFT'
}

function mapWaveAccountClass(accountType: string): string {
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
export async function getWaveCredentials(
  connectionId: string,
  credentials: AccountingCredentials
): Promise<AccountingCredentials> {
  return getValidCredentials(connectionId, credentials, waveAdapter.refreshToken)
}

/**
 * Disconnect from Wave — revoke the token.
 */
export async function revokeWaveToken(credentials: AccountingCredentials): Promise<void> {
  try {
    await fetch(`${WAVE_TOKEN_URL}revoke/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: credentials.refresh_token,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    })
  } catch {
    // Best effort — token may already be expired
  }
}
