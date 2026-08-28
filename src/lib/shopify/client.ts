// ============================================================
// Shopify Admin API client (server only). Mirrors the WooCommerce client:
// verify credentials, auto-register the order webhooks, tear them down,
// and verify + normalise inbound order payloads.
//
// Auth is a custom-app Admin API access token (header X-Shopify-Access-
// Token); inbound webhooks are signed by the app's API secret key
// (X-Shopify-Hmac-Sha256), verified here.
// ============================================================

import crypto from 'crypto';

const API_VERSION = '2024-10';

export interface ShopifyCredentials {
  shopDomain: string; // e.g. myshop.myshopify.com
  accessToken: string;
}

export interface NormalizedOrder {
  shopifyOrderId: number;
  number: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Order events we subscribe to. */
export const SHOPIFY_TOPICS = ['orders/create', 'orders/updated'] as const;

// ── OAuth ───────────────────────────────────────────────────────────
//
// The install flow, for merchants who should never see a token.
//
// Everything below the exchange is unchanged: an OAuth access token is
// presented in the same X-Shopify-Access-Token header a custom app's
// token uses, so verifyStore / createOrderWebhooks / normalizeOrder all
// work against either. Only where the token COMES FROM differs.

/**
 * Scopes requested at install. Read-only and as narrow as the feature
 * allows — a merchant reading this consent screen should see nothing
 * that lets us change their store.
 *
 * `read_orders` covers the last 60 days; `read_all_orders` is what
 * Shopify calls a protected scope and needs their approval, so it is
 * deliberately not here. Order automations fire on new orders, which
 * the base scope already delivers.
 */
export const SHOPIFY_SCOPES = ['read_orders', 'read_customers'] as const;

/** Where the merchant is sent to log in and approve the install. */
export function buildShopifyAuthorizeUrl(input: {
  shopDomain: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(`https://${input.shopDomain}/admin/oauth/authorize`);
  u.searchParams.set('client_id', input.clientId);
  u.searchParams.set('scope', SHOPIFY_SCOPES.join(','));
  u.searchParams.set('redirect_uri', input.redirectUri);
  u.searchParams.set('state', input.state);
  return u.toString();
}

/** Trade the one-time `code` from the callback for a lasting token. */
export async function exchangeShopifyCode(input: {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{ accessToken?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://${input.shopDomain}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          code: input.code,
        }),
      },
    );
    if (!res.ok) {
      return {
        error: `Shopify refused the authorization code (${res.status}).`,
      };
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      return { error: 'Shopify returned no access token.' };
    }
    return { accessToken: json.access_token };
  } catch {
    return { error: 'Could not reach Shopify to complete the install.' };
  }
}

/**
 * Verify the HMAC on an OAuth callback's query string.
 *
 * A DIFFERENT computation from the webhook signature above, and the two
 * are easy to confuse: a webhook is a raw JSON body hashed to base64,
 * while this is the sorted query parameters — minus `hmac` itself —
 * joined as `k=v&k=v` and hashed to hex. Getting them the wrong way
 * round yields a check that always fails.
 *
 * Without this, anyone who can guess the callback URL can post a `code`
 * of their choosing at it.
 */
export function verifyShopifyOAuthHmac(
  params: URLSearchParams,
  clientSecret: string,
): boolean {
  const received = params.get('hmac');
  if (!received) return false;

  const message = [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const expected = crypto
    .createHmac('sha256', clientSecret)
    .update(message, 'utf8')
    .digest('hex');

  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function apiBase(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${API_VERSION}`;
}

async function req(
  creds: ShopifyCredentials,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiBase(creds.shopDomain) + path, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': creds.accessToken,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
}

/** Normalise a user-entered domain to `<store>.myshopify.com`. */
export function normalizeShopDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!d) return null;
  if (!d.includes('.')) d = `${d}.myshopify.com`;
  // Only allow *.myshopify.com — that's the stable admin domain.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d)) return null;
  return d;
}

export async function verifyStore(
  creds: ShopifyCredentials,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await req(creds, '/shop.json');
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Invalid Admin API access token for that store.' };
    }
    if (res.status === 404) {
      return { ok: false, error: 'Store not found — check the .myshopify.com domain.' };
    }
    if (!res.ok) {
      return { ok: false, error: `The store returned an error (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the store.' };
  }
}

export async function createOrderWebhooks(
  creds: ShopifyCredentials,
  deliveryUrl: string,
): Promise<{ ids: number[]; error?: string }> {
  const ids: number[] = [];
  for (const topic of SHOPIFY_TOPICS) {
    let res: Response;
    try {
      res = await req(creds, '/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({
          webhook: { topic, address: deliveryUrl, format: 'json' },
        }),
      });
    } catch {
      return { ids, error: 'Could not reach the store to register webhooks.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ids, error: 'permission' };
    }
    if (!res.ok) {
      // 422 usually means "already taken" for this address+topic — treat as
      // a soft success so a reconnect doesn't hard-fail.
      if (res.status !== 422) {
        return { ids, error: `Registering the webhook failed (${res.status}).` };
      }
      continue;
    }
    const data = (await res.json().catch(() => null)) as {
      webhook?: { id?: number };
    } | null;
    if (data?.webhook?.id) ids.push(data.webhook.id);
  }
  return { ids };
}

export async function deleteWebhooks(
  creds: ShopifyCredentials,
  ids: number[],
): Promise<void> {
  for (const id of ids) {
    try {
      await req(creds, `/webhooks/${id}.json`, { method: 'DELETE' });
    } catch {
      /* best effort */
    }
  }
}

export function normalizeOrder(raw: unknown): NormalizedOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const customer = (o.customer ?? {}) as Record<string, unknown>;
  const billing = (o.billing_address ?? {}) as Record<string, unknown>;
  const shipping = (o.shipping_address ?? {}) as Record<string, unknown>;

  const name =
    [customer.first_name, customer.last_name]
      .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      .join(' ')
      .trim() ||
    (typeof billing.name === 'string' ? billing.name : null) ||
    null;

  const phone =
    (typeof o.phone === 'string' && o.phone.trim() && o.phone) ||
    (typeof customer.phone === 'string' && customer.phone.trim() && customer.phone) ||
    (typeof billing.phone === 'string' && billing.phone.trim() && billing.phone) ||
    (typeof shipping.phone === 'string' && shipping.phone.trim() && shipping.phone) ||
    null;

  const email =
    (typeof o.email === 'string' && o.email.trim() && o.email) ||
    (typeof customer.email === 'string' && customer.email.trim() && customer.email) ||
    null;

  const totalNum = Number(o.total_price);
  return {
    shopifyOrderId: id,
    number:
      o.order_number != null
        ? String(o.order_number)
        : typeof o.name === 'string'
          ? o.name.replace(/^#/, '')
          : null,
    status: typeof o.financial_status === 'string' ? o.financial_status : null,
    total: Number.isFinite(totalNum) ? totalNum : null,
    currency: typeof o.currency === 'string' ? o.currency : null,
    name,
    phone: phone ? String(phone).trim() : null,
    email: email ? String(email).trim() : null,
  };
}

/**
 * Verify a Shopify webhook: base64( HMAC-SHA256(rawBody, apiSecret) ) in the
 * `x-shopify-hmac-sha256` header. Constant-time compared.
 */
export function verifyShopifySignature(
  rawBody: string,
  hmacHeader: string | null,
  apiSecret: string,
): boolean {
  if (!hmacHeader) return false;
  const expected = crypto
    .createHmac('sha256', apiSecret)
    .update(rawBody, 'utf8')
    .digest('base64');
  const a = Buffer.from(hmacHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
