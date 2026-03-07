import type { PosProviderAdapter, PosMenuItem, PosOAuthTokens } from "../types";
import type { PosSaleEvent } from "@/lib/services/pos";
import { validateRevelSignature } from "../webhook-validators";

const getClientId = () => process.env.REVEL_CLIENT_ID || "";
const getClientSecret = () => process.env.REVEL_CLIENT_SECRET || "";
const getRedirectUri = () => process.env.REVEL_REDIRECT_URI || "";

/**
 * Revel Systems Adapter
 *
 * Cloud-native iPad POS for restaurants and retail, global reach.
 * OAuth2 authentication.
 */
export const revelAdapter: PosProviderAdapter = {
  provider: "revel",
  name: "Revel Systems",
  authType: "oauth2",

  getAuthUrl(_storeId: string, stateToken: string): string {
    const params = new URLSearchParams({
      client_id: getClientId(),
      response_type: "code",
      redirect_uri: getRedirectUri(),
      state: stateToken,
    });
    return `https://api.revelsystems.com/oauth2/authorize?${params}`;
  },

  async exchangeCode(code: string): Promise<PosOAuthTokens> {
    const res = await fetch("https://api.revelsystems.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
        redirect_uri: getRedirectUri(),
      }),
    });
    if (!res.ok) throw new Error(`Revel token exchange failed: ${res.status}`);
    const data = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(
        Date.now() + (data.expires_in || 3600) * 1000,
      ).toISOString(),
    };
  },

  async refreshToken(
    credentials: Record<string, unknown>,
  ): Promise<PosOAuthTokens> {
    const res = await fetch("https://api.revelsystems.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: getClientId(),
        client_secret: getClientSecret(),
        refresh_token: credentials.refresh_token as string,
      }),
    });
    if (!res.ok) throw new Error(`Revel token refresh failed: ${res.status}`);
    const data = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(
        Date.now() + (data.expires_in || 3600) * 1000,
      ).toISOString(),
    };
  },

  validateSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    return validateRevelSignature(payload, signature, secret);
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>;
    const orderId = (body.order_id as string) || (body.id as string);
    if (!orderId) return null;

    const items =
      (body.items as Record<string, unknown>[]) ||
      (body.order_items as Record<string, unknown>[]) ||
      [];
    return {
      external_event_id: String(orderId),
      event_type: body.is_refund ? "refund" : "sale",
      items: items.map((item) => ({
        pos_item_id: String(item.product_id || item.id || ""),
        pos_item_name:
          (item.product_name as string) || (item.name as string) || "Unknown",
        quantity: Number(item.quantity) || 1,
        unit_price: item.price ? Number(item.price) : undefined,
      })),
      total_amount: body.final_total ? Number(body.final_total) : undefined,
      currency: "USD",
      occurred_at: (body.created_date as string) || new Date().toISOString(),
    };
  },

  async validateConnection(
    credentials: Record<string, unknown>,
  ): Promise<boolean> {
    const domain = (credentials.domain as string) || "api.revelsystems.com";
    try {
      const res = await fetch(
        `https://${domain}/resources/Establishment/?format=json&limit=1`,
        {
          headers: {
            "API-AUTHENTICATION": `${credentials.api_key}:${credentials.api_secret}`,
            Accept: "application/json",
          },
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  async syncSales(
    credentials: Record<string, unknown>,
    since?: string,
  ): Promise<PosSaleEvent[]> {
    const domain = (credentials.domain as string) || "api.revelsystems.com";
    const params = new URLSearchParams({
      format: "json",
      limit: "500",
      order_by: "-created_date",
    });
    if (since) {
      params.set("created_date__gte", since);
    }

    const res = await fetch(`https://${domain}/resources/Order/?${params}`, {
      headers: {
        "API-AUTHENTICATION": `${credentials.api_key}:${credentials.api_secret}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Revel orders fetch failed: ${res.status}`);
    const data = await res.json();

    return ((data.objects as Record<string, unknown>[]) || []).map((order) => {
      const items = (order.items as Record<string, unknown>[]) || [];
      return {
        external_event_id: String(order.id),
        event_type: (order.is_refund ? "refund" : "sale") as "sale" | "refund",
        items: items.map((item) => ({
          pos_item_id: String(item.product_id || item.id || ""),
          pos_item_name:
            (item.product_name as string) || (item.name as string) || "Unknown",
          quantity: Number(item.quantity) || 1,
          unit_price: item.price ? Number(item.price) : undefined,
        })),
        total_amount: order.final_total ? Number(order.final_total) : undefined,
        currency: "USD",
        occurred_at: (order.created_date as string) || new Date().toISOString(),
      };
    });
  },

  async fetchMenuItems(
    credentials: Record<string, unknown>,
  ): Promise<PosMenuItem[]> {
    const domain = (credentials.domain as string) || "api.revelsystems.com";
    const res = await fetch(
      `https://${domain}/resources/Product/?format=json&limit=500`,
      {
        headers: {
          "API-AUTHENTICATION": `${credentials.api_key}:${credentials.api_secret}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) throw new Error(`Revel products fetch failed: ${res.status}`);
    const data = await res.json();

    return ((data.objects as Record<string, unknown>[]) || []).map(
      (product) => ({
        pos_item_id: String(product.id),
        pos_item_name: (product.name as string) || "Unknown",
        category: (product.category_name as string) || undefined,
        price: product.price ? Number(product.price) : undefined,
        currency: "USD",
      }),
    );
  },
};
