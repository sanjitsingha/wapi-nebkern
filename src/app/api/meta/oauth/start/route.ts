import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { buildMetaAuthorizeUrl } from '@/lib/meta/connect';
import { META_OAUTH_STATE_COOKIE } from '@/lib/meta/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';

/**
 * GET /api/meta/oauth/start
 *
 * The single button. Admin+ only (same tier as editing either channel's
 * config). Stashes a CSRF nonce in a short-lived cookie, then 302s to
 * Facebook's consent screen asking for Pages *and* Instagram messaging
 * permissions at once — one approval, both inboxes.
 *
 * `?tab=1` (how the settings panel opens it) makes the callback report
 * back through postMessage and close itself instead of redirecting, so
 * the settings page never unmounts. Carried in `state` — see
 * lib/oauth/state.ts for why it can't be a query param on redirect_uri.
 *
 * No plan gate here even though Instagram is a per-plan feature: this
 * flow always delivers Messenger, and the Instagram half is skipped
 * server-side at finalize time for plans that don't include it. Blocking
 * the whole button would take Messenger down with it.
 *
 * Uses the same META_APP_ID / META_APP_SECRET as WhatsApp embedded
 * signup. The Meta app needs Facebook Login, Messenger and Instagram
 * products enabled with this callback URL whitelisted.
 */
export async function GET(request: Request) {
  const tab = wantsTab(request);

  // A tab of its own has no one to show JSON to — an error here has to
  // come back through the same postMessage channel a successful login
  // would use, or the tab just sits there displaying a raw error object.
  function refuse(message: string, status: number): NextResponse {
    return tab
      ? oauthTabResponse({ error: message })
      : NextResponse.json({ error: message }, { status });
  }

  try {
    await requireRole('admin');

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return refuse(
        'Facebook Login is not configured on this server. Set META_APP_ID and META_APP_SECRET (Meta for Developers → your App → Facebook Login) and restart.',
        503,
      );
    }

    const redirectUri = `${new URL(request.url).origin}/api/meta/oauth/callback`;
    const state = buildOAuthState(tab);

    const authorizeUrl = buildMetaAuthorizeUrl({
      appId,
      redirectUri,
      state,
      // Set when the Meta app uses a Facebook Login for Business
      // configuration instead of a raw scope list — see buildMetaAuthorizeUrl.
      configId: process.env.META_LOGIN_CONFIG_ID || null,
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — plenty for the login + consent round trip
      path: '/api/meta/oauth',
    });
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error:
          err instanceof Error
            ? err.message
            : 'You must be signed in as an admin to connect these channels.',
      });
    }
    return toErrorResponse(err);
  }
}
