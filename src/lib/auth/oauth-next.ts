// ============================================================
// Where to land after an OAuth round trip.
//
// This used to ride in the `redirectTo` query string:
//
//   redirectTo: `${origin}/auth/callback?next=%2Fdashboard`
//
// which is the trap. Supabase matches `redirectTo` against the project's
// Redirect URLs allow-list as a *whole URL, query string included* — a
// list entry of `https://site/auth/callback` does not match
// `https://site/auth/callback?next=%2Fdashboard`, and on a miss GoTrue
// silently falls back to the project's Site URL. The user completes
// Google consent and lands on the marketing homepage with an unspent
// `?code=` in the address bar, session-less, wondering why they have to
// log in again.
//
// So the destination travels in a short-lived cookie instead and
// `redirectTo` stays a bare, allow-list-friendly `/auth/callback`.
// SameSite=Lax is deliberate and sufficient: the return leg is a
// top-level GET navigation, which Lax permits — the same mechanism
// supabase-js already relies on for its PKCE verifier cookie.
// ============================================================

export const OAUTH_NEXT_COOKIE = 'wacrm-oauth-next';

/** Ten minutes — long enough to pick an account and clear a consent
 *  screen, short enough that an abandoned attempt doesn't hijack an
 *  unrelated sign-in an hour later. */
const MAX_AGE_SECONDS = 600;

/**
 * Same-site relative paths only. Anything else — an absolute URL, a
 * protocol-relative `//evil.com`, a stray backslash some browsers
 * normalise to `/` — is refused, so a tampered cookie can't turn the
 * callback into an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/**
 * Browser side: remember where to go, then start the OAuth flow.
 * Call immediately before `signInWithOAuth` / `linkIdentity`.
 */
export function rememberOAuthNext(path: string): void {
  if (typeof document === 'undefined') return;
  const next = safeNextPath(path);
  if (!next) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
