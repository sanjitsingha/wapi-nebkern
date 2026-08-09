// ============================================================
// Cookie consent — where the visitor's answer is kept.
//
// A tiny module of its own rather than a `localStorage.getItem` inline
// in the modal, because the *point* of a consent record is that other
// code can ask about it. Anything that wants to set a non-essential
// cookie should call `getCookieConsent()` first, and there should be
// exactly one key to get wrong.
//
// SCOPE, HONESTLY
//
// This records a choice. It does not currently switch anything off,
// because the signed-in app sets no non-essential cookies — the
// analytics that do (GA4, `_ga`) run on the public marketing pages,
// where the visitor is logged out and never sees this modal. Wiring
// the two together means rendering the same prompt on the marketing
// layout and having `analytics.tsx` read this value; see the note in
// `cookie-consent-modal.tsx`.
// ============================================================

export const COOKIE_CONSENT_KEY = 'wacrm:cookie-consent';

export type CookieConsent = 'accepted' | 'declined';

/** The stored choice, or null if they have not been asked yet. */
export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    // Private mode or storage disabled. Treated as "not asked", which
    // means the prompt reappears — annoying, but the alternative is
    // assuming consent from a failed read.
    return null;
  }
}

export function setCookieConsent(value: CookieConsent): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Nothing useful to do: the choice applies to this session and
    // they will be asked again next time.
  }
  for (const fn of listeners) fn();
}

/* ─── Subscription ────────────────────────────────────────────────────
 *
 * localStorage is an external store, so React should read it through
 * `useSyncExternalStore` rather than copying it into state inside an
 * effect. That is what these three exports are for: they turn the key
 * above into something a component can subscribe to, which also means
 * two prompts on screen at once would agree with each other.
 *
 * `storage` events fire only in OTHER tabs, so `setCookieConsent`
 * notifies this tab's listeners itself. */

const listeners = new Set<() => void>();

export function subscribeCookieConsent(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Server snapshot: always "not asked". Nothing renders on the server,
 *  so the client's first read is what decides — and hydration matches
 *  because both sides start from null. */
export function getCookieConsentServer(): CookieConsent | null {
  return null;
}
