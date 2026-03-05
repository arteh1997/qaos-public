/**
 * Centralised Token Refresh Manager
 *
 * Handles automatic token refresh for accounting integrations (Xero, QuickBooks).
 * Uses a simple mutex to prevent concurrent refresh requests for the same connection.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { TokenRevokedError } from "./types";
import type { AccountingCredentials, TokenRefreshResult } from "./types";

// In-memory mutex to prevent concurrent refreshes for the same connection
const refreshLocks = new Map<string, Promise<TokenRefreshResult>>();

/**
 * Get valid credentials for a connection, refreshing the token if needed.
 * Thread-safe via in-memory lock per connection ID.
 */
export async function getValidCredentials(
  connectionId: string,
  credentials: AccountingCredentials,
  refreshFn: (creds: AccountingCredentials) => Promise<TokenRefreshResult>,
): Promise<AccountingCredentials> {
  const expiresAt = new Date(credentials.expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  // Token still valid (>5 min buffer)
  if (expiresAt > fiveMinutesFromNow) {
    return credentials;
  }

  // Check if a refresh is already in progress for this connection
  const existingRefresh = refreshLocks.get(connectionId);
  if (existingRefresh) {
    const result = await existingRefresh;
    return { ...credentials, ...result };
  }

  // Start a new refresh
  const refreshPromise = performRefresh(connectionId, credentials, refreshFn);
  refreshLocks.set(connectionId, refreshPromise);

  try {
    const result = await refreshPromise;
    return { ...credentials, ...result };
  } finally {
    refreshLocks.delete(connectionId);
  }
}

async function performRefresh(
  connectionId: string,
  credentials: AccountingCredentials,
  refreshFn: (creds: AccountingCredentials) => Promise<TokenRefreshResult>,
): Promise<TokenRefreshResult> {
  let result: TokenRefreshResult;

  try {
    result = await refreshFn(credentials);
  } catch (err) {
    if (err instanceof TokenRevokedError) {
      // Deactivate the connection — user must re-authorize
      const supabase = createAdminClient();
      await supabase
        .from("accounting_connections")
        .update({
          is_active: false,
          sync_status: "error",
          sync_error: err.message,
        })
        .eq("id", connectionId);
    }
    throw err;
  }

  // Persist updated tokens to database
  const supabase = createAdminClient();
  const updatedCredentials: AccountingCredentials = {
    ...credentials,
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: result.expires_at,
  };

  await supabase
    .from("accounting_connections")
    .update({ credentials: JSON.parse(JSON.stringify(updatedCredentials)) })
    .eq("id", connectionId);

  return result;
}
