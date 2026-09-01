// ============================================================
// Zoho CRM client (server only).
//
// Zoho's OAuth differs from the others in this codebase in two ways
// that matter, and both are handled here rather than at each call site:
//
//   1. REGION. Zoho runs separate data centres (.com, .eu, .in, .com.au,
//      .jp) and a token minted in one is rejected by the others. The
//      authorize response tells us which one, and every later call is
//      built from the stored domain rather than a hardcoded .com.
//
//   2. SHORT ACCESS TOKENS. They expire in an hour. The refresh token
//      is the durable one and is what the connection actually holds; an
//      access token is minted from it on demand.
// ============================================================

/** Zoho data centres, keyed by the `location` the callback returns. */
const ACCOUNTS_BY_LOCATION: Record<string, string> = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp',
  ca: 'https://accounts.zohocloud.ca',
  sa: 'https://accounts.zoho.sa',
};

/**
 * Scopes requested at connect.
 *
 * Read-only on the CRM modules, because this integration does not write
 * to Zoho — events come out, messages go out from here. Asking for
 * write access we never use is the kind of thing that makes an admin
 * refuse the install, and rightly.
 *
 * `ZohoCRM.org.READ` is what lets us name the org in Settings, so the
 * user can see WHICH Zoho is connected.
 */
export const ZOHO_SCOPES = [
  'ZohoCRM.modules.ALL.READ',
  'ZohoCRM.org.READ',
  'ZohoCRM.settings.READ',
] as const;

export interface ZohoTokens {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry, computed from Zoho's relative `expires_in`. */
  expiresAt: string;
  apiDomain: string;
  accountsUrl: string;
}

/** Where the user is sent to approve the connection. */
export function buildZohoAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  /** Which data centre to start at. Users on a non-US Zoho must pick
   *  theirs, or the consent screen refuses them. */
  accountsUrl?: string;
}): string {
  const base = input.accountsUrl ?? ACCOUNTS_BY_LOCATION.us;
  const u = new URL(`${base}/oauth/v2/auth`);
  u.searchParams.set('scope', ZOHO_SCOPES.join(','));
  u.searchParams.set('client_id', input.clientId);
  u.searchParams.set('response_type', 'code');
  // `offline` is what yields a refresh token. Without it the connection
  // dies silently an hour after it is made, which is the single easiest
  // way to get this integration wrong.
  u.searchParams.set('access_type', 'offline');
  // Ask every time. Zoho only returns a refresh token on the FIRST
  // consent otherwise, so a user who reconnects after revoking gets an
  // access token and nothing durable.
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('redirect_uri', input.redirectUri);
  u.searchParams.set('state', input.state);
  return u.toString();
}

/** Resolve the accounts host for a `location` the callback returned. */
export function accountsUrlForLocation(location: string | null): string {
  if (!location) return ACCOUNTS_BY_LOCATION.us;
  return ACCOUNTS_BY_LOCATION[location.toLowerCase()] ?? ACCOUNTS_BY_LOCATION.us;
}

/** All the data centres, for the connect dialog's picker. */
export const ZOHO_REGIONS: { value: string; label: string; accountsUrl: string }[] =
  [
    { value: 'us', label: 'United States (.com)', accountsUrl: ACCOUNTS_BY_LOCATION.us },
    { value: 'eu', label: 'Europe (.eu)', accountsUrl: ACCOUNTS_BY_LOCATION.eu },
    { value: 'in', label: 'India (.in)', accountsUrl: ACCOUNTS_BY_LOCATION.in },
    { value: 'au', label: 'Australia (.com.au)', accountsUrl: ACCOUNTS_BY_LOCATION.au },
    { value: 'jp', label: 'Japan (.jp)', accountsUrl: ACCOUNTS_BY_LOCATION.jp },
    { value: 'ca', label: 'Canada (.ca)', accountsUrl: ACCOUNTS_BY_LOCATION.ca },
    { value: 'sa', label: 'Saudi Arabia (.sa)', accountsUrl: ACCOUNTS_BY_LOCATION.sa },
  ];

interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  api_domain?: string;
  expires_in?: number;
  error?: string;
}

/** Trade the one-time `code` for tokens. */
export async function exchangeZohoCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountsUrl: string;
}): Promise<{ tokens?: ZohoTokens; error?: string }> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });

    const res = await fetch(`${input.accountsUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as ZohoTokenResponse;
    // Zoho answers 200 with an `error` field rather than a 4xx, so the
    // status alone is not a success check.
    if (json.error || !json.access_token) {
      return { error: zohoTokenError(json.error) };
    }
    if (!json.refresh_token) {
      return {
        error:
          'Zoho did not return a refresh token, so the connection would stop working within the hour. Remove this app under Zoho → Connected Apps and connect again.',
      };
    }

    return {
      tokens: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: expiryFrom(json.expires_in),
        apiDomain: json.api_domain ?? 'https://www.zohoapis.com',
        accountsUrl: input.accountsUrl,
      },
    };
  } catch {
    return { error: 'Could not reach Zoho to complete the connection.' };
  }
}

/**
 * Mint a fresh access token from the stored refresh token.
 *
 * Not called on the event path — an inbound Workflow Rule webhook
 * carries its own payload and needs no Zoho API call, which is why this
 * integration keeps working even when the access token has long since
 * expired.
 *
 * It exists for the calls that DO read from Zoho: `fetchZohoOrg` at
 * connect time today, and anything that later wants to pull a record's
 * fuller record than the webhook carried. Takes the client id and
 * secret explicitly because they are per-account (on the connection
 * row), not server-wide.
 */
export async function refreshZohoToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  accountsUrl: string;
}): Promise<{ tokens?: Omit<ZohoTokens, 'refreshToken'>; error?: string }> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    });

    const res = await fetch(`${input.accountsUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as ZohoTokenResponse;
    if (json.error || !json.access_token) {
      return { error: zohoTokenError(json.error) };
    }

    return {
      tokens: {
        accessToken: json.access_token,
        expiresAt: expiryFrom(json.expires_in),
        apiDomain: json.api_domain ?? 'https://www.zohoapis.com',
        accountsUrl: input.accountsUrl,
      },
    };
  } catch {
    return { error: 'Could not reach Zoho to refresh the connection.' };
  }
}

/** Who we are connected to, for the settings card. */
export async function fetchZohoOrg(input: {
  accessToken: string;
  apiDomain: string;
}): Promise<{ id?: string; name?: string; error?: string }> {
  try {
    const res = await fetch(`${input.apiDomain}/crm/v5/org`, {
      headers: { Authorization: `Zoho-oauthtoken ${input.accessToken}` },
    });
    if (!res.ok) return { error: `Zoho returned ${res.status}.` };
    const json = (await res.json()) as {
      org?: { zgid?: string; company_name?: string }[];
    };
    const org = json.org?.[0];
    return { id: org?.zgid, name: org?.company_name };
  } catch {
    return { error: 'Could not reach Zoho.' };
  }
}

/** Zoho's token errors are terse codes; say what they mean. */
function zohoTokenError(code: string | undefined): string {
  switch (code) {
    case 'invalid_code':
      return 'That authorization expired before it was used. Try connecting again.';
    case 'invalid_client':
      return 'The Zoho client ID or secret on this server is wrong. Check ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.';
    case 'invalid_client_secret':
      return 'The Zoho client secret on this server is wrong.';
    case 'invalid_redirect_uri':
      return 'The redirect URL does not match the one registered in the Zoho API console. They must match exactly.';
    case 'invalid_grant':
      return 'Zoho rejected the connection — it may have been revoked there. Connect again.';
    default:
      return code ? `Zoho refused the connection (${code}).` : 'Zoho refused the connection.';
  }
}

/** Absolute expiry, with a minute of headroom so a call that starts
 *  just before the boundary does not land just after it. */
function expiryFrom(expiresIn: number | undefined): string {
  const seconds = typeof expiresIn === 'number' ? expiresIn : 3600;
  return new Date(Date.now() + (seconds - 60) * 1000).toISOString();
}
