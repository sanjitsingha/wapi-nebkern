import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { buildInstagramAuthorizeUrl } from '@/lib/instagram/meta-api'
import { INSTAGRAM_OAUTH_STATE_COOKIE } from '@/lib/instagram/oauth-cookie'
import {
  featureBlockedResponse,
  getAccountEntitlements,
} from '@/lib/billing/entitlements'

/**
 * GET /api/instagram/oauth/start
 *
 * Admin+ only (same tier as connecting/editing instagram_config). Kicks
 * off Instagram Business Login: stashes a CSRF nonce in a short-lived
 * cookie, then 302s the browser straight to Instagram's own login
 * page. No client-side JS/SDK involved — the Settings button just
 * links here.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin')

    // Plan gate — the Instagram channel is a per-plan feature (062).
    const ent = await getAccountEntitlements(ctx.supabase, ctx.accountId)
    if (!ent.allowInstagram) return featureBlockedResponse('Instagram DMs')

    const appId = process.env.INSTAGRAM_APP_ID
    if (!appId) {
      return NextResponse.json(
        {
          error:
            'Instagram Login is not configured on this server. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET (Meta for Developers → your App → Instagram → Business Login) and restart.',
        },
        { status: 503 },
      )
    }

    const redirectUri = `${new URL(request.url).origin}/api/instagram/oauth/callback`
    const state = randomUUID()

    const authorizeUrl = buildInstagramAuthorizeUrl({ appId, redirectUri, state })

    const response = NextResponse.redirect(authorizeUrl)
    response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — plenty for the login+consent round trip
      path: '/api/instagram/oauth',
    })
    return response
  } catch (err) {
    return toErrorResponse(err)
  }
}
