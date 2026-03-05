import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// token-manager depends on fetch too — mock it out
vi.mock("@/lib/services/accounting/token-manager", () => ({
  getValidCredentials: vi.fn(async (_id, creds) => creds),
}));

import {
  getFreshbooksAuthUrl,
  exchangeCodeForTokens,
  freshbooksAdapter,
} from "@/lib/services/accounting/freshbooks";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

const BASE_CREDS: AccountingCredentials = {
  access_token: "access-tok",
  refresh_token: "refresh-tok",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  token_type: "Bearer",
  tenant_id: "acct123",
};

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("FreshBooks adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.FRESHBOOKS_CLIENT_ID = "fb-client-id";
    process.env.FRESHBOOKS_CLIENT_SECRET = "fb-secret";
    process.env.FRESHBOOKS_REDIRECT_URI = "https://example.com/callback";
  });

  describe("getFreshbooksAuthUrl", () => {
    it("returns an authorization URL containing the client_id and state", () => {
      const url = getFreshbooksAuthUrl("my-state");
      expect(url).toContain("https://auth.freshbooks.com/oauth/authorize");
      expect(url).toContain("client_id=fb-client-id");
      expect(url).toContain("state=my-state");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges the code for tokens and returns credentials", async () => {
      mockFetch
        // token endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "new-access",
              refresh_token: "new-refresh",
              expires_in: 3600,
              token_type: "Bearer",
            }),
        })
        // /auth/api/v1/users/me
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              response: {
                business_memberships: [
                  { business: { account_id: "acct-456" } },
                ],
              },
            }),
        });

      const creds = await exchangeCodeForTokens("auth-code");
      expect(creds.access_token).toBe("new-access");
      expect(creds.refresh_token).toBe("new-refresh");
      expect(creds.tenant_id).toBe("acct-456");
    });

    it("throws on a non-ok token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad"),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "FreshBooks token exchange failed",
      );
    });
  });

  describe("adapter.refreshToken", () => {
    it("returns new tokens on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "refreshed",
            refresh_token: "new-refresh",
            expires_in: 3600,
          }),
      });

      const result = await freshbooksAdapter.refreshToken(BASE_CREDS);
      expect(result.access_token).toBe("refreshed");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("fail"),
      });
      await expect(freshbooksAdapter.refreshToken(BASE_CREDS)).rejects.toThrow(
        "FreshBooks token refresh failed",
      );
    });
  });

  describe("adapter.getAccounts", () => {
    it("maps expense categories to AccountingAccount[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              result: {
                expense_categories: [
                  {
                    id: "1",
                    category_id: "CAT1",
                    category_name: "Food",
                    is_active: true,
                  },
                ],
              },
            },
          }),
      });

      const accounts = await freshbooksAdapter.getAccounts(BASE_CREDS);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account_id).toBe("1");
      expect(accounts[0].name).toBe("Food");
      expect(accounts[0].status).toBe("ACTIVE");
    });

    it("throws on a failed request", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(freshbooksAdapter.getAccounts(BASE_CREDS)).rejects.toThrow(
        "Failed to fetch FreshBooks accounts",
      );
    });
  });

  describe("adapter.findOrCreateContact", () => {
    it("returns external_id if already set", async () => {
      const id = await freshbooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Vendor",
        external_id: "existing-vendor-id",
      });
      expect(id).toBe("existing-vendor-id");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns existing vendor id from search", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: { result: { bill_vendors: [{ vendorid: 99 }] } },
          }),
      });
      const id = await freshbooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Acme",
      });
      expect(id).toBe("99");
    });

    it("creates a new vendor when none found", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ response: { result: { bill_vendors: [] } } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              response: { result: { bill_vendor: { vendorid: 101 } } },
            }),
        });

      const id = await freshbooksAdapter.findOrCreateContact(BASE_CREDS, {
        name: "New Vendor",
      });
      expect(id).toBe("101");
    });
  });

  describe("adapter.createBill", () => {
    it("returns success with external_id on creation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ response: { result: { bill: { id: "bill-1" } } } }),
      });

      const result = await freshbooksAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "USD",
        total: 100,
        status: "DRAFT",
        line_items: [
          {
            description: "Item",
            quantity: 1,
            unit_amount: 100,
            account_code: "5100",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("bill-1");
    });

    it("returns failure on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve("Unprocessable"),
      });
      const result = await freshbooksAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "USD",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("FreshBooks API error");
    });
  });

  describe("adapter.updateBill", () => {
    it("returns success on successful update", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const result = await freshbooksAdapter.updateBill(BASE_CREDS, "bill-1", {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "USD",
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
      ["partial", "PARTIALLY_PAID"],
      ["overdue", "OVERDUE"],
      ["draft", "DRAFT"],
      ["unpaid", "UNPAID"],
    ])("maps FreshBooks status '%s' to '%s'", async (fbStatus, expected) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: { result: { bill: { status: fbStatus } } },
          }),
      });
      const status = await freshbooksAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-1",
      );
      expect(status).toBe(expected);
    });
  });
});
