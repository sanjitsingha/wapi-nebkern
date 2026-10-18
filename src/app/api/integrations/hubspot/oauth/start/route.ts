import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import {
  buildHubSpotAuthorizeUrl,
  hubspotRedirectUri,
  platformHubSpotCredentials,
} from '@/lib/hubspot/client';
import { HUBSPOT_OAUTH_COOKIE_PATH, HUBSPOT_OAUTH_STATE_COOKIE } from '@/lib/hubspot/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';
import { publicOrigin } from '@/lib/public-origin';

/**
 * GET /api/integrations/hubspot/oauth/start?tab=1
 *
 * Admin+ only. The whole of connecting, as with Zoho: there is nothing
 * to fill in first — the app is Instant's — so this creates the row the
 * callback completes and sends the admin to HubSpot's consent screen.
 */
export async function GET(request: Request) {
  const tab = wantsTab(request);
  const refuse = (message: string, status: number) =>
    tab ? oauthTabResponse({ error: message }) : NextResponse.json({ error: message }, { status });

  try {
    const ctx = await requireRole('admin');

    const platform = platformHubSpotCredentials();
    if (!platform) {
      return refuse(
        'HubSpot is not configured on this server. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.',
        503,
      );
    }

    const db = supabaseAdmin();
    const { data: existing } = await db
      .from('hubspot_connections')
      .select('id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    // Only when there is no row yet: a working connection keeps working
    // until a new consent actually lands.
    if (!existing) {
      const { error } = await db
        .from('hubspot_connections')
        .insert({ account_id: ctx.accountId, is_active: false });
      if (error) {
        console.error('[hubspot/oauth/start] row insert failed:', error);
        return refuse('Could not start the connection. Please try again.', 500);
      }
    }

    const state = buildOAuthState(tab);
    const response = NextResponse.redirect(
      buildHubSpotAuthorizeUrl({
        clientId: platform.clientId,
        redirectUri: hubspotRedirectUri(publicOrigin(request)),
        state,
      }),
    );
    response.cookies.set(HUBSPOT_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: HUBSPOT_OAUTH_COOKIE_PATH,
    });
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error: err instanceof Error ? err.message : 'You must be signed in as an admin to connect HubSpot.',
      });
    }
    return toErrorResponse(err);
  }
}
