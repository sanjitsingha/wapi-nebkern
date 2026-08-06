// ============================================================
// Cloudflare Turnstile verification.
//
// Turnstile over reCAPTCHA because it is free at any volume, needs no
// Google account, and does not ask the visitor to identify traffic
// lights. It is also the only one of the three whose privacy story
// survives contact with the Cookie Policy in this repo.
//
// Server-side only — the secret must never reach the bundle.
// ============================================================

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Configured only when BOTH halves are present: a site key with no
 *  secret renders a widget whose token nothing checks, which is worse
 *  than no captcha because it looks like protection. */
export function isCaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() &&
    process.env.TURNSTILE_SECRET_KEY?.trim()
  );
}

/**
 * True if the token is valid, or if Turnstile is not configured on this
 * deployment.
 *
 * The open-when-unconfigured behaviour is deliberate: this is a
 * self-hostable repo, and a fork that has not signed up for Turnstile
 * should still have a working contact form. It is logged loudly at the
 * call site instead of failing silently. Configure it in production —
 * a public POST endpoint with no challenge WILL be found.
 */
export async function verifyCaptcha(
  token: string | undefined,
  ip?: string | null
): Promise<boolean> {
  if (!isCaptchaConfigured()) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  // Cloudflare uses this to spot one address burning through tokens.
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare unreachable. Reject rather than wave it through: a
    // network blip is rare, and "captcha service is down" is a
    // spammer's favourite state to induce.
    return false;
  }
}

/** Best-effort client IP from the proxy headers this app sits behind. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('cf-connecting-ip');
}
