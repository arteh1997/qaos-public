"use client";

import { useState, useEffect, useCallback } from "react";
import { useCSRF } from "./useCSRF";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface UseApiKeysResult {
  apiKeys: ApiKey[];
  isLoading: boolean;
  createApiKey: (data: {
    name: string;
    scopes: string[];
    expires_in_days?: number;
  }) => Promise<{ key: string } | undefined>;
  revokeApiKey: (keyId: string) => Promise<void>;
}

export function useApiKeys(storeId: string | null): UseApiKeysResult {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { csrfFetch } = useCSRF();

  const fetchApiKeys = useCallback(async () => {
    if (!storeId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/stores/${storeId}/api-keys`);
      const data = await response.json();
      if (response.ok) {
        setApiKeys(data.data ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const createApiKey = useCallback(
    async (body: {
      name: string;
      scopes: string[];
      expires_in_days?: number;
    }): Promise<{ key: string } | undefined> => {
      if (!storeId) return undefined;

      const response = await csrfFetch(`/api/stores/${storeId}/api-keys`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create API key");
      }

      await fetchApiKeys();
      return { key: data.data.key };
    },
    [storeId, csrfFetch, fetchApiKeys],
  );

  const revokeApiKey = useCallback(
    async (keyId: string): Promise<void> => {
      if (!storeId) return;

      const response = await csrfFetch(
        `/api/stores/${storeId}/api-keys?keyId=${keyId}`,
        { method: "DELETE" },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to revoke API key");
      }

      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    },
    [storeId, csrfFetch],
  );

  return { apiKeys, isLoading, createApiKey, revokeApiKey };
}
