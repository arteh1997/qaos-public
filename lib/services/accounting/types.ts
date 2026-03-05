/**
 * Accounting Provider Interface
 *
 * Defines a common contract for accounting integrations (Xero, QuickBooks).
 * Each provider implements this interface with their specific API calls.
 */

export interface AccountingCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
  token_type: string;
  scope?: string;
  tenant_id?: string; // Xero
  realm_id?: string; // QuickBooks
}

export interface AccountingBill {
  external_id?: string; // Xero bill ID if already synced
  contact_name: string;
  contact_external_id?: string;
  reference: string;
  date: string;
  due_date?: string;
  currency: string;
  line_items: AccountingBillLineItem[];
  total: number;
  status: "DRAFT" | "AUTHORISED" | "PAID";
}

export interface AccountingBillLineItem {
  description: string;
  quantity: number;
  unit_amount: number;
  account_code: string;
  tax_type?: string;
  line_amount?: number;
}

export interface AccountingContact {
  external_id?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface AccountingAccount {
  account_id: string;
  code: string;
  name: string;
  type: string;
  class: string; // EXPENSE, ASSET, LIABILITY, EQUITY, REVENUE
  status: string;
}

export interface TokenRefreshResult {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface SyncResult {
  success: boolean;
  external_id?: string;
  error?: string;
}

export class TokenRevokedError extends Error {
  constructor(provider: string) {
    super(`${provider} token has been revoked or is invalid`);
    this.name = "TokenRevokedError";
  }
}

export class RateLimitError extends Error {
  retryAfter: number | null;

  constructor(provider: string, retryAfter: number | null = null) {
    super(
      `${provider} API rate limit exceeded${retryAfter ? ` — retry after ${retryAfter}s` : ""}`,
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export interface AccountingProviderAdapter {
  provider: string;

  // Token management
  refreshToken(credentials: AccountingCredentials): Promise<TokenRefreshResult>;

  // Chart of accounts
  getAccounts(credentials: AccountingCredentials): Promise<AccountingAccount[]>;

  // Contacts / Suppliers
  findOrCreateContact(
    credentials: AccountingCredentials,
    contact: AccountingContact,
  ): Promise<string>;

  // Bills (supplier invoices)
  createBill(
    credentials: AccountingCredentials,
    bill: AccountingBill,
  ): Promise<SyncResult>;
  updateBill(
    credentials: AccountingCredentials,
    externalId: string,
    bill: AccountingBill,
  ): Promise<SyncResult>;

  // Payments
  getBillPaymentStatus(
    credentials: AccountingCredentials,
    externalId: string,
  ): Promise<string>;
}
