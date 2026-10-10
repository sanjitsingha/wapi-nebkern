import { SHEET_TABS, TAB_HEADERS, type SheetTab } from './rows';

// ============================================================
// Google OAuth + the two Sheets calls Instant makes.
//
// Plain fetch against Google's REST endpoints — the official client
// library is a large dependency for four requests.
//
// The scope is `drive.file`: access only to files this app created. It
// is what lets the connection skip Google's app review (the broad
// `spreadsheets` scope needs it), and it is also why Instant creates the
// spreadsheet itself ("Add new sheet") rather than linking one the user
// already has — it could not open that one.
// ============================================================

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const GOOGLE_SHEETS_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
];

const TIMEOUT_MS = 20_000;

/**
 * The OAuth client: Instant's own, from the same Google Cloud project as
 * "Sign in with Google". The id is public (it is in that button too);
 * the secret is server-only.
 */
export function googleSheetsClient(): { clientId: string; clientSecret: string } | null {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  )?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function buildGoogleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GOOGLE_SHEETS_SCOPES.join(' '));
  // offline + consent: Google only hands out a refresh token on a fresh
  // consent, and without one the connection dies after an hour.
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', opts.state);
  return u.toString();
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms when the access token stops working. */
  expiresAt: number;
  scope: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new GoogleSheetsError(
      data.error === 'invalid_grant'
        ? 'Google no longer accepts this connection — it was revoked or expired. Connect Google Sheets again.'
        : `Google sign-in failed: ${data.error_description ?? data.error ?? `HTTP ${res.status}`}`,
      data.error === 'invalid_grant' ? 'revoked' : 'oauth_error',
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? '',
  };
}

export function exchangeGoogleCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
}

export function refreshGoogleToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokens> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
}

/** Which Google account authorised it, for "Connected as …". */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export class GoogleSheetsError extends Error {
  /** `revoked`: the grant is gone and only reconnecting fixes it.
   *  `not_found`: the spreadsheet was deleted. Anything else is worth
   *  a retry. */
  readonly code: 'revoked' | 'not_found' | 'oauth_error' | 'api_error';
  constructor(message: string, code: GoogleSheetsError['code']) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.code = code;
  }
}

async function sheetsRequest<T>(
  accessToken: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${SHEETS_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return (await res.json()) as T;

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  const detail = data.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) {
    throw new GoogleSheetsError(
      `Google refused access to the spreadsheet (${detail}). Connect Google Sheets again.`,
      'revoked',
    );
  }
  if (res.status === 404) {
    throw new GoogleSheetsError(
      'The spreadsheet no longer exists — it may have been deleted. Add a new sheet.',
      'not_found',
    );
  }
  throw new GoogleSheetsError(`Google Sheets error: ${detail}`, 'api_error');
}

/**
 * Create the spreadsheet with one tab per kind of data and a frozen,
 * bold header row on each — so it is readable the moment it is opened,
 * before a single row has arrived.
 */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
): Promise<{ id: string; url: string; title: string }> {
  const created = await sheetsRequest<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: { properties: { sheetId: number; title: string } }[];
  }>(accessToken, '', {
    method: 'POST',
    body: {
      properties: { title },
      sheets: SHEET_TABS.map((tab, index) => ({
        properties: {
          title: tab,
          index,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    },
  });

  await sheetsRequest(accessToken, `/${created.spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: {
      valueInputOption: 'RAW',
      data: SHEET_TABS.map((tab) => ({
        range: `'${tab}'!A1`,
        values: [TAB_HEADERS[tab]],
      })),
    },
  });

  await sheetsRequest(accessToken, `/${created.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: {
      requests: created.sheets.map((s) => ({
        repeatCell: {
          range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      })),
    },
  });

  return {
    id: created.spreadsheetId,
    url: created.spreadsheetUrl,
    title: created.properties.title,
  };
}

/**
 * Append rows to a tab. USER_ENTERED so timestamps and amounts arrive
 * as real dates and numbers; cells that must stay text (phones) are
 * already escaped by `literal()` in rows.ts.
 */
export async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  tab: SheetTab,
  rows: string[][],
): Promise<void> {
  if (rows.length === 0) return;
  const range = encodeURIComponent(`'${tab}'!A1`);
  await sheetsRequest(
    accessToken,
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: { values: rows } },
  );
}
