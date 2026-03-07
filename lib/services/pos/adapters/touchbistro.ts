import type { PosProviderAdapter, PosMenuItem } from "../types";
import type { PosSaleEvent } from "@/lib/services/pos";
import { validateTouchBistroSignature } from "../webhook-validators";

function mapOrderToEvent(order: Record<string, unknown>): PosSaleEvent {
  const items =
    (order.order_items as Record<string, unknown>[]) ||
    (order.items as Record<string, unknown>[]) ||
    [];
  return {
    external_event_id: String(order.order_id || order.bill_id || order.id),
    event_type: (order.is_refund ? "refund" : "sale") as "sale" | "refund",
    items: items.map((item) => ({
      pos_item_id: String(item.menu_item_id || item.id || ""),
      pos_item_name:
        (item.menu_item_name as string) || (item.name as string) || "Unknown",
      quantity: item.quantity != null ? Number(item.quantity) : 1,
      unit_price: item.price ? Number(item.price) : undefined,
    })),
    total_amount: order.total ? Number(order.total) : undefined,
    currency: (order.currency as string) || "CAD",
    occurred_at:
      (order.closed_at as string) ||
      (order.created_at as string) ||
      new Date().toISOString(),
  };
}

/**
 * TouchBistro Adapter
 *
 * iPad POS popular with North American restaurants and bars.
 * Uses API key authentication.
 */
export const touchBistroAdapter: PosProviderAdapter = {
  provider: "touchbistro",
  name: "TouchBistro",
  authType: "api_key",

  getAuthUrl: undefined,
  exchangeCode: undefined,
  refreshToken: undefined,

  validateSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    return validateTouchBistroSignature(payload, signature, secret);
  },

  normalizeEvent(rawPayload: unknown): PosSaleEvent | null {
    const body = rawPayload as Record<string, unknown>;
    if (!(body.order_id as string) && !(body.bill_id as string)) return null;
    return mapOrderToEvent(body);
  },

  async validateConnection(
    credentials: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        "https://cloud.touchbistro.com/api/v1/restaurant",
        {
          headers: {
            Authorization: `Bearer ${credentials.api_key}`,
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
    const params = new URLSearchParams({ limit: "500" });
    if (since) {
      params.set("closed_after", since);
    }

    const res = await fetch(
      `https://cloud.touchbistro.com/api/v1/orders?${params}`,
      {
        headers: {
          Authorization: `Bearer ${credentials.api_key}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok)
      throw new Error(`TouchBistro orders fetch failed: ${res.status}`);
    const data = await res.json();

    return ((data.orders as Record<string, unknown>[]) || []).map((order) =>
      mapOrderToEvent(order),
    );
  },

  async fetchMenuItems(
    credentials: Record<string, unknown>,
  ): Promise<PosMenuItem[]> {
    const res = await fetch("https://cloud.touchbistro.com/api/v1/menu-items", {
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        Accept: "application/json",
      },
    });
    if (!res.ok)
      throw new Error(`TouchBistro menu fetch failed: ${res.status}`);
    const data = await res.json();

    return ((data.menu_items as Record<string, unknown>[]) || []).map(
      (item) => ({
        pos_item_id: String(item.id),
        pos_item_name: (item.name as string) || "Unknown",
        category: (item.category_name as string) || undefined,
        price: item.price ? Number(item.price) : undefined,
        currency: (item.currency as string) || "CAD",
      }),
    );
  },
};
