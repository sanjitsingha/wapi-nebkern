import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireRole } from '@/lib/auth/account';
import {
  exchangeFacebookCode,
  exchangeForLongLivedUserToken,
  getManagedPages,
} from '@/lib/messenger/meta-api';
import { encrypt } from '@/lib/whatsapp/encryption';
import { finalizeMessengerPage } from '@/lib/messenger/server-config';
import { MESSENGER_OAUTH_STATE_COOKIE } from '@/lib/messenger/oauth-cookie';

/**
 * GET /api/messenger/oauth/callback
 *
 * Facebook redirects the browser here after login + consent. This is a
 * top-level navigation back to our own origin, so the caller's normal
 * auth session cookies are present.
 *
 * Flow: code → short-lived user token → long-lived user token → the
 * Pages they manage. Exactly one Page connects immediately; several
 * Pages parks the (encrypted) user token on the row and sends the
 * operator back to Settings to pick one.
 *
 * Always redirects to /settings/messenger with ?fb_connected / ?fb_pick
 * / ?fb_error rather than returning JSON — no XHR caller is waiting.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings/messenger', url.origin);

  function fail(message: string): NextResponse {
    settingsUrl.searchParams.set('fb_error', message);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(MESSENGER_OAUTH_STATE_COOKIE);
    return res;
  }

  const fbError =
    url.searchParams.get('error_description') || url.searchParams.get('error');
  if (fbError) {
    return fail(`Facebook login was not completed: ${fbError}`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return fail('Facebook did not return an authorization code.');
  }

  const cookieState = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith(`${MESSENGER_OAUTH_STATE_COOKIE}=`))
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
    return fail('You must be signed in as an admin to connect Messenger.');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return fail('Facebook Login is not configured on this server.');
  }

  try {
    const redirectUri = `${url.origin}/api/messenger/oauth/callback`;
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

    const pages = await getManagedPages(userAccessToken);
    if (pages.length === 0) {
      return fail(
        'No Facebook Pages found on that account. Create a Page (or ask to be given a Page admin role) and try again.',
      );
    }

    // Park the user token so the picker — and the single-Page finalize
    // below — have something to work from.
    const now = new Date().toISOString();
    const row = {
      user_access_token: encrypt(userAccessToken),
      connect_method: 'oauth' as const,
      status: 'disconnected' as const,
      last_verification_error: null,
      updated_at: now,
    };

    const { data: existing } = await supabase
      .from('messenger_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('messenger_config')
        .update(row)
        .eq('account_id', accountId);
      if (error) {
        console.error('[messenger-oauth] row update failed:', error);
        return fail('Failed to save the connection. Please try again.');
      }
    } else {
      const { error } = await supabase
        .from('messenger_config')
        .insert({ account_id: accountId, created_by: userId, ...row });
      if (error) {
        console.error('[messenger-oauth] row insert failed:', error);
        return fail('Failed to save the connection. Please try again.');
      }
    }

    // Exactly one Page — no reason to make anyone choose.
    if (pages.length === 1) {
      const result = await finalizeMessengerPage({
        supabase,
        accountId,
        page: pages[0],
      });
      if (!result.ok) return fail(result.error);

      settingsUrl.searchParams.set('fb_connected', '1');
      settingsUrl.searchParams.set('fb_page', result.pageName);
      const res = NextResponse.redirect(settingsUrl);
      res.cookies.delete(MESSENGER_OAUTH_STATE_COOKIE);
      return res;
    }

    // Several Pages — let the operator pick in Settings.
    settingsUrl.searchParams.set('fb_pick', '1');
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(MESSENGER_OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[messenger-oauth] callback failed:', message);
    return fail(message);
  }
}
