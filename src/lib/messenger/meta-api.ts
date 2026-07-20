/**
 * Meta Facebook Messenger API helpers.
 *
 * Mirrors the structure of src/lib/instagram/meta-api.ts (named-param
 * functions, a logging fetch wrapper with token redaction) but targets
 * the Facebook Login + Pages Messaging path: the operator logs in with
 * Facebook, we read the Pages they manage, and each Page carries its own
 * long-lived Page access token used to send/receive Messenger DMs.
 *
 * All calls target graph.facebook.com. Kept a separate small file rather
 * than importing the WhatsApp/Instagram modules so this channel can be
 * lifted or reworked without touching the others.
 *
 * VERIFY AT INTEGRATION TIME against Meta's current docs: Graph API
 * version, OAuth scope names (`pages_show_list`, `pages_messaging`,
 * `pages_manage_metadata`), and the Send API payload shape — this
 * surface has changed across versions.
 */

const META_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`;

// Minimal scopes for receiving + replying to Page messages:
//   pages_show_list       — enumerate the Pages the user manages
//   pages_messaging       — send/receive Messenger messages as the Page
//   pages_manage_metadata — subscribe the Page to this app's webhook
//   pages_read_engagement — read Page fields (id/name) with a Page token;
//                           without it any GET /{page-id} returns (#100)
const OAUTH_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
].join(',');

export interface MessengerSendResult {
  messageId: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  /** Long-lived Page access token (when derived from a long-lived user
   *  token, this effectively does not expire). */
  accessToken: string;
}

interface MetaErrorResponse {
  error?: {
    message?: string;
    code?: number;
    type?: string;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const data = (await response.json()) as MetaErrorResponse;
    const err = data.error;
    if (err) {
      const parts = [err.error_user_title, err.error_user_msg, err.message].filter(
        (s): s is string => Boolean(s && s.trim()),
      );
      if (parts.length > 0) message = parts.join(' — ');
      if (err.error_subcode) message += ` [subcode ${err.error_subcode}]`;
    }
  } catch {
    // body wasn't JSON — keep the fallback
  }
  throw new Error(message);
}

function redactSecret(value: string): string {
  if (!value) return value;
  return value.length <= 8 ? '***' : `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function redactUrl(url: string): string {
  return url
    .replace(/(access_token|client_secret|fb_exchange_token)=([^&]+)/gi, (_m, key, val) =>
      `${key}=${redactSecret(decodeURIComponent(val))}`,
    );
}

async function metaFetch(
  url: string,
  init: RequestInit | undefined,
  op: string,
): Promise<Response> {
  const started = Date.now();
  const method = init?.method ?? 'GET';
  console.info(`[messenger:${op}] → ${method} ${redactUrl(url)}`);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    console.error(
      `[messenger:${op}] ✗ network error after ${Date.now() - started}ms:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
  console.info(`[messenger:${op}] ← ${response.status} in ${Date.now() - started}ms`);
  return response;
}

// ============================================================
// Facebook Login (OAuth)
// ============================================================

export interface BuildAuthorizeUrlArgs {
  appId: string;
  redirectUri: string;
  /** CSRF nonce — round-tripped by Facebook and checked on callback. */
  state: string;
}

/** Build the URL that starts Facebook Login for Pages messaging. */
export function buildFacebookAuthorizeUrl(args: BuildAuthorizeUrlArgs): string {
  const { appId, redirectUri, state } = args;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: OAUTH_SCOPES,
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

export interface ExchangeCodeArgs {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}

/** Step 1 — exchange the authorization code for a short-lived user token. */
export async function exchangeFacebookCode(args: ExchangeCodeArgs): Promise<string> {
  const { appId, appSecret, redirectUri, code } = args;
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const url = `${GRAPH_BASE}/oauth/access_token?${params.toString()}`;
  const response = await metaFetch(url, undefined, 'exchangeFacebookCode');
  if (!response.ok) {
    await throwMetaError(response, `Code exchange failed: ${response.status}`);
  }
  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('Facebook token exchange returned no access_token.');
  }
  return String(data.access_token);
}

/** Step 2 — exchange the short-lived user token for a ~60-day one. */
export async function exchangeForLongLivedUserToken(args: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<string> {
  const { appId, appSecret, shortLivedToken } = args;
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const url = `${GRAPH_BASE}/oauth/access_token?${params.toString()}`;
  const response = await metaFetch(url, undefined, 'exchangeForLongLivedUserToken');
  if (!response.ok) {
    await throwMetaError(response, `Long-lived token exchange failed: ${response.status}`);
  }
  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('Long-lived token exchange returned no access_token.');
  }
  return String(data.access_token);
}

/**
 * List the Pages the user manages, each with its own Page access token.
 * When called with a long-lived user token, the Page tokens returned are
 * themselves long-lived.
 */
export async function getManagedPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userAccessToken)}`;
  const response = await metaFetch(url, undefined, 'getManagedPages');
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = await response.json();
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows
    .filter((p: unknown): p is { id: string; name: string; access_token: string } => {
      const r = p as Record<string, unknown>;
      return Boolean(r?.id && r?.access_token);
    })
    .map((p: { id: string; name: string; access_token: string }) => ({
      id: String(p.id),
      name: String(p.name ?? p.id),
      accessToken: String(p.access_token),
    }));
}

/**
 * Subscribe the Page to this app's webhook for message events.
 * Best-effort — callers should not block connecting on this. Registering
 * the callback URL itself is a separate, manual step in Meta's App
 * Dashboard; this only subscribes the Page to whatever URL is set there.
 */
export async function subscribePageToApp(args: {
  pageId: string;
  pageAccessToken: string;
}): Promise<void> {
  const { pageId, pageAccessToken } = args;
  const params = new URLSearchParams({
    subscribed_fields: 'messages,messaging_postbacks',
    access_token: pageAccessToken,
  });
  const url = `${GRAPH_BASE}/${pageId}/subscribed_apps?${params.toString()}`;
  const response = await metaFetch(url, { method: 'POST' }, 'subscribePageToApp');
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
}

/** Confirm a Page token still works — used by the config status check. */
export async function verifyPageToken(args: {
  pageId: string;
  pageAccessToken: string;
}): Promise<{ id: string; name?: string }> {
  const { pageId, pageAccessToken } = args;
  const url = `${GRAPH_BASE}/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`;
  const response = await metaFetch(url, undefined, 'verifyPageToken');
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  return response.json();
}

// ============================================================
// Sending (text + media — used by the inbox reply path, phase 2)
// ============================================================

export interface SendMessengerTextArgs {
  pageAccessToken: string;
  /** PSID of the customer. */
  recipientId: string;
  text: string;
}

/** Send a plain-text Messenger message from the Page. */
export async function sendMessengerText(
  args: SendMessengerTextArgs,
): Promise<MessengerSendResult> {
  const { pageAccessToken, recipientId, text } = args;
  const url = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text },
    }),
  });
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = await response.json();
  return { messageId: String(data.message_id ?? data.id) };
}

export type MessengerMediaKind = 'image' | 'video' | 'audio' | 'file';

export interface SendMessengerMediaArgs {
  pageAccessToken: string;
  recipientId: string;
  kind: MessengerMediaKind;
  /** Public URL Meta fetches at send time. */
  link: string;
}

/** Send a media attachment by public URL. */
export async function sendMessengerMedia(
  args: SendMessengerMediaArgs,
): Promise<MessengerSendResult> {
  const { pageAccessToken, recipientId, kind, link } = args;
  const url = `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { attachment: { type: kind, payload: { url: link, is_reusable: false } } },
    }),
  });
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = await response.json();
  return { messageId: String(data.message_id ?? data.id) };
}
