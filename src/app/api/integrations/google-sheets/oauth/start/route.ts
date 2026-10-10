import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { buildGoogleAuthorizeUrl, googleSheetsClient } from '@/lib/google-sheets/client';
import {
  GSHEETS_OAUTH_COOKIE_PATH,
  GSHEETS_OAUTH_STATE_COOKIE,
  gsheetsRedirectUri,
} from '@/lib/google-sheets/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { buildOAuthState, wantsTab } from '@/lib/oauth/state';

/**
 * GET /api/integrations/google-sheets/oauth/start  (admin+)
 *
 * Sends the admin to Google's consent screen. Opened in a tab (`?tab=1`)
 * by the settings page, the same contract as the Zoho and Meta flows
 * (src/lib/oauth/tab.ts), so a half-filled page survives the round trip.
 */
export async function GET(request: Request) {
  const tab = wantsTab(request);
  const refuse = (message: string, status: number) =>
    tab ? oauthTabResponse({ error: message }) : NextResponse.json({ error: message }, { status });

  try {
    await requireRole('admin');

    const client = googleSheetsClient();
    if (!client) {
      return refuse('Google Sheets is not set up on this server yet.', 503);
    }

    const url = new URL(request.url);
    const state = buildOAuthState(tab);
    const response = NextResponse.redirect(
      buildGoogleAuthorizeUrl({
        clientId: client.clientId,
        redirectUri: gsheetsRedirectUri(url.origin),
        state,
      }),
    );
    response.cookies.set(GSHEETS_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes — ample for a sign-in and a consent click
      path: GSHEETS_OAUTH_COOKIE_PATH,
    });
    return response;
  } catch (err) {
    if (tab) {
      return oauthTabResponse({
        error:
          err instanceof Error
            ? err.message
            : 'You must be signed in as an admin to connect Google Sheets.',
      });
    }
    return toErrorResponse(err);
  }
}
