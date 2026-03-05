import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from "../types";
import type { PosSaleEvent } from "@/lib/services/pos";
import { validateCloverSignature } from "../webhook-validators";

const getAppId = () => process.env.CLOVER_APP_ID || "";
const getAppSecret = () => process.env.CLOVER_APP_SECRET || "";
const getBaseApiUrl = () =>
  process.env.CLOVER_API_URL || "https://api.clover.com";
const getOAuthBaseUrl = () => "https://www.clover.com";

export const cloverAdapter: PosProviderAdapter = {
  provider: "clover",
  name: "Clover",
  authType: "oauth2",

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getAppId(),
      response_type: "code",
      state: stateToken,
    });
    return `${getOAuthBaseUrl()}/oauth/v2/authorize?${params}`;
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch(
      `${getOAuthBaseUrl()}/oauth/v2/token?client_id=${getAppId()}&client_secret=${getAppSecret()}&code=${code}`,
    );
    if (!res.ok) throw new Error(`Clover token exchange failed: ${res.status}`);
    const data = await res.json();
    return {
      access_token: data.access_token,
      merchant_id: data.merchant_id,
    };
  },

  validateSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    return validateCloverSignature(payload, signature, secret);
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>;
    if (!body.orderId && !body.id) return null;

    const lineItems = (body.lineItems as Record<string, unknown>[]) || [];
    return {
      external_event_id: (body.orderId as string) || (body.id as string),
      event_type: body.refunded ? "refund" : "sale",
      items: lineItems.map((li) => ({
        pos_item_id: (li.id as string) || "",
        pos_item_name: (li.name as string) || "Unknown",
        quantity: Number(li.quantity) || 1,
        unit_price: li.price ? Number(li.price) / 100 : undefined,
      })),
      total_amount: body.total ? Number(body.total) / 100 : undefined,
      currency: "GBP",
      occurred_at: body.createdTime
        ? new Date(Number(body.createdTime)).toISOString()
        : new Date().toISOString(),
    };
  },

  async fetchMenuItems(
    credentials: Record<string, unknown>,
  ): Promise<PosMenuItem[]> {
    const merchantId = credentials.merchant_id as string;
    const res = await fetch(
      `${getBaseApiUrl()}/v3/merchants/${merchantId}/items?expand=categories`,
      { headers: { Authorization: `Bearer ${credentials.access_token}` } },
    );
    if (!res.ok) throw new Error(`Clover items fetch failed: ${res.status}`);
    const data = await res.json();

    return (data.elements || []).map((item: Record<string, unknown>) => ({
      pos_item_id: item.id as string,
      pos_item_name: (item.name as string) || "Unknown",
      category:
        ((
          (item.categories as Record<string, unknown>)?.elements as Record<
            string,
            unknown
          >[]
        )?.[0]?.name as string) || undefined,
      price: item.price ? Number(item.price) / 100 : undefined,
      currency: "GBP",
    }));
  },
};
