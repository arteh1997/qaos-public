/**
 * Xero Accounting Integration Service
 *
 * Handles OAuth token exchange/refresh, chart of accounts, contact sync,
 * and bill creation (pushing invoices/POs to Xero as supplier bills).
 *
 * Uses raw fetch against Xero's REST API — no SDK dependency needed.
 *
 * Env vars required:
 *  XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI
 */

import { XERO_OAUTH_CONFIG } from "@/lib/validations/accounting";
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
  return process.env.XERO_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.XERO_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return process.env.XERO_REDIRECT_URI || "";
}

function getBasicAuthHeader(): string {
  return Buffer.from(`${getClientId()}:${getClientSecret()}`).toString(
    "base64",
  );
}

async function xeroFetch(
  credentials: AccountingCredentials,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${XERO_OAUTH_CONFIG.apiBaseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.access_token}`,
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Xero requires tenant_id header for all API calls
  if (credentials.tenant_id) {
    headers["Xero-Tenant-Id"] = credentials.tenant_id;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new RateLimitError(
      "Xero",
      retryAfter ? parseInt(retryAfter, 10) : null,
    );
  }

  return res;
}

// ── OAuth Flow ──

/**
 * Build the Xero OAuth authorization URL.
 */
export function getXeroAuthUrl(stateToken: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: XERO_OAUTH_CONFIG.scopes.join(" "),
    state: stateToken,
  });
  return `${XERO_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<AccountingCredentials> {
  const response = await fetch(XERO_OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${getBasicAuthHeader()}`,
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
      `Xero token exchange failed: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Get tenant ID from Xero connections endpoint
  const connectionsRes = await fetch(XERO_OAUTH_CONFIG.connectionsUrl, {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      "Content-Type": "application/json",
    },
  });

  let tenantId: string | undefined;
  if (connectionsRes.ok) {
    const connections = await connectionsRes.json();
    if (connections.length > 0) {
      tenantId = connections[0].tenantId;
    }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || "Bearer",
    scope: data.scope,
    tenant_id: tenantId,
  };
}

// ── Xero Provider Adapter ──

export const xeroAdapter: AccountingProviderAdapter = {
  provider: "xero",

  async refreshToken(
    credentials: AccountingCredentials,
  ): Promise<TokenRefreshResult> {
    const response = await fetch(XERO_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${getBasicAuthHeader()}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("invalid_grant")) {
        throw new TokenRevokedError("Xero");
      }
      throw new Error(
        `Xero token refresh failed: ${response.status} ${errorText}`,
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
    const res = await xeroFetch(credentials, "/Accounts");
    if (!res.ok) {
      throw new Error(`Failed to fetch Xero accounts: ${res.status}`);
    }

    const data = await res.json();
    return (data.Accounts || []).map((acc: Record<string, string>) => ({
      account_id: acc.AccountID,
      code: acc.Code || "",
      name: acc.Name,
      type: acc.Type,
      class: acc.Class || "",
      status: acc.Status,
    }));
  },

  async findOrCreateContact(
    credentials: AccountingCredentials,
    contact: AccountingContact,
  ): Promise<string> {
    // Try to find existing contact
    if (contact.external_id) {
      return contact.external_id;
    }

    const searchRes = await xeroFetch(
      credentials,
      `/Contacts?where=Name=="${encodeURIComponent(contact.name)}"`,
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.Contacts && data.Contacts.length > 0) {
        return data.Contacts[0].ContactID;
      }
    }

    // Create new contact
    const createRes = await xeroFetch(credentials, "/Contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Contacts: [
          {
            Name: contact.name,
            EmailAddress: contact.email || undefined,
            Phones: contact.phone
              ? [{ PhoneType: "DEFAULT", PhoneNumber: contact.phone }]
              : undefined,
          },
        ],
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create Xero contact: ${createRes.status}`);
    }

    const created = await createRes.json();
    return created.Contacts[0].ContactID;
  },

  async createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill,
  ): Promise<SyncResult> {
    const xeroInvoice = mapBillToXeroInvoice(bill);

    const res = await xeroFetch(credentials, "/Invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `Xero API error: ${res.status} ${errorText}`,
      };
    }

    const data = await res.json();
    const created = data.Invoices?.[0];

    if (created?.HasErrors) {
      const errorMessage = created.ValidationErrors?.map(
        (e: { Message: string }) => e.Message,
      ).join("; ");
      return {
        success: false,
        error: errorMessage || "Xero validation failed",
      };
    }

    return { success: true, external_id: created?.InvoiceID };
  },

  async updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill,
  ): Promise<SyncResult> {
    const xeroInvoice = {
      ...mapBillToXeroInvoice(bill),
      InvoiceID: externalId,
    };

    const res = await xeroFetch(credentials, "/Invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `Xero API error: ${res.status} ${errorText}`,
      };
    }

    return { success: true, external_id: externalId };
  },

  async getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string,
  ): Promise<string> {
    const res = await xeroFetch(credentials, `/Invoices/${externalId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch Xero invoice: ${res.status}`);
    }

    const data = await res.json();
    return data.Invoices?.[0]?.Status || "UNKNOWN";
  },
};

// ── Mapping Helpers ──

function mapBillToXeroInvoice(bill: AccountingBill) {
  return {
    Type: "ACCPAY", // Accounts Payable (supplier bill)
    Contact: {
      ContactID: bill.contact_external_id || undefined,
      Name: bill.contact_name,
    },
    Reference: bill.reference,
    Date: bill.date,
    DueDate: bill.due_date || bill.date,
    CurrencyCode: bill.currency?.toUpperCase() || "GBP",
    Status: bill.status,
    LineItems: bill.line_items.map((item) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.unit_amount,
      AccountCode: item.account_code,
      TaxType: item.tax_type || "INPUT2", // UK standard rate VAT
      LineAmount: item.line_amount,
    })),
  };
}

// ── High-Level Sync Operations ──

/**
 * Get valid (auto-refreshed) credentials for a connection.
 */
export async function getXeroCredentials(
  connectionId: string,
  credentials: AccountingCredentials,
): Promise<AccountingCredentials> {
  return getValidCredentials(
    connectionId,
    credentials,
    xeroAdapter.refreshToken,
  );
}

/**
 * Disconnect from Xero — revoke the token.
 */
export async function revokeXeroToken(
  credentials: AccountingCredentials,
): Promise<void> {
  try {
    await fetch("https://identity.xero.com/connect/revocation", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${getBasicAuthHeader()}`,
      },
      body: new URLSearchParams({
        token: credentials.refresh_token,
      }),
    });
  } catch {
    // Best effort — token may already be expired
  }
}
