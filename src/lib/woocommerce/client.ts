// ============================================================
// WooCommerce REST API client (server only).
//
// Talks to a store's /wp-json/wc/v3 API with Basic auth (consumer
// key:secret over HTTPS). Covers what the integration needs: verify
// credentials, auto-register the order webhooks, tear them down, and
// verify + normalise inbound order payloads.
// ============================================================

import crypto from 'crypto';

export interface WooCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface NormalizedOrder {
  wcOrderId: number;
  number: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Order events we subscribe to in WooCommerce. */
export const WOO_TOPICS = ['order.created', 'order.updated'] as const;

function apiBase(storeUrl: string): string {
  return storeUrl.replace(/\/+$/, '') + '/wp-json/wc/v3';
}

function authHeader(key: string, secret: string): string {
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

async function wcRequest(
  creds: WooCredentials,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiBase(creds.storeUrl) + path, {
    ...init,
    headers: {
      Authorization: authHeader(creds.consumerKey, creds.consumerSecret),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    // Never hang the connect request on a slow store.
    signal: AbortSignal.timeout(15_000),
  });
}

/** Authenticated ping to confirm the URL + credentials work. */
export async function verifyStore(
  creds: WooCredentials,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await wcRequest(creds, '/orders?per_page=1');
    if (res.status === 401) {
      return { ok: false, error: 'Invalid consumer key or secret.' };
    }
    if (res.status === 404) {
      return {
        ok: false,
        error: 'WooCommerce REST API not found at that URL — is WooCommerce installed?',
      };
    }
    if (!res.ok) {
      return { ok: false, error: `The store returned an error (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the store URL over HTTPS.' };
  }
}

/**
 * Auto-register the order webhooks. Returns the created webhook ids, or
 * `error: 'write_permission'` when the API key is read-only (the caller
 * then tells the user to use a Read/Write key).
 */
export async function createOrderWebhooks(
  creds: WooCredentials,
  deliveryUrl: string,
  secret: string,
): Promise<{ ids: number[]; error?: string }> {
  const ids: number[] = [];
  for (const topic of WOO_TOPICS) {
    let res: Response;
    try {
      res = await wcRequest(creds, '/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: `Instant — ${topic}`,
          topic,
          delivery_url: deliveryUrl,
          secret,
          status: 'active',
        }),
      });
    } catch {
      return { ids, error: 'Could not reach the store to register webhooks.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ids, error: 'write_permission' };
    }
    if (!res.ok) {
      return { ids, error: `Registering the webhook failed (${res.status}).` };
    }
    const data = (await res.json().catch(() => null)) as { id?: number } | null;
    if (data?.id) ids.push(data.id);
  }
  return { ids };
}

/** Best-effort teardown of the webhooks we created. */
export async function deleteWebhooks(
  creds: WooCredentials,
  ids: number[],
): Promise<void> {
  for (const id of ids) {
    try {
      await wcRequest(creds, `/webhooks/${id}?force=true`, { method: 'DELETE' });
    } catch {
      /* best effort */
    }
  }
}

/** Map a raw Woo order object to the fields we care about. */
export function normalizeOrder(raw: unknown): NormalizedOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const b = (o.billing ?? {}) as Record<string, unknown>;
  const name =
    [b.first_name, b.last_name]
      .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      .join(' ')
      .trim() || null;
  const totalNum = Number(o.total);
  return {
    wcOrderId: id,
    number: o.number != null ? String(o.number) : null,
    status: typeof o.status === 'string' ? o.status : null,
    total: Number.isFinite(totalNum) ? totalNum : null,
    currency: typeof o.currency === 'string' ? o.currency : null,
    name,
    phone: typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim() : null,
    email: typeof b.email === 'string' && b.email.trim() ? b.email.trim() : null,
  };
}

/**
 * Verify a WooCommerce webhook signature: base64( HMAC-SHA256(body, secret) )
 * in the `x-wc-webhook-signature` header. Constant-time compared.
 */
export function verifyWooSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
