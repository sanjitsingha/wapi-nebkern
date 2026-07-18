import crypto from 'crypto';

// ============================================================
// Webhook signing + destination-URL safety.
// ============================================================

/**
 * HMAC-SHA256 of the raw body with the endpoint secret, hex-encoded.
 * The receiver recomputes this over the exact bytes they receive and
 * compares against the `X-Wacrm-Signature` header to verify authenticity.
 */
export function signBody(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** A fresh, high-entropy signing secret for a new endpoint. */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

// Hostnames / IP ranges we refuse to POST to — an SSRF guard so a tenant
// can't point a webhook at internal infrastructure.
const BLOCKED_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.local)$/i;

/**
 * True only for a public https URL we're willing to deliver to. Rejects
 * non-https, private/loopback/link-local hosts, and malformed URLs.
 */
export function isAllowedWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST_RE.test(host)) return false;
  // Bare hostnames with no dot (e.g. an internal "db") aren't public.
  if (!host.includes('.')) return false;
  return true;
}
