import { createHmac, timingSafeEqual } from 'node:crypto';

// ============================================================
// Unsubscribe links.
//
// The link carries the address plus a signature of it:
//
//   /unsubscribe?e=sam%40shop.com&t=9f2c…
//
// The signature is an HMAC of the lowercased address under a server
// secret, so the two halves have to agree. Editing the address in the
// URL to unsubscribe somebody else invalidates the signature, and the
// signature cannot be produced without the secret.
//
// WHY NOT A TOKEN COLUMN
//
// A stored per-row token would need a migration, a backfill for every
// existing subscriber, and a row lookup before the address is even
// known to be real. This is stateless: any address can be signed at
// send time, including ones added after this code shipped, and a
// leaked database gives an attacker nothing they could not already
// read.
//
// Server-only — `node:crypto` and the secret both stay off the client.
// ============================================================

/** 128 bits of the digest. Full-length hex makes an ugly link and adds
 *  nothing: this signs a public email address, not a session. */
const TOKEN_CHARS = 32;

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (!s) {
    // Loud, not silent. The alternative — falling back to a default —
    // means every deployment shares a secret, and a signature anyone
    // can compute is not a signature.
    throw new Error(
      'UNSUBSCRIBE_SECRET is not set; unsubscribe links cannot be signed or verified'
    );
  }
  return s;
}

export function isUnsubscribeConfigured(): boolean {
  return Boolean(process.env.UNSUBSCRIBE_SECRET?.trim());
}

/** The signature half of the link. */
export function signEmail(email: string): string {
  return createHmac('sha256', secret())
    .update(email.trim().toLowerCase())
    .digest('hex')
    .slice(0, TOKEN_CHARS);
}

/** Constant-time check — a plain `===` on a secret-derived value leaks
 *  how much of it was right through timing. */
export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!email || !token) return false;
  let expected: string;
  try {
    expected = signEmail(email);
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The full link to put in an email.
 *
 * `baseUrl` defaults to the configured site so a caller can pass
 * nothing; the address is encoded because a `+` in an email address is
 * legal and would otherwise arrive as a space.
 */
export function unsubscribeUrl(email: string, baseUrl?: string): string {
  const base = (
    baseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://instant.nebkern.com'
  ).replace(/\/$/, '');
  const clean = email.trim().toLowerCase();
  return `${base}/unsubscribe?e=${encodeURIComponent(clean)}&t=${signEmail(clean)}`;
}
