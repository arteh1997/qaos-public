"use client";

import { useState, useEffect, useCallback } from "react";
import { useCSRF } from "./useCSRF";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface UseWebhooksResult {
  webhooks: WebhookEndpoint[];
  isLoading: boolean;
  createWebhook: (data: {
    url: string;
    events: string[];
    description?: string;
  }) => Promise<{ secret: string } | undefined>;
  deleteWebhook: (webhookId: string) => Promise<void>;
}

export function useWebhooks(storeId: string | null): UseWebhooksResult {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { csrfFetch } = useCSRF();

  const fetchWebhooks = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/stores/${storeId}/webhooks`);
      const data = await response.json();
      if (response.ok) {
        setWebhooks(data.data ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const createWebhook = useCallback(
    async (body: {
      url: string;
      events: string[];
      description?: string;
    }): Promise<{ secret: string } | undefined> => {
      if (!storeId) return undefined;

      const response = await csrfFetch(`/api/stores/${storeId}/webhooks`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create webhook");
      }

      await fetchWebhooks();
      return { secret: data.data.secret };
    },
    [storeId, csrfFetch, fetchWebhooks],
  );

  const deleteWebhook = useCallback(
    async (webhookId: string): Promise<void> => {
      if (!storeId) return;

      const response = await csrfFetch(
        `/api/stores/${storeId}/webhooks?webhookId=${webhookId}`,
        { method: "DELETE" },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete webhook");
      }

      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    },
    [storeId, csrfFetch],
  );

  return { webhooks, isLoading, createWebhook, deleteWebhook };
}
