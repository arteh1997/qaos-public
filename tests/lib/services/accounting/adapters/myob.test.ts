import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/services/accounting/token-manager", () => ({
  getValidCredentials: vi.fn(async (_id, creds) => creds),
}));

import {
  getMyobAuthUrl,
  exchangeCodeForTokens,
  myobAdapter,
} from "@/lib/services/accounting/myob";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

const BASE_CREDS: AccountingCredentials = {
  access_token: "access-tok",
  refresh_token: "refresh-tok",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  token_type: "Bearer",
  tenant_id: "https://api.myob.com/accountright/company-file-uid",
};

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("MYOB adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.MYOB_CLIENT_ID = "myob-client-id";
    process.env.MYOB_CLIENT_SECRET = "myob-secret";
    process.env.MYOB_REDIRECT_URI = "https://example.com/callback";
  });

  describe("getMyobAuthUrl", () => {
    it("returns an authorization URL with client_id and state", () => {
      const url = getMyobAuthUrl("state-token");
      expect(url).toContain("https://secure.myob.com/oauth2/v1/authorize");
      expect(url).toContain("client_id=myob-client-id");
      expect(url).toContain("state=state-token");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges the code for tokens", async () => {
      mockFetch
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
        // Company files list
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { Uri: "https://api.myob.com/accountright/cf-uid" },
            ]),
        });

      const creds = await exchangeCodeForTokens("auth-code");
      expect(creds.access_token).toBe("new-access");
      expect(creds.tenant_id).toBe("https://api.myob.com/accountright/cf-uid");
    });

    it("throws on a non-ok token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad"),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "MYOB token exchange failed",
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
      const result = await myobAdapter.refreshToken(BASE_CREDS);
      expect(result.access_token).toBe("refreshed");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("fail"),
      });
      await expect(myobAdapter.refreshToken(BASE_CREDS)).rejects.toThrow(
        "MYOB token refresh failed",
      );
    });
  });

  describe("adapter.getAccounts", () => {
    it("maps MYOB accounts to AccountingAccount[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              {
                UID: "uid-1",
                Number: "5100",
                Name: "Food",
                Type: "Expense",
                Classification: "Expense",
                IsActive: true,
              },
            ],
          }),
      });

      const accounts = await myobAdapter.getAccounts(BASE_CREDS);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account_id).toBe("uid-1");
      expect(accounts[0].code).toBe("5100");
      expect(accounts[0].class).toBe("EXPENSE");
      expect(accounts[0].status).toBe("ACTIVE");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(myobAdapter.getAccounts(BASE_CREDS)).rejects.toThrow(
        "Failed to fetch MYOB accounts",
      );
    });
  });

  describe("adapter.findOrCreateContact", () => {
    it("returns external_id immediately if provided", async () => {
      const id = await myobAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Vendor",
        external_id: "existing-uid",
      });
      expect(id).toBe("existing-uid");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns found supplier UID from search", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Items: [{ UID: "found-uid" }] }),
      });
      const id = await myobAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Acme",
      });
      expect(id).toBe("found-uid");
    });

    it("creates a new supplier when none found and extracts UID from Location header", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ Items: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (h: string) =>
              h === "Location"
                ? "https://api.myob.com/contact/supplier/new-uid"
                : null,
          },
          json: () => Promise.resolve({}),
        });

      const id = await myobAdapter.findOrCreateContact(BASE_CREDS, {
        name: "New Vendor",
      });
      expect(id).toBe("new-uid");
    });
  });

  describe("adapter.createBill", () => {
    it("returns success with UID from Location header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (h: string) =>
            h === "Location"
              ? "https://api.myob.com/purchase/bill/created-uid"
              : null,
        },
        json: () => Promise.resolve({}),
      });

      const result = await myobAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "AUD",
        total: 100,
        status: "DRAFT",
        line_items: [
          {
            description: "Item",
            quantity: 1,
            unit_amount: 100,
            account_code: "uid-acc",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("created-uid");
    });

    it("returns failure on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve("Unprocessable"),
      });
      const result = await myobAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "AUD",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("MYOB API error");
    });
  });

  describe("adapter.updateBill", () => {
    it("fetches existing bill for RowVersion then updates", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ RowVersion: "rv123" }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      const result = await myobAdapter.updateBill(BASE_CREDS, "bill-uid", {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "AUD",
        total: 100,
        status: "AUTHORISED",
        line_items: [],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("bill-uid");
    });
  });

  describe("adapter.getBillPaymentStatus", () => {
    it("returns PAID for Closed status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: "Closed",
            BalanceDueAmount: 0,
            TotalAmount: 100,
          }),
      });
      const status = await myobAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-uid",
      );
      expect(status).toBe("PAID");
    });

    it("returns PARTIALLY_PAID when balance < total", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: "Open",
            BalanceDueAmount: 50,
            TotalAmount: 100,
          }),
      });
      const status = await myobAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-uid",
      );
      expect(status).toBe("PARTIALLY_PAID");
    });

    it("returns UNPAID for open bill with no payments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: "Open",
            BalanceDueAmount: 100,
            TotalAmount: 100,
          }),
      });
      const status = await myobAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-uid",
      );
      expect(status).toBe("UNPAID");
    });
  });
});
