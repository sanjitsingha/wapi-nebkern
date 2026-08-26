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
