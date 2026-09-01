import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { decrypt, encrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import { exchangeZohoCode, fetchZohoOrg } from '@/lib/zoho/client';
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

    const accountsUrl = readCookie(ZOHO_OAUTH_REGION_COOKIE);
    if (!accountsUrl) {
      return fail('That connect link has expired. Start again from Settings.');
    }

    const code = url.searchParams.get('code');
    if (!code) return fail('Zoho sent no authorization code.');

    const ctx = await requireRole('admin');

    // The customer's own Zoho application, from the row the connect
    // route wrote before sending them away. Not a platform-wide client
    // in the environment — every account registers its own.
    const db = supabaseAdmin();
    const { data: pending } = await db
      .from('zoho_connections')
      .select('client_id, client_secret, webhook_token')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (!pending?.client_id || !pending?.client_secret) {
      return fail('Add your Zoho client ID and secret first, then connect.');
    }

    let clientSecret: string;
    try {
      clientSecret = decrypt(pending.client_secret as string);
    } catch {
      return fail('Stored Zoho credentials could not be read. Re-enter them.');
    }

    const { tokens, error: exErr } = await exchangeZohoCode({
      code,
      clientId: pending.client_id as string,
      clientSecret,
      redirectUri: `${url.origin}/api/integrations/zoho/oauth/callback`,
      accountsUrl: decodeURIComponent(accountsUrl),
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
      (pending.webhook_token as string) ??
      crypto.randomBytes(24).toString('hex');

    // UPDATE, not upsert: the row already exists — the connect route
    // created it to hold the credentials across the round trip. An
    // upsert would work but would need to restate client_id and
    // client_secret, which is how one of them ends up nulled.
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
