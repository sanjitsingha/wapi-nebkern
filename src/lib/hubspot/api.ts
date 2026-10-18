// ============================================================
// Authenticated calls into a customer's HubSpot (server only).
//
// The same three rules as lib/zoho/api.ts:
//
//   1. Mint an access token AHEAD of expiry (they last 30 minutes),
//      not in response to a 401 in the middle of someone's automation.
//   2. The clock is not the authority: a 401 retries once with a
//      freshly minted token, then gives up.
//   3. A refresh HubSpot refuses outright (the app was uninstalled in
//      HubSpot) marks the call `disconnected`, so callers stop retrying.
//
// Plus HubSpot's rate limit: a 429 is returned as a plain error, which
// the queue's backoff turns into a later retry.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { HUBSPOT_API, platformHubSpotCredentials, refreshHubSpotToken } from './client';

export interface HubSpotCallResult<T> {
  data?: T;
  error?: string;
  /** HTTP status HubSpot answered with, when it answered. */
  status?: number;
  /** The connection is gone or unusable, not merely failing. */
  disconnected?: boolean;
}

interface ConnectionRow {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  is_active: boolean;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const at = Date.parse(expiresAt);
  return Number.isNaN(at) || at <= Date.now();
}

async function accessToken(
  db: SupabaseClient,
  conn: ConnectionRow,
  force: boolean,
): Promise<HubSpotCallResult<string>> {
  if (!force && conn.access_token && !isExpired(conn.expires_at)) {
    try {
      return { data: decrypt(conn.access_token) };
    } catch {
      // Unreadable (a rotated ENCRYPTION_KEY): mint a new one below.
    }
  }

  if (!conn.refresh_token) {
    return { error: 'This HubSpot connection is not finished. Reconnect it in Settings.', disconnected: true };
  }
  let refreshToken: string;
  try {
    refreshToken = decrypt(conn.refresh_token);
  } catch {
    return {
      error: 'Stored HubSpot credentials could not be read. Disconnect and connect again.',
      disconnected: true,
    };
  }

  const platform = platformHubSpotCredentials();
  if (!platform) return { error: 'HubSpot is not configured on this server.', disconnected: true };

  const { tokens, error } = await refreshHubSpotToken({ refreshToken, ...platform });
  if (!tokens) {
    return {
      error: error ?? 'Could not refresh the HubSpot connection.',
      disconnected: /rejected|removed/i.test(error ?? ''),
    };
  }

  // Persist, so the next call this half hour does not refresh again.
  // HubSpot may rotate the refresh token too; keep whichever it gave.
  conn.access_token = encrypt(tokens.accessToken);
  conn.expires_at = tokens.expiresAt;
  await db
    .from('hubspot_connections')
    .update({
      access_token: conn.access_token,
      refresh_token: encrypt(tokens.refreshToken),
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  return { data: tokens.accessToken };
}

/** HubSpot's error body, reduced to one readable line. */
function errorMessage(json: unknown, status: number): string {
  const body = json as { message?: string; category?: string } | null;
  if (status === 429) return 'HubSpot rate limit reached; will retry.';
  if (status === 403 && /scope|permission/i.test(body?.message ?? body?.category ?? '')) {
    return 'HubSpot has not granted Instant this permission. Reconnect HubSpot in Settings to approve it.';
  }
  return body?.message ?? `HubSpot returned ${status}.`;
}

/**
 * Call the HubSpot API for an account. `path` is relative to
 * api.hubapi.com, e.g. `/crm/v3/objects/contacts/123`.
 */
export async function hubspotApiFetch<T = unknown>(
  db: SupabaseClient,
  accountId: string,
  path: string,
  init: RequestInit = {},
): Promise<HubSpotCallResult<T>> {
  const { data: row } = await db
    .from('hubspot_connections')
    .select('id, access_token, refresh_token, expires_at, is_active')
    .eq('account_id', accountId)
    .maybeSingle();
  const conn = row as ConnectionRow | null;
  if (!conn || !conn.is_active) {
    return { error: 'HubSpot is not connected for this account.', disconnected: true };
  }

  const attempt = async (force: boolean): Promise<HubSpotCallResult<T> | 'retry'> => {
    const token = await accessToken(db, conn, force);
    if (!token.data) return { error: token.error, disconnected: token.disconnected };

    let res: Response;
    try {
      res = await fetch(`${HUBSPOT_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token.data}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      return { error: 'Could not reach HubSpot.' };
    }

    if (res.status === 401 && !force) return 'retry';
    if (res.status === 204) return { data: undefined, status: 204 };

    const json = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      return {
        error: errorMessage(json, res.status),
        status: res.status,
        disconnected: res.status === 401,
      };
    }
    return { data: json ?? undefined, status: res.status };
  };

  const first = await attempt(false);
  if (first !== 'retry') return first;
  const second = await attempt(true);
  return second === 'retry'
    ? { error: 'HubSpot rejected the connection twice. Reconnect it in Settings.', disconnected: true }
    : second;
}
