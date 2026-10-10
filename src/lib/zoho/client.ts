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
//      We no longer ASK which region. Zoho's multi-DC support lets one
//      client serve every data centre: the consent flow always starts
//      at accounts.zoho.com, Zoho sends the user on to their own DC,
//      and the callback comes back carrying `location` ("in", "eu")
//      plus `accounts-server`. See accountsUrlFromCallback.
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
 * ONE scope, and the narrowest one that works.
 *
 * This integration never reads a CRM record: a Workflow Rule webhook
 * arrives carrying its own payload, which is the whole point of the
 * design. The only Zoho API call in the codebase is `/crm/v5/org`, once
 * at connect time, to name the organisation in Settings — and
 * `ZohoCRM.org.READ` is exactly that.
 *
 * An earlier version asked for `ZohoCRM.modules.ALL` as well. That
 * would have granted read AND write on every record in the CRM to
 * satisfy no call at all, which is the kind of consent screen an admin
 * is right to refuse.
 *
 * Note the grammar if this ever needs extending:
 * `Service.Resource.Operation`. `ZohoCRM.modules.ALL.READ` is a fourth
 * segment that does not parse — Zoho answers "Invalid OAuth Scope —
 * Scope does not exist", with no hint as to which one.
 */
export const ZOHO_SCOPES = ['ZohoCRM.org.READ'] as const;

/**
 * The ONE Zoho application this deployment connects through.
 *
 * This reverses the original design, where every account registered its
 * own Zoho client and pasted the id and secret into Settings. That was
 * chosen because Zoho is region-partitioned and a client registered on
 * .com is unknown to .in — but Zoho's multi-DC support solves exactly
 * that, and asking each customer to register a server-based application
 * before they can connect a CRM is a wall most of them will not climb.
 *
 * Register it once at api-console.zoho.com as a Server-based
 * Application with "Use the same OAuth credentials for all data
 * centers" enabled, then set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.
 *
 * Returns null when unset, so the UI can say the integration is not
 * configured on this server rather than sending someone to a consent
 * screen that will refuse them.
 */
export function platformZohoCredentials():
  | { clientId: string; clientSecret: string }
  | null {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * The redirect URI sent to Zoho, and the single most common way this
 * handshake fails.
 *
 * Zoho compares it to the Authorized Redirect URI in the API console
 * BYTE FOR BYTE. A different scheme, a different port or a trailing
 * slash, and the consent screen refuses with "Redirect URI passed does
 * not match with the one configured" — naming neither value, so there
 * is nothing to compare.
 *
 * ── It is the SITE's address, not the browser's ──
 *
 * This followed the request origin at first, so that localhost, a
 * tunnel and production would each work against their own console
 * entry. That is the wrong trade for a product with one address: it
 * made the registered URL depend on where the admin happened to be
 * sitting, and connecting from a dev server duly sent Zoho a
 * localhost callback that nobody had registered — or could, since
 * Zoho cannot reach it.
 *
 * NEXT_PUBLIC_SITE_URL is the deployment's canonical address and is
 * already set in every environment, so the value is now constant:
 * ONE URL to register, and connecting from a dev server still
 * completes against the live site. ZOHO_REDIRECT_URI overrides it
 * outright if a deployment ever needs something else.
 *
 * Both the authorize URL and the token exchange call this. They must
 * agree, or the exchange fails after the user has already consented.
 */
export function zohoRedirectUri(origin?: string): string {
  const override = process.env.ZOHO_REDIRECT_URI?.trim();
  if (override) return stripSlash(override);

  // The canonical site, so the value is the same no matter where the
  // admin happens to be browsing from.
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return `${stripSlash(site)}${ZOHO_CALLBACK_PATH}`;

  // Only when the site URL is unset — a bare checkout with no env. Not
  // the normal path, and it is the case that produced a localhost
  // redirect URI nobody had registered.
  return origin
    ? `${stripSlash(origin)}${ZOHO_CALLBACK_PATH}`
    : ZOHO_CALLBACK_PATH;
}

const ZOHO_CALLBACK_PATH = '/api/integrations/zoho/oauth/callback';

function stripSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Whether a connection row must keep going through its OWN Zoho
 * application rather than this deployment's.
 *
 * The test is NOT "does it have a client_id". It is "did that client
 * ever actually mint us a token" — which is what refresh_token proves.
 *
 * The distinction matters because a half-made row is ordinary debris:
 * someone pasted credentials under the old design, never finished the
 * consent, and left a row behind. Treating that as a legacy connection
 * pins the account to an application nothing depends on, and there is
 * no way to clear it from the UI because Disconnect only appears once
 * a connection is live. Requiring the refresh token means only a
 * connection that genuinely works keeps its own app — which is the
 * whole and only reason legacy rows get special treatment, since a
 * refresh token can only be refreshed by the client that minted it.
 *
 * Start and callback MUST agree on this. If start sends the user to
 * Zoho with one client and the callback exchanges the code with
 * another, Zoho answers invalid_client and the consent is wasted.
 */
export function usesLegacyZohoApp(
  row: {
    client_id?: unknown;
    client_secret?: unknown;
    refresh_token?: unknown;
  } | null,
): boolean {
  return !!(row?.client_id && row?.client_secret && row?.refresh_token);
}

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
  /**
   * Where to begin. Defaults to accounts.zoho.com, which is the
   * multi-DC entry point: Zoho recognises the signed-in user's home
   * data centre and forwards them to it, then names it on the way back.
   * Nobody has to pick a region.
   *
   * Still overridable, because a connection made under the old
   * per-account design is pinned to the DC its client was registered
   * in and has to be refreshed there.
   */
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

/**
 * Which data centre to exchange the code at, from what the callback said.
 *
 * ── Why this is safe to read off the URL ──
 *
 * The region used to be pinned in a cookie at start time, deliberately,
 * because the returning URL is attacker-controlled and the token
 * exchange carries our client secret — posting it to a host of
 * someone else's choosing would hand it over.
 *
 * Multi-DC means we no longer know the DC at start time, so it HAS to
 * come back with the user. What keeps that safe is that neither value
 * is ever used as a URL: `location` is a short code looked up in
 * ACCOUNTS_BY_LOCATION above, and `accounts-server` is only ever
 * compared for equality against those same known hosts. Anything
 * unrecognised falls back to the US DC. The return value is therefore
 * always one of our own constants, whatever Zoho — or anyone else —
 * puts in the query string.
 */
export function accountsUrlFromCallback(
  location: string | null,
  accountsServer: string | null,
): string {
  if (location && ACCOUNTS_BY_LOCATION[location.toLowerCase()]) {
    return ACCOUNTS_BY_LOCATION[location.toLowerCase()];
  }
  // No `location`: match the server Zoho named against the ones we know.
  // Compared, never dereferenced — see above.
  if (accountsServer) {
    const normalised = accountsServer.trim().replace(/\/+$/, '');
    const known = Object.values(ACCOUNTS_BY_LOCATION).find(
      (host) => host === normalised,
    );
    if (known) return known;
  }
  return ACCOUNTS_BY_LOCATION.us;
}

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
