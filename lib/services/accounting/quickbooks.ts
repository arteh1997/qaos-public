/**
 * QuickBooks Online Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, vendor sync,
 * and bill creation (pushing invoices/POs to QBO as supplier bills).
 *
 * Uses raw fetch against QBO's REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI
 */

import { QUICKBOOKS_OAUTH_CONFIG } from "@/lib/validations/accounting";
import { getValidCredentials } from "./token-manager";
import { TokenRevokedError, RateLimitError } from "./types";
import type {
  AccountingCredentials,
  AccountingProviderAdapter,
  AccountingAccount,
  AccountingBill,
  AccountingContact,
  TokenRefreshResult,
  SyncResult,
} from "./types";

// ── Helpers ──

function getClientId(): string {
  return process.env.QUICKBOOKS_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.QUICKBOOKS_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return process.env.QUICKBOOKS_REDIRECT_URI || "";
}

function getBasicAuthHeader(): string {
  return Buffer.from(`${getClientId()}:${getClientSecret()}`).toString(
    "base64",
  );
}

async function qboFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const realmId = credentials.realm_id;
  if (!realmId) throw new Error("QuickBooks realm_id is required");

  const baseUrl = `${QUICKBOOKS_OAUTH_CONFIG.apiBaseUrl}/company/${realmId}`;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token}`,
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 429) {
    const retryAfterRaw = res.headers.get("Retry-After");
    let retryAfter: number | null = null;
    if (retryAfterRaw) {
      const parsed = Number(retryAfterRaw);
      if (!Number.isNaN(parsed)) {
        retryAfter = parsed;
      } else {
        // HTTP-date format — compute seconds from now
        const date = Date.parse(retryAfterRaw);
        if (!Number.isNaN(date)) {
          retryAfter = Math.max(0, Math.ceil((date - Date.now()) / 1000));
        }
      }
    }
    throw new RateLimitError("QuickBooks", retryAfter);
  }

  return res;
}

// ── OAuth Flow ──

/**
 * Build the QuickBooks OAuth authorization URL.
 */
export function getQuickBooksAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    scope: QUICKBOOKS_OAUTH_CONFIG.scopes.join(" "),
    redirect_uri: getRedirectUri(),
    state: stateToken,
  });
  return `${QUICKBOOKS_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens.
 * QBO returns realmId in the callback URL query param.
 */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
): Promise<AccountingCredentials> {
  const response = await fetch(QUICKBOOKS_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${getBasicAuthHeader()}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `QuickBooks token exchange failed: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || "Bearer",
    realm_id: realmId,
  };
}

// ── QuickBooks Provider Adapter ──

export const quickbooksAdapter: AccountingProviderAdapter = {
  provider: "quickbooks",

  async refreshToken(
    credentials: AccountingCredentials,
  ): Promise<TokenRefreshResult> {
    const response = await fetch(QUICKBOOKS_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${getBasicAuthHeader()}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("invalid_grant")) {
        throw new TokenRevokedError("QuickBooks");
      }
      throw new Error(
        `QuickBooks token refresh failed: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  },

  async getAccounts(
    credentials: AccountingCredentials,
  ): Promise<AccountingAccount[]> {
    // Query all expense accounts via QBO query API
    const query = encodeURIComponent(
      "SELECT * FROM Account WHERE AccountType IN ('Expense', 'Cost of Goods Sold', 'Other Expense') ORDERBY Name",
    );
    const res = await qboFetch(credentials, `/query?query=${query}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch QuickBooks accounts: ${res.status}`);
    }

    const data = await res.json();
    const accounts = data.QueryResponse?.Account || [];

    return accounts.map((acc: Record<string, unknown>) => ({
      account_id: String(acc.Id),
      code: String(acc.AcctNum || ""),
      name: String(acc.Name),
      type: String(acc.AccountType),
      class: mapQboAccountClass(String(acc.Classification || "")),
      status: acc.Active ? "ACTIVE" : "ARCHIVED",
    }));
  },

  async findOrCreateContact(
    credentials: AccountingCredentials,
    contact: AccountingContact,
  ): Promise<string> {
    // Return existing external ID if available
    if (contact.external_id) {
      return contact.external_id;
    }

    // Search for existing vendor by name
    const query = encodeURIComponent(
      `SELECT * FROM Vendor WHERE DisplayName = '${contact.name.replace(/'/g, "\\'")}'`,
    );
    const searchRes = await qboFetch(credentials, `/query?query=${query}`);

    if (searchRes.ok) {
      const data = await searchRes.json();
      const vendors = data.QueryResponse?.Vendor || [];
      if (vendors.length > 0) {
        return String(vendors[0].Id);
      }
    }

    // Create new vendor
    const createRes = await qboFetch(credentials, "/vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        DisplayName: contact.name,
        PrimaryEmailAddr: contact.email
          ? { Address: contact.email }
          : undefined,
        PrimaryPhone: contact.phone
          ? { FreeFormNumber: contact.phone }
          : undefined,
      }),
    });

    if (!createRes.ok) {
      throw new Error(
        `Failed to create QuickBooks vendor: ${createRes.status}`,
      );
    }

    const created = await createRes.json();
    return String(created.Vendor.Id);
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill,
  ): Promise<SyncResult> {
    const qboBill = mapBillToQboBill(bill);

    const res = await qboFetch(credentials, "/bill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qboBill),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `QuickBooks API error: ${res.status} ${errorText}`,
      };
    }

    const data = await res.json();
    return { success: true, external_id: String(data.Bill?.Id || "") };
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill,
  ): Promise<SyncResult> {
    // QBO requires SyncToken for updates — fetch the current bill first
    const getRes = await qboFetch(credentials, `/bill/${externalId}`);
    if (!getRes.ok) {
      return {
        success: false,
        error: `Failed to fetch bill for update: ${getRes.status}`,
      };
    }
    const existing = await getRes.json();
    const syncToken = existing.Bill?.SyncToken || "0";

    const qboBill = {
      ...mapBillToQboBill(bill),
      Id: externalId,
      SyncToken: syncToken,
    };

    const res = await qboFetch(credentials, "/bill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qboBill),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `QuickBooks API error: ${res.status} ${errorText}`,
      };
    }

    return { success: true, external_id: externalId };
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string,
  ): Promise<string> {
    const res = await qboFetch(credentials, `/bill/${externalId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch QuickBooks bill: ${res.status}`);
    }

    const data = await res.json();
    const balance = data.Bill?.Balance;
    if (balance === 0) return "PAID";
    if (balance < data.Bill?.TotalAmt) return "PARTIALLY_PAID";
    return "UNPAID";
  },
};

// ── Mapping Helpers ──

function mapBillToQboBill(bill: AccountingBill) {
  return {
    VendorRef: {
      value: bill.contact_external_id || undefined,
      name: bill.contact_name,
    },
    DocNumber: bill.reference,
    TxnDate: bill.date,
    DueDate: bill.due_date || bill.date,
    CurrencyRef: { value: bill.currency?.toUpperCase() || "GBP" },
    Line: bill.line_items.map((item, index) => ({
      Id: String(index + 1),
      DetailType: "AccountBasedExpenseLineDetail",
      Amount: item.line_amount ?? item.quantity * item.unit_amount,
      Description: item.description,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: item.account_code },
        BillableStatus: "NotBillable",
        TaxCodeRef: { value: item.tax_type || "TAX" },
      },
    })),
  };
}

function mapQboAccountClass(classification: string): string {
  const map: Record<string, string> = {
    Expense: "EXPENSE",
    Asset: "ASSET",
    Liability: "LIABILITY",
    Equity: "EQUITY",
    Revenue: "REVENUE",
  };
  return map[classification] || classification.toUpperCase();
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getQuickBooksCredentials(
  connectionId: string,
  credentials: AccountingCredentials,
): Promise<AccountingCredentials> {
  return getValidCredentials(
    connectionId,
    credentials,
    quickbooksAdapter.refreshToken,
  );
}

/**
 * Disconnect from QuickBooks — revoke the token.
 */
export async function revokeQuickBooksToken(
  credentials: AccountingCredentials,
): Promise<void> {
  try {
    await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${getBasicAuthHeader()}`,
      },
      body: JSON.stringify({
        token: credentials.refresh_token,
      }),
    });
  } catch {
    // Best effort — token may already be expired
  }
}
