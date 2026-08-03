import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { buildFacebookAuthorizeUrl } from '@/lib/messenger/meta-api';
import { MESSENGER_OAUTH_STATE_COOKIE } from '@/lib/messenger/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';

/**
 * GET /api/messenger/oauth/start
 *
 * Admin+ only (same tier as connecting/editing messenger_config). Kicks
 * off Facebook Login: stashes a CSRF nonce in a short-lived cookie, then
 * 302s the browser to Facebook's OAuth dialog. No client-side SDK — the
 * Settings button just links here.
 *
 * Reuses the app's existing META_APP_ID / META_APP_SECRET (the same Meta
 * app already used for WhatsApp embedded signup); the Meta app needs the
 * Facebook Login + Messenger products enabled and this callback URL
 * whitelisted.
 */
export async function GET(request: Request) {
  // `?tab=1` — the combined panel (/settings/meta) opens this in a
  // tab, so both the callback AND any refusal here report back
  // through postMessage rather than leaving raw JSON in the window.
  const tab = wantsTab(request);

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

    const redirectUri = `${new URL(request.url).origin}/api/messenger/oauth/callback`;
    const state = buildOAuthState(tab);

    const authorizeUrl = buildFacebookAuthorizeUrl({ appId, redirectUri, state });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(MESSENGER_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — plenty for the login + consent round trip
      path: '/api/messenger/oauth',
    });
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error:
          err instanceof Error
            ? err.message
            : 'You must be signed in as an admin to connect Messenger.',
      });
    }
    return toErrorResponse(err);
  }
}
