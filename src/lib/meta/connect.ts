/**
 * Unified Meta channel connect — Graph API helpers.
 *
 * One Facebook Login for Business consent, both inboxes. `GET
 * /me/accounts` can return, per Page, both the Page access token
 * (Messenger) and the Instagram professional account linked to that
 * Page (Instagram DMs) — so a single grant is enough to light up both
 * channels, which is what the per-channel flows in src/lib/messenger/
 * and src/lib/instagram/ could never do between them.
 *
 * Only the pieces unique to the combined flow live here. The OAuth code
 * and token exchanges are plain Facebook Login and are imported from
 * the Messenger module rather than copied — they take the app
 * credentials as arguments and know nothing about channels.
 *
 * VERIFY AT INTEGRATION TIME against Meta's current docs: the Graph API
 * version, the scope names below, and whether your Meta app's Tech
 * Provider configuration requires the permissions to be requested
 * through a configuration id (`config_id=`) rather than a `scope=` list
 * — Facebook Login for Business supports both, and apps created after
 * Meta's 2024 change may be configured for the former.
 */

const META_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`;

/**
 * Everything both channels need, in one consent screen:
 *   pages_show_list            — enumerate the Pages the user manages
 *   pages_messaging            — send/receive Messenger messages
 *   pages_manage_metadata      — subscribe the Page to our webhook
 *   pages_read_engagement      — read Page fields with a Page token
 *   instagram_basic            — read the linked IG account (id, handle)
 *   instagram_manage_messages  — send/receive Instagram DMs
 *
 * The two Instagram scopes are the only addition over the Messenger-only
 * list. A user with no Instagram account linked to their Page simply
 * grants them and gets nothing extra — the flow degrades to Messenger.
 */
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_messages',
] as const;

/** An Instagram professional account reached through a Page. */
export interface LinkedInstagramAccount {
  id: string;
  username: string | null;
  name: string | null;
}

/** One connectable Page, plus whatever Instagram hangs off it. */
export interface MetaAsset {
  pageId: string;
  pageName: string;
  /** Long-lived when derived from a long-lived user token. Server-only —
   *  never serialise this to the browser. */
  pageAccessToken: string;
  /** null when the Page has no linked Instagram professional account, or
   *  the user declined the Instagram scopes. */
  instagram: LinkedInstagramAccount | null;
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
  return url.replace(
    /(access_token|client_secret|fb_exchange_token)=([^&]+)/gi,
    (_m, key, val) => `${key}=${redactSecret(decodeURIComponent(val))}`,
  );
}

async function metaFetch(
  url: string,
  init: RequestInit | undefined,
  op: string,
): Promise<Response> {
  const started = Date.now();
  const method = init?.method ?? 'GET';
  console.info(`[meta:${op}] → ${method} ${redactUrl(url)}`);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    console.error(
      `[meta:${op}] ✗ network error after ${Date.now() - started}ms:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
  console.info(`[meta:${op}] ← ${response.status} in ${Date.now() - started}ms`);
  return response;
}

// ============================================================
// OAuth
// ============================================================

export interface BuildMetaAuthorizeUrlArgs {
  appId: string;
  redirectUri: string;
  /** CSRF nonce — round-tripped by Facebook and checked on callback. */
  state: string;
  /**
   * Facebook Login for Business configuration id. When the Meta app is
   * set up with a login configuration, Meta wants `config_id` INSTEAD OF
   * `scope` — passing both is accepted but the configuration wins, so we
   * send only one. Optional: apps still using classic Facebook Login
   * leave `META_LOGIN_CONFIG_ID` unset and get the scope list.
   */
  configId?: string | null;
}

/** Build the URL that starts the one-consent Meta connect. */
export function buildMetaAuthorizeUrl(args: BuildMetaAuthorizeUrlArgs): string {
  const { appId, redirectUri, state, configId } = args;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
  });
  if (configId) {
    params.set('config_id', configId);
  } else {
    params.set('scope', META_OAUTH_SCOPES.join(','));
  }
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

// The code→token and token→long-lived exchanges are ordinary Facebook
// Login and are channel-agnostic; re-exported so callers of this module
// never need to reach into the Messenger internals for half a flow.
export {
  exchangeFacebookCode,
  exchangeForLongLivedUserToken,
} from '@/lib/messenger/meta-api';

// ============================================================
// Asset discovery
// ============================================================

interface RawPage {
  id?: unknown;
  name?: unknown;
  access_token?: unknown;
  instagram_business_account?: {
    id?: unknown;
    username?: unknown;
    name?: unknown;
  } | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * The Pages this user manages, each with its Page token and its linked
 * Instagram professional account.
 *
 * `instagram_business_account` is requested as a nested field on the
 * same call rather than one follow-up request per Page — an operator
 * with a dozen Pages would otherwise pay a dozen round trips before the
 * picker could render.
 *
 * A Page whose Instagram sub-object is missing is returned with
 * `instagram: null` rather than dropped: it is still perfectly
 * connectable for Messenger, and silently hiding it would look like the
 * Page had vanished.
 */
export async function getMetaAssets(userAccessToken: string): Promise<MetaAsset[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    limit: '100',
    access_token: userAccessToken,
  });
  const url = `${GRAPH_BASE}/me/accounts?${params.toString()}`;
  const response = await metaFetch(url, undefined, 'getMetaAssets');
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  const data = await response.json();
  const rows: RawPage[] = Array.isArray(data?.data) ? data.data : [];

  return rows.flatMap((row): MetaAsset[] => {
    const pageId = str(row.id);
    const pageAccessToken = str(row.access_token);
    if (!pageId || !pageAccessToken) return [];

    const ig = row.instagram_business_account;
    const igId = ig ? str(ig.id) : null;

    return [
      {
        pageId,
        pageName: str(row.name) ?? pageId,
        pageAccessToken,
        instagram: igId
          ? { id: igId, username: str(ig?.username), name: str(ig?.name) }
          : null,
      },
    ];
  });
}

// ============================================================
// Webhook subscription
// ============================================================

// No subscribe helper here on purpose. Instagram messaging through a
// Facebook Page is delivered against the SAME Page subscription as
// Messenger, so finalizeMessengerPage()'s existing (best-effort)
// `subscribed_apps` call with `messages,messaging_postbacks` already
// covers both channels — a second call with the same fields would just
// re-send the same request. Registering the callback URLs themselves
// stays a one-time manual step in Meta's App Dashboard.

/** Confirm a Page token still works — one call validates both channels,
 *  since they share the credential. */
export async function verifyMetaPageToken(args: {
  pageId: string;
  pageAccessToken: string;
}): Promise<{ id: string; name?: string }> {
  const { pageId, pageAccessToken } = args;
  const url = `${GRAPH_BASE}/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`;
  const response = await metaFetch(url, undefined, 'verifyMetaPageToken');
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`);
  }
  return response.json();
}
