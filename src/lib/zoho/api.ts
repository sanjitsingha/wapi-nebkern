// ============================================================
// Authenticated calls into a customer's Zoho CRM (server only).
//
// Until now this integration never read from Zoho. A Workflow Rule
// pushed an event carrying its own payload, and that was the whole
// design — which is why `refreshZohoToken` existed and nothing called
// it on a live path.
//
// Reading changes the failure modes, so they are handled here once
// rather than at each call site:
//
//   1. ACCESS TOKENS LAST AN HOUR. The refresh token is the durable
//      one. A token is minted ahead of expiry rather than in response
//      to a 401, because the 401 costs a round trip and arrives in the
//      middle of someone's automation.
//
//   2. THE CLOCK IS NOT THE AUTHORITY. `expires_at` can be right and
//      the token still rejected — revoked in Zoho, or invalidated by a
//      reconnect elsewhere. So a 401 retries ONCE with a freshly
//      minted token, and only then gives up.
//
//   3. WHICH CLIENT MINTED IT. A refresh token can only be refreshed
//      by the OAuth client that issued it, so a legacy row refreshes
//      with its own credentials and everything else with the
//      platform's. Same rule as the connect routes, same helper.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import {
  platformZohoCredentials,
  refreshZohoToken,
  usesLegacyZohoApp,
} from './client';

/** What a call needs, read once per request rather than per call. */
interface ZohoAuth {
  accessToken: string;
  apiDomain: string;
}

export interface ZohoCallResult<T> {
  data?: T;
  /** Set when the call could not be made or Zoho refused it. */
  error?: string;
  /** True when the connection is gone or unusable, not merely failing.
   *  Callers use it to stop retrying rather than to report. */
  disconnected?: boolean;
}

interface ConnectionRow {
  id: string;
  account_id: string;
  api_domain: string | null;
  accounts_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  client_id: string | null;
  client_secret: string | null;
  is_active: boolean;
}

const SELECT =
  'id, account_id, api_domain, accounts_url, access_token, refresh_token, expires_at, client_id, client_secret, is_active';

/**
 * A minute of headroom, matching how `expires_at` is written.
 *
 * Without it a call that starts just inside the window lands just
 * outside it, which shows up as an intermittent 401 that is very hard
 * to attribute.
 */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const at = Date.parse(expiresAt);
  return Number.isNaN(at) || at <= Date.now();
}

/**
 * Ensure the connection has a usable access token, minting one if not.
 *
 * `force` skips the expiry check, for the retry after a 401 where the
 * stored token is wrong despite looking current.
 */
async function authorise(
  db: SupabaseClient,
  conn: ConnectionRow,
  force: boolean,
): Promise<ZohoCallResult<ZohoAuth>> {
  const apiDomain = conn.api_domain || 'https://www.zohoapis.com';

  if (!force && conn.access_token && !isExpired(conn.expires_at)) {
    try {
      return { data: { accessToken: decrypt(conn.access_token), apiDomain } };
    } catch {
      // Unreadable, so fall through and mint a new one rather than
      // failing: a rotated ENCRYPTION_KEY should not take the
      // connection down when the refresh token still works.
    }
  }

  if (!conn.refresh_token) {
    return {
      error: 'This Zoho connection is not finished. Reconnect it in Settings.',
      disconnected: true,
    };
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(conn.refresh_token);
  } catch {
    return {
      error:
        'Stored Zoho credentials could not be read. Disconnect and connect again.',
      disconnected: true,
    };
  }

  // The client that minted this refresh token is the only one that can
  // refresh it. See usesLegacyZohoApp.
  let clientId: string;
  let clientSecret: string;
  if (usesLegacyZohoApp(conn)) {
    try {
      clientSecret = decrypt(conn.client_secret as string);
    } catch {
      return {
        error:
          'Stored Zoho credentials could not be read. Disconnect and connect again.',
        disconnected: true,
      };
    }
    clientId = conn.client_id as string;
  } else {
    const platform = platformZohoCredentials();
    if (!platform) {
      return {
        error: 'Zoho is not configured on this server.',
        disconnected: true,
      };
    }
    clientId = platform.clientId;
    clientSecret = platform.clientSecret;
  }

  const { tokens, error } = await refreshZohoToken({
    refreshToken,
    clientId,
    clientSecret,
    accountsUrl: conn.accounts_url || 'https://accounts.zoho.com',
  });

  if (!tokens) {
    // invalid_grant means the user revoked us in Zoho, or the token was
    // superseded. Nothing retries past that, so say so plainly.
    const revoked = /revoked|invalid_grant|rejected/i.test(error ?? '');
    return { error: error ?? 'Could not refresh the Zoho connection.', disconnected: revoked };
  }

  // Persist, so the next call in this hour does not refresh again.
  // Best effort: a failed write costs an extra refresh later, which is
  // cheaper than failing the call the caller actually wanted.
  await db
    .from('zoho_connections')
    .update({
      access_token: encrypt(tokens.accessToken),
      expires_at: tokens.expiresAt,
      api_domain: tokens.apiDomain,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  return { data: { accessToken: tokens.accessToken, apiDomain: tokens.apiDomain } };
}

/**
 * Call the Zoho CRM API for an account, refreshing the token as needed.
 *
 * `path` is relative to the API domain and starts with a slash, e.g.
 * `/crm/v5/Leads/12345`. The domain is NOT hardcoded: it is whichever
 * data centre this connection was made in, and a .com URL is rejected
 * outright by an account on .in.
 */
export async function zohoApiFetch<T = unknown>(
  db: SupabaseClient,
  accountId: string,
  path: string,
  init: RequestInit = {},
): Promise<ZohoCallResult<T>> {
  const { data: row } = await db
    .from('zoho_connections')
    .select(SELECT)
    .eq('account_id', accountId)
    .maybeSingle();

  const conn = row as ConnectionRow | null;
  if (!conn || !conn.is_active) {
    return { error: 'Zoho is not connected for this account.', disconnected: true };
  }

  const attempt = async (force: boolean): Promise<ZohoCallResult<T> | 'retry'> => {
    const auth = await authorise(db, conn, force);
    if (!auth.data) {
      return { error: auth.error, disconnected: auth.disconnected };
    }

    let res: Response;
    try {
      res = await fetch(`${auth.data.apiDomain}${path}`, {
        ...init,
        headers: {
          Authorization: `Zoho-oauthtoken ${auth.data.accessToken}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      return { error: 'Could not reach Zoho.' };
    }

    // The token was wrong despite the clock. Worth exactly one retry
    // with a freshly minted one — see the note at the top.
    if (res.status === 401 && !force) return 'retry';

    // 204 is success with nothing to say: a delete, or a query that
    // matched no records. Returning an error here would turn "no
    // results" into a failure.
    if (res.status === 204) return { data: undefined };

    const json = (await res.json().catch(() => null)) as T | null;

    if (!res.ok) {
      const message =
        (json as { message?: string } | null)?.message ??
        `Zoho returned ${res.status}.`;
      return { error: message, disconnected: res.status === 401 };
    }

    return { data: json ?? undefined };
  };

  const first = await attempt(false);
  if (first !== 'retry') return first;

  const second = await attempt(true);
  return second === 'retry'
    ? { error: 'Zoho rejected the connection twice. Reconnect it in Settings.', disconnected: true }
    : second;
}
