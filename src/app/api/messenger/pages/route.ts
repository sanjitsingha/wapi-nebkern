import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getManagedPages } from '@/lib/messenger/meta-api';
import { loadMessengerUserToken } from '@/lib/messenger/server-config';

/**
 * GET /api/messenger/pages
 *
 * The Facebook Pages the connecting user manages, for the settings
 * picker. Admin+ only. Returns id + name ONLY — Page access tokens stay
 * server-side and are never sent to the browser.
 *
 * Requires a live "choose a Page" session (the OAuth callback parks a
 * long-lived user token on the row); once a Page is chosen that token is
 * cleared and this returns `expired`.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const userAccessToken = await loadMessengerUserToken(supabase, accountId);
    if (!userAccessToken) {
      return NextResponse.json({
        pages: [],
        expired: true,
        message:
          'Your Facebook login session has expired. Click “Connect with Facebook” to start again.',
      });
    }

    try {
      const pages = await getManagedPages(userAccessToken);
      return NextResponse.json({
        pages: pages.map((p) => ({ id: p.id, name: p.name })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json({
        pages: [],
        expired: true,
        message: `Facebook rejected the session: ${message}`,
      });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
