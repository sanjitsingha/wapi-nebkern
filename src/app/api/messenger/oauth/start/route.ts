import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { buildFacebookAuthorizeUrl } from '@/lib/messenger/meta-api';
import { MESSENGER_OAUTH_STATE_COOKIE } from '@/lib/messenger/oauth-cookie';

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
  try {
    await requireRole('admin');

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        {
          error:
            'Facebook Login is not configured on this server. Set META_APP_ID and META_APP_SECRET (Meta for Developers → your App → Facebook Login) and restart.',
        },
        { status: 503 },
      );
    }

    const redirectUri = `${new URL(request.url).origin}/api/messenger/oauth/callback`;
    const state = randomUUID();

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
    return toErrorResponse(err);
  }
}
