// ============================================================
// OAuth in a new browser tab.
//
// Meta's login cannot be embedded in a modal or an iframe — every
// facebook.com / instagram.com login page ships `X-Frame-Options: DENY`,
// and Meta treats credential entry inside a third-party frame as a
// phishing surface. So the login gets its own browsing context.
//
// A full tab rather than a small popup window: Facebook's login is not a
// one-screen affair — 2FA, device checkpoints and the "confirm it's you"
// flows all need room, and a cramped window makes them worse. A tab also
// survives popup blockers more often and looks like an ordinary "log in
// with Facebook" hop.
//
// The trade against a same-tab redirect: the settings page keeps its
// state (no remount, no ?query round trip), and a login the user
// abandons costs nothing — we simply never resolve `done`.
//
// Contract with the server side (see tab-response.ts): the callback
// route renders a tiny page that postMessages `{ source, params }` back
// to its opener — and broadcasts the same on a BroadcastChannel named
// OAUTH_MESSAGE_SOURCE — then closes itself.
//
// Why both: a provider page that sends Cross-Origin-Opener-Policy (as
// sign-in pages increasingly do) moves the tab into a new browsing
// context group. From then on `window.opener` is null on the callback
// page AND our handle reports `tab.closed === true` while the login is
// still going on. Trusting either alone meant a successful connect
// read as "cancelled": no toast, dialog unchanged.
// ============================================================

/** Marks a postMessage as ours. Anything else on the bus is ignored. */
export const OAUTH_MESSAGE_SOURCE = 'wacrm-oauth';

export type OAuthTabOutcome =
  /** The callback reported back. `params` is whatever it chose to send. */
  | { status: 'done'; params: Record<string, string> }
  /** The tab closed without reporting — user backed out. */
  | { status: 'cancelled' }
  /** The browser refused to open it at all. */
  | { status: 'blocked' };

export interface OpenOAuthTabOptions {
  /** Tab name. Reusing one name means a second click re-uses the same
   *  tab instead of stacking them. */
  name?: string;
  /** Abandon this attempt: settles as `cancelled` and closes the tab if
   *  it still can. For a fresh click superseding one that never
   *  reported back. */
  signal?: AbortSignal;
}

/**
 * Open `url` in a new tab and resolve once it reports back, is closed,
 * or is blocked.
 *
 * Never rejects — a login the user abandons is an ordinary outcome, not
 * an exception, and callers all want to handle it the same quiet way.
 */
export function openOAuthTab(
  url: string,
  options: OpenOAuthTabOptions = {},
): Promise<OAuthTabOutcome> {
  const { name = 'wacrm-oauth', signal } = options;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ status: 'blocked' });
      return;
    }
    if (signal?.aborted) {
      resolve({ status: 'cancelled' });
      return;
    }

    // No feature string on purpose: passing width/height/popup is
    // exactly what makes a browser render a stripped-down popup window
    // instead of a normal tab.
    const tab = window.open(url, name);
    if (!tab || tab.closed) {
      resolve({ status: 'blocked' });
      return;
    }
    tab.focus();

    let settled = false;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      window.clearInterval(pollId);
      channel?.close();
      signal?.removeEventListener('abort', onAbort);
    }

    function settle(outcome: OAuthTabOutcome) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    }

    function onMessage(event: MessageEvent) {
      // Same-origin only: the callback page runs on our own origin, so
      // anything from elsewhere (including facebook.com's own chatter)
      // has no business being read here.
      if (event.origin !== window.location.origin) return;
      onPayload(event.data);
    }

    function onPayload(raw: unknown) {
      const data = raw as
        | { source?: unknown; params?: unknown }
        | null
        | undefined;
      if (!data || data.source !== OAUTH_MESSAGE_SOURCE) return;

      const params =
        data.params && typeof data.params === 'object'
          ? (data.params as Record<string, string>)
          : {};
      settle({ status: 'done', params });
      try {
        tab?.close();
      } catch {
        // Already gone, or cross-origin at this instant — harmless.
      }
    }

    function onAbort() {
      settle({ status: 'cancelled' });
      try {
        tab?.close();
      } catch {
        // Severed by the provider's COOP — nothing to close from here.
      }
    }

    window.addEventListener('message', onMessage);
    signal?.addEventListener('abort', onAbort);

    // BroadcastChannel is same-origin by construction, so no origin
    // check is needed here.
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(OAUTH_MESSAGE_SOURCE)
        : null;
    if (channel) channel.onmessage = (event) => onPayload(event.data);

    // Cancellation. `tab.closed` cannot be trusted on its own: once the
    // provider's COOP severs the tab it reads true while the user is
    // still signing in. So "closed" only counts as cancelled once the
    // user is back on THIS page (visible and focused) and a grace
    // period has passed with no outcome — long enough for the callback
    // page's message, which is sent just before it closes, to land.
    let backSince: number | null = null;
    const pollId = window.setInterval(() => {
      if (settled) return;
      const back = document.visibilityState === 'visible' && document.hasFocus();
      if (!back) {
        backSince = null;
        return;
      }
      backSince ??= Date.now();
      if (tab.closed && Date.now() - backSince >= 1200) {
        settle({ status: 'cancelled' });
      }
    }, 300);
  });
}
