import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/services/accounting/token-manager", () => ({
  getValidCredentials: vi.fn(async (_id, creds) => creds),
}));

import {
  getZohoBooksAuthUrl,
  exchangeCodeForTokens,
  zohoBooksAdapter,
} from "@/lib/services/accounting/zoho-books";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

const BASE_CREDS: AccountingCredentials = {
  access_token: "access-tok",
  refresh_token: "refresh-tok",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  token_type: "Zoho-oauthtoken",
  tenant_id: "org-123",
};

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Zoho Books adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.ZOHO_CLIENT_ID = "zoho-client-id";
    process.env.ZOHO_CLIENT_SECRET = "zoho-secret";
    process.env.ZOHO_REDIRECT_URI = "https://example.com/callback";
  });

  describe("getZohoBooksAuthUrl", () => {
    it("returns an authorization URL with client_id, state and access_type=offline", () => {
      const url = getZohoBooksAuthUrl("state-token");
      expect(url).toContain("https://accounts.zoho.com/oauth/v2/auth");
      expect(url).toContain("client_id=zoho-client-id");
      expect(url).toContain("state=state-token");
      expect(url).toContain("access_type=offline");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges the code for tokens and fetches organization_id", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 3600,
              token_type: "Zoho-oauthtoken",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              organizations: [{ organization_id: "org-456" }],
            }),
        });

      const creds = await exchangeCodeForTokens("auth-code");
      expect(creds.access_token).toBe("new-access");
      expect(creds.tenant_id).toBe("org-456");
    });

    it("throws on a non-ok token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad"),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "Zoho Books token exchange failed",
      );
    });

    it("throws if response contains an error field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: "invalid_code" }),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "Zoho Books token exchange error: invalid_code",
      );
    });
  });

  describe("adapter.refreshToken", () => {
    it("reuses existing refresh_token since Zoho does not return a new one", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: "refreshed", expires_in: 3600 }),
      });
      const result = await zohoBooksAdapter.refreshToken(BASE_CREDS);
      expect(result.access_token).toBe("refreshed");
      expect(result.refresh_token).toBe("refresh-tok");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("fail"),
      });
      await expect(zohoBooksAdapter.refreshToken(BASE_CREDS)).rejects.toThrow(
        "Zoho Books token refresh failed",
      );
    });
  });

  describe("adapter.getAccounts", () => {
    it("maps Zoho chart of accounts to AccountingAccount[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            chartofaccounts: [
              {
                account_id: "acc-1",
                account_code: "5100",
                account_name: "Food",
                account_type: "expense",
                is_active: true,
              },
            ],
          }),
      });

      const accounts = await zohoBooksAdapter.getAccounts(BASE_CREDS);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account_id).toBe("acc-1");
      expect(accounts[0].code).toBe("5100");
      expect(accounts[0].name).toBe("Food");
      expect(accounts[0].class).toBe("EXPENSE");
      expect(accounts[0].status).toBe("ACTIVE");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(zohoBooksAdapter.getAccounts(BASE_CREDS)).rejects.toThrow(
        "Failed to fetch Zoho Books accounts",
      );
    });
  });

  describe("adapter.findOrCreateContact", () => {
    it("returns external_id immediately if provided", async () => {
      const id = await zohoBooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Vendor",
        external_id: "existing-id",
      });
      expect(id).toBe("existing-id");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns found vendor contact_id from search", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ contacts: [{ contact_id: "c-1" }] }),
      });
      const id = await zohoBooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Acme",
      });
      expect(id).toBe("c-1");
    });

    it("creates a new vendor when none found", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contacts: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contact: { contact_id: "new-c" } }),
        });

      const id = await zohoBooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "New Vendor",
      });
      expect(id).toBe("new-c");
    });
  });

  describe("adapter.createBill", () => {
    it("returns success with bill_id on creation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, bill: { bill_id: "bill-1" } }),
      });

      const result = await zohoBooksAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "INR",
        total: 100,
        status: "DRAFT",
        line_items: [
          {
            description: "Item",
            quantity: 1,
            unit_amount: 100,
            account_code: "acc-1",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("bill-1");
    });

    it("returns failure when response code != 0", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 3, message: "Validation failed" }),
      });
      const result = await zohoBooksAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "INR",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed");
    });

    it("returns failure on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      });
      const result = await zohoBooksAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "INR",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Zoho Books API error");
    });
  });

  describe("adapter.updateBill", () => {
    it("returns success on successful update", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, bill: { bill_id: "bill-1" } }),
      });
      const result = await zohoBooksAdapter.updateBill(BASE_CREDS, "bill-1", {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "INR",
        total: 100,
        status: "AUTHORISED",
        line_items: [],
      });
      expect(result.success).toBe(true);
      expect(result.external_id).toBe("bill-1");
    });
  });

  describe("adapter.getBillPaymentStatus", () => {
    it.each([
      ["paid", "PAID"],
      ["partially_paid", "PARTIALLY_PAID"],
      ["overdue", "OVERDUE"],
      ["open", "UNPAID"],
      ["void", "VOIDED"],
    ])("maps Zoho status '%s' to '%s'", async (zohoStatus, expected) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ bill: { status: zohoStatus } }),
      });
      const status = await zohoBooksAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-1",
      );
      expect(status).toBe(expected);
    });
  });
});
