import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import { buildZohoAuthorizeUrl } from '@/lib/zoho/client';
import {
  ZOHO_OAUTH_COOKIE_PATH,
  ZOHO_OAUTH_REGION_COOKIE,
  ZOHO_OAUTH_STATE_COOKIE,
} from '@/lib/zoho/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';

/**
 * GET /api/integrations/zoho/oauth/start?tab=1
 *
 * Admin+ only. Sends the user to Zoho's consent screen.
 *
 * The client id and secret come from the account's own half-made
 * connection row — written by POST /api/integrations/zoho/connect just
 * before this runs — not from the server environment. Every customer
 * registers their own Zoho application, so there is no platform-wide
 * client to fall back on.
 */
export async function GET(request: Request) {
  const tab = wantsTab(request);

  function refuse(message: string, status: number): NextResponse {
    return tab
      ? oauthTabResponse({ error: message })
      : NextResponse.json({ error: message }, { status });
  }

  try {
    const ctx = await requireRole('admin');
    const url = new URL(request.url);

    const { data: conn } = await supabaseAdmin()
      .from('zoho_connections')
      .select('client_id, client_secret, accounts_url')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!conn?.client_id || !conn?.client_secret) {
      return refuse(
        'Add your Zoho client ID and secret first, then connect.',
        400,
      );
    }

    // The secret is not used here — only the id goes on the authorize
    // URL — but decrypting proves it is readable before we send the
    // admin away to Zoho. Failing after the round trip, on the callback,
    // would mean re-doing the consent for nothing.
    try {
      decrypt(conn.client_secret as string);
    } catch {
      return refuse(
        'Stored Zoho credentials could not be read. Re-enter them and try again.',
        500,
      );
    }

    const accountsUrl =
      (conn.accounts_url as string) || 'https://accounts.zoho.com';
    const redirectUri = `${url.origin}/api/integrations/zoho/oauth/callback`;
    const state = buildOAuthState(tab);

    const response = NextResponse.redirect(
      buildZohoAuthorizeUrl({
        clientId: conn.client_id as string,
        redirectUri,
        state,
        accountsUrl,
      }),
    );

    const cookie = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes — ample for a login and a consent click
      path: ZOHO_OAUTH_COOKIE_PATH,
    };
    response.cookies.set(ZOHO_OAUTH_STATE_COOKIE, state, cookie);
    // Pinned, not read back off the callback URL: the token exchange
    // has to hit the same accounts host that served the consent screen.
    response.cookies.set(ZOHO_OAUTH_REGION_COOKIE, accountsUrl, cookie);
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error:
          err instanceof Error
            ? err.message
            : 'You must be signed in as an admin to connect Zoho.',
      });
    }
    return toErrorResponse(err);
  }
}
