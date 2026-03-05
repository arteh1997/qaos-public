import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/services/accounting/token-manager", () => ({
  getValidCredentials: vi.fn(async (_id, creds) => creds),
}));

import {
  getSageAuthUrl,
  exchangeCodeForTokens,
  sageAdapter,
} from "@/lib/services/accounting/sage";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

const BASE_CREDS: AccountingCredentials = {
  access_token: "access-tok",
  refresh_token: "refresh-tok",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  token_type: "Bearer",
};

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Sage adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.SAGE_CLIENT_ID = "sage-client-id";
    process.env.SAGE_CLIENT_SECRET = "sage-secret";
    process.env.SAGE_REDIRECT_URI = "https://example.com/callback";
  });

  describe("getSageAuthUrl", () => {
    it("returns an authorization URL with client_id and state", () => {
      const url = getSageAuthUrl("state-token");
      expect(url).toContain("https://www.sageone.com/oauth2/auth/central");
      expect(url).toContain("client_id=sage-client-id");
      expect(url).toContain("state=state-token");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges the code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      });

      const creds = await exchangeCodeForTokens("auth-code");
      expect(creds.access_token).toBe("new-access");
    });

    it("throws on a non-ok token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad"),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "Sage token exchange failed",
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
      const result = await sageAdapter.refreshToken(BASE_CREDS);
      expect(result.access_token).toBe("refreshed");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("fail"),
      });
      await expect(sageAdapter.refreshToken(BASE_CREDS)).rejects.toThrow(
        "Sage token refresh failed",
      );
    });
  });

  describe("adapter.getAccounts", () => {
    it("maps Sage ledger accounts to AccountingAccount[]", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            $items: [
              {
                id: "ledger-1",
                nominal_code: "5100",
                displayed_as: "Food & Beverage",
                ledger_account_type: { id: "EXPENSE" },
                ledger_account_classification: { id: "EXPENSE" },
                visible_in_chart_of_accounts: true,
              },
            ],
          }),
      });

      const accounts = await sageAdapter.getAccounts(BASE_CREDS);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account_id).toBe("ledger-1");
      expect(accounts[0].code).toBe("5100");
      expect(accounts[0].name).toBe("Food & Beverage");
      expect(accounts[0].class).toBe("EXPENSE");
      expect(accounts[0].status).toBe("ACTIVE");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(sageAdapter.getAccounts(BASE_CREDS)).rejects.toThrow(
        "Failed to fetch Sage accounts",
      );
    });
  });

  describe("adapter.findOrCreateContact", () => {
    it("returns external_id immediately if provided", async () => {
      const id = await sageAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Vendor",
        external_id: "existing-id",
      });
      expect(id).toBe("existing-id");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns found contact id from search", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ $items: [{ id: "contact-1" }] }),
      });
      const id = await sageAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Acme",
      });
      expect(id).toBe("contact-1");
    });

    it("creates a new contact when none found", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ $items: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "new-contact-id" }),
        });

      const id = await sageAdapter.findOrCreateContact(BASE_CREDS, {
        name: "New Vendor",
      });
      expect(id).toBe("new-contact-id");
    });
  });

  describe("adapter.createBill", () => {
    it("returns success with external_id on creation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "invoice-1" }),
      });

      const result = await sageAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "GBP",
        total: 100,
        status: "DRAFT",
        line_items: [
          {
            description: "Item",
            quantity: 1,
            unit_amount: 100,
            account_code: "ledger-1",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("invoice-1");
    });

    it("returns failure on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve("Unprocessable"),
      });
      const result = await sageAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "GBP",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Sage API error");
    });
  });

  describe("adapter.updateBill", () => {
    it("returns success on successful update", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const result = await sageAdapter.updateBill(BASE_CREDS, "invoice-1", {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "GBP",
        total: 100,
        status: "AUTHORISED",
        line_items: [],
      });
      expect(result.success).toBe(true);
      expect(result.external_id).toBe("invoice-1");
    });
  });

  describe("adapter.getBillPaymentStatus", () => {
    it.each([
      ["PAID", "PAID"],
      ["PART_PAID", "PARTIALLY_PAID"],
      ["VOID", "VOIDED"],
      ["OUTSTANDING", "OUTSTANDING"],
    ])("maps Sage status '%s' to '%s'", async (sageStatus, expected) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: { id: sageStatus } }),
      });
      const status = await sageAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "invoice-1",
      );
      expect(status).toBe(expected);
    });
  });
});
