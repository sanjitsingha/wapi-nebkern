import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import { verifyShopifyOAuthHmac } from './client';

const SECRET = 'shpss_test_secret';

/** Sign a query string the way Shopify does: sorted params minus
 *  `hmac`, joined k=v&k=v, HMAC-SHA256, hex. */
function sign(params: Record<string, string>): string {
  const message = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return crypto.createHmac('sha256', SECRET).update(message, 'utf8').digest('hex');
}

function query(params: Record<string, string>, hmac?: string): URLSearchParams {
  const u = new URLSearchParams(params);
  if (hmac !== undefined) u.set('hmac', hmac);
  return u;
}

describe('verifyShopifyOAuthHmac', () => {
  const base = {
    code: 'abc123',
    shop: 'mystore.myshopify.com',
    state: 'nonce-1.tab',
    timestamp: '1700000000',
  };

  it('accepts a correctly signed callback', () => {
    expect(verifyShopifyOAuthHmac(query(base, sign(base)), SECRET)).toBe(true);
  });

  it('rejects a tampered parameter', () => {
    const good = sign(base);
    const tampered = query({ ...base, shop: 'evil.myshopify.com' }, good);
    expect(verifyShopifyOAuthHmac(tampered, SECRET)).toBe(false);
  });

  it('rejects a missing hmac', () => {
    expect(verifyShopifyOAuthHmac(query(base), SECRET)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const other = crypto
      .createHmac('sha256', 'wrong-secret')
      .update('code=abc123', 'utf8')
      .digest('hex');
    expect(verifyShopifyOAuthHmac(query(base, other), SECRET)).toBe(false);
  });

  it('is order-independent — params arrive in any order', () => {
    const hmac = sign(base);
    const shuffled = new URLSearchParams();
    shuffled.set('timestamp', base.timestamp);
    shuffled.set('shop', base.shop);
    shuffled.set('hmac', hmac);
    shuffled.set('state', base.state);
    shuffled.set('code', base.code);
    expect(verifyShopifyOAuthHmac(shuffled, SECRET)).toBe(true);
  });

  it('ignores `signature`, which Shopify excludes from the digest', () => {
    const hmac = sign(base);
    const withSig = query(base, hmac);
    withSig.set('signature', 'legacy-value');
    expect(verifyShopifyOAuthHmac(withSig, SECRET)).toBe(true);
  });
});
