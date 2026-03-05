import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/services/accounting/token-manager", () => ({
  getValidCredentials: vi.fn(async (_id, creds) => creds),
}));

import {
  getWaveAuthUrl,
  exchangeCodeForTokens,
  waveAdapter,
} from "@/lib/services/accounting/wave";
import type { AccountingCredentials } from "@/lib/services/accounting/types";

const BASE_CREDS: AccountingCredentials = {
  access_token: "access-tok",
  refresh_token: "refresh-tok",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  token_type: "Bearer",
  tenant_id: "biz-123",
};

function makeGqlResponse(data: Record<string, unknown>) {
  return {
    ok: true,
    json: () => Promise.resolve({ data }),
  };
}

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Wave adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.WAVE_CLIENT_ID = "wave-client-id";
    process.env.WAVE_CLIENT_SECRET = "wave-secret";
    process.env.WAVE_REDIRECT_URI = "https://example.com/callback";
  });

  describe("getWaveAuthUrl", () => {
    it("returns an authorization URL with client_id and state", () => {
      const url = getWaveAuthUrl("state-token");
      expect(url).toContain("https://api.waveapps.com/oauth2/authorize/");
      expect(url).toContain("client_id=wave-client-id");
      expect(url).toContain("state=state-token");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges the code for tokens and fetches business ID", async () => {
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
        .mockResolvedValueOnce(
          makeGqlResponse({
            businesses: {
              edges: [{ node: { id: "biz-456", name: "My Biz" } }],
            },
          }),
        );

      const creds = await exchangeCodeForTokens("auth-code");
      expect(creds.access_token).toBe("new-access");
      expect(creds.tenant_id).toBe("biz-456");
    });

    it("throws on a non-ok token response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad"),
      });
      await expect(exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "Wave token exchange failed",
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
      const result = await waveAdapter.refreshToken(BASE_CREDS);
      expect(result.access_token).toBe("refreshed");
    });

    it("falls back to existing refresh_token when not returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: "refreshed", expires_in: 3600 }),
      });
      const result = await waveAdapter.refreshToken(BASE_CREDS);
      expect(result.refresh_token).toBe("refresh-tok");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("fail"),
      });
      await expect(waveAdapter.refreshToken(BASE_CREDS)).rejects.toThrow(
        "Wave token refresh failed",
      );
    });
  });

  describe("adapter.getAccounts", () => {
    it("maps Wave accounts to AccountingAccount[]", async () => {
      mockFetch.mockResolvedValueOnce(
        makeGqlResponse({
          business: {
            accounts: {
              edges: [
                {
                  node: {
                    id: "acc-1",
                    name: "Food",
                    type: { name: "Expense", value: "EXPENSE" },
                    subtype: { name: "General", value: "GENERAL" },
                    normalBalanceType: "DEBIT",
                    isArchived: false,
                  },
                },
              ],
            },
          },
        }),
      );

      const accounts = await waveAdapter.getAccounts(BASE_CREDS);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].account_id).toBe("acc-1");
      expect(accounts[0].name).toBe("Food");
      expect(accounts[0].class).toBe("EXPENSE");
      expect(accounts[0].status).toBe("ACTIVE");
    });

    it("throws on GraphQL errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ errors: [{ message: "Unauthorized" }] }),
      });
      await expect(waveAdapter.getAccounts(BASE_CREDS)).rejects.toThrow(
        "Failed to fetch Wave accounts: Unauthorized",
      );
    });
  });

  describe("adapter.findOrCreateContact", () => {
    it("returns external_id immediately if provided", async () => {
      const id = await waveAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Vendor",
        external_id: "existing-id",
      });
      expect(id).toBe("existing-id");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns found vendor id from search", async () => {
      mockFetch.mockResolvedValueOnce(
        makeGqlResponse({
          business: {
            vendors: {
              edges: [{ node: { id: "vendor-1", name: "Acme Corp" } }],
            },
          },
        }),
      );
      const id = await waveAdapter.findOrCreateContact(BASE_CREDS, {
        name: "Acme Corp",
      });
      expect(id).toBe("vendor-1");
    });

    it("creates a new vendor when none found", async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeGqlResponse({ business: { vendors: { edges: [] } } }),
        )
        .mockResolvedValueOnce(
          makeGqlResponse({
            vendorCreate: {
              didSucceed: true,
              vendor: { id: "new-vendor", name: "New Vendor" },
              inputErrors: [],
            },
          }),
        );

      const id = await waveAdapter.findOrCreateContact(BASE_CREDS, {
        name: "New Vendor",
      });
      expect(id).toBe("new-vendor");
    });
  });

  describe("adapter.createBill", () => {
    it("returns success with external_id on creation", async () => {
      mockFetch.mockResolvedValueOnce(
        makeGqlResponse({
          billCreate: {
            didSucceed: true,
            bill: { id: "bill-1", status: "UNPAID" },
            inputErrors: [],
          },
        }),
      );

      const result = await waveAdapter.createBill(BASE_CREDS, {
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
            account_code: "acc-1",
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.external_id).toBe("bill-1");
    });

    it("returns failure on GraphQL mutation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ errors: [{ message: "Invalid input" }] }),
      });
      const result = await waveAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "USD",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Wave API error");
    });

    it("returns failure on mutation inputErrors", async () => {
      mockFetch.mockResolvedValueOnce(
        makeGqlResponse({
          billCreate: {
            didSucceed: false,
            inputErrors: [
              {
                message: "Vendor not found",
                path: "vendorId",
                code: "INVALID",
              },
            ],
          },
        }),
      );
      const result = await waveAdapter.createBill(BASE_CREDS, {
        contact_name: "Vendor",
        reference: "PO-001",
        date: "2024-01-01",
        currency: "USD",
        total: 100,
        status: "DRAFT",
        line_items: [],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Vendor not found");
    });
  });

  describe("adapter.getBillPaymentStatus", () => {
    it.each([
      ["PAID", "PAID"],
      ["PARTIAL", "PARTIALLY_PAID"],
      ["OVERDUE", "OVERDUE"],
      ["UNPAID", "UNPAID"],
      ["DRAFT", "DRAFT"],
    ])("maps Wave status '%s' to '%s'", async (waveStatus, expected) => {
      mockFetch.mockResolvedValueOnce(
        makeGqlResponse({
          node: {
            id: "bill-1",
            status: waveStatus,
            amountDue: { value: 0 },
            total: { value: 100 },
          },
        }),
      );
      const status = await waveAdapter.getBillPaymentStatus(
        BASE_CREDS,
        "bill-1",
      );
      expect(status).toBe(expected);
    });
  });
});
