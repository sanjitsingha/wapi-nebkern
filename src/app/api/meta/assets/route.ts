import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { getMetaAssets } from '@/lib/meta/connect';
import { loadMetaUserToken } from '@/lib/meta/connect-server';

/**
 * GET /api/meta/assets
 *
 * The Pages the connecting user manages, each with the Instagram account
 * linked to it, for the settings picker. Admin+ only.
 *
 * Ids and names ONLY — Page access tokens stay server-side and are never
 * sent to the browser. Requires a live "choose a Page" session (the OAuth
 * callback parks a long-lived user token); once a Page is chosen that
 * token is cleared and this returns `expired`.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('admin');

    const userAccessToken = await loadMetaUserToken(supabase, accountId);
    if (!userAccessToken) {
      return NextResponse.json({
        assets: [],
        expired: true,
        message:
          'Your Facebook login session has expired. Click “Connect Facebook & Instagram” to start again.',
      });
    }

    try {
      const assets = await getMetaAssets(userAccessToken);
      return NextResponse.json({
        assets: assets.map((a) => ({
          page_id: a.pageId,
          page_name: a.pageName,
          instagram: a.instagram
            ? { id: a.instagram.id, username: a.instagram.username }
            : null,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error';
      return NextResponse.json({
        assets: [],
        expired: true,
        message: `Facebook rejected the session: ${message}`,
      });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
