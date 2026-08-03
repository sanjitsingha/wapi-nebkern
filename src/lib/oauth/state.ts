// ============================================================
// OAuth `state` — CSRF nonce, plus which way to answer.
//
// A login running in its own tab and one running as a full-page redirect
// need different endings: the first postMessages its opener and closes,
// the second 302s back to settings. The callback has to know which, and
// it can't be told by a query param on `redirect_uri` (Meta matches that
// string exactly against the whitelist) or by reading a header (it
// arrives as a top-level navigation from facebook.com).
//
// So the mode rides in `state`, which Meta round-trips untouched. That
// is safe because the callback compares the WHOLE state string against
// the value it stashed in an httpOnly cookie — flipping the suffix
// breaks the match and the request is rejected before anything happens.
// ============================================================

import { randomUUID } from 'crypto';

const TAB_SUFFIX = '.tab';

/** True when the client opened this flow in its own tab. */
export function wantsTab(request: Request): boolean {
  return new URL(request.url).searchParams.get('tab') === '1';
}

/** Mint a state nonce that remembers how to answer. */
export function buildOAuthState(tab: boolean): string {
  const nonce = randomUUID();
  return tab ? `${nonce}${TAB_SUFFIX}` : nonce;
}

/** Read the mode back off a state string that has already been verified
 *  against the cookie. */
export function isTabState(state: string): boolean {
  return state.endsWith(TAB_SUFFIX);
}
