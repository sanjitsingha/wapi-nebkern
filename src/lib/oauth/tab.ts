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
// to its opener and closes itself.
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
  const { name = 'wacrm-oauth' } = options;

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ status: 'blocked' });
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
    let closedTimer: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      window.clearInterval(pollId);
      if (closedTimer) clearTimeout(closedTimer);
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
      const data = event.data as
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

    window.addEventListener('message', onMessage);

    // `tab.closed` is the only reliable signal that someone closed it:
    // there is no cross-origin unload event to listen for. The grace
    // delay covers the ordinary success path, where the callback page
    // posts its message and closes itself in the same tick — without it
    // we would race our own success and report "cancelled".
    const pollId = window.setInterval(() => {
      if (settled || !tab.closed) return;
      window.clearInterval(pollId);
      closedTimer = setTimeout(() => settle({ status: 'cancelled' }), 600);
    }, 400);
  });
}
