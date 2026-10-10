import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';
import {
  buildZohoAuthorizeUrl,
  platformZohoCredentials,
  usesLegacyZohoApp,
  zohoRedirectUri,
} from '@/lib/zoho/client';
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
 * This is now the WHOLE of connecting. There is no form in front of it:
 * the client id and secret belong to this deployment (ZOHO_CLIENT_ID /
 * ZOHO_CLIENT_SECRET), and the data centre resolves itself — the
 * consent flow starts at accounts.zoho.com and Zoho forwards the user
 * to their own DC, naming it on the way back.
 *
 * The row is created here rather than by a separate POST, because there
 * is no longer anything for the admin to save before coming.
 *
 * An account that connected under the old per-account design keeps its
 * own credentials: a refresh token can only be refreshed by the client
 * that minted it, so switching those rows to the platform app would
 * break them at the next refresh.
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

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from('zoho_connections')
      .select(
        'client_id, client_secret, refresh_token, accounts_url, webhook_token',
      )
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // A row that genuinely connected under the old design carries its
    // own application; everything else — including a half-made row
    // whose consent was never completed — goes through the platform
    // one. See usesLegacyZohoApp.
    const legacy = usesLegacyZohoApp(existing);

    let clientId: string;
    let accountsUrl: string | undefined;

    // `legacy` being true means usesLegacyZohoApp found all three
    // fields, so `existing` is non-null here; the predicate returns a
    // plain boolean and cannot narrow it for TypeScript.
    if (legacy && existing) {
      // Decrypting proves the secret is readable before we send the
      // admin away. Failing after the round trip, on the callback,
      // would mean re-doing the consent for nothing.
      try {
        decrypt(existing.client_secret as string);
      } catch {
        return refuse(
          'Stored Zoho credentials could not be read. Disconnect and connect again.',
          500,
        );
      }
      clientId = existing.client_id as string;
      // Pinned to the DC that client was registered in — it is not a
      // multi-DC client, so the generic entry point would refuse it.
      accountsUrl = (existing.accounts_url as string) || undefined;
    } else {
      const platform = platformZohoCredentials();
      if (!platform) {
        return refuse(
          'Zoho is not configured on this server. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.',
          503,
        );
      }
      clientId = platform.clientId;
      // Left undefined: buildZohoAuthorizeUrl defaults to
      // accounts.zoho.com, the multi-DC entry point.
      accountsUrl = undefined;
    }

    // The receiver URL has to survive a reconnect — the Workflow Rules
    // already pointed at it in Zoho would otherwise all break.
    const webhookToken =
      (existing?.webhook_token as string) ??
      crypto.randomBytes(24).toString('hex');

    // INSERT, and only when there is no row yet.
    //
    // This was an upsert, which reads more tidily and is wrong here:
    // `INSERT ... ON CONFLICT DO UPDATE` builds the candidate row and
    // enforces its NOT NULL constraints BEFORE it looks for a conflict.
    // So an upsert that omits a NOT NULL column fails even when the row
    // it would have updated already exists — which is precisely what
    // happened against a database still carrying 097's NOT NULL on
    // client_id and client_secret. See migration 108.
    //
    // Nothing needs updating on a reconnect anyway. The only thing this
    // row carries across the round trip is the webhook token, and an
    // existing row already has one. Leaving it untouched also leaves
    // `is_active` alone, so a working connection keeps working until
    // the new consent actually lands, rather than going dark the moment
    // someone opens the dialog and changes their mind.
    if (!existing) {
      const { error: insertError } = await db
        .from('zoho_connections')
        .insert({
          account_id: ctx.accountId,
          webhook_token: webhookToken,
          // The webhook receiver checks this, so a row waiting on
          // consent cannot accept events.
          is_active: false,
        });
      if (insertError) {
        console.error('[zoho/oauth/start] row insert failed:', insertError);
        return refuse(
          'Could not start the connection — the server could not record it. This is a configuration problem, not something retrying will fix; check the server logs.',
          500,
        );
      }
    }

    const redirectUri = zohoRedirectUri(url.origin);
    const state = buildOAuthState(tab);

    const response = NextResponse.redirect(
      buildZohoAuthorizeUrl({ clientId, redirectUri, state, accountsUrl }),
    );

    const cookie = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: 600, // 10 minutes — ample for a login and a consent click
      path: ZOHO_OAUTH_COOKIE_PATH,
    };
    response.cookies.set(ZOHO_OAUTH_STATE_COOKIE, state, cookie);
    // Only set for a legacy connection, where the DC is fixed and known
    // up front. On the platform app the callback decides, because that
    // is the only point at which the user's own DC is known — see
    // accountsUrlFromCallback for why reading it there is safe.
    if (accountsUrl) {
      response.cookies.set(ZOHO_OAUTH_REGION_COOKIE, accountsUrl, cookie);
    }
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
