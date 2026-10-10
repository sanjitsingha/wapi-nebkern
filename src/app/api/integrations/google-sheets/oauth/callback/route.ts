import { NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/billing/admin-client';
import { encrypt } from '@/lib/whatsapp/encryption';
import { logAudit } from '@/lib/audit/log';
import { AUDIT } from '@/lib/audit/events';
import {
  exchangeGoogleCode,
  fetchGoogleEmail,
  googleSheetsClient,
} from '@/lib/google-sheets/client';
import {
  GSHEETS_OAUTH_COOKIE_PATH,
  GSHEETS_OAUTH_STATE_COOKIE,
  gsheetsRedirectUri,
} from '@/lib/google-sheets/oauth-cookie';
import { oauthTabResponse } from '@/lib/oauth/tab-response';
import { isTabState } from '@/lib/oauth/state';

/**
 * GET /api/integrations/google-sheets/oauth/callback
 *
 * Google sends the admin back here. Checks the state cookie, swaps the
 * code for tokens, and stores them encrypted. The connection is active
 * from here, but writes nothing until "Add new sheet" creates the
 * spreadsheet (spreadsheet_id stays null until then).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tab = isTabState(url.searchParams.get('state') ?? '');
  const pageUrl = new URL('/settings/integrations/google-sheets', url.origin);

  function finish(params: Record<string, string | null>): NextResponse {
    const res = tab
      ? oauthTabResponse(params)
      : (() => {
          for (const [key, value] of Object.entries(params)) {
            if (value) pageUrl.searchParams.set(`gsheets_${key}`, value);
          }
          return NextResponse.redirect(pageUrl);
        })();
    res.cookies.delete({ name: GSHEETS_OAUTH_STATE_COOKIE, path: GSHEETS_OAUTH_COOKIE_PATH });
    return res;
  }
  const fail = (message: string) => finish({ error: message });

  try {
    const denied = url.searchParams.get('error');
    if (denied) {
      return fail(
        denied === 'access_denied'
          ? 'The connection was cancelled.'
          : `Google refused the connection (${denied}).`,
      );
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const expectedState =
      cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${GSHEETS_OAUTH_STATE_COOKIE}=`))
        ?.slice(GSHEETS_OAUTH_STATE_COOKIE.length + 1) ?? null;
    const state = url.searchParams.get('state');
    if (!state || !expectedState || state !== expectedState) {
      return fail('That connect link has expired. Start again from Settings.');
    }

    const code = url.searchParams.get('code');
    if (!code) return fail('Google sent no authorization code.');

    // drive.file is the whole point; without it nothing can be written.
    // Google lets the user untick scopes on the consent screen.
    const granted = url.searchParams.get('scope') ?? '';
    if (granted && !granted.includes('auth/drive.file')) {
      return fail(
        'Instant needs permission to create and edit its own Google Sheets. Connect again and leave that box ticked.',
      );
    }

    const ctx = await requireRole('admin');
    const client = googleSheetsClient();
    if (!client) return fail('Google Sheets is not set up on this server yet.');

    const tokens = await exchangeGoogleCode({
      code,
      ...client,
      redirectUri: gsheetsRedirectUri(url.origin),
    });
    if (!tokens.refreshToken) {
      // Google only issues one on a fresh consent; without it the
      // connection would die in an hour.
      return fail(
        'Google did not grant lasting access. Remove Instant from your Google account’s third-party access, then connect again.',
      );
    }
    const email = await fetchGoogleEmail(tokens.accessToken);

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin()
      .from('google_sheets_connections')
      .upsert(
        {
          account_id: ctx.accountId,
          google_email: email,
          access_token: encrypt(tokens.accessToken),
          refresh_token: encrypt(tokens.refreshToken),
          expires_at: new Date(tokens.expiresAt).toISOString(),
          is_active: true,
          connected_by: ctx.userId,
          connected_at: now,
          last_error: null,
          last_error_at: null,
          updated_at: now,
        },
        { onConflict: 'account_id' },
      );
    if (error) {
      console.error('[google-sheets/oauth/callback] save failed:', error);
      return fail('Connected to Google, but saving failed. Please retry.');
    }

    await logAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      action: AUDIT.CHANNEL_CONNECTED,
      targetType: 'integration',
      targetId: 'google-sheets',
      metadata: { google_email: email },
    });

    return finish({ connected: '1', email: email ?? 'Google' });
  } catch (err) {
    return fail(
      err instanceof Error
        ? err.message
        : 'You must be signed in as an admin to connect Google Sheets.',
    );
  }
}
