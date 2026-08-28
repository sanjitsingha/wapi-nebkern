import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { encrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  createOrderWebhooks,
  deleteWebhooks,
  exchangeShopifyCode,
  normalizeShopDomain,
  verifyShopifyOAuthHmac,
  verifyStore,
} from '@/lib/shopify/client';
import {
  SHOPIFY_OAUTH_COOKIE_PATH,
  SHOPIFY_OAUTH_SHOP_COOKIE,
  SHOPIFY_OAUTH_STATE_COOKIE,
} from '@/lib/shopify/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { isTabState } from '@/lib/oauth/state';

/**
 * GET /api/integrations/shopify/oauth/callback
 *
 * Shopify sends the browser here after the merchant approves (or
 * declines) the install. A top-level navigation back to our own origin,
 * so the normal session cookies ride along and we know who is
 * connecting without a token of our own.
 *
 * Three checks before anything is written, in order:
 *
 *   1. `state` matches the httpOnly cookie the start route set — the
 *      CSRF guard.
 *   2. The query-string HMAC verifies against the app secret, proving
 *      the redirect really came from Shopify.
 *   3. `shop` matches the domain WE pinned at start. Shopify does
 *      round-trip it, but trusting the URL would let a crafted callback
 *      install against a store the admin never chose.
 *
 * Two endings, decided by the state the start route minted: a tab gets
 * a page that postMessages its opener and closes; a plain navigation
 * gets a 302 back to settings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings/integrations', url.origin);

  // Attacker-controlled until `state` is checked, so it decides nothing
  // beyond the shape of an early refusal.
  const tab = isTabState(url.searchParams.get('state') ?? '');

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) settingsUrl.searchParams.set(`shopify_${key}`, value);
          }
          return NextResponse.redirect(settingsUrl);
        })();
    // Deleted WITH the path they were set on. A bare delete targets '/'
    // and silently leaves these behind, so a second install attempt
    // would meet a stale nonce from the first.
    res.cookies.delete({
      name: SHOPIFY_OAUTH_STATE_COOKIE,
      path: SHOPIFY_OAUTH_COOKIE_PATH,
    });
    res.cookies.delete({
      name: SHOPIFY_OAUTH_SHOP_COOKIE,
      path: SHOPIFY_OAUTH_COOKIE_PATH,
    });
    return res;
  }

  const fail = (message: string) => finish({ error: message });

  try {
    // Shopify's own refusal path — merchant hit Cancel.
    const denied = url.searchParams.get('error');
    if (denied) {
      return fail(
        url.searchParams.get('error_description') ??
          'The install was cancelled.',
      );
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const readCookie = (name: string) =>
      cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${name}=`))
        ?.slice(name.length + 1) ?? null;

    // 1. CSRF.
    const state = url.searchParams.get('state');
    const expectedState = readCookie(SHOPIFY_OAUTH_STATE_COOKIE);
    if (!state || !expectedState || state !== expectedState) {
      return fail('That install link has expired. Start again from Settings.');
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return fail('Shopify is not configured on this server.');
    }

    // 2. Did this really come from Shopify?
    if (!verifyShopifyOAuthHmac(url.searchParams, clientSecret)) {
      return fail('That response did not come from Shopify.');
    }

    // 3. Is it the store we sent them to?
    const pinnedShop = readCookie(SHOPIFY_OAUTH_SHOP_COOKIE);
    const returnedShop = normalizeShopDomain(url.searchParams.get('shop') ?? '');
    if (!pinnedShop || !returnedShop || pinnedShop !== returnedShop) {
      return fail('That response was for a different store. Start again.');
    }

    const code = url.searchParams.get('code');
    if (!code) return fail('Shopify sent no authorization code.');

    // Session-bound: this runs as a normal navigation from the admin's
    // own browser, so the same role check the manual flow used applies.
    const ctx = await requireRole('admin');

    const { accessToken, error: exErr } = await exchangeShopifyCode({
      shopDomain: pinnedShop,
      clientId,
      clientSecret,
      code,
    });
    if (!accessToken) return fail(exErr ?? 'Could not complete the install.');

    const creds = { shopDomain: pinnedShop, accessToken };
    const verified = await verifyStore(creds);
    if (!verified.ok) return fail(verified.error ?? 'Could not reach the store.');

    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || url.origin;

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from('shopify_connections')
      .select('webhook_token, wc_webhook_ids')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const token =
      (existing?.webhook_token as string) ??
      crypto.randomBytes(24).toString('hex');
    const deliveryUrl = `${base}/api/integrations/shopify/webhook/${token}`;

    // Reinstalling: drop the old subscriptions before making new ones,
    // or the store fires each order at us twice.
    if (Array.isArray(existing?.wc_webhook_ids) && existing.wc_webhook_ids.length) {
      await deleteWebhooks(creds, existing.wc_webhook_ids as number[]);
    }

    const { ids, error: whErr } = await createOrderWebhooks(creds, deliveryUrl);
    if (whErr) return fail(whErr === 'permission' ? 'The install did not grant order access. Try again.' : whErr);

    const { error } = await db.from('shopify_connections').upsert(
      {
        account_id: ctx.accountId,
        shop_domain: pinnedShop,
        access_token: encrypt(accessToken),
        // Webhooks are signed with the APP's secret, not anything the
        // merchant supplies — under OAuth that is SHOPIFY_CLIENT_SECRET.
        // Storing it per-connection keeps the webhook route unchanged:
        // it still reads `api_secret` off the row and verifies with it,
        // whether the connection was made this way or by pasting a
        // custom app's credentials.
        api_secret: encrypt(clientSecret),
        webhook_token: token,
        wc_webhook_ids: ids,
        is_active: true,
        connected_by: ctx.userId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    );
    if (error) {
      console.error('[shopify/oauth/callback] save failed:', error);
      return fail('Installed on the store, but saving failed. Please retry.');
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'integration',
      targetId: 'shopify',
      metadata: { shop_domain: pinnedShop, via: 'oauth' },
    });

    return finish({ connected: '1', shop: pinnedShop });
  } catch (err) {
    return fail(
      err instanceof Error
        ? err.message
        : 'You must be signed in as an admin to connect Shopify.',
    );
  }
}
