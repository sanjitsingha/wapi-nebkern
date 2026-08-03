import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireRole } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';
import {
  exchangeFacebookCode,
  exchangeForLongLivedUserToken,
  getMetaAssets,
} from '@/lib/meta/connect';
import { finalizeMetaAsset, parkMetaUserToken } from '@/lib/meta/connect-server';
import { META_OAUTH_STATE_COOKIE } from '@/lib/meta/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { isTabState } from '@/lib/oauth/state';

/**
 * GET /api/meta/oauth/callback
 *
 * Facebook redirects the browser here after consent. A top-level
 * navigation back to our own origin, so the caller's session cookies are
 * present and we know who is connecting without a second token.
 *
 * code → short-lived user token → long-lived user token → the Pages they
 * manage with their linked Instagram accounts. Exactly one Page connects
 * both channels immediately; several parks the (encrypted) user token
 * and sends the operator back to Settings to pick one.
 *
 * Two endings, decided by the `state` the start route minted:
 *   - tab (how Settings opens it) — render a page that postMessages
 *     the outcome to its opener and closes, leaving the settings page
 *     mounted and untouched behind it.
 *   - redirect — 302 to /settings/meta with the same values as query
 *     params. Still the ending for anyone who lands here without a
 *     tab, and the reason the panel keeps reading ?meta_* params.
 *
 * Either way, never JSON: no XHR caller is waiting on this.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings/meta', url.origin);

  // Only trustworthy once `state` has been checked against the cookie;
  // until then this is attacker-controlled, so it decides nothing more
  // than which shape of "no" we return.
  const tab = isTabState(url.searchParams.get('state') ?? '');

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) settingsUrl.searchParams.set(`meta_${key}`, value);
          }
          return NextResponse.redirect(settingsUrl);
        })();
    res.cookies.delete(META_OAUTH_STATE_COOKIE);
    return res;
  }

  function fail(message: string): NextResponse {
    return finish({ error: message });
  }

  const metaError =
    url.searchParams.get('error_description') || url.searchParams.get('error');
  if (metaError) {
    return fail(`Facebook login was not completed: ${metaError}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return fail('Facebook did not return an authorization code.');
  }

  const cookieState = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${META_OAUTH_STATE_COOKIE}=`))
    ?.split('=')[1];
  if (!cookieState || cookieState !== state) {
    return fail('Login session expired or was tampered with. Please try connecting again.');
  }

  let accountId: string;
  let userId: string;
  let supabase: SupabaseClient;
  try {
    const ctx = await requireRole('admin');
    accountId = ctx.accountId;
    userId = ctx.userId;
    supabase = ctx.supabase;
  } catch {
    return fail('You must be signed in as an admin to connect these channels.');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return fail('Facebook Login is not configured on this server.');
  }

  try {
    const redirectUri = `${url.origin}/api/meta/oauth/callback`;
    const shortLivedToken = await exchangeFacebookCode({
      appId,
      appSecret,
      redirectUri,
      code,
    });
    const userAccessToken = await exchangeForLongLivedUserToken({
      appId,
      appSecret,
      shortLivedToken,
    });

    const assets = await getMetaAssets(userAccessToken);
    if (assets.length === 0) {
      return fail(
        'No Facebook Pages found on that account. Create a Page (or ask to be given a Page admin role) and try again — Instagram DMs are reached through the Page your Instagram account is linked to.',
      );
    }

    // Park the session so both the picker and the single-Page finalize
    // below have a token to work from.
    const parked = await parkMetaUserToken({
      supabase,
      accountId,
      userId,
      userAccessToken,
    });
    if (!parked.ok) return fail(parked.error);

    // Several Pages — let the operator choose in Settings.
    if (assets.length > 1) {
      return finish({ pick: '1' });
    }

    const ent = await getAccountEntitlements(supabase, accountId);
    const result = await finalizeMetaAsset({
      supabase,
      accountId,
      userId,
      asset: assets[0],
      allowInstagram: ent.allowInstagram,
    });
    if (!result.ok) return fail(result.error);

    return finish({
      connected: '1',
      page: result.pageName,
      ig: result.instagramUsername ?? null,
      ig_skipped: result.instagramSkipped ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[meta-oauth] callback failed:', message);
    return fail(message);
  }
}
