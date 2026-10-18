// ============================================================
// HubSpot client (server only): OAuth, tokens, and webhook signatures.
//
// Shaped like lib/zoho/client.ts, with HubSpot's differences:
//
//   ONE APP, ONE REGION. There is no data-centre dance. The consent
//   screen is app.hubspot.com, tokens come from api.hubspot.com and
//   every portal — EU-hosted included — is reached at api.hubapi.com.
//
//   SHORT ACCESS TOKENS. Thirty minutes. The refresh token is the
//   durable credential; access tokens are minted from it on demand
//   (lib/hubspot/api.ts).
//
//   SIGNED WEBHOOKS. Every delivery carries an HMAC made with the app's
//   client secret, so — unlike Zoho's Workflow Rules — the receiver can
//   prove a request came from HubSpot. verifyHubSpotSignature below.
//
// The app itself is defined in /hubspot (a HubSpot developer project):
// its redirect URL, scopes and webhook subscriptions live there, and
// must agree with this file.
// ============================================================

import crypto from 'crypto';

const AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubspot.com/oauth/v3/token';
const INTROSPECT_URL = 'https://api.hubspot.com/oauth/v3/token/introspect';
export const HUBSPOT_API = 'https://api.hubapi.com';

/**
 * Scopes requested at connect — and, identically, `requiredScopes` in
 * hubspot/src/app/app-hsmeta.json. HubSpot refuses the consent screen
 * when the two disagree.
 *
 * Every one is used (asserted in client.test.ts against the labels):
 *
 *   crm.objects.contacts.read/write  two-way contact sync; also covers
 *                                    logging chats (communications and
 *                                    notes are engagements on contacts).
 *   crm.objects.deals.read/write     deals both ways, and the deal
 *                                    pipeline's stages.
 *   crm.objects.owners.read          the record owner's name in the
 *                                    inbox panel.
 *   oauth                            HubSpot's base OAuth scope.
 */
export const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.owners.read',
  'oauth',
] as const;

/** What each scope means in plain words, for "Granted permissions".
 *  Read and write read as one line. */
export const HUBSPOT_SCOPE_LABELS: Record<(typeof HUBSPOT_SCOPES)[number], string | null> = {
  'crm.objects.contacts.read': 'Contacts — read and write',
  'crm.objects.contacts.write': 'Contacts — read and write',
  'crm.objects.deals.read': 'Deals — read and write',
  'crm.objects.deals.write': 'Deals — read and write',
  'crm.objects.owners.read': 'Owners — read',
  // Not a permission anyone needs explained.
  oauth: null,
};

/** The granted permissions, as Settings lists them. */
export function hubspotPermissionLabels(): string[] {
  const labels = HUBSPOT_SCOPES.map((s) => HUBSPOT_SCOPE_LABELS[s]).filter(
    (l): l is string => !!l,
  );
  return [...new Set([...labels, 'Timeline — log WhatsApp chats'])];
}

/**
 * Instant's HubSpot app. Created once in a HubSpot developer account
 * from the /hubspot project; its Auth tab has the pair. Null when unset,
 * so Settings can say the integration is not configured rather than
 * sending someone to a consent screen that will refuse them.
 */
export function platformHubSpotCredentials():
  | { clientId: string; clientSecret: string }
  | null {
  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

const CALLBACK_PATH = '/api/integrations/hubspot/oauth/callback';

/**
 * The redirect URI. HubSpot compares it with the app's redirectUrls
 * exactly, so — as with Zoho — it is the site's canonical address, not
 * wherever the admin happens to be browsing from. HUBSPOT_REDIRECT_URI
 * overrides it outright.
 */
export function hubspotRedirectUri(origin?: string): string {
  const override = process.env.HUBSPOT_REDIRECT_URI?.trim();
  if (override) return stripSlash(override);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return `${stripSlash(site)}${CALLBACK_PATH}`;
  return origin ? `${stripSlash(origin)}${CALLBACK_PATH}` : CALLBACK_PATH;
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function buildHubSpotAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('client_id', input.clientId);
  u.searchParams.set('scope', HUBSPOT_SCOPES.join(' '));
  u.searchParams.set('redirect_uri', input.redirectUri);
  u.searchParams.set('state', input.state);
  return u.toString();
}

export interface HubSpotTokens {
  accessToken: string;
  refreshToken: string;
  /** Absolute, with a minute of headroom. */
  expiresAt: string;
  hubId: string | null;
  scopes: string[];
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  hub_id?: number | string;
  scopes?: string[] | string;
  status?: string;
  message?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(
  params: Record<string, string>,
): Promise<{ json?: TokenResponse; error?: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !json.access_token) {
      return { error: hubspotTokenError(json) };
    }
    return { json };
  } catch {
    return { error: 'Could not reach HubSpot.' };
  }
}

function toTokens(json: TokenResponse, refreshToken: string): HubSpotTokens {
  const scopes = Array.isArray(json.scopes)
    ? json.scopes
    : typeof json.scopes === 'string'
      ? json.scopes.split(/\s+/).filter(Boolean)
      : [];
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: expiryFrom(json.expires_in),
    hubId: json.hub_id !== undefined && json.hub_id !== null ? String(json.hub_id) : null,
    scopes,
  };
}

/** Trade the one-time `code` for tokens. */
export async function exchangeHubSpotCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ tokens?: HubSpotTokens; error?: string }> {
  const { json, error } = await tokenRequest({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  if (!json) return { error };
  if (!json.refresh_token) {
    return { error: 'HubSpot did not return a refresh token. Try connecting again.' };
  }
  return { tokens: toTokens(json, json.refresh_token) };
}

/** Mint a fresh access token from the stored refresh token. */
export async function refreshHubSpotToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ tokens?: HubSpotTokens; error?: string }> {
  const { json, error } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });
  if (!json) return { error };
  return { tokens: toTokens(json, input.refreshToken) };
}

/** Which portal a token belongs to, for showing WHICH HubSpot is
 *  connected. Best effort — a failure costs only the label. */
export async function introspectHubSpotToken(input: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ hubId?: string; hubDomain?: string }> {
  try {
    const res = await fetch(INTROSPECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        token_type_hint: 'access_token',
        access_token: input.accessToken,
      }),
    });
    if (!res.ok) return {};
    const json = (await res.json().catch(() => ({}))) as {
      hub_id?: number | string;
      hub_domain?: string;
    };
    return {
      hubId: json.hub_id !== undefined ? String(json.hub_id) : undefined,
      hubDomain: json.hub_domain || undefined,
    };
  } catch {
    return {};
  }
}

/** Where the portal's web app lives — app-eu1.hubspot.com for an EU
 *  account — so "Open in HubSpot" lands in the right place. */
export async function fetchHubSpotUiDomain(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${HUBSPOT_API}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => ({}))) as { uiDomain?: string };
    const domain = json.uiDomain?.trim().toLowerCase();
    return domain && /^[a-z0-9.-]+\.hubspot\.com$/.test(domain) ? domain : null;
  } catch {
    return null;
  }
}

function hubspotTokenError(json: TokenResponse): string {
  const code = json.error ?? json.status ?? '';
  if (/invalid_grant|BAD_REFRESH_TOKEN|BAD_AUTH_CODE/i.test(code)) {
    return 'HubSpot rejected the connection — it may have been removed there. Connect again.';
  }
  if (/invalid_client|BAD_CLIENT_ID|BAD_CLIENT_SECRET/i.test(code)) {
    return 'The HubSpot client ID or secret on this server is wrong. Check HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.';
  }
  if (/redirect/i.test(code) || /redirect/i.test(json.message ?? '')) {
    return 'The redirect URL does not match the one in the HubSpot app. They must match exactly.';
  }
  const detail = json.error_description ?? json.message;
  return detail ? `HubSpot refused the connection: ${detail}` : 'HubSpot refused the connection.';
}

function expiryFrom(expiresIn: number | undefined): string {
  const seconds = typeof expiresIn === 'number' ? expiresIn : 1800;
  return new Date(Date.now() + (seconds - 60) * 1000).toISOString();
}

// ── Webhook signatures ──────────────────────────────────────

/** Requests older than this are refused (HubSpot's own guidance). */
const MAX_SIGNATURE_AGE_MS = 5 * 60_000;

/** The characters HubSpot says to decode in the URI before hashing. */
const URI_DECODES: [RegExp, string][] = [
  [/%3A/gi, ':'],
  [/%2F/gi, '/'],
  [/%3F/gi, '?'],
  [/%40/gi, '@'],
  [/%21/gi, '!'],
  [/%24/gi, '$'],
  [/%27/gi, "'"],
  [/%28/gi, '('],
  [/%29/gi, ')'],
  [/%2A/gi, '*'],
  [/%2C/gi, ','],
  [/%3B/gi, ';'],
];

function decodeUri(uri: string): string {
  return URI_DECODES.reduce((s, [re, ch]) => s.replace(re, ch), uri);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Did HubSpot send this? Accepts the v3 signature (HMAC-SHA256 of
 * method + URI + body + timestamp, base64) and the older v1/v2 hashes
 * HubSpot still sends on some deliveries.
 *
 * `uris` are the addresses the request may have been made to. Behind
 * nginx the URL Next sees is not the one HubSpot called (see
 * lib/public-origin.ts), so the caller passes the public one — and the
 * site URL as well, in case the two differ.
 */
export function verifyHubSpotSignature(input: {
  method: string;
  uris: string[];
  body: string;
  headers: Headers;
  clientSecret: string;
  now?: number;
}): boolean {
  const { method, body, headers, clientSecret } = input;
  const uris = [...new Set(input.uris.map(decodeUri))];

  const v3 = headers.get('x-hubspot-signature-v3');
  const timestamp = headers.get('x-hubspot-request-timestamp');
  if (v3 && timestamp) {
    const ts = Number(timestamp);
    const now = input.now ?? Date.now();
    if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SIGNATURE_AGE_MS) return false;
    return uris.some((uri) =>
      safeEqual(
        crypto
          .createHmac('sha256', clientSecret)
          .update(`${method}${uri}${body}${timestamp}`, 'utf8')
          .digest('base64'),
        v3,
      ),
    );
  }

  const legacy = headers.get('x-hubspot-signature');
  if (!legacy) return false;
  const version = (headers.get('x-hubspot-signature-version') ?? 'v1').toLowerCase();
  const sha = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  if (version === 'v2') {
    return uris.some((uri) => safeEqual(sha(`${clientSecret}${method}${uri}${body}`), legacy));
  }
  return safeEqual(sha(`${clientSecret}${body}`), legacy);
}
