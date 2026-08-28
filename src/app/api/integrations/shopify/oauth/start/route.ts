import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  buildShopifyAuthorizeUrl,
  normalizeShopDomain,
} from '@/lib/shopify/client';
import {
  SHOPIFY_OAUTH_COOKIE_PATH,
  SHOPIFY_OAUTH_SHOP_COOKIE,
  SHOPIFY_OAUTH_STATE_COOKIE,
} from '@/lib/shopify/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';

/**
 * GET /api/integrations/shopify/oauth/start?shop=<domain>&tab=1
 *
 * Admin+ only. Begins the Shopify install: stashes a CSRF nonce and the
 * store domain in short-lived cookies, then 302s the browser to
 * Shopify's own login + permission screen.
 *
 * The merchant never handles a token. They sign in to Shopify, see what
 * we are asking for, and approve — the callback trades the resulting
 * code for an access token server-side. That is the difference between
 * this and the custom-app flow it replaces, where a shop owner had to
 * create an app in their admin and copy two secrets out of it.
 *
 * `shop` is the one thing we cannot infer: Shopify's authorize endpoint
 * lives on the store's own domain, so we have to know which store
 * before we can send them anywhere.
 */
export async function GET(request: Request) {
  // The settings card opens this in a tab, so refusals have to report
  // back through postMessage rather than leaving raw JSON on screen.
  const tab = wantsTab(request);

  function refuse(message: string, status: number): NextResponse {
    return tab
      ? oauthTabResponse({ error: message })
      : NextResponse.json({ error: message }, { status });
  }

  try {
    await requireRole('admin');

    const url = new URL(request.url);
    const shopDomain = normalizeShopDomain(url.searchParams.get('shop') ?? '');
    if (!shopDomain) {
      return refuse('Enter your store’s .myshopify.com domain.', 400);
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return refuse(
        'Shopify is not configured on this server. Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (partners.shopify.com → your app → Client credentials) and restart.',
        503,
      );
    }

    const redirectUri = `${url.origin}/api/integrations/shopify/oauth/callback`;
    const state = buildOAuthState(tab);

    const response = NextResponse.redirect(
      buildShopifyAuthorizeUrl({ shopDomain, clientId, redirectUri, state }),
    );

    const cookie = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes — ample for a login and a consent click
      path: SHOPIFY_OAUTH_COOKIE_PATH,
    };
    response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, state, cookie);
    // Pinned so the callback installs against the store WE sent them to,
    // not whatever `shop` the returning URL happens to carry.
    response.cookies.set(SHOPIFY_OAUTH_SHOP_COOKIE, shopDomain, cookie);
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error:
          err instanceof Error
            ? err.message
            : 'You must be signed in as an admin to connect Shopify.',
      });
    }
    return toErrorResponse(err);
  }
}
