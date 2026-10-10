import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  accountsUrlFromCallback,
  exchangeZohoCode,
  fetchZohoOrg,
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
import { isTabState } from '@/lib/oauth/state';

/**
 * GET /api/integrations/zoho/oauth/callback
 *
 * Zoho sends the browser here after the admin approves. A top-level
 * navigation back to our own origin, so the session cookies ride along
 * and we know who is connecting.
 *
 * Zoho has no query HMAC — unlike Shopify — so `state` against the
 * httpOnly cookie is the whole CSRF guard, and it has to hold.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings/integrations', url.origin);

  const tab = isTabState(url.searchParams.get('state') ?? '');

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) settingsUrl.searchParams.set(`zoho_${key}`, value);
          }
          return NextResponse.redirect(settingsUrl);
        })();
    res.cookies.delete({
      name: ZOHO_OAUTH_STATE_COOKIE,
      path: ZOHO_OAUTH_COOKIE_PATH,
    });
    res.cookies.delete({
      name: ZOHO_OAUTH_REGION_COOKIE,
      path: ZOHO_OAUTH_COOKIE_PATH,
    });
    return res;
  }

  const fail = (message: string) => finish({ error: message });

  try {
    // Zoho's refusal path — admin hit Cancel, or the scopes were denied.
    const denied = url.searchParams.get('error');
    if (denied) {
      return fail(
        denied === 'access_denied'
          ? 'The connection was cancelled.'
          : `Zoho refused the connection (${denied}).`,
      );
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const readCookie = (name: string) =>
      cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${name}=`))
        ?.slice(name.length + 1) ?? null;

    const state = url.searchParams.get('state');
    const expectedState = readCookie(ZOHO_OAUTH_STATE_COOKIE);
    if (!state || !expectedState || state !== expectedState) {
      return fail('That connect link has expired. Start again from Settings.');
    }

    const code = url.searchParams.get('code');
    if (!code) return fail('Zoho sent no authorization code.');

    const ctx = await requireRole('admin');

    const db = supabaseAdmin();
    const { data: pending } = await db
      .from('zoho_connections')
      .select('client_id, client_secret, refresh_token, webhook_token')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    // The start route created this row on the way out. If it is gone,
    // the connection was removed in another tab while this admin was at
    // Zoho's consent screen.
    //
    // Checked rather than tolerated, because the save at the end of
    // this handler is an UPDATE ... WHERE account_id: with no row it
    // matches nothing, returns no error, and this would report a
    // connection that does not exist.
    if (!pending) {
      return fail(
        'That connection was removed while you were at Zoho. Start again from Settings.',
      );
    }

    // Which application minted this code — the account's own, if it
    // connected under the old design, otherwise this deployment's. A
    // refresh token belongs to the client that minted it, so a legacy
    // row must keep going through its own.
    let clientId: string;
    let clientSecret: string;

    // Captured, because the save at the end needs to know which app
    // minted the token it is about to store.
    const legacyApp = usesLegacyZohoApp(pending);

    if (legacyApp) {
      try {
        clientSecret = decrypt(pending.client_secret as string);
      } catch {
        return fail(
          'Stored Zoho credentials could not be read. Disconnect and connect again.',
        );
      }
      clientId = pending.client_id as string;
    } else {
      const platform = platformZohoCredentials();
      if (!platform) {
        return fail(
          'Zoho is not configured on this server. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.',
        );
      }
      clientId = platform.clientId;
      clientSecret = platform.clientSecret;
    }

    // Which data centre to exchange at.
    //
    // A legacy connection pinned this in a cookie at start time, since
    // its client only exists in one DC. The platform app is multi-DC,
    // so the DC is not known until the user has signed in — Zoho names
    // it here, on the way back. accountsUrlFromCallback only ever
    // returns one of our own known hosts, never a URL off the query
    // string; see that function for why that distinction matters.
    const pinned = readCookie(ZOHO_OAUTH_REGION_COOKIE);
    const accountsUrl = pinned
      ? decodeURIComponent(pinned)
      : accountsUrlFromCallback(
          url.searchParams.get('location'),
          url.searchParams.get('accounts-server'),
        );

    const { tokens, error: exErr } = await exchangeZohoCode({
      code,
      clientId,
      clientSecret,
      // Must be byte-identical to the one the authorize URL carried,
      // or Zoho rejects the exchange after the consent is already given.
      redirectUri: zohoRedirectUri(url.origin),
      accountsUrl,
    });
    if (!tokens) return fail(exErr ?? 'Could not complete the connection.');

    // Name the org, so Settings can show WHICH Zoho is connected rather
    // than a bare "Connected". Best effort — a failure here is not worth
    // losing a working connection over.
    const org = await fetchZohoOrg({
      accessToken: tokens.accessToken,
      apiDomain: tokens.apiDomain,
    });

    // Reconnecting keeps the same receiver URL, so the Workflow Rules
    // already configured in Zoho keep working. Minting a new token here
    // would silently break every rule the admin had set up.
    const webhookToken =
      (pending.webhook_token as string | null) ??
      crypto.randomBytes(24).toString('hex');

    // UPDATE, not upsert: the row already exists — the start route
    // created it on the way out, to carry the webhook token across the
    // round trip. An upsert would work but would need to restate
    // client_id and client_secret, which is how a legacy account's own
    // credentials end up nulled and its connection broken.
    const { error } = await db
      .from('zoho_connections')
      .update({
        api_domain: tokens.apiDomain,
        accounts_url: tokens.accountsUrl,
        access_token: encrypt(tokens.accessToken),
        refresh_token: encrypt(tokens.refreshToken!),
        expires_at: tokens.expiresAt,
        webhook_token: webhookToken,
        org_id: org.id ?? null,
        org_name: org.name ?? null,
        is_active: true,
        connected_by: ctx.userId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Clear any leftover per-account credentials when the token we
        // just stored was minted by the PLATFORM app.
        //
        // This is not tidiness. usesLegacyZohoApp asks whether a row has
        // client_id, client_secret AND a refresh token — so a row that
        // still carried stale credentials from an abandoned attempt
        // would, the moment this write gave it a refresh token, start
        // reporting itself as a legacy connection. The next refresh
        // would then present the OLD client against a token the NEW one
        // minted, and Zoho answers invalid_client.
        //
        // Writing NULL makes the row unambiguous: platform token,
        // platform client. A genuine legacy connection takes the branch
        // above and keeps its own, which is why this is conditional.
        ...(legacyApp ? {} : { client_id: null, client_secret: null }),
      })
      .eq('account_id', ctx.accountId);
    if (error) {
      console.error('[zoho/oauth/callback] save failed:', error);
      return fail('Connected to Zoho, but saving failed. Please retry.');
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'integration',
      targetId: 'zoho',
      metadata: { org_name: org.name ?? null, api_domain: tokens.apiDomain },
    });

    return finish({ connected: '1', org: org.name ?? 'Zoho CRM' });
  } catch (err) {
    return fail(
      err instanceof Error
        ? err.message
        : 'You must be signed in as an admin to connect Zoho.',
    );
  }
}
