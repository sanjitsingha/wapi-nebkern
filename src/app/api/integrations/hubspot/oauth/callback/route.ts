import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { encrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  exchangeHubSpotCode,
  fetchHubSpotUiDomain,
  hubspotRedirectUri,
  introspectHubSpotToken,
  platformHubSpotCredentials,
} from '@/lib/hubspot/client';
import { HUBSPOT_OAUTH_COOKIE_PATH, HUBSPOT_OAUTH_STATE_COOKIE } from '@/lib/hubspot/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { isTabState } from '@/lib/oauth/state';
import { publicOrigin } from '@/lib/public-origin';

/**
 * GET /api/integrations/hubspot/oauth/callback
 *
 * HubSpot sends the browser here after the admin approves. `state`
 * against the httpOnly cookie is the CSRF guard. On success the
 * connection goes live, and everything already in Dripo is queued
 * for HubSpot — sync needs no setting up.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL('/settings/integrations/hubspot', publicOrigin(request));
  const tab = isTabState(url.searchParams.get('state') ?? '');

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) settingsUrl.searchParams.set(`hubspot_${key}`, value);
          }
          return NextResponse.redirect(settingsUrl);
        })();
    res.cookies.delete({ name: HUBSPOT_OAUTH_STATE_COOKIE, path: HUBSPOT_OAUTH_COOKIE_PATH });
    return res;
  }
  const fail = (message: string) => finish({ error: message });

  try {
    const denied = url.searchParams.get('error');
    if (denied) {
      return fail(
        denied === 'access_denied'
          ? 'The connection was cancelled.'
          : url.searchParams.get('error_description') || `HubSpot refused the connection (${denied}).`,
      );
    }

    const expected = request.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${HUBSPOT_OAUTH_STATE_COOKIE}=`))
      ?.slice(HUBSPOT_OAUTH_STATE_COOKIE.length + 1);
    const state = url.searchParams.get('state');
    if (!state || !expected || state !== expected) {
      return fail('That connect link has expired. Start again from Settings.');
    }

    const code = url.searchParams.get('code');
    if (!code) return fail('HubSpot sent no authorization code.');

    const ctx = await requireRole('admin');
    const platform = platformHubSpotCredentials();
    if (!platform) {
      return fail('HubSpot is not configured on this server. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.');
    }

    const db = supabaseAdmin();
    const { data: pending } = await db
      .from('hubspot_connections')
      .select('id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!pending) {
      return fail('That connection was removed while you were at HubSpot. Start again from Settings.');
    }

    const { tokens, error: exchangeError } = await exchangeHubSpotCode({
      code,
      ...platform,
      // Byte-identical to the authorize URL's, or the exchange fails.
      redirectUri: hubspotRedirectUri(publicOrigin(request)),
    });
    if (!tokens) return fail(exchangeError ?? 'Could not complete the connection.');

    // Which portal this is, for Settings and for routing its webhooks.
    // Best effort: the token response already carries the hub id.
    const [about, uiDomain] = await Promise.all([
      introspectHubSpotToken({ accessToken: tokens.accessToken, ...platform }),
      fetchHubSpotUiDomain(tokens.accessToken),
    ]);
    const portalId = tokens.hubId ?? about.hubId ?? null;
    if (!portalId) return fail('HubSpot did not say which account was connected. Try again.');

    const now = new Date().toISOString();
    const { error } = await db
      .from('hubspot_connections')
      .update({
        portal_id: portalId,
        hub_domain: about.hubDomain ?? null,
        ui_domain: uiDomain ?? 'app.hubspot.com',
        access_token: encrypt(tokens.accessToken),
        refresh_token: encrypt(tokens.refreshToken),
        expires_at: tokens.expiresAt,
        scopes: tokens.scopes,
        is_active: true,
        connected_by: ctx.userId,
        connected_at: now,
        // A reconnect switches sync back on, as Zoho's does.
        push_contacts: true,
        push_deals: true,
        deal_pipeline_at: null,
        updated_at: now,
      })
      .eq('account_id', ctx.accountId);
    if (error) {
      console.error('[hubspot/oauth/callback] save failed:', error);
      return fail('Connected to HubSpot, but saving failed. Please retry.');
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'integration',
      targetId: 'hubspot',
      metadata: { portal_id: portalId, hub_domain: about.hubDomain ?? null },
    });

    // Dripo → HubSpot: bring over everything already here. Linked,
    // unchanged records cost the worker a lookup and nothing in HubSpot.
    try {
      await db.rpc('hubspot_backfill', { p_account: ctx.accountId, p_deals: true });
      // And the notes already written on contacts (migration 122).
      await db.rpc('crm_notes_backfill', { p_account: ctx.accountId, p_crm: 'hubspot' });
    } catch {
      // Queued edits still flow; only the catch-up is missed.
    }

    return finish({ connected: '1', org: about.hubDomain ?? 'HubSpot' });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'You must be signed in as an admin to connect HubSpot.');
  }
}
